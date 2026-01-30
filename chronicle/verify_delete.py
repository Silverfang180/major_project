import asyncio
from uuid import uuid4
from db import get_session
from version_control.models import Prompt, PromptVersion
from sqlalchemy import select

async def test_circular_delete():
    print("🧪 Starting Circular Deletion Test...")
    
    # 1. Setup Data
    async for session in get_session():
        pid = uuid4()
        uid = uuid4()
        
        print(f"   Creating Prompt {pid}...")
        p = Prompt(prompt_id=pid, key=f"del-test-{pid}", title="Delete Me", created_by=uid)
        session.add(p)
        await session.flush()
        
        print("   Creating Version (linked)...")
        v = PromptVersion(
            prompt_id=pid,
            ordinal=1,
            prompt_text="I will be deleted",
            created_by=uid,
            is_latest=True
        )
        session.add(v)
        await session.flush()
        
        # Link them (The Circular Trap)
        p.latest_version_id = v.version_id
        session.add(p)
        await session.commit()
        print("   ✅ Circular Link Established (Prompt <-> Version)")
        
        # 2. Try Deleting (The Fix)
        print("   🗑️ Attempting Deletion...")
        try:
            # Re-fetch to detach/attach properly
            p_to_del = await session.get(Prompt, pid)
            
            # THE FIX LOGIC: Break the link
            p_to_del.latest_version_id = None
            session.add(p_to_del)
            await session.flush()
            print("   ✅ Link Broken (latest_version_id = None)")
            
            await session.delete(p_to_del)
            await session.commit()
            print("   ✅ Prompt Deleted Successfully!")
            
        except Exception as e:
            print(f"   ❌ DELETION FAILED: {str(e)}")
            exit(1)
            
        # 3. Verify it's gone
        check = await session.get(Prompt, pid)
        if check is None:
            print("   🎉 Verification Passed: Record is gone.")
        else:
            print("   ⚠️ Error: Record still exists!")
            
        break

if __name__ == "__main__":
    asyncio.run(test_circular_delete())
