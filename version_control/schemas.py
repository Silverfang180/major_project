from datetime import datetime
from typing import Optional, Dict, Any, List
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict

# ------------------------
# Prompt Schemas
# ------------------------

class PromptBase(BaseModel):
    key: str = Field(min_length=1)
    title: str = Field(min_length=1)
    description: Optional[str] = None

class PromptCreate(PromptBase):
    key: str | None = None
    created_by: str = Field(min_length=1, max_length=64)

class PromptRead(PromptBase):
    prompt_id: UUID
    created_by: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None
    production_version_id: Optional[int] = None
    
    model_config = ConfigDict(from_attributes=True)

# ------------------------
# Version Schemas
# ------------------------

class VersionBase(BaseModel):
    prompt_text: str = Field(min_length=1, max_length=131072)
    model_settings: Dict[str, Any] = Field(default_factory=dict)
    change_note: Optional[str] = None

class VersionCreate(VersionBase):
    prompt_id: UUID
    created_by: str = Field(min_length=1, max_length=64)

class VersionRead(VersionBase):
    version_id: int
    prompt_id: UUID
    prompt_title: Optional[str] = None
    ordinal: int
    created_by: str
    created_at: datetime
    deleted_at: Optional[datetime] = None
    is_latest: bool
    
    model_config = ConfigDict(from_attributes=True)

# ------------------------
# Combined Response Schemas
# ------------------------

class PromptWithLatestVersion(PromptRead):
    latest_version: Optional[VersionRead] = None

class PromptWithHistory(PromptRead):
    versions: List[VersionRead] = Field(default_factory=list)

# ------------------------
# Promote Schema
# ------------------------

class PromptPromote(BaseModel):
    """Request body for promoting a version to production alias."""
    version_id: int