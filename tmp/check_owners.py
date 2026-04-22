import asyncio
import sys
import os

# Add current directory to path
sys.path.append(os.getcwd())

from db import engine, async_session
from sqlalchemy import select
from version_control.models import Prompt

async def main():
    try:
        async with async_session() as db:
            res = await db.execute(select(Prompt.created_by).distinct())
            owners = res.scalars().all()
            print(f"Distinct Owners in Prompts: {owners}")
            
            res_count = await db.execute(select(Prompt))
            print(f"Total Prompt Count: {len(res_count.scalars().all())}")
            
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    asyncio.run(main())
