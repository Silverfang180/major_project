"""add cost_usd to runs

Revision ID: add_cost_usd
Revises: add_alias_history
Create Date: 2026-02-13

Adds:
- cost_usd column (Numeric(10,8), nullable) to runs table
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'add_cost_usd'
down_revision: Union[str, None] = 'add_alias_history'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'runs',
        sa.Column('cost_usd', sa.Numeric(precision=10, scale=8), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('runs', 'cost_usd')
