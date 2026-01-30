import asyncio
import uuid
from db import async_session
from version_control.models import Prompt, PromptVersion
from sqlalchemy import select
from sqlalchemy.orm import selectinload

async def test_denormalization():
    print("Testing Denormalization Logic...")
    async with async_session() as db:
        try:
            # 1. Create Prompt
            pid = uuid.uuid4()
            uid = uuid.uuid4()
            prompt = Prompt(prompt_id=pid, key=f"test-key-{pid}", title="Test", created_by=uid)
            db.add(prompt)
            await db.commit()
            
            # 2. Create Version (Simulating route logic)
            v1 = PromptVersion(prompt_id=pid, ordinal=1, prompt_text="V1", created_by=uid, is_latest=True)
            db.add(v1)
            await db.flush()
            
            # 3. SET POINTER (The Logic we added)
            prompt.latest_version_id = v1.version_id
            db.add(prompt)
            await db.commit()
            print("✅ Created Version 1 and updated pointer.")

            # 4. Verify Fetch (The Benefit)
            # We want to enable eager loading of latest_version
            stmt = select(Prompt).options(selectinload(Prompt.latest_version)).where(Prompt.prompt_id == pid)
            res = await db.execute(stmt)
            p_loaded = res.scalar_one()
            
            if p_loaded.latest_version and p_loaded.latest_version.prompt_text == "V1":
                 print(f"✅ SUCCESS! Fetched Prompt + Latest Version (ID: {p_loaded.latest_version_id}) in one object.")
            else:
                 print("❌ FAILURE: Latest version not loaded.")

        except Exception as e:
            print(f"❌ CRITICAL ERROR: {e}")

if __name__ == "__main__":
    asyncio.run(test_denormalization())
