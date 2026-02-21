"""add execution layer

Revision ID: add_execution_layer
Revises: c4e78c22777f
Create Date: 2026-01-31

Adds:
- production_version_id column to prompts table
- runs table for execution tracking
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'add_execution_layer'
down_revision: Union[str, None] = 'c4e78c22777f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add production_version_id to prompts table
    op.add_column(
        'prompts',
        sa.Column('production_version_id', sa.BigInteger(), nullable=True)
    )
    op.create_foreign_key(
        'fk_prompts_production_version',
        'prompts',
        'prompt_versions',
        ['production_version_id'],
        ['version_id'],
        ondelete='SET NULL'
    )
    
    # Create runs table
    op.create_table(
        'runs',
        sa.Column('run_id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('version_id', sa.BigInteger(), nullable=True),
        sa.Column('prompt_key', sa.Text(), nullable=False),
        sa.Column('alias_used', sa.Text(), nullable=False),
        sa.Column('input_vars', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('rendered_prompt', sa.Text(), nullable=False),
        sa.Column('raw_response', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('latency_ms', sa.Integer(), nullable=False),
        sa.Column('status', sa.Text(), nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ['version_id'], 
            ['prompt_versions.version_id'], 
            ondelete='SET NULL'
        ),
        sa.PrimaryKeyConstraint('run_id')
    )
    
    # Create indexes for runs table
    op.create_index('idx_runs_version_id', 'runs', ['version_id'], unique=False)
    op.create_index('idx_runs_prompt_key', 'runs', ['prompt_key'], unique=False)
    op.create_index('idx_runs_created_at', 'runs', ['created_at'], unique=False)
    op.create_index('idx_runs_status', 'runs', ['status'], unique=False)


def downgrade() -> None:
    # Drop runs table and indexes
    op.drop_index('idx_runs_status', table_name='runs')
    op.drop_index('idx_runs_created_at', table_name='runs')
    op.drop_index('idx_runs_prompt_key', table_name='runs')
    op.drop_index('idx_runs_version_id', table_name='runs')
    op.drop_table('runs')
    
    # Remove production_version_id from prompts
    op.drop_constraint('fk_prompts_production_version', 'prompts', type_='foreignkey')
    op.drop_column('prompts', 'production_version_id')
