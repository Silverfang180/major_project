import asyncio
import sys
import os

# Add current directory to path
sys.path.append(os.getcwd())

from db import engine, async_session
from sqlalchemy import select
from auth.routes import register, UserCreate
from pydantic import EmailStr

async def test_register():
    print("Simulating registration...")
    async with async_session() as db:
        user_in = UserCreate(
            email="sample@gmail.com",
            password="password123",
            name="Sample"
        )
        try:
            # We call the function directly to see the traceback
            response = await register(user_in, db)
            print(f"Success: {response}")
        except Exception as e:
            import traceback
            print("CRASH DETECTED:")
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_register())
