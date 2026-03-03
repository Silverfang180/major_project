"""
Generator — the core two-model pipeline for synthetic dataset generation.

Calls:
  1. Generator LLM to produce an example.
  2. Validator (via synthetic.validator) to accept or reject it.

Decoupled from any CLI concern — progress is communicated via an optional
on_progress callback.
"""

from __future__ import annotations

import asyncio
import json
import logging
import math
from typing import Callable, Optional

from execution.llm_service import call_llm
from synthetic.config import SyntheticConfig
from synthetic.prompts import (
    CLASSIFICATION_GENERATOR_PROMPT,
    QA_GENERATOR_PROMPT,
    TOPIC_VARIANTS_PROMPT,
)
from synthetic.validator import validate_example

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def generate_dataset(
    config: SyntheticConfig,
    on_progress: Optional[Callable[[str, bool], None]] = None,
) -> list[dict]:
    """
    Run the full generation pipeline.

    Args:
        config: Validated SyntheticConfig.
        on_progress: Optional callback(source_tag, accepted) called after each
                     example is accepted or rejected. Enables live progress bars.

    Returns:
        List of accepted example dicts with keys:
        ``input_vars``, ``expected_output``, ``source_tag``.
    """
    size = config.generation.size
    task_type = config.dataset.task_type

    # ── 1. Compute per-difficulty target counts ───────────────────────────────
    diff = config.generation.difficulty
    targets = _compute_targets(
        size,
        {"easy": diff.easy.ratio, "medium": diff.medium.ratio, "hard": diff.hard.ratio},
    )
    logger.info(f"Targets — {targets}")

    # ── 2. Compute edge case assignments ─────────────────────────────────────
    edge_count = int(size * config.generation.edge_cases.ratio)
    edge_types = config.generation.edge_cases.types
    edge_assignments = _assign_edge_cases(targets, edge_count, edge_types)
    logger.info(f"Edge case assignments: {sum(len(v) for v in edge_assignments.values())} total")

    # ── 3. Generate topic variants upfront ───────────────────────────────────
    n_variants = config.generation.diversity.required_topic_variants
    topic_variants = await _fetch_topic_variants(config, n_variants)
    logger.info(f"Topic variants: {topic_variants}")

    # ── 4. Main generation loop ───────────────────────────────────────────────
    accepted: list[dict] = []
    existing_inputs: list[str] = []
    stats = {"attempted": 0, "accepted": 0, "rejected": 0, "skipped": 0}
    variant_idx = 0

    for difficulty_level in ("easy", "medium", "hard"):
        level_config = getattr(config.generation.difficulty, difficulty_level)
        ec_list = list(edge_assignments[difficulty_level])  # copy so we can pop

        for slot_idx in range(targets[difficulty_level]):
            edge_case_type = ec_list.pop(0) if ec_list else None
            topic_variant = topic_variants[variant_idx % len(topic_variants)]
            variant_idx += 1

            source_tag = f"synthetic-{difficulty_level}-{edge_case_type or 'standard'}"

            example_accepted = False
            for attempt in range(config.validation.max_regeneration_attempts):
                stats["attempted"] += 1

                # Build and call generator
                generated = await _call_generator(
                    config, difficulty_level, level_config.definition,
                    edge_case_type, topic_variant,
                )
                await asyncio.sleep(config.models.delay_seconds)

                if generated is None:
                    logger.warning(
                        f"{difficulty_level}[{slot_idx}] attempt {attempt+1}: "
                        "generator parse failed"
                    )
                    continue

                # Validate
                passes, val_result = await validate_example(
                    generated, config, existing_inputs
                )
                await asyncio.sleep(config.models.delay_seconds)

                if passes:
                    example_dict = _to_example_dict(generated, task_type, source_tag)
                    accepted.append(example_dict)
                    existing_inputs.append(_primary_text(generated, task_type))
                    stats["accepted"] += 1
                    example_accepted = True
                    if on_progress:
                        on_progress(source_tag, True)
                    break
                else:
                    stats["rejected"] += 1
                    reason = val_result.get("error") or val_result.get("reasoning", "unknown")
                    logger.debug(
                        f"{difficulty_level}[{slot_idx}] attempt {attempt+1} rejected: {reason}"
                    )

            if not example_accepted:
                stats["skipped"] += 1
                logger.warning(
                    f"{difficulty_level}[{slot_idx}]: all {config.validation.max_regeneration_attempts} "
                    "attempts exhausted — skipping (not padding)"
                )
                if on_progress:
                    on_progress(source_tag, False)

    logger.info(
        f"Generation complete — attempted={stats['attempted']} "
        f"accepted={stats['accepted']} rejected={stats['rejected']} "
        f"skipped={stats['skipped']}"
    )
    return accepted


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _compute_targets(size: int, ratios: dict[str, float]) -> dict[str, int]:
    """Distribute `size` across difficulty levels; last bucket absorbs rounding."""
    levels = list(ratios.keys())
    counts: dict[str, int] = {}
    assigned = 0
    for i, level in enumerate(levels):
        if i == len(levels) - 1:
            counts[level] = size - assigned
        else:
            counts[level] = math.floor(size * ratios[level])
            assigned += counts[level]
    return counts


def _assign_edge_cases(
    targets: dict[str, int],
    edge_count: int,
    edge_types: list[str],
) -> dict[str, list[str]]:
    """
    Assign edge case types to slots, starting with hard, then medium, then easy.
    Round-robins through the edge_types list.
    """
    assignments: dict[str, list[str]] = {"easy": [], "medium": [], "hard": []}
    remaining = edge_count
    ec_idx = 0

    for level in ("hard", "medium", "easy"):
        cap = targets[level]
        while remaining > 0 and len(assignments[level]) < cap:
            assignments[level].append(edge_types[ec_idx % len(edge_types)])
            ec_idx += 1
            remaining -= 1

    return assignments


async def _fetch_topic_variants(config: SyntheticConfig, n: int) -> list[str]:
    """One LLM call to get n topic variants. Falls back to [config.domain.topic] on parse error."""
    prompt = TOPIC_VARIANTS_PROMPT.format(
        topic=config.domain.topic,
        task_type=config.dataset.task_type,
        n=n,
    )
    try:
        result = await call_llm(rendered_prompt=prompt, model=config.models.generator)
        raw = result["response"].strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        variants = json.loads(raw)
        if isinstance(variants, list) and variants:
            return [str(v) for v in variants]
    except Exception as e:
        logger.warning(f"Topic variants fetch failed: {e}")
    return [config.domain.topic]


async def _call_generator(
    config: SyntheticConfig,
    difficulty_level: str,
    difficulty_definition: str,
    edge_case_type: Optional[str],
    topic_variant: str,
) -> Optional[dict]:
    """Call the generator LLM and parse the JSON response. Returns None on parse failure."""
    task_type = config.dataset.task_type

    if task_type == "classification":
        labels_str = ", ".join(config.domain.labels or [])
        prompt = CLASSIFICATION_GENERATOR_PROMPT.format(
            topic=config.domain.topic,
            labels=labels_str,
            difficulty_level=difficulty_level,
            difficulty_definition=difficulty_definition,
            edge_case_type=edge_case_type or "none",
            topic_variant=topic_variant,
        )
    else:
        prompt = QA_GENERATOR_PROMPT.format(
            topic=config.domain.topic,
            context_style=config.domain.context_style or "encyclopedic",
            answer_type=config.domain.answer_type or "extractive",
            difficulty_level=difficulty_level,
            difficulty_definition=difficulty_definition,
            edge_case_type=edge_case_type or "none",
            topic_variant=topic_variant,
        )

    try:
        result = await call_llm(
            rendered_prompt=prompt,
            model=config.models.generator,
            max_tokens=config.models.max_tokens_per_call,
        )
        raw = result["response"].strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw)
    except Exception as e:
        logger.warning(f"Generator parse failed: {e}")
        return None


def _to_example_dict(generated: dict, task_type: str, source_tag: str) -> dict:
    """Convert a raw generated dict into the canonical example format."""
    if task_type == "classification":
        return {
            "input_vars": {"input_text": generated.get("input_text", "")},
            "expected_output": str(generated.get("expected_label", "")),
            "source_tag": source_tag,
        }
    else:
        return {
            "input_vars": {
                "context": generated.get("context", ""),
                "question": generated.get("question", ""),
            },
            "expected_output": str(generated.get("expected_answer", "")),
            "source_tag": source_tag,
        }


def _primary_text(generated: dict, task_type: str) -> str:
    """Return the primary text for diversity tracking."""
    if task_type == "classification":
        return generated.get("input_text", "")
    return f"{generated.get('context', '')} {generated.get('question', '')}".strip()
