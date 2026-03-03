from pydantic import BaseModel, conlist, Field
from typing import Optional, List, Literal, Dict, Any
from uuid import UUID
from datetime import datetime

class DatasetCreate(BaseModel):
    name: str
    description: Optional[str] = None
    task_type: Literal['classification', 'generation', 'qa']
    created_by: str

class DatasetResponse(BaseModel):
    dataset_id: UUID
    name: str
    description: Optional[str]
    task_type: str
    created_by: str
    created_at: datetime
    example_count: int

    class Config:
        from_attributes = True

class ExampleCreate(BaseModel):
    input_vars: Dict[str, Any]
    expected_output: str
    source_tag: Optional[str] = None

class ExampleResponse(BaseModel):
    example_id: UUID
    dataset_id: UUID
    input_vars: Dict[str, Any]
    expected_output: str
    source_tag: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class BulkExampleCreate(BaseModel):
    examples: List[ExampleCreate] = Field(..., min_length=1, max_length=1000)

class CSVUploadResponse(BaseModel):
    imported: int
    skipped: int
    errors: List[str]
    
from pydantic import field_validator

class EvalJobCreate(BaseModel):
    prompt_id: UUID
    version_id: int
    dataset_id: UUID
    evaluators: List[str]
    created_by: str
    
    @field_validator("evaluators")
    @classmethod
    def check_evaluators(cls, v: List[str]) -> List[str]:
        if not v:
            raise ValueError("evaluators list cannot be empty")
        valid = {"exact_match", "llm_judge", "confidence_calibration"}
        for item in v:
            if item not in valid:
                raise ValueError(f"Invalid evaluator: {item}")
        return v

class EvalJobResponse(BaseModel):
    job_id: UUID
    prompt_id: UUID
    version_id: int
    dataset_id: UUID
    status: str
    evaluators: List[str]
    created_by: str
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class EvalResultResponse(BaseModel):
    result_id: UUID
    job_id: UUID
    example_id: UUID
    run_id: Optional[int] = None
    raw_output: Optional[str] = None
    expected_output: str
    is_correct: Optional[bool] = None
    confidence_score: Optional[float] = None
    evaluator_score: Optional[float] = None
    latency_ms: Optional[int] = None
    cost_usd: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ComparisonJobSummary(BaseModel):
    summary_id: UUID
    job_id: UUID
    prompt_id: UUID
    version_id: int
    dataset_id: UUID
    model: str
    
    total_examples: int
    scored_examples: int
    accuracy: Optional[float] = None
    mean_evaluator_score: Optional[float] = None
    
    total_cost_usd: Optional[float] = None
    mean_cost_per_run: Optional[float] = None
    cost_per_correct: Optional[float] = None
    
    mean_latency_ms: Optional[float] = None
    p50_latency_ms: Optional[float] = None
    p95_latency_ms: Optional[float] = None
    
    mce: Optional[float] = None
    overconfidence_rate: Optional[float] = None
    underconfidence_rate: Optional[float] = None
    
    computed_at: datetime
    
    is_pareto_optimal: bool
    is_knee_point: bool = False
    dominates: List[str]
    dominated_by: List[str]
    rank: int

class ComparisonResponse(BaseModel):
    dataset_id: UUID
    compared_jobs: int
    pareto_optimal_count: int
    knee_point_job_id: Optional[UUID] = None
    recommendation: str
    jobs: List[ComparisonJobSummary]
    computed_at: datetime

class DashboardResponse(BaseModel):
    total_datasets: int
    total_jobs: int
    total_examples: int
    completed_jobs: int
    failed_jobs: int
    recent_jobs: List[EvalJobResponse]
    top_summaries: List[dict]

