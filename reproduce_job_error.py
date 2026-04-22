import asyncio
import uuid
from db import async_session
from evaluation.models import EvalJob, JobStatus, Dataset
from version_control.models import Prompt, PromptVersion
from sqlalchemy import select

async def reproduce_job_error():
    print("Attempting to reproduce Eval Job creation error...")
    async with async_session() as session:
        # Get existing data
        dataset = (await session.execute(select(Dataset).limit(1))).scalar_one_or_none()
        prompt = (await session.execute(select(Prompt).limit(1))).scalar_one_or_none()
        if not prompt:
            print("No prompt found.")
            return
        
        version = (await session.execute(select(PromptVersion).where(PromptVersion.prompt_id == prompt.prompt_id).limit(1))).scalar_one_or_none()
        
        if not (dataset and prompt and version):
            print("Missing prerequisite data (dataset/prompt/version).")
            return

        print(f"Dataset: {dataset.dataset_id}")
        print(f"Prompt: {prompt.prompt_id}")
        print(f"Version: {version.version_id}")

        job = EvalJob(
            prompt_id=prompt.prompt_id,
            version_id=version.version_id,
            dataset_id=dataset.dataset_id,
            status=JobStatus.pending.value,
            evaluators=["exact_match"],
            created_by="test-user"
        )
        session.add(job)
        try:
            await session.commit()
            print(f"SUCCESS: Job created with ID: {job.job_id}")
            # Cleanup
            await session.delete(job)
            await session.commit()
        except Exception as e:
            print(f"FAILED: {e}")
            await session.rollback()

if __name__ == "__main__":
    asyncio.run(reproduce_job_error())
