import asyncio
from db import get_session
from evaluation.models import EvalJob, EvalSummary
from sqlalchemy import select

async def check():
    async for db in get_session():
        # Check jobs
        res = await db.execute(select(EvalJob).where(EvalJob.status == "completed").limit(5))
        jobs = res.scalars().all()
        print(f"Completed Jobs: {len(jobs)}")
        for j in jobs:
            print(f"Job {j.job_id} | Status: {j.status}")
            
        # Check summaries
        res = await db.execute(select(EvalSummary).limit(5))
        summaries = res.scalars().all()
        print(f"\nSummaries: {len(summaries)}")
        for s in summaries:
            print(f"Job: {s.job_id} | Accuracy: {s.accuracy}")
        break

if __name__ == "__main__":
    asyncio.run(check())
