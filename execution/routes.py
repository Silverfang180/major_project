"""
Execution Routes
The single execution entrypoint for PromptOps.

POST /execute/{prompt_key}?alias=production
"""

import logging
import time
import os
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Query, Response, Header
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_session
from version_control.models import Prompt, PromptVersion
from execution.models import Run
from execution.schemas import ExecuteRequest, ExecuteResponse
from execution.variable_engine import (
    extract_placeholders, 
    validate_variables, 
    render_prompt,
    VariableError
)
from execution.llm_service import call_llm, LLMError
from execution.pricing import calculate_cost, MODEL_PRICING


logger = logging.getLogger(__name__)

router = APIRouter(tags=["Execution"])

from prometheus_client import REGISTRY

@router.get("/metrics/summary")
async def get_metrics_summary():
    """Returns a JSON summary of Prometheus metrics."""
    metrics = []
    for metric in REGISTRY.collect():
        samples = []
        for sample in metric.samples:
            samples.append({
                "name": sample.name,
                "labels": sample.labels,
                "value": sample.value
            })
        metrics.append({
            "name": metric.name,
            "description": metric.documentation,
            "type": metric.type,
            "samples": samples
        })
    
    total_requests = 0
    total_errors = 0
    latency_sum = 0
    latency_count = 0
    
    for metric in metrics:
        if metric["name"] == "http_requests_total":
            for sample in metric["samples"]:
                total_requests += sample["value"]
                status = sample["labels"].get("status", "200")
                if status.startswith("4") or status.startswith("5"):
                    total_errors += sample["value"]
        elif metric["name"] == "http_request_duration_seconds":
            for sample in metric["samples"]:
                if sample["name"] == "http_request_duration_seconds_sum":
                    latency_sum += sample["value"]
                elif sample["name"] == "http_request_duration_seconds_count":
                    latency_count += sample["value"]

    avg_latency = round((latency_sum / latency_count) * 1000, 2) if latency_count > 0 else 0
    error_rate = round((total_errors / total_requests) * 100, 2) if total_requests > 0 else 0
    
    return {
        "kpis": {
            "total_requests": int(total_requests),
            "total_errors": int(total_errors),
            "error_rate_percent": error_rate,
            "average_latency_ms": avg_latency
        },
        "raw_metrics": metrics
    }



@router.get("/runs")
async def list_runs(
    db: AsyncSession = Depends(get_session),
    x_chronicle_user: str = Header(default="legacy-user", alias="X-Chronicle-User")
):
    from execution.schemas import RunRead
    stmt = select(Run).where(Run.created_by == x_chronicle_user).order_by(Run.created_at.desc()).limit(100)
    result = await db.execute(stmt)
    runs = result.scalars().all()
    return [RunRead.model_validate(r) for r in runs]


@router.get("/pricing")
async def get_model_pricing():
    """Return the current model pricing list."""
    pricing_list = []
    for model_name, costs in MODEL_PRICING.items():
        # Determine provider heuristically
        lower_name = model_name.lower()
        if "gpt" in lower_name:
            provider = "OpenAI"
        elif "gemini" in lower_name:
            provider = "Google"
        elif "llama" in lower_name or "moonshot" in lower_name:
            provider = "Groq"
        else:
            provider = "Other"

        # Special formatting for very small numbers to avoid $0.00
        input_1m = costs['input_cost_per_1k'] * 1000
        output_1m = costs['output_cost_per_1k'] * 1000
        
        input_str = f"${input_1m:.3f}".rstrip('0').rstrip('.') if input_1m < 0.01 else f"${input_1m:.2f}"
        output_str = f"${output_1m:.3f}".rstrip('0').rstrip('.') if output_1m < 0.01 else f"${output_1m:.2f}"

        pricing_list.append({
            "model": model_name,
            "provider": provider,
            "inputPrice": f"{input_str} / 1M",
            "outputPrice": f"{output_str} / 1M"
        })
    return pricing_list


@router.get("/config/keys")
async def get_api_keys():
    """Return configured API keys (masked)."""
    keys_config = [
        {"name": "Google AI", "env_var": "GEMINI_API_KEY"},
        {"name": "Groq", "env_var": "GROQ_API_KEY"},
    ]
    
    response = []
    for k in keys_config:
        val = os.getenv(k["env_var"], "")
        # Mask the middle of the key for security as requested: "make them in '*****'"
        if len(val) > 8:
            masked = f"{val[:4]}****{val[-4:]}"
        elif val:
            masked = "********"
        else:
            masked = "missing"
            
        response.append({
            "name": k["name"],
            "key": masked,
            "status": "active" if val else "missing"
        })
    return response


# update_api_key endpoint removed for security. Config should be managed via .env or Orchestrator variables.

class SimulateRequest(BaseModel):
    prompt_text: str
    provider: str
    model: str
    temperature: float = 0.7
    max_tokens: int = 1000
    input_vars: dict = {}

@router.post("/simulate")
async def simulate_prompt(
    payload: SimulateRequest,
    x_gemini_key: Optional[str] = Header(default=None, alias="X-Gemini-Key"),
    x_groq_key: Optional[str] = Header(default=None, alias="X-Groq-Key")
):
    rendered = render_prompt(payload.prompt_text, payload.input_vars)
    start_time = time.perf_counter()
    try:
        llm_result = await call_llm(
            rendered_prompt=rendered,
            model=payload.model,
            temperature=payload.temperature,
            max_tokens=payload.max_tokens,
            gemini_api_key=x_gemini_key,
            groq_api_key=x_groq_key
        )
        return llm_result
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.post("/execute/{prompt_key}", response_model=ExecuteResponse)
async def execute_prompt(
    prompt_key: str,
    payload: ExecuteRequest,
    response: Response,
    version_id: Optional[int] = Query(default=None, description="Specific version to execute"),
    alias: str = Query(default="production", description="Alias to resolve (production only in Phase-1)"),
    db: AsyncSession = Depends(get_session),
    x_chronicle_user: str = Header(default="legacy-user", alias="X-Chronicle-User"),
    x_gemini_key: Optional[str] = Header(default=None, alias="X-Gemini-Key"),
    x_groq_key: Optional[str] = Header(default=None, alias="X-Groq-Key")
):
    """
    Execute a prompt with variable injection.
    
    Flow:
    1. Resolve prompt_key → Prompt
    2. Resolve version_id OR alias → PromptVersion
    3. Extract placeholders, validate variables
    4. Render prompt
    5. Insert pending run
    6. Call LLM (in try/finally)
    7. Update run with result
    8. Return response with X-PromptOps-Run-ID header
    """
    logger.info(f"Executing prompt '{prompt_key}' (version_id={version_id}, alias={alias})")
    
    # Step 1: Resolve prompt by key
    stmt = select(Prompt).where(Prompt.key == prompt_key)
    result = await db.execute(stmt)
    prompt = result.scalar_one_or_none()
    
    if not prompt:
        raise HTTPException(status_code=404, detail=f"Prompt '{prompt_key}' not found")
    
    # Step 2: Resolve version OR alias
    version = None
    if version_id is not None:
        version = await db.get(PromptVersion, version_id)
        if not version:
            raise HTTPException(status_code=404, detail="Version not found")
        if version.prompt_id != prompt.prompt_id:
            raise HTTPException(status_code=400, detail="Version does not belong to this prompt")
        used_alias = f"version:{version_id}"
    else:
        # Phase-1: Only production alias supported
        if alias != "production":
            raise HTTPException(
                status_code=400,
                detail=f"Alias '{alias}' not supported. Phase-1 only supports 'production'."
            )
        
        if not prompt.production_version_id:
            raise HTTPException(
                status_code=404, 
                detail=f"Prompt '{prompt_key}' has no production version. Use POST /prompts/{{id}}/promote first."
            )
        
        version = await db.get(PromptVersion, prompt.production_version_id)
        if not version:
            raise HTTPException(
                status_code=500, 
                detail=f"Production version {prompt.production_version_id} not found (data integrity issue)"
            )
        used_alias = alias

    # Step 3: Extract and validate variables
    try:
        required_vars = extract_placeholders(version.prompt_text)
        validate_variables(required_vars, payload.variables, strict=True)
    except VariableError as e:
        raise HTTPException(status_code=422, detail=str(e))

    
    # Step 4: Render prompt
    rendered = render_prompt(version.prompt_text, payload.variables)
    
    # Step 5: Pre-insert pending run
    run = Run(
        version_id=version.version_id,
        prompt_key=prompt_key,
        alias_used=used_alias,
        input_vars=payload.variables,
        rendered_prompt=rendered,
        raw_response={},
        latency_ms=0,
        status="pending",
        created_by=x_chronicle_user,
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)
    
    logger.info(f"Run {run.run_id} created with status=pending")
    
    # Step 6: Call LLM with try/finally to always update run
    start_time = time.perf_counter()
    run_status = "error"
    error_message = "Execution did not complete (unexpected failure)"
    raw_response = {}
    llm_response_text = ""
    cost_usd = None
    
    try:
        # Use model settings from version if available
        model = version.model_settings.get("model") if version.model_settings else None
        temperature = version.model_settings.get("temperature", 0.7) if version.model_settings else 0.7
        max_tokens = version.model_settings.get("max_tokens", 1000) if version.model_settings else 1000
        
        llm_result = await call_llm(
            rendered_prompt=rendered,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            gemini_api_key=x_gemini_key,
            groq_api_key=x_groq_key
        )
        
        llm_response_text = llm_result["response"]
        raw_response = llm_result
        run_status = "success"
        error_message = None
        
        # Calculate cost from token usage
        usage = llm_result.get("usage", {})
        cost_usd = calculate_cost(
            model_name=llm_result.get("model", ""),
            prompt_tokens=usage.get("prompt_tokens", 0),
            completion_tokens=usage.get("completion_tokens", 0)
        )
        
    except LLMError as e:
        run_status = "error"
        error_message = str(e)
        raw_response = {"error": str(e)}
        logger.error(f"LLM call failed for prompt '{prompt_key}': {e}")
    except Exception as e:
        run_status = "error"
        error_message = f"Unexpected error: {str(e)}"
        raw_response = {"error": f"Unexpected error: {str(e)}"}
        logger.error(f"Unexpected error during LLM call for prompt '{prompt_key}': {e}")
    finally:
        # Step 7: Always update the run row
        latency_ms = int((time.perf_counter() - start_time) * 1000)
        run.status = run_status
        run.raw_response = raw_response
        run.latency_ms = latency_ms
        run.error_message = error_message
        run.cost_usd = cost_usd
        await db.commit()
        await db.refresh(run)
        logger.info(f"Run {run.run_id} finalized: status={run_status}, latency={latency_ms}ms")
    
    # Step 8: Add correlation header and return
    response.headers["X-PromptOps-Run-ID"] = str(run.run_id)
    
    # If LLM failed, return 502
    if run_status == "error":
        raise HTTPException(
            status_code=502,
            detail=f"LLM call failed: {error_message}",
            headers={"X-PromptOps-Run-ID": str(run.run_id)}
        )
    
    usage = raw_response.get("usage", {})
    
    return ExecuteResponse(
        run_id=run.run_id,
        rendered_prompt=rendered,
        response=llm_response_text,
        latency_ms=latency_ms,
        status=run_status,
        model_used=raw_response.get("model"),
        prompt_tokens=usage.get("prompt_tokens"),
        completion_tokens=usage.get("completion_tokens"),
        cost_usd=float(cost_usd) if cost_usd is not None else None
    )

