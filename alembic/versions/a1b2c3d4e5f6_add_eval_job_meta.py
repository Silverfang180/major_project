"""add eval_job_meta

Revision ID: a1b2c3d4e5f6
Revises: cd14823e07ac
Create Date: 2026-02-25 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'cd14823e07ac'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "eval_job_meta",
        sa.Column("meta_id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("calibration_metrics", sa.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("updated_at", sa.TIMESTAMP(), nullable=True),
        sa.ForeignKeyConstraint(
            ["job_id"],
            ["eval_jobs.job_id"],
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("job_id", name="uq_eval_job_meta_job_id"),
    )


def downgrade() -> None:
    op.drop_table("eval_job_meta")
