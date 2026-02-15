# Update your version_control/models.py - Fix the imports

from datetime import datetime
from sqlalchemy import (
    BigInteger, Boolean, Column, DateTime, ForeignKey, Integer, Text, 
    UniqueConstraint, Index, CheckConstraint
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

# Import Base from the root db.py
from db import Base


class Prompt(Base):
    __tablename__ = "prompts"

    prompt_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    key = Column(Text, unique=True, nullable=False)
    title = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    created_by = Column(UUID(as_uuid=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    versions = relationship("PromptVersion", back_populates="prompt", cascade="all, delete-orphan", foreign_keys="PromptVersion.prompt_id")
    
    # Alias resolution: points to a specific version_id for production
    production_version_id = Column(BigInteger, ForeignKey("prompt_versions.version_id", ondelete="SET NULL"), nullable=True)
    production_version = relationship("PromptVersion", foreign_keys=[production_version_id])

    __table_args__ = (
        CheckConstraint("char_length(key) > 0", name="ck_prompts_key_not_empty"),
        CheckConstraint("char_length(title) > 0", name="ck_prompts_title_not_empty"),
        Index("idx_prompts_key", "key"),
        Index("idx_prompts_created_by", "created_by"),
    )


class PromptVersion(Base):
    __tablename__ = "prompt_versions"

    version_id = Column(BigInteger, primary_key=True, autoincrement=True)
    prompt_id = Column(
        UUID(as_uuid=True), 
        ForeignKey("prompts.prompt_id", ondelete="CASCADE"), 
        nullable=False
    )
    ordinal = Column(Integer, nullable=False)
    prompt_text = Column(Text, nullable=False)
    model_settings = Column(JSONB, nullable=False, default=dict)
    change_note = Column(Text)
    created_by = Column(UUID(as_uuid=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)
    is_latest = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    
    # Add version for optimistic locking
    version = Column(Integer, nullable=False, default=1)

    prompt = relationship("Prompt", back_populates="versions", foreign_keys=[prompt_id])

    __table_args__ = (
        UniqueConstraint('prompt_id', 'ordinal', name='ux_prompt_versions_prompt_ordinal'),
        CheckConstraint("char_length(prompt_text) > 0", name="ck_prompt_versions_text_not_empty"),
        CheckConstraint("ordinal > 0", name="ck_prompt_versions_ordinal_positive"),
        Index(
            "idx_prompt_versions_unique_latest", 
            "prompt_id", 
            unique=True,
            postgresql_where=Column("is_latest") == True
        ),
        Index("idx_prompt_versions_prompt_id_created_at", "prompt_id", "created_at"),
        Index("idx_prompt_versions_prompt_id_ordinal", "prompt_id", "ordinal"),
        Index("idx_prompt_versions_created_by", "created_by"),
    )
