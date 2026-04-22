import asyncio
import sys
import os

# Add current directory to path
sys.path.append(os.getcwd())

from db import engine, async_session
from sqlalchemy import inspect, select

async def main():
    try:
        async with engine.connect() as conn:
            tables = await conn.run_sync(lambda sync_conn: inspect(sync_conn).get_table_names())
            print(f"Tables: {tables}")
            
            if 'users' in tables:
                from auth.models import User
                async with async_session() as session:
                    res = await session.execute(select(User))
                    users = res.scalars().all()
                    print(f"User count: {len(users)}")
            else:
                print("USERS TABLE MISSING!")
                
            # Check prompt count to answer the data question
            if 'prompts' in tables:
                from version_control.models import Prompt
                async with async_session() as session:
                    res = await session.execute(select(Prompt))
                    prompts = res.scalars().all()
                    print(f"Prompt count: {len(prompts)}")
            
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    asyncio.run(main())
