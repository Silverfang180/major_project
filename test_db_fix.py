import asyncio
import uuid
import json
from db import async_session
from evaluation.models import Dataset, DatasetExample
from sqlalchemy import select

async def test_insertion():
    print("Testing DB insertion with UUID example_id...")
    async with async_session() as session:
        # 1. Get or create a test dataset
        stmt = select(Dataset).limit(1)
        result = await session.execute(stmt)
        dataset = result.scalar_one_or_none()
        
        if not dataset:
            print("Creating test dataset...")
            dataset = Dataset(
                name="Test Dataset",
                task_type="classification",
                created_by="test-user"
            )
            session.add(dataset)
            await session.commit()
            await session.refresh(dataset)
            print(f"Created dataset: {dataset.dataset_id}")
        else:
            print(f"Using existing dataset: {dataset.dataset_id}")
            
        # 2. Try to insert an example without manually providing example_id
        # (The model should now have a default=uuid.uuid4)
        print("Inserting test example...")
        example = DatasetExample(
            dataset_id=dataset.dataset_id,
            input_vars={"test": "var"},
            expected_output="test-output"
        )
        session.add(example)
        
        try:
            await session.commit()
            print(f"SUCCESS: Example inserted with ID: {example.example_id}")
            print("Verifying type...")
            if isinstance(example.example_id, uuid.UUID):
                print("Result is a valid UUID.")
            else:
                print(f"Result is NOT a UUID: {type(example.example_id)}")
                
            # Cleanup
            await session.delete(example)
            await session.commit()
            print("Cleanup complete.")
            
        except Exception as e:
            print(f"FAILED: {e}")
            await session.rollback()

if __name__ == "__main__":
    asyncio.run(test_insertion())
