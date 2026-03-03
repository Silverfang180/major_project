"""
Validator — runs the LLM validator model against a generated example.
Decoupled from generator: generator imports this, not the other way around.
"""

from __future__ import annotations

import json
import logging

from execution.llm_service import call_llm
from synthetic.config import SyntheticConfig
from synthetic.diversity import is_too_similar
from synthetic.prompts import (
    CLASSIFICATION_VALIDATOR_PROMPT,
    QA_VALIDATOR_PROMPT,
)

logger = logging.getLogger(__name__)


async def validate_example(
    example: dict,
    config: SyntheticConfig,
    existing_inputs: list[str],
) -> tuple[bool, dict]:
    """
    Validate a generated example through two checks:
      1. Diversity: reject without LLM call if too similar to existing inputs.
      2. LLM validation: call the validator model with the appropriate prompt.

    Returns (passes: bool, validation_result: dict).
    """
    # ── 1. Diversity check ───────────────────────────────────────────────────
    if config.generation.diversity.enforce:
        candidate_text = _candidate_text(example, config.dataset.task_type)
        if is_too_similar(
            candidate_text,
            existing_inputs,
            config.generation.diversity.min_word_overlap_threshold,
        ):
            logger.debug("Example rejected by diversity check")
            return False, {"error": "diversity_rejected"}

    # ── 2. LLM validation ────────────────────────────────────────────────────
    criteria_text = "\n".join(
        f"- {c}" for c in config.validation.criteria
    )

    if config.dataset.task_type == "classification":
        prompt = CLASSIFICATION_VALIDATOR_PROMPT.format(
            topic=config.domain.topic,
            labels=", ".join(config.domain.labels or []),
            input_text=example.get("input_text", ""),
            expected_label=example.get("expected_label", ""),
            difficulty_level=example.get("difficulty", ""),
            difficulty_definition=_difficulty_definition(
                example.get("difficulty", ""), config
            ),
            edge_case_type=example.get("edge_case_type") or "none",
            criteria=criteria_text,
        )
    else:
        prompt = QA_VALIDATOR_PROMPT.format(
            topic=config.domain.topic,
            answer_type=config.domain.answer_type or "extractive",
            context=example.get("context", ""),
            question=example.get("question", ""),
            expected_answer=example.get("expected_answer", ""),
            answer_span=example.get("answer_span") or "N/A",
            difficulty_level=example.get("difficulty", ""),
            difficulty_definition=_difficulty_definition(
                example.get("difficulty", ""), config
            ),
            edge_case_type=example.get("edge_case_type") or "none",
            criteria=criteria_text,
        )

    try:
        llm_result = await call_llm(
            rendered_prompt=prompt,
            model=config.models.validator,
        )
        raw = llm_result["response"].strip()

        # Strip markdown code fences if present
        if raw.startswith("```"):
            lines = raw.split("\n")
            # Remove first line (```json or ```) and last line (```)
            raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

        # Extract just the JSON object (from first { to last })
        start = raw.find("{")
        end = raw.rfind("}")
        if start != -1 and end != -1:
            raw = raw[start:end + 1]

        # Remove single-line // comments that LLMs sometimes emit
        import re as _re
        raw = _re.sub(r"\s*//[^\n]*", "", raw)

        validation = json.loads(raw)
    except (json.JSONDecodeError, KeyError, Exception) as e:
        logger.warning(f"Validator response parse failed: {e}")
        return False, {"error": "parse_failed"}

    passes = bool(validation.get("passes", False))
    confidence = float(validation.get("confidence", 0.0))

    if confidence < config.validation.rejection_threshold:
        passes = False

    return passes, validation


# ── Helpers ──────────────────────────────────────────────────────────────────

def _candidate_text(example: dict, task_type: str) -> str:
    """Return the primary text to check for diversity."""
    if task_type == "classification":
        return example.get("input_text", "")
    # QA: combine context + question
    return f"{example.get('context', '')} {example.get('question', '')}".strip()


def _difficulty_definition(difficulty: str, config: SyntheticConfig) -> str:
    """Look up the difficulty definition from config."""
    mapping = {
        "easy": config.generation.difficulty.easy.definition,
        "medium": config.generation.difficulty.medium.definition,
        "hard": config.generation.difficulty.hard.definition,
    }
    return mapping.get(difficulty, "")
