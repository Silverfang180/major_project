"""Add source_tag to dataset_examples

Revision ID: h9i0j1k2l3m4
Revises: g8h9i0j1k2l3
Create Date: 2026-03-05 02:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'h9i0j1k2l3m4'
down_revision: str = 'g8h9i0j1k2l3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add source_tag column if not exists
    try:
        op.add_column('dataset_examples', sa.Column('source_tag', sa.Text(), nullable=True))
    except Exception:
        pass  # Column might already exist


def downgrade() -> None:
    op.drop_column('dataset_examples', 'source_tag')
