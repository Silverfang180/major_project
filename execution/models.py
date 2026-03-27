"""
Execution Models
Defines the Run table for tracking every prompt execution.
"""

from sqlalchemy import (
    BigInteger, Column, DateTime, ForeignKey, Integer, Numeric, Text, Index
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func

from db import Base


class Run(Base):
    """
    Tracks every prompt execution.
    
    Provides operational memory for:
    - Auditability
    - Cost control  
    - Regression tracking
    """
    __tablename__ = "runs"

    run_id = Column(BigInteger, primary_key=True, autoincrement=True)
    created_by = Column(Text, nullable=False, server_default='legacy-user')
    
    # Reference to the version that was executed
    version_id = Column(
        BigInteger, 
        ForeignKey("prompt_versions.version_id", ondelete="SET NULL"),
        nullable=True  # Allow orphaned runs if version deleted
    )
    
    # Denormalized for query convenience
    prompt_key = Column(Text, nullable=False)
    
    # Which alias was used (production, staging, etc.)
    alias_used = Column(Text, nullable=False, default="production")
    
    # Variables passed at execution time
    input_vars = Column(JSONB, nullable=False, default=dict)
    
    # Final prompt after variable injection
    rendered_prompt = Column(Text, nullable=False)
    
    # LLM response - JSONB to preserve structure (model, finish_reason, usage)
    raw_response = Column(JSONB, nullable=False)
    
    # Execution duration in milliseconds
    latency_ms = Column(Integer, nullable=False)
    
    # Execution status: success, error, timeout
    status = Column(Text, nullable=False, default="success")
    
    # Error details if failed
    error_message = Column(Text, nullable=True)
    
    # Estimated cost in USD based on token usage
    cost_usd = Column(Numeric(10, 8), nullable=True)
    
    # Timestamp
    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_runs_version_id", "version_id"),
        Index("idx_runs_prompt_key", "prompt_key"),
        Index("idx_runs_created_at", "created_at"),
        Index("idx_runs_status", "status"),
    )
