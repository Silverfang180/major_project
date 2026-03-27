"""
evaluation/metrics.py — Phase 2 Week 4

Aggregation: compute_summary builds an EvalSummary from EvalResult rows.
Pareto analysis: compute_pareto_frontier and identify_knee_point are
pure-Python functions — no DB calls, no async.

NOTE: cost_per_correct is the Pareto x-axis. If all provider pricing
returns 0.0 (placeholder), cost_per_correct will be 0.0 for every job
and the frontier will be degenerate (all jobs at x=0). This is acceptable
until real pricing data is wired in.
"""

from __future__ import annotations

import logging
import math
import statistics
from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import select

from .models import EvalJob, EvalJobMeta, EvalResult, EvalSummary, JobStatus

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def compute_summary(job_id: UUID, db: "AsyncSession") -> EvalSummary:
    """
    Aggregates eval_results for a job into an EvalSummary.
    Fetches job, results, job meta, and prompt version model.
    Upserts into eval_summaries (update if exists, insert if not).
    Returns the EvalSummary object.
    """
    # 1. Fetch job
    job = await db.get(EvalJob, job_id)
    if not job:
        raise ValueError(f"EvalJob {job_id} not found")
    if job.status != JobStatus.completed:
        raise ValueError(
            f"EvalJob {job_id} is not completed (status={job.status.value})"
        )

    # 2. Fetch all results for the job
    stmt = select(EvalResult).where(EvalResult.job_id == job_id)
    result = await db.execute(stmt)
    results = list(result.scalars().all())

    # 3. Fetch PromptVersion to get model name
    from version_control.models import PromptVersion

    version = await db.get(PromptVersion, job.version_id)
    model_name: str = ""
    if version and version.model_settings:
        model_name = version.model_settings.get("model") or ""

    # 4. Compute metrics in Python (explicit, not SQL)
    total_examples = len(results)

    scored_results = [r for r in results if r.is_correct is not None]
    scored_examples = len(scored_results)

    correct_count = sum(1 for r in scored_results if r.is_correct is True)

    accuracy: float | None = None
    if scored_examples > 0:
        accuracy = correct_count / scored_examples

    evaluator_scores = [r.evaluator_score for r in results if r.evaluator_score is not None]
    mean_evaluator_score: float | None = (
        sum(evaluator_scores) / len(evaluator_scores) if evaluator_scores else None
    )

    cost_values = [r.cost_usd for r in results if r.cost_usd is not None]
    total_cost_usd: float | None = sum(cost_values) if cost_values else None
    mean_cost_per_run: float | None = (
        total_cost_usd / total_examples if (total_cost_usd is not None and total_examples > 0) else None
    )
    cost_per_correct: float | None = (
        total_cost_usd / correct_count if (total_cost_usd is not None and correct_count > 0) else None
    )

    latency_values = [r.latency_ms for r in results if r.latency_ms is not None]
    mean_latency_ms: float | None = (
        sum(latency_values) / len(latency_values) if latency_values else None
    )
    p50_latency_ms: float | None = None
    p95_latency_ms: float | None = None
    if latency_values:
        sorted_lat = sorted(latency_values)
        p50_latency_ms = float(statistics.median(sorted_lat))
        n = len(sorted_lat)
        p95_idx = int(0.95 * n)
        # Clamp index to valid range
        p95_idx = min(p95_idx, n - 1)
        p95_latency_ms = float(sorted_lat[p95_idx])

    # 5. Fetch calibration from EvalJobMeta
    mce: float | None = None
    overconfidence_rate: float | None = None
    underconfidence_rate: float | None = None

    stmt_meta = select(EvalJobMeta).where(EvalJobMeta.job_id == job_id)
    meta_result = await db.execute(stmt_meta)
    job_meta = meta_result.scalar_one_or_none()
    if job_meta and job_meta.calibration_metrics:
        cm = job_meta.calibration_metrics
        mce = cm.get("mce")
        overconfidence_rate = cm.get("overconfidence_rate")
        underconfidence_rate = cm.get("underconfidence_rate")

    # 6. Upsert EvalSummary
    stmt_existing = select(EvalSummary).where(EvalSummary.job_id == job_id)
    existing = (await db.execute(stmt_existing)).scalar_one_or_none()

    if existing:
        existing.prompt_id = job.prompt_id
        existing.version_id = job.version_id
        existing.dataset_id = job.dataset_id
        existing.model = model_name
        existing.total_examples = total_examples
        existing.scored_examples = scored_examples
        existing.accuracy = accuracy
        existing.mean_evaluator_score = mean_evaluator_score
        existing.total_cost_usd = total_cost_usd
        existing.mean_cost_per_run = mean_cost_per_run
        existing.cost_per_correct = cost_per_correct
        existing.mean_latency_ms = mean_latency_ms
        existing.p50_latency_ms = p50_latency_ms
        existing.p95_latency_ms = p95_latency_ms
        existing.mce = mce
        existing.overconfidence_rate = overconfidence_rate
        existing.underconfidence_rate = underconfidence_rate
        existing.computed_at = datetime.utcnow()
        summary = existing
    else:
        summary = EvalSummary(
            job_id=job_id,
            prompt_id=job.prompt_id,
            version_id=job.version_id,
            dataset_id=job.dataset_id,
            model=model_name,
            total_examples=total_examples,
            scored_examples=scored_examples,
            accuracy=accuracy,
            mean_evaluator_score=mean_evaluator_score,
            total_cost_usd=total_cost_usd,
            mean_cost_per_run=mean_cost_per_run,
            cost_per_correct=cost_per_correct,
            mean_latency_ms=mean_latency_ms,
            p50_latency_ms=p50_latency_ms,
            p95_latency_ms=p95_latency_ms,
            mce=mce,
            overconfidence_rate=overconfidence_rate,
            underconfidence_rate=underconfidence_rate,
        )
        db.add(summary)

    await db.commit()
    await db.refresh(summary)
    return summary


def compute_pareto_frontier(summaries: list[EvalSummary], dimension: str = "cost") -> list[dict]:
    """
    Computes the Pareto frontier on two dimensions:
      x: cost_per_correct or p50_latency_ms (lower is better)
      y: accuracy (higher is better)

    A summary is Pareto-optimal if no other summary is both
    cheaper (lower cost_per_correct) AND more accurate (higher accuracy).

    Returns list of dicts with all summary fields plus:
      - is_pareto_optimal: bool
      - dominates: list of job_id strings this summary dominates
      - dominated_by: list of job_id strings that dominate this summary
    """
    x_key = "cost_per_correct" if dimension == "cost" else "p50_latency_ms"
    
    # Separate placeable vs unplaceable (missing either axis value)
    placeable = [s for s in summaries if getattr(s, x_key) is not None and s.accuracy is not None]
    unplaceable = [s for s in summaries if getattr(s, x_key) is None or s.accuracy is None]

    # Build dicts for all summaries
    def _to_dict(s: EvalSummary) -> dict:
        return {
            "summary_id": str(s.summary_id),
            "job_id": str(s.job_id),
            "prompt_id": str(s.prompt_id),
            "version_id": s.version_id,
            "dataset_id": str(s.dataset_id),
            "model": s.model,
            "total_examples": s.total_examples,
            "scored_examples": s.scored_examples,
            "accuracy": s.accuracy,
            "mean_evaluator_score": s.mean_evaluator_score,
            "total_cost_usd": s.total_cost_usd,
            "mean_cost_per_run": s.mean_cost_per_run,
            "cost_per_correct": s.cost_per_correct,
            "mean_latency_ms": s.mean_latency_ms,
            "p50_latency_ms": s.p50_latency_ms,
            "p95_latency_ms": s.p95_latency_ms,
            "mce": s.mce,
            "overconfidence_rate": s.overconfidence_rate,
            "underconfidence_rate": s.underconfidence_rate,
            "computed_at": s.computed_at.isoformat() if s.computed_at else None,
            "is_pareto_optimal": False,
            "dominates": [],
            "dominated_by": [],
        }

    placeable_dicts = [_to_dict(s) for s in placeable]
    unplaceable_dicts = [_to_dict(s) for s in unplaceable]

    # Compute dominance relationships among placeable summaries
    for i, candidate in enumerate(placeable_dicts):
        for j, other in enumerate(placeable_dicts):
            if i == j:
                continue
            # other dominates candidate if other is cheaper/faster or equally cheap/faster AND more accurate or equally accurate (strictly better in at least one)
            if (other[x_key] <= candidate[x_key]
                    and other["accuracy"] >= candidate["accuracy"]
                    and (other[x_key] < candidate[x_key] or other["accuracy"] > candidate["accuracy"])):
                candidate["dominated_by"].append(other["job_id"])
                other["dominates"].append(candidate["job_id"])

    # Mark Pareto-optimal: not dominated by anyone, and accuracy > 0.0
    for d in placeable_dicts:
        if d["accuracy"] == 0.0:
            d["is_pareto_optimal"] = False
        else:
            d["is_pareto_optimal"] = len(d["dominated_by"]) == 0

    # Remove duplicate job_ids in dominates/dominated_by lists (can accumulate from two loops)
    for d in placeable_dicts:
        d["dominates"] = list(dict.fromkeys(d["dominates"]))
        d["dominated_by"] = list(dict.fromkeys(d["dominated_by"]))

    # Sort: Pareto-optimal first (accuracy DESC), then dominated (accuracy DESC)
    pareto_optimal = sorted(
        [d for d in placeable_dicts if d["is_pareto_optimal"]],
        key=lambda x: x["accuracy"],
        reverse=True,
    )
    dominated = sorted(
        [d for d in placeable_dicts if not d["is_pareto_optimal"]],
        key=lambda x: x["accuracy"],
        reverse=True,
    )

    return pareto_optimal + dominated + unplaceable_dicts


def identify_knee_point(pareto_results: list[dict], dimension: str = "cost") -> dict | None:
    """
    Identifies the 'knee point' — the Pareto-optimal summary with the
    best balance between cost/latency and accuracy.
    """
    x_key = "cost_per_correct" if dimension == "cost" else "p50_latency_ms"
    frontier = [d for d in pareto_results if d.get("is_pareto_optimal")]
    if len(frontier) < 3:
        return None

    # Sort by cost/latency ascending so the first is cheapest/fastest and last is most expensive/slowest
    frontier_sorted = sorted(frontier, key=lambda d: d[x_key])

    costs = [d[x_key] for d in frontier_sorted]
    accuracies = [d["accuracy"] for d in frontier_sorted]
    # ... rest of the logic uses x1, x2 which are normalized ...
    n = len(frontier_sorted)

    # Normalize to [0, 1]
    min_cost, max_cost = min(costs), max(costs)
    min_acc, max_acc = min(accuracies), max(accuracies)

    cost_range = max_cost - min_cost
    acc_range = max_acc - min_acc

    # Avoid division by zero if all points are identical on one axis
    if cost_range == 0 or acc_range == 0:
        return None

    def _nc(c: float) -> float:
        return (c - min_cost) / cost_range

    def _na(a: float) -> float:
        return (a - min_acc) / acc_range

    # The reference line: from the lowest-cost point to the highest-accuracy point.
    # In normalized space, find which point has the lowest cost (x1,y1) and which
    # has the highest accuracy (x2,y2). These may not be (0,0) and (1,1).
    # We define: A = the cheapest (lowest cost_per_correct) point
    #            B = the most accurate (highest accuracy) point
    # For a well-formed Pareto frontier, A has low cost/low acc and B has high acc/high cost.
    a_pt = frontier_sorted[0]   # cheapest
    b_pt = max(frontier_sorted, key=lambda d: d["accuracy"])  # most accurate

    x1, y1 = _nc(a_pt[x_key]), _na(a_pt["accuracy"])
    x2, y2 = _nc(b_pt[x_key]), _na(b_pt["accuracy"])

    # Direction vector of the line (x2-x1, y2-y1), length
    dx = x2 - x1
    dy = y2 - y1
    line_len = math.sqrt(dx * dx + dy * dy)
    if line_len == 0:
        return None

    # Perpendicular distance from point (px, py) to line through (x1,y1)→(x2,y2):
    # dist = |dy*(px-x1) - dx*(py-y1)| / line_len
    max_dist = -1.0
    knee = None
    for d in frontier_sorted:
        px = _nc(d[x_key])
        py = _na(d["accuracy"])
        dist = abs(dy * (px - x1) - dx * (py - y1)) / line_len
        if dist > max_dist:
            max_dist = dist
            knee = d

    if knee is not None:
        knee = dict(knee)
        knee["is_knee_point"] = True

    return knee


def generate_recommendation(
    frontier: list[dict],
    knee_point: dict | None,
    dimension: str = "cost"
) -> str:
    """
    Generates a plain English recommendation based on Pareto results.
    Pure function — no DB calls.
    """
    x_key = "cost_per_correct" if dimension == "cost" else "p50_latency_ms"
    dim_name = "cost" if dimension == "cost" else "latency"
    dim_unit = "$/correct" if dimension == "cost" else "ms"

    if not frontier:
        return f"Insufficient data to make a recommendation. Run eval jobs and ensure evaluators populate is_correct."

    if len(frontier) == 1:
        return "Only one version evaluated. Add more prompt versions or models to enable comparison."
    
    pareto_points = [p for p in frontier if p.get("is_pareto_optimal")]

    if len(pareto_points) == 1:
        best = pareto_points[0]
        return f"Version {best['version_id']} on {best['model']} dominates all others — highest accuracy at lowest {dim_name}. Deploy it."

    if knee_point is not None:
        top_acc_pt = max(pareto_points, key=lambda d: d.get("accuracy") or 0.0)

        knee_acc = knee_point.get("accuracy") or 0.0
        knee_val = knee_point.get(x_key) or 0.0
        
        top_acc = top_acc_pt.get("accuracy") or 0.0
        top_val = top_acc_pt.get(x_key) or 0.0
        
        if top_val == 0.0 or knee_val == 0.0:
            val_delta = 1.0
        else:
            val_delta = round(top_val / knee_val, 1)

        return f"Version {knee_point['version_id']} on {knee_point['model']} offers the best {dim_name}-accuracy balance (knee point). Recommended for production unless accuracy above {knee_acc:.0%} is required, in which case Version {top_acc_pt['version_id']} achieves {top_acc:.0%} at {val_delta}x the {dim_name}."

    if len(pareto_points) == 2:
        p1, p2 = pareto_points
        if (p1.get("accuracy") or 0.0) > (p2.get("accuracy") or 0.0):
            high_acc, low_val = p1, p2
        else:
            high_acc, low_val = p2, p1

        acc1 = high_acc.get("accuracy") or 0.0
        val2 = low_val.get(x_key) or 0.0
        return f"Two viable options: version {high_acc['version_id']} maximises accuracy ({acc1:.0%}), version {low_val['version_id']} minimises {dim_name} ({val2:.1f}{dim_unit}). Choose based on your constraint."

    return "Insufficient data to make a recommendation. Run eval jobs and ensure evaluators populate is_correct."

