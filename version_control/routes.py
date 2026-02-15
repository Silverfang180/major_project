import logging
import re
import uuid
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Depends, Query, status
from sqlalchemy import select, func, desc, update, delete
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from version_control.models import Prompt, PromptVersion
from version_control.alias_history import AliasHistory
from version_control.schemas import (
    VersionCreate, VersionRead,
    PromptCreate, PromptRead, PromptWithLatestVersion, PromptPromote
)
from db import get_session

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
    created_by: Optional[UUID] = Query(default=None)
):
    """List active prompts (excluding soft-deleted) with their latest version."""
    stmt = (
        select(Prompt)
        .options(selectinload(Prompt.versions))
        .where(Prompt.deleted_at.is_(None))  # Filter active only
        .order_by(desc(Prompt.created_at))
    )

    if created_by:
        stmt = stmt.where(Prompt.created_by == created_by)

    stmt = stmt.limit(limit).offset(offset)
    result = await db.execute(stmt)
    prompts = result.scalars().all()

    prompt_data = []
    for prompt in prompts:
        # Filter versions to find latest active one
        # Note: prompt.versions might contain soft-deleted ones if we don't filter load
        # But for 'is_latest', typically there's only one true latest.
        # We should check if the latest version itself is deleted?
        # For now, just finding the one marked is_latest (and presumably not deleted)
        latest = next((v for v in prompt.versions if v.is_latest and not v.deleted_at), None)
        
        obj = PromptWithLatestVersion.from_orm(prompt).copy(
            update={"latest_version": latest}
        )
        prompt_data.append(obj)

    return prompt_data


@router.get("/prompts/{prompt_id}", response_model=PromptWithLatestVersion)
async def get_prompt(prompt_id: UUID, db: AsyncSession = Depends(get_session)):
    """Get a prompt and its active latest version."""
    stmt = (
        select(Prompt)
        .options(selectinload(Prompt.versions))
        .where(Prompt.prompt_id == prompt_id, Prompt.deleted_at.is_(None))
    )
    result = await db.execute(stmt)
    prompt = result.scalar_one_or_none()

    if not prompt:
        raise HTTPException(status_code=404, detail=f"Prompt {prompt_id} not found")

    latest_version = next((v for v in prompt.versions if v.is_latest and not v.deleted_at), None)
    return PromptWithLatestVersion.from_orm(prompt).copy(
        update={"latest_version": latest_version}
    )


@router.delete("/prompts/{prompt_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_prompt(
    prompt_id: UUID, 
    permanent: bool = Query(False),
    db: AsyncSession = Depends(get_session)
):
    """Delete a prompt. Default: Soft delete. Permanent: Hard delete."""
    prompt = await db.get(Prompt, prompt_id)
    if not prompt:
        raise HTTPException(status_code=404, detail=f"Prompt {prompt_id} not found")

    if permanent:
        await db.delete(prompt)
        logger.info(f"Permanently deleted prompt {prompt_id}")
    else:
        # Break production version link to avoid circular deps if needed
        # But actually, soft delete keeps relationships intact usually
        prompt.deleted_at = func.now()
        db.add(prompt)
        logger.info(f"Soft deleted prompt {prompt_id}")

    await db.commit()
    return None


@router.post("/prompts/{prompt_id}/promote", response_model=PromptRead)
async def promote_version(
    prompt_id: UUID, 
    payload: PromptPromote, 
    db: AsyncSession = Depends(get_session)
):
    """Promote a version to production alias."""
    logger.info(f"Promoting version {payload.version_id} to production for prompt {prompt_id}")
    
    prompt = await db.get(Prompt, prompt_id)
    if not prompt:
        raise HTTPException(status_code=404, detail=f"Prompt {prompt_id} not found")
    
    if prompt.deleted_at:
        raise HTTPException(status_code=404, detail=f"Prompt {prompt_id} is deleted")

    version = await db.get(PromptVersion, payload.version_id)
    if not version:
        raise HTTPException(status_code=404, detail=f"Version {payload.version_id} not found")
    if version.prompt_id != prompt_id:
        raise HTTPException(status_code=400, detail="Version does not belong to prompt")
    if version.deleted_at:
        raise HTTPException(status_code=400, detail="Cannot promote a deleted version")

    old_production_version_id = prompt.production_version_id
    prompt.production_version_id = payload.version_id
    
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
# Trash Bin (Prompts)
# ------------------------

@router.get("/prompts/trash/all", response_model=List[PromptWithLatestVersion])
async def list_trash_prompts(
    db: AsyncSession = Depends(get_session),
    limit: int = Query(default=50, le=100, ge=1),
    offset: int = Query(default=0, ge=0)
):
    """List soft-deleted prompts with auto-cleanup (20 days)."""
    
    # Auto-Cleanup
    try:
        cutoff = datetime.utcnow() - timedelta(days=20)
        cleanup_stmt = select(Prompt).where(Prompt.deleted_at < cutoff)
        result = await db.execute(cleanup_stmt)
        expired = result.scalars().all()
        for p in expired:
            await db.delete(p)
        if expired:
            await db.commit()
            logger.info(f"Auto-cleaned {len(expired)} expired prompts")
    except Exception as e:
        logger.error(f"Auto-cleanup failed: {e}")

    stmt = (
        select(Prompt)
        .options(selectinload(Prompt.versions))
        .where(Prompt.deleted_at.is_not(None))
        .order_by(desc(Prompt.deleted_at))
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    prompts = result.scalars().all()

    data = []
    for p in prompts:
        latest = next((v for v in p.versions if v.is_latest), None)
        obj = PromptWithLatestVersion.from_orm(p).copy(update={"latest_version": latest})
        data.append(obj)
    return data


@router.post("/prompts/{prompt_id}/restore", response_model=PromptRead)
async def restore_prompt(prompt_id: UUID, db: AsyncSession = Depends(get_session)):
    """Restore a soft-deleted prompt."""
    prompt = await db.get(Prompt, prompt_id)
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    
    if not prompt.deleted_at:
        return prompt

    prompt.deleted_at = None
    db.add(prompt)
    try:
        await db.commit()
        await db.refresh(prompt)
        return prompt
    except IntegrityError:
        raise HTTPException(status_code=409, detail="Key conflict on restore")


# ------------------------
# Version Endpoints
# ------------------------

@router.post("/versions", response_model=VersionRead, status_code=status.HTTP_201_CREATED)
async def create_version(payload: VersionCreate, db: AsyncSession = Depends(get_session)):
    """Create a new version."""
    logger.info(f"Creating version for prompt {payload.prompt_id}")

    async def _create_version():
        prompt = await db.get(Prompt, payload.prompt_id)
        if not prompt or prompt.deleted_at:
            raise HTTPException(status_code=404, detail=f"Prompt {payload.prompt_id} not found or deleted")

        # Mark old as not latest
        await db.execute(
            update(PromptVersion)
            .where(PromptVersion.prompt_id == payload.prompt_id, PromptVersion.is_latest == True)
            .values(is_latest=False)
        )

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
    """Get latest active version."""
    stmt = (
        select(PromptVersion)
        .where(
            PromptVersion.prompt_id == prompt_id, 
            PromptVersion.is_latest == True,
            PromptVersion.deleted_at.is_(None)
        )
    )
    result = await db.execute(stmt)
    version = result.scalar_one_or_none()

    if not version:
        raise HTTPException(status_code=404, detail=f"No active latest version found for prompt {prompt_id}")
    return version


@router.get("/versions/{prompt_id}/history", response_model=List[VersionRead])
async def get_version_history(
    prompt_id: UUID,
    db: AsyncSession = Depends(get_session),
    limit: int = Query(default=50, le=100, ge=1),
    offset: int = Query(default=0, ge=0)
):
    """Get active version history."""
    prompt = await db.get(Prompt, prompt_id)
    if not prompt or prompt.deleted_at:
        raise HTTPException(status_code=404, detail=f"Prompt {prompt_id} not found")

    stmt = (
        select(PromptVersion)
        .where(PromptVersion.prompt_id == prompt_id, PromptVersion.deleted_at.is_(None))
        .order_by(desc(PromptVersion.ordinal))
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.delete("/versions/{version_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_version(
    version_id: int, 
    permanent: bool = Query(False),
    db: AsyncSession = Depends(get_session)
):
    """Delete a version (Re-introduced with Soft Delete support)."""
    version = await db.get(PromptVersion, version_id)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    if permanent:
        await db.delete(version)
        logger.info(f"Permanently deleted version {version_id}")
    else:
        version.deleted_at = func.now()
        db.add(version)
        logger.info(f"Soft deleted version {version_id}")

    await db.commit()
    return None


# ------------------------
# Trash Bin (Versions)
# ------------------------

@router.get("/versions/trash/all", response_model=List[VersionRead])
async def list_trash_versions(
    db: AsyncSession = Depends(get_session),
    limit: int = Query(default=50, le=100, ge=1),
    offset: int = Query(default=0, ge=0)
):
    """List soft-deleted versions (Auto-cleanup 20 days)."""
    try:
        cutoff = datetime.utcnow() - timedelta(days=20)
        cleanup_stmt = select(PromptVersion).where(PromptVersion.deleted_at < cutoff)
        result = await db.execute(cleanup_stmt)
        expired = result.scalars().all()
        for v in expired:
            await db.delete(v)
        if expired:
            await db.commit()
            logger.info(f"Auto-cleaned {len(expired)} versions")
    except Exception as e:
        logger.error(f"Version auto-cleanup failed: {e}")

    stmt = (
        select(PromptVersion)
        .where(PromptVersion.deleted_at.is_not(None))
        .order_by(desc(PromptVersion.deleted_at))
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/versions/{version_id}/restore", response_model=VersionRead)
async def restore_version(version_id: int, db: AsyncSession = Depends(get_session)):
    """Restore a soft-deleted version."""
    version = await db.get(PromptVersion, version_id)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    
    if not version.deleted_at:
        return version

    version.deleted_at = None
    db.add(version)
    await db.commit()
    await db.refresh(version)
    return version


# ------------------------
# Alias History
# ------------------------

@router.get("/prompts/{prompt_id}/alias-history")
async def get_alias_history(
    prompt_id: UUID,
    db: AsyncSession = Depends(get_session),
    limit: int = Query(default=50, le=100, ge=1),
    offset: int = Query(default=0, ge=0)
):
    """Get alias (promotion) history."""
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
