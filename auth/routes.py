from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from db import get_session
from pydantic import BaseModel, EmailStr
from .models import User
from .utils import get_password_hash, verify_password, create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str | None = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str | None

class AuthResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserCreate, db: AsyncSession = Depends(get_session)):
    # Check if user already exists
    stmt = select(User).where(User.email == user_in.email)
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already registered"
        )
    
    # Check if this is the FIRST user to auto-assign legacy data
    users_count_stmt = select(func.count(User.user_id))
    users_count_res = await db.execute(users_count_stmt)
    is_first_user = users_count_res.scalar() == 0

    new_user = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        name=user_in.name
    )
    db.add(new_user)
    await db.flush()  # To get new_user.user_id before commit

    if is_first_user:
        user_id_str = str(new_user.user_id)
        # Import models here to avoid circular imports
        from version_control.models import Prompt, PromptVersion
        from evaluation.models import Dataset, EvalJob
        from execution.models import Run

        # Update all legacy data to belong to this first user
        await db.execute(update(Prompt).values(created_by=user_id_str))
        await db.execute(update(PromptVersion).values(created_by=user_id_str))
        await db.execute(update(Dataset).values(created_by=user_id_str))
        await db.execute(update(EvalJob).values(created_by=user_id_str))
        await db.execute(update(Run).values(created_by=user_id_str))

    await db.commit()
    await db.refresh(new_user)

    access_token = create_access_token(data={"sub": str(new_user.user_id), "email": new_user.email})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": str(new_user.user_id),
            "email": new_user.email,
            "name": new_user.name
        }
    }

@router.post("/login", response_model=AuthResponse)
async def login(user_in: UserLogin, db: AsyncSession = Depends(get_session)):
    stmt = select(User).where(User.email == user_in.email)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(user_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"sub": str(user.user_id), "email": user.email})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": str(user.user_id),
            "email": user.email,
            "name": user.name
        }
    }
