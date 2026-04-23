"""
evaluation/evaluators.py — Phase 2 Week 3

Three evaluator functions plus a pipeline runner.
No FastAPI imports — pure async Python.
"""

from __future__ import annotations

import asyncio
import json
import logging
import math
import string
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

from .models import EvalJob, EvalResult, EvalJobMeta
from execution.llm_service import call_llm

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _normalize(text: str) -> str:
    """Lowercase, strip whitespace, strip punctuation."""
    text = text.lower().strip()
    text = text.translate(str.maketrans("", "", string.punctuation))
    return text


# ---------------------------------------------------------------------------
# 1. exact_match
# ---------------------------------------------------------------------------

async def exact_match(result: EvalResult) -> tuple[bool, float]:
    """
    Compares raw_output to expected_output.
    Normalization: lowercase, strip whitespace, strip punctuation.

    Heuristic task detection:
    - expected_output ≤ 50 chars → classification (exact match)
    - expected_output > 50 chars → QA extractive (substring match)

    Returns (is_correct: bool, score: float) — score is 1.0 or 0.0.
    """
    raw = _normalize(result.raw_output or "")
    expected = _normalize(result.expected_output or "")

    if len(result.expected_output or "") <= 50:
        # Classification: exact match
        is_correct = raw == expected
    else:
        # QA extractive: expected should appear in the output
        is_correct = expected in raw

    return (is_correct, 1.0 if is_correct else 0.0)


# ---------------------------------------------------------------------------
# 2. llm_judge
# ---------------------------------------------------------------------------

_JUDGE_PROMPT = """\
You are an objective evaluator assessing whether an AI response correctly answers a question or task.

Expected output: {expected_output}
Actual output: {raw_output}

Evaluate whether the actual output is correct, equivalent, or acceptable given the expected output.
Consider semantic equivalence, not just exact wording.

Return a JSON object with exactly these keys:
{{
  "is_correct": true | false,
  "score": <float 0.0-1.0>,
  "reasoning": "<one sentence>"
}}

Return only the JSON object. No preamble, no markdown."""


async def llm_judge(result: EvalResult, judge_model: str, api_keys: dict[str, str] = None) -> tuple[bool, float]:
    """
    Uses a separate LLM to judge correctness.
    No shared context with the generator — only expected_output and raw_output passed.
    Returns (is_correct: bool, evaluator_score: float 0.0-1.0).
    """
    prompt = _JUDGE_PROMPT.format(
        expected_output=result.expected_output or "",
        raw_output=result.raw_output or "",
    )

    api_keys = api_keys or {}
    gemini_key = api_keys.get("gemini")
    groq_key = api_keys.get("groq")

    try:
        llm_result = await call_llm(
            rendered_prompt=prompt, 
            model=judge_model,
            gemini_api_key=gemini_key,
            groq_api_key=groq_key
        )
        raw_response = llm_result["response"].strip()
        # Strip markdown fences if present
        if raw_response.startswith("```"):
            raw_response = raw_response.split("```")[1]
            if raw_response.startswith("json"):
                raw_response = raw_response[4:]
        data = json.loads(raw_response)
    except Exception as e:
        logger.warning(f"llm_judge parse failure for result {result.result_id}: {e}")
        return (False, 0.0)

    is_correct = bool(data.get("is_correct", False))
    score = data.get("score")
    if score is None or not isinstance(score, (int, float)):
        score = 1.0 if is_correct else 0.0
    else:
        score = float(score)

    return (is_correct, score)


# ---------------------------------------------------------------------------
# 3. confidence_calibration
# ---------------------------------------------------------------------------

async def confidence_calibration(results: list[EvalResult]) -> dict:
    """
    Computes calibration metrics across a set of results.
    Requires is_correct to be populated on all results.
    Returns calibration metrics dict, or {"error": ..., "min_required": 5} on insufficient data.

    This function is async for pipeline consistency but internally synchronous.
    numpy is used only for Platt Scaling — no sklearn / scipy.
    """
    # Filter to results with both scores
    valid = [
        r for r in results
        if r.is_correct is not None and r.confidence_score is not None
    ]

    if len(valid) < 5:
        return {"error": "insufficient_data", "min_required": 5}

    confidences = [r.confidence_score for r in valid]
    corrects = [1 if r.is_correct else 0 for r in valid]
    n = len(valid)

    # ── Mean Calibration Error (MCE) ─────────────────────────────────────────
    buckets: dict[int, list] = {i: [] for i in range(10)}
    for conf, corr in zip(confidences, corrects):
        bucket_idx = min(int(conf * 10), 9)
        buckets[bucket_idx].append((conf, corr))

    bucket_details = []
    weighted_errors = []
    for i in range(10):
        items = buckets[i]
        if not items:
            continue
        mean_conf = sum(c for c, _ in items) / len(items)
        accuracy = sum(corr for _, corr in items) / len(items)
        error = abs(mean_conf - accuracy)
        weighted_errors.append((error, len(items)))
        bucket_details.append({
            "bucket": f"{i/10:.1f}-{(i+1)/10:.1f}",
            "confidence_mean": mean_conf,
            "accuracy": accuracy,
            "count": len(items),
            "error": error,
        })

    if weighted_errors:
        total_weighted = sum(err * count for err, count in weighted_errors)
        mce = total_weighted / n
    else:
        mce = 0.0

    # ── Overconfidence / Underconfidence rates ────────────────────────────────
    overconfident = sum(
        1 for conf, corr in zip(confidences, corrects)
        if conf > 0.7 and corr == 0
    )
    underconfident = sum(
        1 for conf, corr in zip(confidences, corrects)
        if conf < 0.4 and corr == 1
    )
    overconfidence_rate = overconfident / n
    underconfidence_rate = underconfident / n

    # ── Platt Scaling — gradient descent, numpy only ─────────────────────────
    try:
        import numpy as np
        X = np.array(confidences, dtype=float)
        y = np.array(corrects, dtype=float)

        A = 0.0
        B = 0.0
        lr = 0.01

        for _ in range(50):
            logits = A * X + B
            # Sigmoid
            probs = 1.0 / (1.0 + np.exp(-logits))
            error = probs - y
            grad_A = float(np.mean(error * X))
            grad_B = float(np.mean(error))
            A -= lr * grad_A
            B -= lr * grad_B

        calibrated_logits = A * X + B
        platt_calibrated = (1.0 / (1.0 + np.exp(-calibrated_logits))).tolist()
    except ImportError:
        # numpy not available — fall back to identity
        logger.warning("numpy not available; Platt Scaling will use raw confidences")
        A, B = 1.0, 0.0
        platt_calibrated = confidences

    return {
        "mce": mce,
        "overconfidence_rate": overconfidence_rate,
        "underconfidence_rate": underconfidence_rate,
        "platt_A": float(A),
        "platt_B": float(B),
        "platt_calibrated_scores": platt_calibrated,
        "n_samples": n,
        "bucket_details": bucket_details,
    }


# ---------------------------------------------------------------------------
# 4. run_evaluators — pipeline runner
# ---------------------------------------------------------------------------

DEFAULT_JUDGE_MODEL = "openai/gpt-oss-120b"


async def run_evaluators(
    job: EvalJob,
    results: list[EvalResult],
    db: "AsyncSession",
    api_keys: dict[str, str] = None,
) -> None:
    """
    Pipeline runner. Executes evaluators in order, updates EvalResult rows.
    Order: exact_match → llm_judge → confidence_calibration

    Args:
        job: The EvalJob (must have .evaluators populated).
        results: In-memory EvalResult objects — not re-fetched from DB.
        db: Async database session.
    """
    evaluators = list(job.evaluators or [])

    # Guard: confidence_calibration without a scoring evaluator
    has_scoring = "exact_match" in evaluators or "llm_judge" in evaluators
    if "confidence_calibration" in evaluators and not has_scoring:
        # Check if scores are already populated
        all_scored = all(r.is_correct is not None for r in results)
        if not all_scored:
            raise ValueError(
                "confidence_calibration requires a scoring evaluator "
                "(exact_match or llm_judge) or pre-populated is_correct values"
            )

    # ── exact_match pass ─────────────────────────────────────────────────────
    if "exact_match" in evaluators:
        for result in results:
            is_correct, score = await exact_match(result)
            result.is_correct = is_correct
            result.evaluator_score = score
        await db.commit()
        logger.info(f"Job {job.job_id}: exact_match pass complete")

    # ── llm_judge pass ───────────────────────────────────────────────────────
    if "llm_judge" in evaluators:
        judge_model = DEFAULT_JUDGE_MODEL
        for i, result in enumerate(results):
            is_correct, score = await llm_judge(result, judge_model, api_keys)
            result.is_correct = is_correct
            result.evaluator_score = score
            if i < len(results) - 1:
                await asyncio.sleep(1)
        await db.commit()
        logger.info(f"Job {job.job_id}: llm_judge pass complete")

    # ── confidence_calibration pass ──────────────────────────────────────────
    if "confidence_calibration" in evaluators:
        metrics = await confidence_calibration(results)

        # Upsert EvalJobMeta
        from sqlalchemy import select as sa_select
        from datetime import datetime as dt

        stmt = sa_select(EvalJobMeta).where(EvalJobMeta.job_id == job.job_id)
        existing_meta = (await db.execute(stmt)).scalar_one_or_none()

        if existing_meta:
            existing_meta.calibration_metrics = metrics
            existing_meta.updated_at = dt.utcnow()
        else:
            meta = EvalJobMeta(
                job_id=job.job_id,
                calibration_metrics=metrics,
            )
            db.add(meta)

        await db.commit()
        logger.info(f"Job {job.job_id}: confidence_calibration pass complete")
