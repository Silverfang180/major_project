import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from db import engine, Base
from version_control.routes import router as version_router

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper()),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application startup and shutdown."""
    logger.info("Starting Chronicle application...")
    yield
    logger.info("Shutting down Chronicle application...")
    await engine.dispose()

# Create FastAPI app
app = FastAPI(
    title="Chronicle - Prompt Version Control",
    description="A system for managing prompt versions with full history tracking",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.environment == "development" else [],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(
    version_router, 
    prefix="/api/v1/version-control", 
    tags=["Version Control"]
)

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
        "health": "/health"
    }