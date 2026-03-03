import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from config import settings
from db import engine, Base
from version_control.routes import router as version_router
from execution.routes import router as execution_router
from evaluation.routes import router as evaluation_router

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

# API Key authentication middleware
PUBLIC_PATHS = ("/health", "/docs", "/redoc", "/openapi.json")

@app.middleware("http")
async def api_key_middleware(request: Request, call_next):
    path = request.url.path
    if request.method == "OPTIONS" or path.startswith("/gui") or path in PUBLIC_PATHS:
        return await call_next(request)
    api_key = request.headers.get("X-API-Key")
    if api_key != settings.api_key:
        return JSONResponse(
            status_code=401,
            content={"detail": "Invalid or missing API key"}
        )
    return await call_next(request)

# Register routers
app.include_router(
    version_router, 
    prefix="/api/v1/version-control", 
    tags=["Version Control"]
)
app.include_router(
    execution_router,
    prefix="/api/v1",
    tags=["Execution"]
)
app.include_router(
    evaluation_router,
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
        "health": "/health",
        "gui": "/gui/index.html"
    }

# Mount static files for the GUI
app.mount("/gui", StaticFiles(directory="files", html=True), name="gui")