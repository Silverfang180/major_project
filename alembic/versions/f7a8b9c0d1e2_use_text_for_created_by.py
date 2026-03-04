"""Use Text for created_by columns instead of UUID

Revision ID: f7a8b9c0d1e2
Revises: b2c3d4e5f601
Create Date: 2026-03-05 01:25:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f7a8b9c0d1e2'
down_revision: str = 'b2c3d4e5f601'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Cast existing UUID values to text strings
    op.alter_column(
        'prompts', 'created_by',
        existing_type=sa.UUID(),
        type_=sa.Text(),
        existing_nullable=False,
        postgresql_using='created_by::text'
    )
    op.alter_column(
        'prompt_versions', 'created_by',
        existing_type=sa.UUID(),
        type_=sa.Text(),
        existing_nullable=False,
        postgresql_using='created_by::text'
    )


def downgrade() -> None:
    op.alter_column(
        'prompt_versions', 'created_by',
        existing_type=sa.Text(),
        type_=sa.UUID(),
        existing_nullable=False,
        postgresql_using='created_by::uuid'
    )
    op.alter_column(
        'prompts', 'created_by',
        existing_type=sa.Text(),
        type_=sa.UUID(),
        existing_nullable=False,
        postgresql_using='created_by::uuid'
    )
