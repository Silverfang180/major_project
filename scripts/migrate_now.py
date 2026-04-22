import asyncio
import sys
import os

# Add current directory to path
sys.path.append(os.getcwd())

from db import async_session
from sqlalchemy import select, update
from auth.models import User
from version_control.models import Prompt, PromptVersion
from evaluation.models import Dataset, EvalJob
from execution.models import Run

async def migrate():
    print("Starting manual migration to sample@gmail.com...")
    async with async_session() as db:
        # 1. Get the target user ID
        res = await db.execute(select(User).where(User.email == "sample@gmail.com"))
        user = res.scalar_one_or_none()
        
        if not user:
            print("ERROR: User sample@gmail.com not found. Please register first.")
            return

        user_id_str = str(user.user_id)
        print(f"Target User ID: {user_id_str}")

        # 2. Update all tables
        p_count = (await db.execute(update(Prompt).values(created_by=user_id_str))).rowcount
        pv_count = (await db.execute(update(PromptVersion).values(created_by=user_id_str))).rowcount
        d_count = (await db.execute(update(Dataset).values(created_by=user_id_str))).rowcount
        j_count = (await db.execute(update(EvalJob).values(created_by=user_id_str))).rowcount
        r_count = (await db.execute(update(Run).values(created_by=user_id_str))).rowcount

        await db.commit()
        
        print(f"MIGRATION COMPLETE!")
        print(f"Updated {p_count} Prompts")
        print(f"Updated {pv_count} Versions")
        print(f"Updated {d_count} Datasets")
        print(f"Updated {j_count} Jobs")
        print(f"Updated {r_count} Runs")

if __name__ == "__main__":
    asyncio.run(migrate())
