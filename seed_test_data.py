"""
Seed the Chronicle database with test data for all pages.
Run: .\.venv\Scripts\python.exe seed_test_data.py
"""
import requests
import time
import json

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

def get(path):
    r = requests.get(f"{BASE}{path}", headers=HEADERS)
    if r.status_code >= 400:
        print(f"  ERROR {r.status_code}: {r.text[:200]}")
        return None
    return r.json()

print("=" * 60)
print("  Chronicle Test Data Seeder")
print("=" * 60)

# -------------------------------------------------------
# 1. Create Prompts
# -------------------------------------------------------
print("\n[1/5] Creating prompts...")

prompts_data = [
    {"key": "email-summarizer", "title": "Email Summarizer", "created_by": IDENTITY},
    {"key": "sentiment-analyzer", "title": "Sentiment Analyzer", "created_by": IDENTITY},
    {"key": "code-reviewer", "title": "Code Reviewer", "created_by": IDENTITY},
]

created_prompts = []
for p in prompts_data:
    result = post("/version-control/prompts", p)
    if result:
        created_prompts.append(result)
        print(f"  Created prompt: {result['title']} ({result['prompt_id']})")

if not created_prompts:
    print("  No prompts created. They might already exist. Fetching existing...")
    existing = get("/version-control/prompts")
    if existing:
        created_prompts = existing[:3]
        print(f"  Found {len(created_prompts)} existing prompts.")

# -------------------------------------------------------
# 2. Create Versions for each prompt
# -------------------------------------------------------
print("\n[2/5] Creating versions...")

version_texts = {
    "Email Summarizer": [
        "Summarize the following email in 3 bullet points:\n\n{{email_body}}",
        "You are a professional summarizer. Given the email below, produce exactly 3 concise bullet points:\n\n{{email_body}}",
        "Act as an executive assistant. Summarize this email into 3 actionable bullet points. Be brief.\n\nEmail:\n{{email_body}}",
    ],
    "Sentiment Analyzer": [
        "Classify the sentiment of this text as positive, negative, or neutral:\n\n{{text}}",
        "You are a sentiment analysis expert. Classify the following text as POSITIVE, NEGATIVE, or NEUTRAL. Respond with only the label.\n\n{{text}}",
    ],
    "Code Reviewer": [
        "Review this code and list any bugs or improvements:\n\n{{code}}",
        "You are a senior software engineer. Review the following code for bugs, security issues, and performance problems. Be specific.\n\n```\n{{code}}\n```",
    ],
}

for prompt in created_prompts:
    title = prompt.get("title", "")
    texts = version_texts.get(title, ["Default prompt text: {{input}}"])
    for i, text in enumerate(texts):
        result = post("/version-control/versions", {
            "prompt_id": prompt["prompt_id"],
            "prompt_text": text,
            "created_by": IDENTITY,
            "model_settings": {"model": "llama-3.3-70b-versatile", "temperature": 0.7},
            "change_note": f"Version {i+1} - {'initial' if i == 0 else 'improved prompt'}"
        })
        if result:
            print(f"  Created v{result.get('ordinal', '?')} for '{title}'")

# Promote latest version to production for the first prompt
if created_prompts:
    pid = created_prompts[0]["prompt_id"]
    versions = get(f"/version-control/versions/{pid}/history")
    if versions and len(versions) > 0:
        latest = versions[0]
        post(f"/version-control/prompts/{pid}/promote", {"version_id": latest["version_id"]})
        print(f"  Promoted v{latest['ordinal']} to production for '{created_prompts[0]['title']}'")

# -------------------------------------------------------
# 3. Create Datasets with Examples
# -------------------------------------------------------
print("\n[3/5] Creating datasets and examples...")

datasets_data = [
    {
        "name": "Email Test Suite",
        "description": "Test cases for email summarization prompts",
        "task_type": "generation",
        "created_by": IDENTITY,
        "examples": [
            {"input_vars": {"email_body": "Hi team, the Q4 results are in. Revenue grew 15% YoY. We beat our target by $2M. The board meeting is Thursday at 3pm. Please prepare your slides by Wednesday EOD."}, "expected_output": "- Q4 revenue grew 15% YoY, beating target by $2M\n- Board meeting scheduled Thursday 3pm\n- Slides due Wednesday EOD"},
            {"input_vars": {"email_body": "Reminder: office will be closed Monday for the holiday. Please submit timesheets by Friday. Also, the new parking policy starts next month - see attached PDF."}, "expected_output": "- Office closed Monday (holiday)\n- Timesheets due Friday\n- New parking policy starts next month"},
            {"input_vars": {"email_body": "The deployment failed last night due to a database migration error. I've rolled back to the previous version. We need to fix the migration script before attempting again. Can we schedule a call today?"}, "expected_output": "- Last night's deployment failed (DB migration error)\n- Rolled back to previous version\n- Need call today to fix migration script"},
            {"input_vars": {"email_body": "Great news! The client approved the proposal. Contract value is $500K over 2 years. Legal will send the agreement next week. Let's kick off the onboarding process."}, "expected_output": "- Client approved $500K/2-year proposal\n- Legal sending agreement next week\n- Begin onboarding process"},
            {"input_vars": {"email_body": "Please review the attached design mockups for the new dashboard. We need feedback by Thursday. The development sprint starts next Monday. Focus on the data visualization components."}, "expected_output": "- Review dashboard design mockups\n- Feedback needed by Thursday\n- Dev sprint starts Monday, focus on data viz"},
        ]
    },
    {
        "name": "Sentiment Benchmark",
        "description": "Labeled sentiment analysis test cases",
        "task_type": "classification",
        "created_by": IDENTITY,
        "examples": [
            {"input_vars": {"text": "This product is absolutely amazing! Best purchase I've ever made."}, "expected_output": "POSITIVE"},
            {"input_vars": {"text": "Terrible customer service. Will never buy from them again."}, "expected_output": "NEGATIVE"},
            {"input_vars": {"text": "The package arrived on time. It works as described."}, "expected_output": "NEUTRAL"},
            {"input_vars": {"text": "I love how easy this is to use. The interface is beautiful!"}, "expected_output": "POSITIVE"},
            {"input_vars": {"text": "The software crashed three times today. Very frustrating."}, "expected_output": "NEGATIVE"},
        ]
    }
]

created_datasets = []
for ds in datasets_data:
    examples = ds.pop("examples")
    result = post("/eval/datasets", ds)
    if result:
        created_datasets.append(result)
        print(f"  Created dataset: {result['name']} ({result['dataset_id']})")
        for ex in examples:
            post(f"/eval/datasets/{result['dataset_id']}/examples", ex)
        print(f"    Added {len(examples)} examples")

# -------------------------------------------------------
# 4. Create Eval Jobs
# -------------------------------------------------------
print("\n[4/5] Creating evaluation jobs...")

if created_prompts and created_datasets:
    for prompt in created_prompts[:2]:
        versions = get(f"/version-control/versions/{prompt['prompt_id']}/history")
        if versions:
            for ds in created_datasets:
                for v in versions[:2]:  # Test first 2 versions per dataset
                    result = post("/eval/jobs", {
                        "prompt_id": prompt["prompt_id"],
                        "version_id": v["version_id"],
                        "dataset_id": ds["dataset_id"],
                        "evaluators": ["exact_match"],
                        "created_by": IDENTITY,
                    })
                    if result:
                        print(f"  Created eval job: {result['job_id'][:8]}... (v{v['ordinal']} x {ds['name']})")

    # Wait for jobs to complete
    print("\n  Waiting for eval jobs to finish...")
    for i in range(15):
        time.sleep(2)
        jobs = get("/eval/jobs")
        if jobs:
            running = [j for j in jobs if j["status"] in ("pending", "running")]
            completed = [j for j in jobs if j["status"] == "completed"]
            print(f"    [{i*2}s] Running: {len(running)}, Completed: {len(completed)}")
            if len(running) == 0:
                break

# -------------------------------------------------------
# 5. Execute some prompts to generate Runs
# -------------------------------------------------------
print("\n[5/5] Executing prompts to generate runs...")

if created_prompts:
    for prompt in created_prompts:
        key = prompt.get("key", "")
        test_inputs = {
            "email-summarizer": [
                {"variables": {"email_body": "Meeting moved from 2pm to 4pm tomorrow. Same conference room. Please confirm attendance."}},
                {"variables": {"email_body": "The server upgrade is complete. All services are back online. Performance improved by 30%."}},
            ],
            "sentiment-analyzer": [
                {"variables": {"text": "What a wonderful day! Everything went perfectly."}},
                {"variables": {"text": "This is the worst experience I have ever had."}},
            ],
            "code-reviewer": [
                {"variables": {"code": "def add(a, b):\n    return a + b"}},
            ],
        }
        inputs = test_inputs.get(key, [{"variables": {"input": "Hello world"}}])
        for inp in inputs:
            result = post(f"/execute/{key}", inp)
            if result:
                status = result.get("status", "?")
                latency = result.get("latency_ms", "?")
                cost = result.get("cost_usd", "?")
                print(f"  Executed '{key}': status={status}, latency={latency}ms, cost=${cost}")

# -------------------------------------------------------
# Summary
# -------------------------------------------------------
print("\n" + "=" * 60)
print("  Seeding complete!")
print("=" * 60)

dashboard = get("/eval/dashboard")
if dashboard:
    print(f"\n  Dashboard Summary:")
    print(f"    Total Datasets:  {dashboard.get('total_datasets', 0)}")
    print(f"    Total Jobs:      {dashboard.get('total_jobs', 0)}")
    print(f"    Total Examples:  {dashboard.get('total_examples', 0)}")
    print(f"    Completed Jobs:  {dashboard.get('completed_jobs', 0)}")

print(f"\n  Now open http://localhost:5173 and check all pages!")
print(f"  All data was created by identity: {IDENTITY[:16]}...")
