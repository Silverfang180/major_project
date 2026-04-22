import requests
import json
import csv
import os

BASE = "http://127.0.0.1:8000/api/v1"
HEADERS = {
    "Content-Type": "application/json",
    "X-API-Key": "chronicle-dev-key"
}
IDENTITY = "seed-script-a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4"

def post(path, data):
    r = requests.post(f"{BASE}{path}", json=data, headers=HEADERS)
    if r.status_code >= 400:
        print(f"  ERROR {r.status_code}: {r.text[:200]}")
        return None
    return r.json()

def import_csv_to_dataset(file_path, name, description, task_type):
    print(f"\nImporting {name} from {file_path}...")
    
    # Check if file exists
    if not os.path.exists(file_path):
        print(f"  ERROR: File {file_path} not found.")
        return

    # Create dataset
    ds_payload = {
        "name": name,
        "description": description,
        "task_type": task_type,
        "created_by": IDENTITY
    }
    dataset = post("/eval/datasets", ds_payload)
    if not dataset:
        print(f"  Failed to create dataset {name}")
        return
    
    dataset_id = dataset["dataset_id"]
    print(f"  Created dataset: {name} ({dataset_id})")

    # Read CSV and batch upload examples
    examples = []
    with open(file_path, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                input_vars = json.loads(row["input_vars"])
                examples.append({
                    "input_vars": input_vars,
                    "expected_output": row["expected_output"],
                    "source_tag": row.get("source_tag")
                })
            except Exception as e:
                print(f"  Skipping row due to error: {e}")

    if examples:
        # Use bulk endpoint
        result = post(f"/eval/datasets/{dataset_id}/examples/bulk", {"examples": examples})
        if result:
            print(f"  Imported {result['imported']} examples.")
        else:
            print(f"  Failed to bulk import examples.")
    else:
        print(f"  No examples found to import.")

if __name__ == "__main__":
    # 1. Science QA
    import_csv_to_dataset(
        "exports/science-qa-eval.csv",
        "Science QA Eval",
        "Extractive QA on Wikipedia-style science paragraphs",
        "qa"
    )

    # 2. Ecommerce Sentiment
    import_csv_to_dataset(
        "exports/ecommerce-sentiment-eval.csv",
        "Ecommerce Sentiment",
        "Labeled sentiment analysis for ecommerce reviews",
        "classification"
    )

    print("\nImport complete!")
