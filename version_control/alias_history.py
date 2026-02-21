"""
Alias History Model
Tracks every alias change (promotion) for audit trail.
"""

from sqlalchemy import (
    Column, DateTime, ForeignKey, Integer, BigInteger, Text, Index
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from db import Base


class AliasHistory(Base):
    __tablename__ = "alias_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    prompt_id = Column(
        UUID(as_uuid=True),
        ForeignKey("prompts.prompt_id", ondelete="CASCADE"),
        nullable=False
    )
    from_version_id = Column(
        BigInteger,
        ForeignKey("prompt_versions.version_id", ondelete="SET NULL"),
        nullable=True
    )
    to_version_id = Column(
        BigInteger,
        ForeignKey("prompt_versions.version_id", ondelete="SET NULL"),
        nullable=True
    )
    changed_by = Column(Text, nullable=True)
    changed_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_alias_history_prompt_id", "prompt_id"),
        Index("idx_alias_history_changed_at", "changed_at"),
    )
