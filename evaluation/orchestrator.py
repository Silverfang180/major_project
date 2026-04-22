"""
Eval Job Orchestrator

Executes evaluation jobs by running each dataset example directly through the
internal execution stack (no HTTP). Writes a real Run row per example so
EvalResult.run_id satisfies the FK constraint against runs.run_id.
"""

import logging
from uuid import UUID
from datetime import datetime, timezone
import asyncio

from sqlalchemy import select

from db import async_session
from execution.models import Run
from execution.llm_service import call_llm, LLMError
from execution.pricing import calculate_cost
from execution.variable_engine import render_prompt
from version_control.models import Prompt, PromptVersion
from .models import EvalJob, EvalResult, DatasetExample, JobStatus

logger = logging.getLogger(__name__)


async def run_eval_job(job_id: UUID, api_key: str):
    """
    Background task. Executes all examples in the job's dataset against the
    pinned version using direct internal calls (no HTTP).

    Per-example error isolation: a single failed example rolls back its own
    transaction and logs the error, but does not abort the rest of the job.
    """
    async with async_session() as db:
        try:
            job = await db.get(EvalJob, job_id)
            if not job:
                logger.error(f"Eval job {job_id} not found")
                return

            job.status = JobStatus.running
            job.started_at = datetime.now(timezone.utc)
            await db.commit()

            # Fetch version once — all examples use the same version
            version = await db.get(PromptVersion, job.version_id)
            if not version:
                logger.error(f"Job {job_id}: version {job.version_id} not found")
                job.status = JobStatus.failed
                await db.commit()
                return

            prompt = await db.get(Prompt, job.prompt_id)
            if not prompt:
                logger.error(f"Job {job_id}: prompt {job.prompt_id} not found")
                job.status = JobStatus.failed
                await db.commit()
                return

            stmt = (
                select(DatasetExample)
                .where(DatasetExample.dataset_id == job.dataset_id)
                .order_by(DatasetExample.created_at.asc())
            )
            result = await db.execute(stmt)
            examples = result.scalars().all()

            if not examples:
                logger.error(f"Job {job_id}: dataset {job.dataset_id} has no examples")
                job.status = JobStatus.failed
                await db.commit()
                return

            # Extract model settings from version once
            model_settings = version.model_settings or {}
            model = model_settings.get("model") or None
            temperature = model_settings.get("temperature", 0.7)
            max_tokens = model_settings.get("max_tokens", 1000)
            accepted_results: list[EvalResult] = []

            for example in examples:
                try:
                    # 1. Render the prompt with example variables
                    rendered = render_prompt(version.prompt_text, example.input_vars)

                    # 2. Call LLM directly
                    llm_result = await call_llm(
                        rendered_prompt=rendered,
                        model=model,
                        temperature=temperature,
                        max_tokens=max_tokens,
                    )

                    usage = llm_result.get("usage", {})
                    prompt_tokens = usage.get("prompt_tokens", 0)
                    completion_tokens = usage.get("completion_tokens", 0)
                    actual_model = llm_result.get("model", model or "")
                    latency_ms = llm_result.get("latency_ms", 0)

                    # 3. Compute cost
                    cost_usd = calculate_cost(actual_model, prompt_tokens, completion_tokens)

                    # 4. Write a real Run row (flush to get run_id, then commit with EvalResult)
                    run = Run(
                        version_id=version.version_id,
                        prompt_key=prompt.key,
                        alias_used=f"eval:{job_id}",
                        input_vars=example.input_vars,
                        rendered_prompt=rendered,
                        raw_response=llm_result,
                        latency_ms=latency_ms,
                        status="success",
                        error_message=None,
                        cost_usd=cost_usd,
                    )
                    db.add(run)
                    await db.flush()  # Assigns run.run_id without committing

                    # 5. Write EvalResult linked to the run
                    eval_res = EvalResult(
                        job_id=job_id,
                        example_id=example.example_id,
                        run_id=run.run_id,
                        raw_output=llm_result.get("response"),
                        expected_output=example.expected_output,
                        is_correct=None,
                        latency_ms=latency_ms,
                        cost_usd=float(cost_usd) if cost_usd is not None else None,
                    )
                    db.add(eval_res)

                    # 6. Commit both rows together
                    await db.commit()
                    accepted_results.append(eval_res)

                    # Pacing: add a small delay between requests to avoid burst rate limits
                    await asyncio.sleep(0.2)

                except Exception as e:
                    logger.error(
                        f"Job {job_id} example {example.example_id} failed: {e}"
                    )
                    await db.rollback()
                    # Continue to next example

            job.status = JobStatus.completed
            job.completed_at = datetime.now(timezone.utc)
            await db.commit()

            # Run evaluators on in-memory result objects (no re-fetch)
            if accepted_results:
                from evaluation.evaluators import run_evaluators
                try:
                    await run_evaluators(job, accepted_results, db)
                except Exception as e:
                    logger.error(f"Job {job_id} evaluator pipeline failed: {e}")

            # Compute summary after evaluators complete
            from evaluation.metrics import compute_summary
            try:
                await compute_summary(job.job_id, db)
            except Exception as e:
                logger.error(f"Job {job_id} compute_summary failed: {e}")

        except Exception as e:
            logger.error(f"Job {job_id} fatal exception: {e}")
            await db.rollback()
            try:
                job = await db.get(EvalJob, job_id)
                if job:
                    job.status = JobStatus.failed
                    await db.commit()
            except Exception:
                logger.error(f"Could not mark job {job_id} as failed")

