# Chronicle CLI: Path to Infra-Grade

To transition the Chronicle CLI from a "convenient sandbox executor" to a true **infrastructure-grade control plane** (akin to `git` or `kubectl`), the following features and backend primitives must be built. 

This document tracks the gaps between what is currently supported and what enterprise agentic workflows require.

---

## 🔴 Completely Missing (Requires new Backend primitives)

### 1️⃣ Evaluation Commands (Biggest Gap)
**Needed:** 
- `chronicle eval <key> --dataset path.json`
- `chronicle compare <key> --v1 3 --v2 5`
- `chronicle regressions <key>`
**Why:** Without this, we only execute; we do not govern. Serious systems measure accuracy, cost-per-correct, and fail CI if metrics degrade.
**Backend Gap:** `0%` support. We have no concept of "Datasets", "Expected Outputs", or "Scoring Assertions". Requires an entirely new `EvaluationDatasets` schema and execution loops.

### 2️⃣ Structured Output Enforcement
**Needed:** `chronicle execute <key> --schema schema.json`
**Why:** Agents require contracts. If the LLM drifts from the JSON schema, the pipeline fails.
**Backend Gap:** `0%` support. Current `ai_service.py` only asks for raw text. Needs integration with Pydantic/JSON Schema structured outputs via the LLM provider API.

### 3️⃣ Failure Intelligence
**Needed:**
- `chronicle runs <key> --last 20`
- `chronicle errors <key>`
**Why:** Must expose failure rates, latency spikes, and cost anomalies directly in the terminal.
**Backend Gap:** We record runs in PostgreSQL, but we never built a `GET /prompts/{id}/runs` API endpoint. Telemetry is currently trapped in the DB.

---

## 🟡 Partially Supported (Needs minor Backend tweaks)

### 4️⃣ Alias Management From CLI
**Needed:**
- `chronicle promote <key> --to production`
- `chronicle alias set <key> staging 7`
**Why:** Promotion must be scriptable for CI workflows, not bound to a UI click.
**Backend Gap:** The database supports `AliasHistory` and `production_version_id`, but there is no dedicated `PUT /prompts/{id}/alias` endpoint to mutate these pointers programmatically.

### 5️⃣ Determinism Controls
**Needed:** Execution with `--seed 42` and `--temperature 0`.
**Why:** Reproducibility is required for noise-free version comparisons.
**Backend Gap:** The DB stores `model_settings` (like temperature), but the `POST /execute` route ignores them and doesn't pass them to the OpenAI client.

### 6️⃣ Batch Execution Mode
**Needed:** `chronicle batch <dataset.json> --alias production --json`
**Why:** CI needs to pump 100 tests sequentially and get a summary metric, not test one-at-a-time manually.
**Backend Gap:** FastAPI/asyncpg can handle massive concurrency natively. The CLI just needs the logic to fire 50 parallel async requests to `/execute`; a dedicated `/batch` endpoint isn't strictly required yet.

---

## 🟢 Fully Supported (CLI just needs to be wired up)

### 7️⃣ Diffing Between Versions
**Needed:** `chronicle diff <key> --v1 4 --v2 5`
**Why:** Show Prompt text diff, Model config diff, and Token/Cost deltas natively like `git diff`.
**Backend Status:** *Supported.* `GET /versions/{id}/history` exists. The CLI just needs a `difflib` python script to fetch two versions and print colored terminal output.

### 8️⃣ Auth Profiles
**Needed:** `chronicle profile add prod`, `chronicle profile use staging`.
**Why:** Clean separation of credentials.
**Backend Status:** *Supported.* `chronicle init` and `chronicle use` already exist and write to `~/.chronicle/config.json`.
