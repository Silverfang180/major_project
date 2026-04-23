"""Fix datasets.created_by UUID->Text and add eval_jobs.created_by

Revision ID: g8h9i0j1k2l3
Revises: f7a8b9c0d1e2
Create Date: 2026-03-05 01:55:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'g8h9i0j1k2l3'
down_revision: str = 'f7a8b9c0d1e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

from sqlalchemy.engine.reflection import Inspector

def upgrade() -> None:
    # Fix datasets.created_by: UUID -> Text
    op.alter_column(
        'datasets', 'created_by',
        existing_type=sa.UUID(),
        type_=sa.Text(),
        existing_nullable=False,
        postgresql_using='created_by::text'
    )

    bind = op.get_bind()
    inspector = Inspector.from_engine(bind)
    columns = [c['name'] for c in inspector.get_columns('eval_jobs')]
    
    if 'created_by' not in columns:
        op.add_column('eval_jobs', sa.Column('created_by', sa.Text(), nullable=True))
        # Backfill any existing rows
        op.execute("UPDATE eval_jobs SET created_by = 'system' WHERE created_by IS NULL")
        op.alter_column('eval_jobs', 'created_by', nullable=False)


def downgrade() -> None:
    op.alter_column(
        'datasets', 'created_by',
        existing_type=sa.Text(),
        type_=sa.UUID(),
        existing_nullable=False,
        postgresql_using='created_by::uuid'
    )
