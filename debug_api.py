
import asyncio
from sqlalchemy import select
from db import async_session
from execution.models import Run
from execution.schemas import RunRead
from sqlalchemy.ext.asyncio import AsyncSession
from decimal import Decimal

async def debug_runs():
    async with async_session() as db:
        stmt = select(Run).order_by(Run.created_at.desc()).limit(10)
        result = await db.execute(stmt)
        runs = result.scalars().all()
        for idx, r in enumerate(runs):
            try:
                print(f"Validating run {idx+1} (ID: {r.run_id})...")
                RunRead.model_validate(r)
                print(f"Run {idx+1} OK.")
            except Exception as e:
                print(f"Run {idx+1} FAILED: {str(e)}")
                print(f"Data: {r.__dict__}")

async def debug_dashboard():
    from evaluation.models import Dataset, EvalJob
    from version_control.models import Prompt, PromptVersion
    from execution.models import Run
    from sqlalchemy import func
    
    x_chronicle_user = 'legacy-user'
    
    async with async_session() as db:
        print("Debugging dashboard query...")
        total_cost = (await db.execute(
            select(func.coalesce(func.sum(Run.cost_usd), 0.0)).where(Run.created_by == x_chronicle_user)
        )).scalar()
        print(f"total_cost raw value: {total_cost} (type: {type(total_cost)})")
        
        try:
            val = float(total_cost) if total_cost is not None else 0.0
            print(f"Cast to float: {val}")
        except Exception as e:
            print(f"Cast to float FAILED: {str(e)}")

if __name__ == "__main__":
    print("Starting debug...")
    asyncio.run(debug_runs())
    asyncio.run(debug_dashboard())
