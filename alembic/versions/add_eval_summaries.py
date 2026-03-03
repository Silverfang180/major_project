"""add eval_summaries

Revision ID: b2c3d4e5f601
Revises: a1b2c3d4e5f6
Create Date: 2026-03-01 01:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f601'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "eval_summaries",
        sa.Column("summary_id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("prompt_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("version_id", sa.Integer(), nullable=False),
        sa.Column("dataset_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("model", sa.Text(), nullable=False),
        # Core metrics
        sa.Column("total_examples", sa.Integer(), nullable=False),
        sa.Column("scored_examples", sa.Integer(), nullable=False),
        sa.Column("accuracy", sa.Float(), nullable=True),
        sa.Column("mean_evaluator_score", sa.Float(), nullable=True),
        # Cost metrics
        sa.Column("total_cost_usd", sa.Float(), nullable=True),
        sa.Column("mean_cost_per_run", sa.Float(), nullable=True),
        sa.Column("cost_per_correct", sa.Float(), nullable=True),
        # Latency metrics
        sa.Column("mean_latency_ms", sa.Float(), nullable=True),
        sa.Column("p50_latency_ms", sa.Float(), nullable=True),
        sa.Column("p95_latency_ms", sa.Float(), nullable=True),
        # Calibration metrics
        sa.Column("mce", sa.Float(), nullable=True),
        sa.Column("overconfidence_rate", sa.Float(), nullable=True),
        sa.Column("underconfidence_rate", sa.Float(), nullable=True),
        sa.Column(
            "computed_at",
            sa.TIMESTAMP(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["job_id"],
            ["eval_jobs.job_id"],
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("job_id", name="uq_eval_summaries_job_id"),
    )
    op.create_index(
        "ix_eval_summaries_dataset_id",
        "eval_summaries",
        ["dataset_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_eval_summaries_dataset_id", table_name="eval_summaries")
    op.drop_table("eval_summaries")
