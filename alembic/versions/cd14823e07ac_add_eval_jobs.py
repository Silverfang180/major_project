"""add eval jobs

Revision ID: cd14823e07ac
Revises: 2289adf1b0f7
Create Date: 2026-02-24 22:10:58.806968

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'cd14823e07ac'
down_revision: Union[str, None] = '2289adf1b0f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("DROP TYPE IF EXISTS jobstatus CASCADE")
    jobstatus = postgresql.ENUM('pending', 'running', 'completed', 'failed', name='jobstatus')
    
    op.create_table(
        "eval_jobs",
        sa.Column("job_id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("prompt_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("version_id", sa.Integer(), nullable=False),
        sa.Column("dataset_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", jobstatus, nullable=False, server_default="pending"),
        sa.Column("evaluators", sa.JSON(), nullable=False),
        sa.Column("created_by", sa.Text(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(), nullable=False, server_default=sa.func.now()),
        sa.Column("started_at", sa.TIMESTAMP(), nullable=True),
        sa.Column("completed_at", sa.TIMESTAMP(), nullable=True),
        sa.ForeignKeyConstraint(["prompt_id"], ["prompts.prompt_id"]),
        sa.ForeignKeyConstraint(["version_id"], ["prompt_versions.version_id"]),
        sa.ForeignKeyConstraint(["dataset_id"], ["datasets.dataset_id"])
    )

    op.create_table(
        "eval_results",
        sa.Column("result_id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("example_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("run_id", sa.Integer(), nullable=True),
        sa.Column("raw_output", sa.Text(), nullable=True),
        sa.Column("expected_output", sa.Text(), nullable=False),
        sa.Column("is_correct", sa.Boolean(), nullable=True),
        sa.Column("confidence_score", sa.Float(), nullable=True),
        sa.Column("evaluator_score", sa.Float(), nullable=True),
        sa.Column("latency_ms", sa.Integer(), nullable=True),
        sa.Column("cost_usd", sa.Float(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["job_id"], ["eval_jobs.job_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["example_id"], ["dataset_examples.example_id"]),
        sa.ForeignKeyConstraint(["run_id"], ["runs.run_id"])
    )
    
    op.create_index("ix_eval_results_job_id", "eval_results", ["job_id"])


def downgrade() -> None:
    op.drop_index("ix_eval_results_job_id", table_name="eval_results")
    op.drop_table("eval_results")
    op.drop_table("eval_jobs")
    
    jobstatus = postgresql.ENUM('pending', 'running', 'completed', 'failed', name='jobstatus')
    jobstatus.drop(op.get_bind())
