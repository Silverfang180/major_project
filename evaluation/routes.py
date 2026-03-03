import csv
import io
import json
from typing import List
from uuid import UUID

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_session
from .models import Dataset, DatasetExample
from .schemas import (
    DatasetCreate, DatasetResponse, ExampleCreate, ExampleResponse,
    BulkExampleCreate, CSVUploadResponse
)

router = APIRouter(prefix="/api/v1/eval", tags=["evaluation"])

@router.post("/datasets", response_model=DatasetResponse, status_code=201)
async def create_dataset(
    payload: DatasetCreate,
    db: AsyncSession = Depends(get_session)
):
    dataset = Dataset(**payload.model_dump())
    db.add(dataset)
    await db.commit()
    await db.refresh(dataset)
    
    data = dataset.__dict__.copy()
    data["example_count"] = 0
    return data

@router.get("/datasets", response_model=List[DatasetResponse])
async def list_datasets(db: AsyncSession = Depends(get_session)):
    stmt = (
        select(
            Dataset, 
            func.count(DatasetExample.example_id).label("example_count")
        )
        .outerjoin(DatasetExample, Dataset.dataset_id == DatasetExample.dataset_id)
        .group_by(Dataset.dataset_id)
        .order_by(Dataset.created_at.desc())
    )
    result = await db.execute(stmt)
    rows = result.all()
    
    return [
        {**row.Dataset.__dict__, "example_count": row.example_count}
        for row in rows
    ]

@router.get("/datasets/{dataset_id}", response_model=DatasetResponse)
async def get_dataset(dataset_id: UUID, db: AsyncSession = Depends(get_session)):
    stmt = (
        select(
            Dataset, 
            func.count(DatasetExample.example_id).label("example_count")
        )
        .outerjoin(DatasetExample, Dataset.dataset_id == DatasetExample.dataset_id)
        .where(Dataset.dataset_id == dataset_id)
        .group_by(Dataset.dataset_id)
    )
    result = await db.execute(stmt)
    row = result.first()
    
    if not row:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    return {**row.Dataset.__dict__, "example_count": row.example_count}

@router.post("/datasets/{dataset_id}/examples", response_model=ExampleResponse, status_code=201)
async def add_example(
    dataset_id: UUID, 
    payload: ExampleCreate,
    db: AsyncSession = Depends(get_session)
):
    dataset = await db.get(Dataset, dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    example = DatasetExample(
        dataset_id=dataset_id,
        **payload.model_dump()
    )
    db.add(example)
    await db.commit()
    await db.refresh(example)
    
    return example

@router.post("/datasets/{dataset_id}/examples/bulk", status_code=201)
async def bulk_add_examples(
    dataset_id: UUID,
    payload: BulkExampleCreate,
    db: AsyncSession = Depends(get_session)
):
    dataset = await db.get(Dataset, dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    examples = [
        DatasetExample(dataset_id=dataset_id, **ex.model_dump())
        for ex in payload.examples
    ]
    db.add_all(examples)
    await db.commit()
    
    return {"imported": len(examples), "dataset_id": str(dataset_id)}

@router.post("/datasets/{dataset_id}/examples/upload-csv", response_model=CSVUploadResponse)
async def upload_csv(
    dataset_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_session)
):
    dataset = await db.get(Dataset, dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    content = await file.read()
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Invalid file encoding. Must be UTF-8.")
        
    reader = csv.DictReader(io.StringIO(text))
    
    if not reader.fieldnames or "input_vars" not in reader.fieldnames or "expected_output" not in reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV must contain 'input_vars' and 'expected_output' columns")
        
    imported = 0
    skipped = 0
    errors = []
    
    to_insert = []
    
    for row_idx, row in enumerate(reader, start=2): # header is row 1
        expected = row.get("expected_output", "").strip()
        if not expected:
            skipped += 1
            errors.append(f"Row {row_idx}: expected_output is empty")
            continue
            
        input_vars_str = row.get("input_vars", "").strip()
        try:
            input_vars = json.loads(input_vars_str)
            if not isinstance(input_vars, dict):
                raise ValueError("Must be a JSON object")
        except Exception as e:
            skipped += 1
            errors.append(f"Row {row_idx}: Invalid JSON in input_vars - {str(e)}")
            continue
            
        source_tag = row.get("source_tag", "").strip() or None
        
        to_insert.append(DatasetExample(
            dataset_id=dataset_id,
            input_vars=input_vars,
            expected_output=expected,
            source_tag=source_tag
        ))
        imported += 1
        
    if to_insert:
        db.add_all(to_insert)
        await db.commit()
        
    return {"imported": imported, "skipped": skipped, "errors": errors}

@router.get("/datasets/{dataset_id}/examples", response_model=List[ExampleResponse])
async def list_examples(dataset_id: UUID, db: AsyncSession = Depends(get_session)):
    dataset = await db.get(Dataset, dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    stmt = (
        select(DatasetExample)
        .where(DatasetExample.dataset_id == dataset_id)
        .order_by(DatasetExample.created_at.asc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()

@router.delete("/datasets/{dataset_id}", status_code=204)
async def delete_dataset(dataset_id: UUID, db: AsyncSession = Depends(get_session)):
    dataset = await db.get(Dataset, dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    await db.delete(dataset)
    await db.commit()
    return None

from fastapi import BackgroundTasks, Request
from version_control.models import Prompt, PromptVersion
from .models import EvalJob, EvalResult, JobStatus
from .schemas import EvalJobCreate, EvalJobResponse, EvalResultResponse
from .orchestrator import run_eval_job

@router.post("/jobs", response_model=EvalJobResponse, status_code=201)
async def create_job(
    payload: EvalJobCreate,
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_session)
):
    prompt = await db.get(Prompt, payload.prompt_id)
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
        
    version = await db.get(PromptVersion, payload.version_id)
    if not version or version.prompt_id != payload.prompt_id:
        raise HTTPException(status_code=404, detail="Version not found or mismatch")
        
    dataset = await db.get(Dataset, payload.dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    job = EvalJob(
        prompt_id=payload.prompt_id,
        version_id=payload.version_id,
        dataset_id=payload.dataset_id,
        evaluators=payload.evaluators,
        created_by=payload.created_by,
        status="pending"
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    
    api_key = request.headers.get("X-API-Key", "")
    background_tasks.add_task(run_eval_job, job.job_id, api_key)
    
    return job

@router.get("/jobs/{job_id}", response_model=EvalJobResponse)
async def get_job(job_id: UUID, db: AsyncSession = Depends(get_session)):
    job = await db.get(EvalJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="EvalJob not found")
    # Cast enum to str for response
    return {**job.__dict__, "status": job.status.value}

@router.get("/jobs/{job_id}/results", response_model=List[EvalResultResponse])
async def get_job_results(job_id: UUID, db: AsyncSession = Depends(get_session)):
    job = await db.get(EvalJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="EvalJob not found")
        
    stmt = select(EvalResult).where(EvalResult.job_id == job_id).order_by(EvalResult.created_at.asc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/jobs/{job_id}/meta")
async def get_job_meta(job_id: UUID, db: AsyncSession = Depends(get_session)):
    """Return calibration and evaluator metadata for a completed job."""
    job = await db.get(EvalJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="EvalJob not found")

    from .models import EvalJobMeta
    stmt = select(EvalJobMeta).where(EvalJobMeta.job_id == job_id)
    result = await db.execute(stmt)
    meta = result.scalar_one_or_none()

    if not meta:
        raise HTTPException(status_code=404, detail="No meta available yet")

    return {
        "meta_id": str(meta.meta_id),
        "job_id": str(meta.job_id),
        "calibration_metrics": meta.calibration_metrics,
        "created_at": meta.created_at,
        "updated_at": meta.updated_at,
    }


@router.post("/jobs/{job_id}/evaluate", status_code=202)
async def trigger_evaluate(
    job_id: UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_session),
):
    """
    Trigger (or re-trigger) evaluators on an already-completed job.
    Use case: running confidence_calibration after scores already exist,
    or changing evaluator settings without re-generating outputs.
    """
    job = await db.get(EvalJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="EvalJob not found")

    if job.status != JobStatus.completed:
        raise HTTPException(
            status_code=400,
            detail="Job must be completed before evaluation",
        )

    stmt = select(EvalResult).where(EvalResult.job_id == job_id).order_by(EvalResult.created_at.asc())
    result = await db.execute(stmt)
    results = list(result.scalars().all())

    from .evaluators import run_evaluators

    async def _run(job_id_str: str):
        from db import async_session as _session
        from uuid import UUID as _UUID
        async with _session() as bg_db:
            bg_job = await bg_db.get(EvalJob, _UUID(job_id_str))
            bg_stmt = select(EvalResult).where(EvalResult.job_id == _UUID(job_id_str))
            bg_result = await bg_db.execute(bg_stmt)
            bg_results = list(bg_result.scalars().all())
            await run_evaluators(bg_job, bg_results, bg_db)

    background_tasks.add_task(_run, str(job_id))

    return {"message": "Evaluation started", "job_id": str(job_id)}


# ── Summary endpoints ─────────────────────────────────────────────────────────

@router.get("/jobs/{job_id}/summary")
async def get_job_summary(job_id: UUID, db: AsyncSession = Depends(get_session)):
    """Return EvalSummary for the job as JSON."""
    job = await db.get(EvalJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="EvalJob not found")

    from .models import EvalSummary
    from sqlalchemy import select as _select
    stmt = _select(EvalSummary).where(EvalSummary.job_id == job_id)
    result = await db.execute(stmt)
    summary = result.scalar_one_or_none()

    if not summary:
        raise HTTPException(status_code=404, detail="Summary not yet computed")

    return {
        "summary_id": str(summary.summary_id),
        "job_id": str(summary.job_id),
        "prompt_id": str(summary.prompt_id),
        "version_id": summary.version_id,
        "dataset_id": str(summary.dataset_id),
        "model": summary.model,
        "total_examples": summary.total_examples,
        "scored_examples": summary.scored_examples,
        "accuracy": summary.accuracy,
        "mean_evaluator_score": summary.mean_evaluator_score,
        "total_cost_usd": summary.total_cost_usd,
        "mean_cost_per_run": summary.mean_cost_per_run,
        "cost_per_correct": summary.cost_per_correct,
        "mean_latency_ms": summary.mean_latency_ms,
        "p50_latency_ms": summary.p50_latency_ms,
        "p95_latency_ms": summary.p95_latency_ms,
        "mce": summary.mce,
        "overconfidence_rate": summary.overconfidence_rate,
        "underconfidence_rate": summary.underconfidence_rate,
        "computed_at": summary.computed_at,
    }


@router.post("/jobs/{job_id}/summary/compute", status_code=202)
async def recompute_job_summary(
    job_id: UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_session),
):
    """
    Trigger compute_summary as a background task on an already-completed job.
    Use case: recompute after re-running evaluators.
    """
    job = await db.get(EvalJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="EvalJob not found")

    if job.status != JobStatus.completed:
        raise HTTPException(
            status_code=400,
            detail="Job must be completed before computing summary",
        )

    async def _run_summary(job_id_str: str):
        from db import async_session as _session
        from uuid import UUID as _UUID
        from evaluation.metrics import compute_summary as _compute
        async with _session() as bg_db:
            await _compute(_UUID(job_id_str), bg_db)

    background_tasks.add_task(_run_summary, str(job_id))
    return {"message": "Summary computation started", "job_id": str(job_id)}


@router.get("/datasets/{dataset_id}/pareto")
async def get_pareto_frontier(dataset_id: UUID, db: AsyncSession = Depends(get_session)):
    """
    Compute Pareto frontier (accuracy vs cost_per_correct) across all
    completed EvalSummary rows for the dataset.
    """
    from .models import EvalSummary
    from sqlalchemy import select as _select
    from datetime import datetime as _dt

    stmt = _select(EvalSummary).where(EvalSummary.dataset_id == dataset_id)
    result = await db.execute(stmt)
    summaries = list(result.scalars().all())

    if len(summaries) < 2:
        raise HTTPException(
            status_code=400,
            detail="Need at least 2 job summaries to compute frontier",
        )

    from .metrics import compute_pareto_frontier, identify_knee_point

    frontier = compute_pareto_frontier(summaries)
    knee = identify_knee_point(frontier)
    knee_job_id = knee["job_id"] if knee else None

    pareto_count = sum(1 for d in frontier if d.get("is_pareto_optimal"))

    return {
        "dataset_id": str(dataset_id),
        "total_jobs": len(summaries),
        "pareto_optimal_count": pareto_count,
        "knee_point_job_id": knee_job_id,
        "frontier": frontier,
        "computed_at": _dt.utcnow().isoformat(),
    }


@router.get("/datasets/{dataset_id}/summaries")
async def get_dataset_summaries(dataset_id: UUID, db: AsyncSession = Depends(get_session)):
    """Return all EvalSummary rows for a dataset ordered by accuracy DESC."""
    from .models import EvalSummary
    from sqlalchemy import select as _select, desc

    # Verify dataset exists
    dataset = await db.get(Dataset, dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    stmt = (
        _select(EvalSummary)
        .where(EvalSummary.dataset_id == dataset_id)
        .order_by(desc(EvalSummary.accuracy))
    )
    result = await db.execute(stmt)
    summaries = list(result.scalars().all())

    return [
        {
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
            "computed_at": s.computed_at,
        }
        for s in summaries
    ]

# ── Phase 2 Week 5 Comparison & Dashboard ─────────────────────────────────────
from pydantic import BaseModel, conlist, field_validator
from .schemas import ComparisonResponse, DashboardResponse

class CompareRequest(BaseModel):
    job_ids: List[UUID]
    
    @field_validator("job_ids")
    @classmethod
    def check_count(cls, v):
        if len(v) < 2:
            raise ValueError("Need at least 2 jobs to compare")
        if len(v) > 10:
            raise ValueError("Maximum 10 jobs per comparison")
        return v

@router.post("/compare", response_model=ComparisonResponse)
async def compare_jobs(payload: CompareRequest, db: AsyncSession = Depends(get_session)):
    from .models import EvalSummary
    from .metrics import compute_pareto_frontier, identify_knee_point, generate_recommendation
    from datetime import datetime
    
    summaries = []
    for jid in payload.job_ids:
        stmt = select(EvalSummary).where(EvalSummary.job_id == jid)
        res = await db.execute(stmt)
        s = res.scalar_one_or_none()
        if not s:
            raise HTTPException(status_code=400, detail=f"Job {jid} has no summary. Run the job to completion first.")
        summaries.append(s)
        
    dataset_id = summaries[0].dataset_id
    if any(s.dataset_id != dataset_id for s in summaries):
        raise HTTPException(status_code=400, detail="All jobs must use the same dataset for meaningful comparison.")
        
    frontier_results = compute_pareto_frontier(summaries)
    knee_point = identify_knee_point(frontier_results)
    rec = generate_recommendation(frontier_results, knee_point)
    
    sorted_by_acc = sorted(frontier_results, key=lambda x: x.get("accuracy") or 0.0, reverse=True)
    rank_map = {d["job_id"]: i + 1 for i, d in enumerate(sorted_by_acc)}
    
    for d in frontier_results:
        d["rank"] = rank_map[d["job_id"]]
        if knee_point and d["job_id"] == str(knee_point["job_id"]):
            d["is_knee_point"] = True
            
    pareto_count = sum(1 for d in frontier_results if d.get("is_pareto_optimal"))
    
    return {
        "dataset_id": str(dataset_id),
        "compared_jobs": len(frontier_results),
        "pareto_optimal_count": pareto_count,
        "knee_point_job_id": str(knee_point["job_id"]) if knee_point else None,
        "recommendation": rec,
        "jobs": frontier_results,
        "computed_at": datetime.utcnow()
    }

@router.get("/compare/dataset/{dataset_id}", response_model=ComparisonResponse)
async def auto_compare_dataset(dataset_id: UUID, db: AsyncSession = Depends(get_session)):
    from .models import EvalSummary
    from .metrics import compute_pareto_frontier, identify_knee_point, generate_recommendation
    from datetime import datetime
    
    stmt = select(EvalSummary).where(EvalSummary.dataset_id == dataset_id)
    res = await db.execute(stmt)
    summaries = list(res.scalars().all())
    
    if len(summaries) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 job summaries to compute frontier")
        
    frontier_results = compute_pareto_frontier(summaries)
    knee_point = identify_knee_point(frontier_results)
    rec = generate_recommendation(frontier_results, knee_point)
    
    sorted_by_acc = sorted(frontier_results, key=lambda x: x.get("accuracy") or 0.0, reverse=True)
    rank_map = {d["job_id"]: i + 1 for i, d in enumerate(sorted_by_acc)}
    
    for d in frontier_results:
        d["rank"] = rank_map[d["job_id"]]
        if knee_point and d["job_id"] == str(knee_point["job_id"]):
            d["is_knee_point"] = True
            
    pareto_count = sum(1 for d in frontier_results if d.get("is_pareto_optimal"))
    
    return {
        "dataset_id": str(dataset_id),
        "compared_jobs": len(frontier_results),
        "pareto_optimal_count": pareto_count,
        "knee_point_job_id": knee_point["job_id"] if knee_point else None,
        "recommendation": rec,
        "jobs": frontier_results,
        "computed_at": datetime.utcnow()
    }

@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(db: AsyncSession = Depends(get_session)):
    from .models import Dataset, EvalJob, DatasetExample, EvalSummary, JobStatus
    
    total_datasets = (await db.execute(select(func.count(Dataset.dataset_id)))).scalar() or 0
    total_jobs = (await db.execute(select(func.count(EvalJob.job_id)))).scalar() or 0
    total_examples = (await db.execute(select(func.count(DatasetExample.example_id)))).scalar() or 0
    
    completed_jobs = (await db.execute(select(func.count(EvalJob.job_id)).where(EvalJob.status == JobStatus.completed))).scalar() or 0
    failed_jobs = (await db.execute(select(func.count(EvalJob.job_id)).where(EvalJob.status == JobStatus.failed))).scalar() or 0
    
    stmt = select(EvalJob).order_by(EvalJob.created_at.desc()).limit(5)
    recent_jobs = list((await db.execute(stmt)).scalars().all())
    
    stmt2 = select(EvalSummary).where(EvalSummary.accuracy.is_not(None)).order_by(EvalSummary.accuracy.desc()).limit(5)
    top_summaries_rows = list((await db.execute(stmt2)).scalars().all())
    
    top_summaries = [
        {
            "job_id": str(s.job_id),
            "version_id": s.version_id,
            "model": s.model,
            "accuracy": s.accuracy,
            "cost_per_correct": s.cost_per_correct,
            "dataset_id": str(s.dataset_id)
        }
        for s in top_summaries_rows
    ]
    
    recent_jobs_resp = [{**j.__dict__, "status": j.status.value} for j in recent_jobs]
    
    return {
        "total_datasets": total_datasets,
        "total_jobs": total_jobs,
        "total_examples": total_examples,
        "completed_jobs": completed_jobs,
        "failed_jobs": failed_jobs,
        "recent_jobs": recent_jobs_resp,
        "top_summaries": top_summaries
    }

@router.get("/jobs/{job_id}/report")
async def get_job_report(job_id: UUID, db: AsyncSession = Depends(get_session)):
    from .models import EvalJob, EvalSummary, EvalResult, EvalJobMeta
    
    job = await db.get(EvalJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="EvalJob not found")
        
    s_stmt = select(EvalSummary).where(EvalSummary.job_id == job_id)
    summary = (await db.execute(s_stmt)).scalar_one_or_none()
    
    m_stmt = select(EvalJobMeta).where(EvalJobMeta.job_id == job_id)
    meta = (await db.execute(m_stmt)).scalar_one_or_none()
    
    r_stmt = select(EvalResult).where(EvalResult.job_id == job_id).order_by(EvalResult.created_at.asc())
    results = list((await db.execute(r_stmt)).scalars().all())
    
    result_count = len(results)
    correct_count = sum(1 for r in results if r.is_correct is True)
    incorrect_count = sum(1 for r in results if r.is_correct is False)
    unscored_count = sum(1 for r in results if r.is_correct is None)
    
    sum_dict = None
    if summary:
        sum_dict = {
            "summary_id": str(summary.summary_id),
            "job_id": str(summary.job_id),
            "prompt_id": str(summary.prompt_id),
            "version_id": summary.version_id,
            "dataset_id": str(summary.dataset_id),
            "model": summary.model,
            "total_examples": summary.total_examples,
            "scored_examples": summary.scored_examples,
            "accuracy": summary.accuracy,
            "mean_evaluator_score": summary.mean_evaluator_score,
            "total_cost_usd": summary.total_cost_usd,
            "mean_cost_per_run": summary.mean_cost_per_run,
            "cost_per_correct": summary.cost_per_correct,
            "mean_latency_ms": summary.mean_latency_ms,
            "p50_latency_ms": summary.p50_latency_ms,
            "p95_latency_ms": summary.p95_latency_ms,
            "mce": summary.mce,
            "overconfidence_rate": summary.overconfidence_rate,
            "underconfidence_rate": summary.underconfidence_rate,
            "computed_at": summary.computed_at,
        }
        
    meta_dict = None
    if meta:
        meta_dict = {
            "meta_id": str(meta.meta_id),
            "job_id": str(meta.job_id),
            "calibration_metrics": meta.calibration_metrics,
            "created_at": meta.created_at,
            "updated_at": meta.updated_at,
        }
        
    return {
        "job": {**job.__dict__, "status": job.status.value},
        "summary": sum_dict,
        "meta": meta_dict,
        "results": results,
        "result_count": result_count,
        "correct_count": correct_count,
        "incorrect_count": incorrect_count,
        "unscored_count": unscored_count
    }

@router.get("/datasets/{dataset_id}/leaderboard")
async def get_dataset_leaderboard(dataset_id: UUID, db: AsyncSession = Depends(get_session)):
    from .models import Dataset, EvalSummary
    from .metrics import compute_pareto_frontier, identify_knee_point, generate_recommendation
    
    dataset = await db.get(Dataset, dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    stmt = select(EvalSummary).where(EvalSummary.dataset_id == dataset_id)
    res = await db.execute(stmt)
    summaries = list(res.scalars().all())
    
    if not summaries:
        return {
            "dataset_id": str(dataset_id),
            "dataset_name": dataset.name,
            "entries": [],
            "pareto_optimal_count": 0,
            "best_accuracy": None,
            "best_cost_efficiency": None,
            "recommendation": "Insufficient data to make a recommendation. Run eval jobs and ensure evaluators populate is_correct."
        }
        
    frontier_results = compute_pareto_frontier(summaries)
    knee_point = identify_knee_point(frontier_results)
    rec = generate_recommendation(frontier_results, knee_point)
    
    sorted_by_acc = sorted(frontier_results, key=lambda x: x.get("accuracy") or 0.0, reverse=True)
    rank_map = {d["job_id"]: i + 1 for i, d in enumerate(sorted_by_acc)}
    
    for d in frontier_results:
        d["rank"] = rank_map[d["job_id"]]
        if knee_point and d["job_id"] == str(knee_point["job_id"]):
            d["is_knee_point"] = True
            
    pareto_count = sum(1 for d in frontier_results if d.get("is_pareto_optimal"))
    
    best_acc = max((s.accuracy for s in summaries if s.accuracy is not None), default=None)
    best_cost = min((s.cost_per_correct for s in summaries if s.cost_per_correct is not None), default=None)
    
    return {
        "dataset_id": str(dataset_id),
        "dataset_name": dataset.name,
        "entries": sorted_by_acc,
        "pareto_optimal_count": pareto_count,
        "best_accuracy": best_acc,
        "best_cost_efficiency": best_cost,
        "recommendation": rec
    }

