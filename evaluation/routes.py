import csv
import io
import json
from typing import List
from uuid import UUID

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Header, Query
from sqlalchemy import select, func, desc, update
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_session
from .models import Dataset, DatasetExample
from .schemas import (
    DatasetCreate, DatasetResponse, ExampleCreate, ExampleResponse,
    BulkExampleCreate, CSVUploadResponse
)

router = APIRouter(tags=["evaluation"])

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
async def list_datasets(
    db: AsyncSession = Depends(get_session),
    x_chronicle_user: str = Header(default="legacy-user", alias="X-Chronicle-User")
):
    from sqlalchemy import or_
    stmt = (
        select(
            Dataset, 
            func.count(DatasetExample.example_id).label("example_count")
        )
        .outerjoin(DatasetExample, Dataset.dataset_id == DatasetExample.dataset_id)
        .where(
            Dataset.deleted_at.is_(None),
            or_(
                Dataset.created_by == x_chronicle_user,
                Dataset.created_by == 'seed-script' # Simplified seed identifier
            )
        )
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
        .where(Dataset.dataset_id == dataset_id, Dataset.deleted_at.is_(None))
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
        try:
            # Handle empty lines or rows missing columns (row.get returns None in some cases)
            expected = (row.get("expected_output") or "").strip()
            if not expected:
                skipped += 1
                errors.append(f"Row {row_idx}: expected_output is empty")
                continue
                
            input_vars_str = (row.get("input_vars") or "").strip()
            if not input_vars_str:
                skipped += 1
                errors.append(f"Row {row_idx}: input_vars is empty")
                continue

            input_vars = json.loads(input_vars_str)
            if not isinstance(input_vars, dict):
                raise ValueError("Must be a JSON object")
                
            source_tag = (row.get("source_tag") or "").strip() or None
            
            to_insert.append(DatasetExample(
                dataset_id=dataset.dataset_id,
                input_vars=input_vars,
                expected_output=expected,
                source_tag=source_tag
            ))
            imported += 1
        except Exception as e:
            skipped += 1
            errors.append(f"Row {row_idx}: {str(e)}")
            continue
        
    if to_insert:
        db.add_all(to_insert)
        try:
            await db.commit()
        except Exception as e:
            await db.rollback()
            raise HTTPException(status_code=500, detail=f"Database error during insert: {str(e)}")
            
    return {"imported": imported, "skipped": skipped, "errors": errors}

@router.get("/datasets/{dataset_id}/examples", response_model=List[ExampleResponse])
async def list_examples(dataset_id: UUID, db: AsyncSession = Depends(get_session)):
    dataset = await db.get(Dataset, dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    stmt = (
        select(DatasetExample)
        .where(
            DatasetExample.dataset_id == dataset_id,
            DatasetExample.deleted_at.is_(None)
        )
        .order_by(DatasetExample.created_at.asc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()

@router.delete("/datasets/{dataset_id}", status_code=204)
async def delete_dataset(dataset_id: UUID, permanent: bool = False, db: AsyncSession = Depends(get_session)):
    """Soft delete a dataset (Invisible Cloak). Permanent=True for immediate purging."""
    dataset = await db.get(Dataset, dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    if not permanent:
        dataset.deleted_at = func.now()
        # Soft delete children too
        await db.execute(
            update(DatasetExample)
            .where(DatasetExample.dataset_id == dataset_id)
            .values(deleted_at=func.now())
        )
        await db.commit()
    else:
        await db.delete(dataset)
        await db.commit()
    return None

@router.post("/datasets/{dataset_id}/restore", response_model=DatasetResponse)
async def restore_dataset(dataset_id: UUID, db: AsyncSession = Depends(get_session)):
    """Take the 'Invisible Cloak' off a dataset and its examples."""
    dataset = await db.get(Dataset, dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    dataset.deleted_at = None
    await db.execute(
        update(DatasetExample)
        .where(DatasetExample.dataset_id == dataset_id)
        .values(deleted_at=None)
    )
    await db.commit()
    await db.refresh(dataset)
    return {**dataset.__dict__, "example_count": 0, "deleted_at": dataset.deleted_at} # Simplified count

@router.get("/datasets/trash/all", response_model=List[DatasetResponse])
async def list_trashed_datasets(
    db: AsyncSession = Depends(get_session),
    x_chronicle_user: str = Header(default="", alias="X-Chronicle-User")
):
    """List all soft-deleted datasets for the user."""
    user_id = x_chronicle_user or "legacy-user"
    
    stmt = (
        select(Dataset)
        .where(
            Dataset.deleted_at.is_not(None),
            Dataset.created_by == user_id
        )
        .order_by(desc(Dataset.deleted_at))
    )
    result = await db.execute(stmt)
    datasets = result.scalars().all()
    
    return [
        {
            "dataset_id": d.dataset_id,
            "name": d.name,
            "description": d.description,
            "task_type": d.task_type,
            "created_by": d.created_by,
            "created_at": d.created_at,
            "deleted_at": d.deleted_at,
            "example_count": 0  # Simplified for trash view
        }
        for d in datasets
    ]

from fastapi import BackgroundTasks, Request
from version_control.models import Prompt, PromptVersion
from .models import EvalJob, EvalResult, JobStatus
from .schemas import EvalJobCreate, EvalJobResponse, EvalResultResponse
from .orchestrator import run_eval_job

@router.get("/jobs", response_model=List[EvalJobResponse])
async def list_jobs(
    db: AsyncSession = Depends(get_session),
    x_chronicle_user: str = Header(default="legacy-user", alias="X-Chronicle-User")
):
    from .models import EvalSummary
    stmt = (
        select(EvalJob, EvalSummary)
        .outerjoin(EvalSummary, EvalJob.job_id == EvalSummary.job_id)
        .where(EvalJob.created_by == x_chronicle_user)
        .order_by(EvalJob.created_at.desc())
    )
    result = await db.execute(stmt)
    rows = result.all()
    
    return [
        EvalJobResponse.model_validate({
            **row.EvalJob.__dict__, 
            "status": row.EvalJob.status,
            "summary": row.EvalSummary
        })
        for row in rows
    ]

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
    
    x_gemini_key = request.headers.get("X-Gemini-Key", "")
    x_groq_key = request.headers.get("X-Groq-Key", "")
    background_tasks.add_task(run_eval_job, job.job_id, {"gemini": x_gemini_key, "groq": x_groq_key})
    
    return job

@router.get("/jobs/{job_id}", response_model=EvalJobResponse)
async def get_job(job_id: UUID, db: AsyncSession = Depends(get_session)):
    from .models import EvalSummary
    stmt = (
        select(EvalJob, EvalSummary)
        .outerjoin(EvalSummary, EvalJob.job_id == EvalSummary.job_id)
        .where(EvalJob.job_id == job_id)
    )
    result = await db.execute(stmt)
    row = result.first()
    
    if not row:
        raise HTTPException(status_code=404, detail="EvalJob not found")
        
    return {
        **row.EvalJob.__dict__, 
        "status": row.EvalJob.status,
        "summary": row.EvalSummary
    }

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

    if job.status != "completed":
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

    if job.status != "completed":
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
async def compare_jobs(
    payload: CompareRequest, 
    db: AsyncSession = Depends(get_session),
    dimension: str = Query(default="cost")
):
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
        
    frontier_results = compute_pareto_frontier(summaries, dimension=dimension)
    knee_point = identify_knee_point(frontier_results, dimension=dimension)
    rec = generate_recommendation(frontier_results, knee_point, dimension=dimension)
    
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
async def auto_compare_dataset(
    dataset_id: UUID, 
    db: AsyncSession = Depends(get_session),
    dimension: str = Query(default="cost")
):
    from .models import EvalSummary
    from .metrics import compute_pareto_frontier, identify_knee_point, generate_recommendation
    from datetime import datetime
    
    stmt = select(EvalSummary).where(EvalSummary.dataset_id == dataset_id)
    res = await db.execute(stmt)
    summaries = list(res.scalars().all())
    
    if len(summaries) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 job summaries to compute frontier")
        
    frontier_results = compute_pareto_frontier(summaries, dimension=dimension)
    knee_point = identify_knee_point(frontier_results, dimension=dimension)
    rec = generate_recommendation(frontier_results, knee_point, dimension=dimension)
    
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
async def get_dashboard(
    db: AsyncSession = Depends(get_session),
    x_chronicle_user: str = Header(default="legacy-user", alias="X-Chronicle-User")
):
    from .models import Dataset, EvalJob
    from version_control.models import Prompt, PromptVersion
    from execution.models import Run
    from sqlalchemy import or_
    
    total_prompts = (await db.execute(
        select(func.count(Prompt.prompt_id)).where(Prompt.created_by == x_chronicle_user)
    )).scalar() or 0
    
    # Simple count of versions created by the user
    total_versions = (await db.execute(
        select(func.count(PromptVersion.version_id)).where(PromptVersion.created_by == x_chronicle_user)
    )).scalar() or 0
    
    total_runs = (await db.execute(
        select(func.count(Run.run_id)).where(Run.created_by == x_chronicle_user)
    )).scalar() or 0
    
    total_eval_jobs = (await db.execute(
        select(func.count(EvalJob.job_id)).where(EvalJob.created_by == x_chronicle_user)
    )).scalar() or 0
    
    total_datasets = (await db.execute(
        select(func.count(Dataset.dataset_id)).where(
            or_(
                Dataset.created_by == x_chronicle_user,
                Dataset.created_by == 'seed-script-a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'
            )
        )
    )).scalar() or 0
    
    total_cost = (await db.execute(
        select(func.coalesce(func.sum(Run.cost_usd), 0.0)).where(Run.created_by == x_chronicle_user)
    )).scalar() or 0.0
    
    # Calculate trend for last 7 days
    from datetime import datetime, timedelta, timezone
    now = datetime.now(timezone.utc)
    trend = []
    for i in range(6, -1, -1):
        day = now - timedelta(days=i)
        day_start = datetime(day.year, day.month, day.day, tzinfo=timezone.utc)
        day_end = day_start + timedelta(days=1)
        
        day_runs = (await db.execute(
            select(func.count(Run.run_id)).where(
                Run.created_by == x_chronicle_user,
                Run.created_at >= day_start,
                Run.created_at < day_end
            )
        )).scalar() or 0
        
        day_cost = (await db.execute(
            select(func.coalesce(func.sum(Run.cost_usd), 0.0)).where(
                Run.created_by == x_chronicle_user,
                Run.created_at >= day_start,
                Run.created_at < day_end
            )
        )).scalar() or 0.0
        
        trend.append({
            "day": day.strftime("%a"),
            "cost": float(day_cost),
            "runs": int(day_runs)
        })

    # Avg Accuracy across all completed jobs
    from .models import EvalSummary
    avg_acc = (await db.execute(
        select(func.avg(EvalSummary.accuracy)).where(EvalSummary.accuracy.is_not(None))
    )).scalar() or 0.0

    return {
        "total_prompts": total_prompts,
        "total_versions": total_versions,
        "total_runs": total_runs,
        "total_eval_jobs": total_eval_jobs,
        "total_datasets": total_datasets,
        "total_cost_usd": float(total_cost),
        "avg_performance": float(avg_acc),
        "trend": trend
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
        "job": {**job.__dict__, "status": job.status},
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

