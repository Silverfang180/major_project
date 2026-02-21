"""
Execution Schemas
Pydantic models for execution requests/responses.
"""

from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, ConfigDict, Field


class ExecuteRequest(BaseModel):
    """Request body for executing a prompt."""
    variables: Dict[str, Any] = Field(default_factory=dict)


class ExecuteResponse(BaseModel):
    """Response from prompt execution."""
    run_id: int
    rendered_prompt: str
    response: str
    latency_ms: int
    status: str
    model_used: Optional[str] = None
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    cost_usd: Optional[float] = None
    
    model_config = ConfigDict(from_attributes=True)


class RunRead(BaseModel):
    """Full run details for history queries."""
    run_id: int
    version_id: Optional[int] = None
    prompt_key: str
    alias_used: str
    input_vars: Dict[str, Any]
    rendered_prompt: str
    raw_response: Dict[str, Any]
    latency_ms: int
    status: str
    error_message: Optional[str] = None
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
