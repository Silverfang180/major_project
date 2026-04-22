import logging
import re
import uuid
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Depends, Query, status, Header
from sqlalchemy import select, func, desc, update
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from version_control.models import Prompt, PromptVersion
from version_control.alias_history import AliasHistory
from version_control.schemas import (
    VersionCreate, VersionRead,
    PromptCreate, PromptRead, PromptWithLatestVersion, PromptPromote
)
from db import get_session  # from root db.py

# Configure logging
logger = logging.getLogger(__name__)


def generate_prompt_key(title: str) -> str:
    slug = re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')
    slug = slug[:50]
    suffix = uuid.uuid4().hex[:6]
    return f"{slug}-{suffix}" if slug else suffix


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
    # Auto-generate key from title if not provided
    if not payload.key:
        payload.key = generate_prompt_key(payload.title)

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
    x_chronicle_user: str = Header(default="legacy-user", alias="X-Chronicle-User")
):
    """List prompts with their latest version."""
    stmt = select(Prompt).options(
        selectinload(Prompt.versions)
    ).where(
        Prompt.deleted_at.is_(None),
        Prompt.created_by == x_chronicle_user
    ).order_by(desc(Prompt.created_at))

    stmt = stmt.limit(limit).offset(offset)
    result = await db.execute(stmt)
    prompts = result.scalars().all()

    prompt_data = []
    for prompt in prompts:
        latest_version = next((v for v in prompt.versions if v.is_latest), None)
        obj = PromptWithLatestVersion.model_validate(prompt).model_copy(
            update={"latest_version": latest_version}
        )
        prompt_data.append(obj)

    return prompt_data


@router.get("/prompts/{prompt_id}", response_model=PromptWithLatestVersion)
async def get_prompt(prompt_id: UUID, db: AsyncSession = Depends(get_session)):
    """Get a prompt and its latest version."""
    stmt = (
        select(Prompt)
        .options(selectinload(Prompt.versions))
        .where(Prompt.prompt_id == prompt_id, Prompt.deleted_at.is_(None))
    )
    result = await db.execute(stmt)
    prompt = result.scalar_one_or_none()

    if not prompt:
        raise HTTPException(status_code=404, detail=f"Prompt {prompt_id} not found")

    latest_version = next((v for v in prompt.versions if v.is_latest), None)
    return PromptWithLatestVersion.model_validate(prompt).model_copy(
        update={"latest_version": latest_version}
    )


@router.delete("/prompts/{prompt_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_prompt(prompt_id: UUID, permanent: bool = False, db: AsyncSession = Depends(get_session)):
    """Delete a prompt. If permanent is False, soft delete the prompt and all versions."""
    prompt = await db.get(Prompt, prompt_id)
    if not prompt:
        raise HTTPException(status_code=404, detail=f"Prompt {prompt_id} not found")

    if not permanent:
        logger.info(f"Soft deleting prompt {prompt_id}")
        prompt.deleted_at = func.now()
        
        # Soft delete versions too
        stmt = (
            update(PromptVersion)
            .where(PromptVersion.prompt_id == prompt_id)
            .values(deleted_at=func.now())
        )
        await db.execute(stmt)
        await db.commit()
        return None

    # Hard Delete path
    # 1. Break pointer
    prompt.production_version_id = None
    db.add(prompt)
    await db.flush()

    from sqlalchemy import delete
    # 2. Evict relationship state
    db.expunge(prompt)

    # 3. Pure SQL bulk delete
    await db.execute(delete(PromptVersion).where(PromptVersion.prompt_id == prompt_id))
    await db.execute(delete(Prompt).where(Prompt.prompt_id == prompt_id))

    await db.commit()
    logger.info(f"Deleted prompt {prompt_id} permanently")
    return None


@router.post("/prompts/{prompt_id}/promote", response_model=PromptRead)
async def promote_version(
    prompt_id: UUID, 
    payload: PromptPromote, 
    db: AsyncSession = Depends(get_session)
):
    """Promote a version to production alias."""
    logger.info(f"Promoting version {payload.version_id} to production for prompt {prompt_id}")
    
    # Get prompt
    prompt = await db.get(Prompt, prompt_id)
    if not prompt:
        raise HTTPException(status_code=404, detail=f"Prompt {prompt_id} not found")
    
    # Verify version belongs to this prompt
    version = await db.get(PromptVersion, payload.version_id)
    if not version:
        raise HTTPException(status_code=404, detail=f"Version {payload.version_id} not found")
    if version.prompt_id != prompt_id:
        raise HTTPException(
            status_code=400, 
            detail=f"Version {payload.version_id} does not belong to prompt {prompt_id}"
        )
    
    # Capture old production version for audit trail
    old_production_version_id = prompt.production_version_id
    
    # Update production alias
    prompt.production_version_id = payload.version_id
    
    # Record alias change in audit trail
    alias_record = AliasHistory(
        prompt_id=prompt_id,
        from_version_id=old_production_version_id,
        to_version_id=payload.version_id,
    )
    db.add(alias_record)
    
    await db.commit()
    await db.refresh(prompt)
    
    logger.info(f"Promoted version {payload.version_id} to production")
    return prompt


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
            prompt_text=payload.prompt_text,
            model_settings=payload.model_settings,
            change_note=payload.change_note,
            created_by=payload.created_by,
            is_latest=True,
        )
        db.add(new_version)
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
        .where(PromptVersion.prompt_id == prompt_id, PromptVersion.deleted_at.is_(None))
        .order_by(desc(PromptVersion.ordinal))
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    versions = result.scalars().all()
    return versions


# ------------------------
# Alias History Endpoint
# ------------------------

@router.get("/prompts/{prompt_id}/alias-history")
async def get_alias_history(
    prompt_id: UUID,
    db: AsyncSession = Depends(get_session),
    limit: int = Query(default=50, le=100, ge=1),
    offset: int = Query(default=0, ge=0)
):
    """Get alias (promotion) history for a prompt."""
    prompt = await db.get(Prompt, prompt_id)
    if not prompt:
        raise HTTPException(status_code=404, detail=f"Prompt {prompt_id} not found")

    stmt = (
        select(AliasHistory)
        .where(AliasHistory.prompt_id == prompt_id)
        .order_by(desc(AliasHistory.changed_at))
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    rows = result.scalars().all()

    return [
        {
            "id": r.id,
            "prompt_id": str(r.prompt_id),
            "from_version_id": r.from_version_id,
            "to_version_id": r.to_version_id,
            "changed_by": r.changed_by,
            "changed_at": r.changed_at.isoformat() if r.changed_at else None,
        }
        for r in rows
    ]


# ------------------------
# Trash & Restore Endpoints
# ------------------------

@router.delete("/versions/{version_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_version(version_id: int, permanent: bool = False, db: AsyncSession = Depends(get_session)):
    """Delete a specific version."""
    version = await db.get(PromptVersion, version_id)
    if not version:
        raise HTTPException(status_code=404, detail=f"Version {version_id} not found")

    if not permanent:
        version.deleted_at = func.now()
        await db.commit()
        return None

    # Hard Delete path
    from sqlalchemy import delete
    await db.execute(delete(PromptVersion).where(PromptVersion.version_id == version_id))
    await db.commit()
    return None


@router.post("/prompts/{prompt_id}/restore", response_model=PromptRead)
async def restore_prompt(prompt_id: UUID, db: AsyncSession = Depends(get_session)):
    """Restore a soft-deleted prompt and its versions."""
    prompt = await db.get(Prompt, prompt_id)
    if not prompt:
        raise HTTPException(status_code=404, detail=f"Prompt {prompt_id} not found")

    async def _restore():
        prompt.deleted_at = None
        await db.execute(
            update(PromptVersion)
            .where(PromptVersion.prompt_id == prompt_id)
            .values(deleted_at=None)
        )
        await db.commit()
        await db.refresh(prompt)
        return prompt

    return await handle_db_errors(_restore)


@router.post("/versions/{version_id}/restore", response_model=VersionRead)
async def restore_version(version_id: int, db: AsyncSession = Depends(get_session)):
    """Restore a soft-deleted version."""
    version = await db.get(PromptVersion, version_id)
    if not version:
        raise HTTPException(status_code=404, detail=f"Version {version_id} not found")

    async def _restore():
        version.deleted_at = None
        await db.commit()
        await db.refresh(version)
        return version

    return await handle_db_errors(_restore)


@router.get("/prompts/trash/all", response_model=List[PromptRead])
async def list_trashed_prompts(
    db: AsyncSession = Depends(get_session),
    x_chronicle_user: str = Header(default="", alias="X-Chronicle-User")
):
    """List all soft-deleted prompts for the user."""
    # Use the header user by default, or fallback to something more generic 
    # (In real prod, we'd use current_user dependency)
    user_id = x_chronicle_user or "legacy-user"
    
    logger.info(f"Listing trashed prompts for user: {user_id}")
    stmt = select(Prompt).where(
        Prompt.deleted_at.is_not(None),
        Prompt.created_by == user_id
    ).order_by(desc(Prompt.deleted_at))
    
    result = await db.execute(stmt)
    prompts = result.scalars().all()
    logger.info(f"Found {len(prompts)} trashed prompts")
    return prompts


@router.get("/versions/trash/all", response_model=List[VersionRead])
async def list_trashed_versions(db: AsyncSession = Depends(get_session)):
    """List all soft-deleted versions."""
    stmt = select(PromptVersion).where(PromptVersion.deleted_at.is_not(None)).order_by(desc(PromptVersion.deleted_at))
    result = await db.execute(stmt)
    return result.scalars().all()
