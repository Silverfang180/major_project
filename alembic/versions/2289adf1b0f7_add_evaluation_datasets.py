"""add evaluation datasets

Revision ID: 2289adf1b0f7
Revises: 0cc75a65b392
Create Date: 2026-02-24 21:31:10.486495

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '2289adf1b0f7'
down_revision: Union[str, None] = '0cc75a65b392'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "datasets",
        sa.Column("dataset_id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("task_type", sa.Text(), nullable=False),
        sa.Column("created_by", sa.Text(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("task_type IN ('classification', 'generation', 'qa')", name="task_type_check")
    )
    
    op.create_table(
        "dataset_examples",
        sa.Column("example_id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("dataset_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("input_vars", sa.JSON(), nullable=False),
        sa.Column("expected_output", sa.Text(), nullable=False),
        sa.Column("source_tag", sa.Text(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["dataset_id"], ["datasets.dataset_id"], ondelete="CASCADE")
    )
    
    op.create_index("ix_dataset_examples_dataset_id", "dataset_examples", ["dataset_id"])


def downgrade() -> None:
    op.drop_index("ix_dataset_examples_dataset_id", table_name="dataset_examples")
    op.drop_table("dataset_examples")
    op.drop_table("datasets")
