from datetime import datetime
from typing import Optional, Dict, Any, List
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict


class PromptBase(BaseModel):
    key: Optional[str] = Field(None, min_length=1)
    title: str = Field(min_length=1)
    description: Optional[str] = None

class PromptCreate(PromptBase):
    created_by: UUID

class PromptRead(PromptBase):
    prompt_id: UUID
    key: str
    created_by: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    production_version_id: Optional[int] = None
    deleted_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)

class PromptPromote(BaseModel):
    version_id: int


class VersionBase(BaseModel):
    prompt_text: str = Field(min_length=1)
    model_settings: Dict[str, Any] = Field(default_factory=dict)
    change_note: Optional[str] = None

class VersionCreate(VersionBase):
    prompt_id: UUID
    created_by: UUID

class VersionRead(VersionBase):
    version_id: int
    prompt_id: UUID
    ordinal: int
    created_by: UUID
    created_at: datetime
    is_latest: bool
    deleted_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)

class PromptWithLatestVersion(PromptRead):
    latest_version: Optional[VersionRead] = None