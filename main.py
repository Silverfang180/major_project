import logging
from contextlib import asynccontextmanager
import asyncio
from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import time

from config import settings
from db import engine, Base
from version_control.routes import router as vc_router
from execution.routes import router as exec_router
from evaluation.routes import router as eval_router
from auth.routes import router as auth_router
from auth.utils import decode_access_token

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper()),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

logger = logging.getLogger(__name__)

async def purge_old_trash():
    """Background task to remove items from the trash older than 30 days."""
    from datetime import datetime, timedelta, timezone
    from sqlalchemy import delete
    from db import async_session
    from version_control.models import Prompt, PromptVersion
    from evaluation.models import Dataset, DatasetExample
    
    while True:
        try:
            logger.info("Running background trash purge...")
            thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
            async with async_session() as db:
                # Prompt Versions first (due to FK)
                await db.execute(delete(PromptVersion).where(PromptVersion.deleted_at < thirty_days_ago))
                # Prompts
                await db.execute(delete(Prompt).where(Prompt.deleted_at < thirty_days_ago))
                # Dataset Examples
                await db.execute(delete(DatasetExample).where(DatasetExample.deleted_at < thirty_days_ago))
                # Datasets
                await db.execute(delete(Dataset).where(Dataset.deleted_at < thirty_days_ago))
                
                await db.commit()
            logger.info("Trash purge complete.")
        except Exception as e:
            logger.error(f"Error during trash purge: {e}")
        
        # Run once every 24 hours
        await asyncio.sleep(86400)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application startup and shutdown."""
    logger.info("Starting Chronicle application...")
    # Start background tasks
    purge_task = asyncio.create_task(purge_old_trash())
    yield
    # Cleanup
    purge_task.cancel()
    logger.info("Shutting down Chronicle application...")
    await engine.dispose()

# Create FastAPI app
app = FastAPI(
    title="Chronicle - Prompt Version Control",
    description="A system for managing prompt versions with full history tracking",
    version="1.0.0",
    lifespan=lifespan
)

from prometheus_fastapi_instrumentator import Instrumentator
Instrumentator().instrument(app).expose(app, include_in_schema=False, should_gzip=True)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Authentication Middleware
@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    # Public endpoints
    public_paths = ["/docs", "/openapi.json", "/api/v1/auth/login", "/api/v1/auth/register", "/health", "/metrics"]
    if any(request.url.path.startswith(p) for p in public_paths):
        return await call_next(request)

    # Allow OPTIONS for CORS
    if request.method == "OPTIONS":
        return await call_next(request)

    # Check for Bearer Token
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        # Fallback to X-API-Key for CLI/Legacy support
        api_key = request.headers.get("X-API-Key")
        if api_key == settings.api_key:
            return await call_next(request)
        return JSONResponse(status_code=401, content={"detail": "Missing or invalid credentials"})

    token = auth_header.split(" ")[1]
    payload = decode_access_token(token)
    if not payload:
        return JSONResponse(status_code=401, content={"detail": "Invalid or expired token"})

    # Inject user info into request state
    request.state.user = payload
    return await call_next(request)

# Include Routers
app.include_router(auth_router, prefix="/api/v1")
app.include_router(vc_router, prefix="/api/v1/version-control")
app.include_router(exec_router, prefix="/api/v1")
app.include_router(eval_router, prefix="/api/v1/eval")

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint for Docker."""
    return {
        "status": "healthy",
        "environment": settings.environment,
        "database": "connected"
    }

@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Welcome to Chronicle - Prompt Version Control System",
        "docs": "/docs",
        "health": "/health",
        "gui": "/gui/index.html"
    }

# Mount static files for the GUI
app.mount("/gui", StaticFiles(directory="files", html=True), name="gui")
