import asyncio
import os
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine
from version_control.models import Prompt, PromptVersion
from version_control.alias_history import AliasHistory
from db import Base
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load .env explicitly (check root then chronicle subdir)
load_dotenv()
if not os.getenv("DATABASE_URL"):
    load_dotenv(os.path.join("chronicle", ".env"))
    
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    logger.error("DATABASE_URL not found in .env")
    exit(1)

logger.info(f"Using DATABASE_URL: {DATABASE_URL}")

async def create_tables():
    # Create engine locally to ensure we use the Env var
    engine = create_async_engine(DATABASE_URL, echo=True)
    
    logger.info("Creating tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Tables created successfully!")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(create_tables())
