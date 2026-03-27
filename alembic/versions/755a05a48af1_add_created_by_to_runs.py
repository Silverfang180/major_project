"""add_created_by_to_runs

Revision ID: 755a05a48af1
Revises: 22bfe03ccc2c
Create Date: 2026-03-27 21:27:09.228798

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '755a05a48af1'
down_revision: Union[str, None] = '22bfe03ccc2c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add column with server_default for existing rows to pass nullable=False constraint
    op.add_column('runs', sa.Column('created_by', sa.Text(), nullable=False, server_default='legacy-user'))

def downgrade() -> None:
    op.drop_column('runs', 'created_by')
