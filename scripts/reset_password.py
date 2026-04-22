import asyncio
import sys
import os

# Add current directory to path
sys.path.append(os.getcwd())

from db import async_session
from sqlalchemy import select, update
from auth.models import User
from auth.utils import get_password_hash

async def reset_password(email, new_password):
    print(f"Resetting password for {email}...")
    async with async_session() as db:
        res = await db.execute(select(User).where(User.email == email))
        user = res.scalar_one_or_none()
        
        if not user:
            print(f"ERROR: User {email} not found.")
            return

        hashed_password = get_password_hash(new_password)
        await db.execute(
            update(User)
            .where(User.email == email)
            .values(hashed_password=hashed_password)
        )
        await db.commit()
        print(f"PASSWORD RESET SUCCESSFUL!")
        print(f"Email: {email}")
        print(f"New Password: {new_password}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        # Default for the user
        asyncio.run(reset_password("sample@gmail.com", "password123"))
    else:
        asyncio.run(reset_password(sys.argv[1], sys.argv[2]))
