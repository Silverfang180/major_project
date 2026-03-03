from sqlalchemy import Column, Text, Integer, ForeignKey, TIMESTAMP, JSON, CheckConstraint, Enum, Float, Boolean, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
import enum
from db import Base
from datetime import datetime

class JobStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"


class Dataset(Base):
    __tablename__ = "datasets"

    dataset_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    task_type = Column(Text, nullable=False)
    created_by = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        CheckConstraint("task_type IN ('classification', 'generation', 'qa')", name="task_type_check"),
    )

    examples = relationship("DatasetExample", back_populates="dataset", cascade="all, delete-orphan")


class DatasetExample(Base):
    __tablename__ = "dataset_examples"

    example_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataset_id = Column(UUID(as_uuid=True), ForeignKey("datasets.dataset_id", ondelete="CASCADE"), nullable=False, index=True)
    input_vars = Column(JSON, nullable=False)
    expected_output = Column(Text, nullable=False)
    source_tag = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP, nullable=False, default=datetime.utcnow)

    dataset = relationship("Dataset", back_populates="examples")

class EvalJob(Base):
    __tablename__ = "eval_jobs"

    job_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prompt_id = Column(UUID(as_uuid=True), ForeignKey("prompts.prompt_id"), nullable=False)
    version_id = Column(Integer, ForeignKey("prompt_versions.version_id"), nullable=False)
    dataset_id = Column(UUID(as_uuid=True), ForeignKey("datasets.dataset_id"), nullable=False)
    status = Column(Enum(JobStatus), nullable=False, default=JobStatus.pending)
    evaluators = Column(JSON, nullable=False)
    created_by = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP, nullable=False, default=datetime.utcnow)
    started_at = Column(TIMESTAMP, nullable=True)
    completed_at = Column(TIMESTAMP, nullable=True)


class EvalResult(Base):
    __tablename__ = "eval_results"

    result_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(UUID(as_uuid=True), ForeignKey("eval_jobs.job_id", ondelete="CASCADE"), nullable=False, index=True)
    example_id = Column(UUID(as_uuid=True), ForeignKey("dataset_examples.example_id"), nullable=False)
    run_id = Column(Integer, ForeignKey("runs.run_id"), nullable=True)
    raw_output = Column(Text, nullable=True)
    expected_output = Column(Text, nullable=False)
    is_correct = Column(Boolean, nullable=True)
    confidence_score = Column(Float, nullable=True)
    evaluator_score = Column(Float, nullable=True)
    latency_ms = Column(Integer, nullable=True)
    cost_usd = Column(Float, nullable=True)
    created_at = Column(TIMESTAMP, nullable=False, default=datetime.utcnow)


class EvalJobMeta(Base):
    __tablename__ = "eval_job_meta"

    meta_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(
        UUID(as_uuid=True),
        ForeignKey("eval_jobs.job_id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    calibration_metrics = Column(JSON, nullable=True)
    created_at = Column(TIMESTAMP, nullable=False, default=datetime.utcnow)
    updated_at = Column(TIMESTAMP, nullable=True)


class EvalSummary(Base):
    __tablename__ = "eval_summaries"

    summary_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(UUID(as_uuid=True), ForeignKey("eval_jobs.job_id", ondelete="CASCADE"), nullable=False, unique=True)
    prompt_id = Column(UUID(as_uuid=True), nullable=False)
    version_id = Column(Integer, nullable=False)
    dataset_id = Column(UUID(as_uuid=True), nullable=False)
    model = Column(Text, nullable=False)

    # Core metrics
    total_examples = Column(Integer, nullable=False)
    scored_examples = Column(Integer, nullable=False)
    accuracy = Column(Float, nullable=True)           # scored_correct / scored_examples
    mean_evaluator_score = Column(Float, nullable=True)

    # Cost metrics
    total_cost_usd = Column(Float, nullable=True)
    mean_cost_per_run = Column(Float, nullable=True)
    cost_per_correct = Column(Float, nullable=True)   # total_cost / correct_count

    # Latency metrics
    mean_latency_ms = Column(Float, nullable=True)
    p50_latency_ms = Column(Float, nullable=True)
    p95_latency_ms = Column(Float, nullable=True)

    # Calibration metrics (from EvalJobMeta if available)
    mce = Column(Float, nullable=True)
    overconfidence_rate = Column(Float, nullable=True)
    underconfidence_rate = Column(Float, nullable=True)

    computed_at = Column(TIMESTAMP, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_eval_summaries_dataset_id", "dataset_id"),
    )
