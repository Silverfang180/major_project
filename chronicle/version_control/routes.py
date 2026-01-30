import logging
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Depends, Query, status
from sqlalchemy import select, func, desc, update
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from version_control.models import Prompt, PromptVersion
from version_control.schemas import (
    VersionCreate, VersionRead,
    PromptCreate, PromptRead, PromptWithLatestVersion,
    SimulationRequest, SimulationResponse
)
from db import get_session  # from root db.py
from services.ai_service import ai_service

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(tags=["Version Control"])


# ------------------------
# Error handling helper
# ------------------------

async def handle_db_errors(func, *args, **kwargs):
    """Common database error handling wrapper."""
    try:
        return await func(*args, **kwargs)
    except IntegrityError as e:
        logger.error(f"Integrity error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Database constraint violation"
        )
    except SQLAlchemyError as e:
        logger.error(f"Database error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database operation failed"
        )


# ------------------------
# Prompt Endpoints
# ------------------------

@router.post("/prompts", response_model=PromptRead, status_code=status.HTTP_201_CREATED)
async def create_prompt(payload: PromptCreate, db: AsyncSession = Depends(get_session)):
    """Create a new prompt."""
    logger.info(f"Creating new prompt with key={payload.key}")

    async def _create_prompt():
        prompt = Prompt(**payload.dict())
        db.add(prompt)
        await db.commit()
        await db.refresh(prompt)
        return prompt

    return await handle_db_errors(_create_prompt)


@router.get("/prompts", response_model=List[PromptWithLatestVersion])
async def list_prompts(
    db: AsyncSession = Depends(get_session),
    limit: int = Query(default=50, le=100, ge=1),
    offset: int = Query(default=0, ge=0),
    created_by: Optional[UUID] = Query(default=None)
):
    """List prompts with their latest version."""
    # Optimized Query: Fetch prompts + latest_version in ONE go.
    stmt = (
        select(Prompt)
        .options(selectinload(Prompt.latest_version)) # Efficiently load single related row
        .order_by(desc(Prompt.created_at))
    )

    if created_by:
        stmt = stmt.where(Prompt.created_by == created_by)

    stmt = stmt.limit(limit).offset(offset)
    result = await db.execute(stmt)
    prompts = result.scalars().all()

    prompt_data = []
    for prompt in prompts:
        # No more filtering loop! Direct access.
        obj = PromptWithLatestVersion.from_orm(prompt).copy(
            update={"latest_version": prompt.latest_version}
        )
        prompt_data.append(obj)

    return prompt_data


@router.get("/prompts/{prompt_id}", response_model=PromptWithLatestVersion)
async def get_prompt(prompt_id: UUID, db: AsyncSession = Depends(get_session)):
    """Get a prompt and its latest version."""
    stmt = (
        select(Prompt)
        .options(selectinload(Prompt.latest_version))
        .where(Prompt.prompt_id == prompt_id)
    )
    result = await db.execute(stmt)
    prompt = result.scalar_one_or_none()

    if not prompt:
        raise HTTPException(status_code=404, detail=f"Prompt {prompt_id} not found")

    return PromptWithLatestVersion.from_orm(prompt).copy(
        update={"latest_version": prompt.latest_version}
    )


@router.patch("/prompts/{prompt_id}", response_model=PromptRead)
async def update_prompt(prompt_id: UUID, payload: PromptCreate, db: AsyncSession = Depends(get_session)):
    """Update prompt details (Title/Key)."""
    prompt = await db.get(Prompt, prompt_id)
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    
    prompt.title = payload.title
    # We generally don't update key or created_by, but strictly speaking payload has them.
    # For now let's just update title.
    
    db.add(prompt)
    await db.commit()
    await db.refresh(prompt)
    return prompt


@router.delete("/prompts/{prompt_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_prompt(prompt_id: UUID, db: AsyncSession = Depends(get_session)):
    """Delete a prompt and all its versions."""
    prompt = await db.get(Prompt, prompt_id)
    if not prompt:
        raise HTTPException(status_code=404, detail=f"Prompt {prompt_id} not found")

    # Denormalization Fix: Break circular dependency
    # Prompt points to Version (latest_version_id)
    # Version points to Prompt (prompt_id) with Cascade
    # We must clear the pointer first to allow cascade to work cleanly.
    prompt.latest_version_id = None
    db.add(prompt)
    await db.flush()

    await db.delete(prompt)
    await db.commit()
    logger.info(f"Deleted prompt {prompt_id}")
    return None


# ------------------------
# Version Endpoints
# ------------------------

@router.post("/versions", response_model=VersionRead, status_code=status.HTTP_201_CREATED)
async def create_version(payload: VersionCreate, db: AsyncSession = Depends(get_session)):
    """Create a new version of a prompt."""
    logger.info(f"Creating version for prompt {payload.prompt_id}")

    async def _create_version():
        prompt = await db.get(Prompt, payload.prompt_id)
        if not prompt:
            raise HTTPException(status_code=404, detail=f"Prompt {payload.prompt_id} not found")

        # Validation: Prevent empty/whitespace versions
        clean_text = payload.prompt_text.strip()
        if not clean_text:
             raise HTTPException(status_code=400, detail="Prompt text cannot be empty or whitespace only.")


        # Mark old versions as not latest
        await db.execute(
            update(PromptVersion)
            .where(PromptVersion.prompt_id == payload.prompt_id, PromptVersion.is_latest == True)
            .values(is_latest=False)
        )

        # Calculate next ordinal safely
        result = await db.execute(
            select(func.coalesce(func.max(PromptVersion.ordinal), 0))
            .where(PromptVersion.prompt_id == payload.prompt_id)
        )
        next_ordinal = result.scalar_one() + 1

        new_version = PromptVersion(
            prompt_id=payload.prompt_id,
            ordinal=next_ordinal,
            prompt_text=clean_text,
            model_settings=payload.model_settings,
            change_note=payload.change_note,
            created_by=payload.created_by,
            is_latest=True,
        )
        db.add(new_version)
        await db.flush() # Flush to get version_id
        
        # Update parent pointer (Denormalization)
        prompt.latest_version_id = new_version.version_id
        db.add(prompt)
        
        await db.commit()
        await db.refresh(new_version)
        return new_version

    return await handle_db_errors(_create_version)


@router.get("/versions/latest/{prompt_id}", response_model=VersionRead)
async def get_latest_version(prompt_id: UUID, db: AsyncSession = Depends(get_session)):
    """Get latest version of a prompt."""
    stmt = (
        select(PromptVersion)
        .where(PromptVersion.prompt_id == prompt_id, PromptVersion.is_latest == True)
    )
    result = await db.execute(stmt)
    version = result.scalar_one_or_none()

    if not version:
        raise HTTPException(status_code=404, detail=f"No versions found for prompt {prompt_id}")

    return version


@router.get("/versions/{prompt_id}/history", response_model=List[VersionRead])
async def get_version_history(
    prompt_id: UUID,
    db: AsyncSession = Depends(get_session),
    limit: int = Query(default=50, le=100, ge=1),
    offset: int = Query(default=0, ge=0)
):
    """Get version history of a prompt (paginated)."""
    prompt = await db.get(Prompt, prompt_id)
    if not prompt:
        raise HTTPException(status_code=404, detail=f"Prompt {prompt_id} not found")

    stmt = (
        select(PromptVersion)
        .where(PromptVersion.prompt_id == prompt_id)
        .order_by(desc(PromptVersion.ordinal))
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    versions = result.scalars().all()
    return versions


@router.delete("/versions/{version_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_version(version_id: int, db: AsyncSession = Depends(get_session)):
    """Delete a specific version."""
    version = await db.get(PromptVersion, version_id)
    if not version:
        raise HTTPException(status_code=404, detail=f"Version {version_id} not found")

    # Denormalization Fix: Unlink from parent if this is the "latest"
    # Otherwise FK constraint blocks deletion
    prompt = await db.get(Prompt, version.prompt_id)
    if prompt and prompt.latest_version_id == version_id:
        # 1. Unlink (set to None) to allow deletion
        prompt.latest_version_id = None
        db.add(prompt)
        await db.flush()
        
        # 2. (Optional Refinement) Attempt to find new latest?
        # For now, we leave it None. If user lists prompts, it shows no latest.
        # This matches "No Versions Found" behavior if last one is deleted.

    await db.delete(version)
    await db.commit()
    logger.info(f"Deleted version {version_id}")
    return None
    await db.commit()
    logger.info(f"Deleted version {version_id}")
    return None


# ------------------------
# AI Simulation Endpoints
# ------------------------

@router.post("/simulate", response_model=SimulationResponse)
async def simulate_prompt(payload: SimulationRequest):
    """Run a prompt through Gemini and calculate costs."""
    
    # 1. Calculate Input Tokens
    input_tokens = ai_service.count_tokens(payload.prompt_text, payload.provider)
    
    # 2. Call AI
    response_text = await ai_service.generate_response(payload.prompt_text, payload.provider, payload.model)
    
    # 3. Calculate Output Tokens
    output_tokens = ai_service.count_tokens(response_text, payload.provider)
    
    # 4. Calculate Cost
    cost = ai_service.calculate_cost(input_tokens, output_tokens, payload.provider, payload.model)
    
    return {
        "response": response_text,
        "usage": {
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_cost": cost
        }
    }
