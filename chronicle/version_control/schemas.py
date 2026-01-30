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
    created_by: UUID

class PromptRead(PromptBase):
    prompt_id: UUID
    created_by: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)

# ------------------------
# Version Schemas
# ------------------------

class VersionBase(BaseModel):
    prompt_text: str = Field(min_length=0)
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
    
    model_config = ConfigDict(from_attributes=True)

# ------------------------
# Combined Response Schemas
# ------------------------

class PromptWithLatestVersion(PromptRead):
    latest_version: Optional[VersionRead] = None

class PromptWithHistory(PromptRead):
    versions: List[VersionRead] = Field(default_factory=list)


# ------------------------
# Simulation Schemas
# ------------------------

class SimulationRequest(BaseModel):
    prompt_text: str
    provider: str = "gemini"
    model: str = "gemini-flash-latest"
    
class UsageStats(BaseModel):
    input_tokens: int
    output_tokens: int
    total_cost: float

class SimulationResponse(BaseModel):
    response: str
    usage: UsageStats