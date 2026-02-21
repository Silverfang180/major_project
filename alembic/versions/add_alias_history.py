"""add alias_history table

Revision ID: add_alias_history
Revises: add_execution_layer
Create Date: 2026-02-13

Adds:
- alias_history table for tracking alias/promotion changes
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'add_alias_history'
down_revision: Union[str, None] = 'add_execution_layer'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'alias_history',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('prompt_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('from_version_id', sa.BigInteger(), nullable=True),
        sa.Column('to_version_id', sa.BigInteger(), nullable=False),
        sa.Column('changed_by', sa.Text(), nullable=True),
        sa.Column('changed_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['prompt_id'], ['prompts.prompt_id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['from_version_id'], ['prompt_versions.version_id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['to_version_id'], ['prompt_versions.version_id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_alias_history_prompt_id', 'alias_history', ['prompt_id'], unique=False)
    op.create_index('idx_alias_history_changed_at', 'alias_history', ['changed_at'], unique=False)


def downgrade() -> None:
    op.drop_index('idx_alias_history_changed_at', table_name='alias_history')
    op.drop_index('idx_alias_history_prompt_id', table_name='alias_history')
    op.drop_table('alias_history')
