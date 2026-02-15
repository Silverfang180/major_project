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
    deleted_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)

# ------------------------
# Version Schemas
# ------------------------


class ModelSettings(BaseModel):
    temperature: float = Field(default=1.0, ge=0.0, le=2.0)
    max_tokens: int = Field(default=8192, ge=1, le=32000)
    top_p: float = Field(default=0.95, ge=0.0, le=1.0)
    top_k: Optional[int] = Field(default=None, ge=1)
    # Usage stats might be nested here or separate, but often comes inside 'usage' key from frontend
    usage: Optional[Dict[str, Any]] = None 


class VersionBase(BaseModel):
    prompt_text: str = Field(min_length=0)
    # Strict Validation: Rejects "temprature" or "Temprature"
    model_settings: ModelSettings = Field(default_factory=ModelSettings)
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