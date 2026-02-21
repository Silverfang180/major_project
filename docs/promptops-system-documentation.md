# PromptOps: Complete System Documentation

## Vision Statement

PromptOps is the systematic approach to managing, versioning, evaluating, and optimizing the lifecycle of Large Language Model prompts. It treats prompts as first-class production artifacts — not strings in code, not random text files, not vibes in notebooks. Structured. Versioned. Executable. Measurable. Optimizable.

The core problem it solves: prompt engineering today is done by intuition. Changes are untracked. Failures are unaudited. Costs are invisible. Performance is unmeasured. PromptOps imposes engineering discipline onto stochastic systems.

**The spine:** Git + CI/CD + Observability for prompts, with a research-backed evaluation and optimization layer on top.

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    PromptOps                        │
│                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │  Chronicle  │  │  Evaluation  │  │ Optimizer │  │
│  │  (Phase 1)  │  │  (Phase 2)   │  │ (Phase 3) │  │
│  └──────┬──────┘  └──────┬───────┘  └─────┬─────┘  │
│         │                │                │         │
│         └────────────────┴────────────────┘         │
│                          │                          │
│              ┌───────────┴──────────┐               │
│              │   PostgreSQL + Redis  │               │
│              └──────────────────────┘               │
└─────────────────────────────────────────────────────┘
```

---

## Phase 1: Chronicle — The Control Plane

### Status: Complete. Verified with 26 integration tests.

### What it is

Chronicle is the foundational infrastructure layer of PromptOps. It answers one question: how do you treat a prompt like a deployable production artifact instead of a string in code?

### Core Identity

A prompt version control and execution control plane. Every prompt is versioned, every deployment is explicit, every execution is logged, every cost is tracked.

### Components Built

**1. Prompt Registry**

Prompts are stored as structured entities with a unique key, title, description, and owner. The key is the stable identifier used by application code — it never changes even as versions evolve. Keys are auto-generated from titles via slugification with a random suffix to prevent collisions.

```
prompts
  prompt_id (UUID, PK)
  key (Text, unique)
  title
  description
  created_by
  production_version_id (FK → prompt_versions, nullable)
  created_at
  updated_at
```

**2. Immutable Version Control**

Every change to a prompt creates a new version. Existing versions cannot be modified or deleted. This is enforced at the application layer — no DELETE or UPDATE routes exist for versions. Each version has an ordinal that increments monotonically. The is_latest flag moves to the newest version on each creation.

```
prompt_versions
  version_id (BigInteger, PK)
  prompt_id (FK)
  prompt_text (Text)
  model_settings (JSONB)
  change_note (Text)
  ordinal (Integer)
  is_latest (Boolean)
  created_by
  created_at
```

**3. Alias-Based Deployment**

The production alias points to a specific version_id via `production_version_id` on the Prompt model. Promoting a version to production is an explicit act — `POST /prompts/{id}/promote`. The latest version and the production version can be different intentionally. This is the "deploy a specific version" mechanic, equivalent to a production deployment in CI/CD.

**4. Alias Audit Trail**

Every promotion is recorded in alias_history with from_version_id and to_version_id. This closes the silent drift problem — you always know when production changed, from what, and to what.

```
alias_history
  id (Integer, PK)
  prompt_id (FK)
  from_version_id (FK, nullable)
  to_version_id (FK)
  changed_by
  changed_at
```

**5. Variable Injection Engine**

Prompts use `{{variable}}` syntax. The injection engine extracts all placeholders, validates that all required variables are present in the execution request (strict mode — no silent fallbacks), and renders the final prompt. Missing variables are rejected before the LLM is called.

**6. Execution Control Plane**

The single execution endpoint: `POST /execute/{prompt_key}?alias=production`. Application code never calls the LLM directly — it calls Chronicle. Chronicle resolves the alias to a specific version, validates variables, renders the prompt, calls the LLM, logs the run, and returns the response. This creates a control boundary — every LLM call goes through a single audited path.

**7. Pre-insert Pending Run**

Before the LLM call, a Run row is inserted with status=pending. After the call — success or failure — the row is updated in a finally block. This closes the crash window: if the server dies mid-call, the run is left in error state, not lost entirely. You were billed, you have a trace.

```
runs
  run_id (BigInteger, PK)
  version_id (FK)
  prompt_key
  alias_used
  input_vars (JSONB)
  rendered_prompt (Text)
  raw_response (JSONB)
  latency_ms (Integer)
  status (pending | success | error)
  error_message (Text, nullable)
  cost_usd (Numeric(10,8), nullable)
  created_at
```

**8. Cost Tracking**

Every run computes cost_usd at insert time from prompt_tokens and completion_tokens using a pricing config table. Unknown models store null — not zero, which would be a lie. Cost is a first-class field, not a dashboard afterthought.

**9. API Key Authentication**

Middleware-level authentication via X-API-Key header. Public paths excluded: /health, /docs, /redoc, /openapi.json, /gui. Returns 401 on missing or invalid key. Single static key for Phase 1 — sufficient for prototype, replaced in Phase 3.

### API Surface

```
POST   /api/v1/version-control/prompts
GET    /api/v1/version-control/prompts
GET    /api/v1/version-control/prompts/{id}
POST   /api/v1/version-control/prompts/{id}/promote
GET    /api/v1/version-control/prompts/{id}/alias-history
POST   /api/v1/version-control/versions
GET    /api/v1/version-control/versions/{prompt_id}/history
POST   /api/v1/execute/{prompt_key}
GET    /health
```

### Key Engineering Decisions

**Why immutability at application layer not DB layer:** PostgreSQL triggers would be more robust but add operational complexity. Application-layer enforcement via absent routes is sufficient for Phase 1 and 2. Phase 3 adds row-level security.

**Why alias pointer not is_latest for production:** is_latest always points to newest. Production should point to what was explicitly deployed. These are different concepts. Conflating them causes silent drift.

**Why JSONB for raw_response and model_settings:** Schema flexibility for different LLM providers. Groq, OpenAI, Anthropic return different response shapes. JSONB stores all of them without schema migrations per provider.

**Why pre-insert pending run:** Closes the crash window between LLM response and database commit. Standard outbox pattern adapted for synchronous execution.

### Latent Bug Found During Testing

The `PromptVersion.prompt` SQLAlchemy relationship lacked `foreign_keys=[prompt_id]`. With multiple FK paths between PromptVersion and Prompt (via prompt_id and production_version_id), SQLAlchemy couldn't resolve the join. Fixed by specifying explicit foreign_keys. This was found by the integration test suite when all models were imported together — a demonstration of why integration tests matter.

### Test Coverage

26 integration tests across 6 sections. All pass. Tests verify behavioral invariants at the DB level, not just HTTP responses. The three targeted changes — alias audit trail, pre-insert pending run, cost fields — are each verified by reading the database directly after the operation, not by trusting the API response.

---

## Phase 2: Evaluation Engine

### Status: Planned. Build order defined.

### What it is

The layer that answers: which prompt version performs best, at what cost, with what reliability? Phase 2 turns Chronicle's run logs into measurable engineering decisions.

### Core Identity

A prompt benchmarking framework with cost-performance tradeoff analysis and confidence calibration metrics. Research-backed. Reproducible. Deterministic — not an agent, not stochastic orchestration.

### Research Foundation

**EvoPrompt (Tsinghua University + Microsoft Research Asia, ICLR 2024)** — Evolutionary algorithms using LLMs as operators. Open source. Directly informs the dataset runner and candidate generation in Phase 3.

**MOPrompt (2025)** — Multi-objective prompt optimization casting prompt discovery as vector-valued minimization. Theoretical backing for the Pareto frontier implementation.

**Reflective LLM + Platt Scaling** — Separately invoked judge model for confidence scoring, post-hoc calibration via Platt Scaling. Grounded approach to confidence calibration that avoids naive self-reporting.

### Components to Build

**1. Dataset Management**

Structured store for evaluation inputs and expected outputs. The fuel the evaluation engine runs on. Without standardized datasets, prompt version comparisons are not reproducible.

```
datasets
  dataset_id (UUID, PK)
  name
  description
  task_type (classification | generation | qa)
  created_by
  created_at

dataset_examples
  example_id (UUID, PK)
  dataset_id (FK)
  input_vars (JSONB)
  expected_output (Text)
  metadata (JSONB)
  created_at
```

Dataset examples are immutable once created — same principle as prompt versions. Results must be reproducible.

**2. Evaluation Orchestrator**

The core loop. Takes a dataset, a prompt version, and a set of evaluators. Runs every example through Chronicle's execute endpoint using a version-pinned execution path (not the production alias — you're evaluating specific versions). Collects run_ids. Stores results.

Requires one Chronicle addition: `POST /execute/{prompt_key}?version_id={id}` — version-pinned execution that bypasses alias resolution.

```
eval_jobs
  job_id (UUID, PK)
  prompt_id (FK)
  version_id (FK)
  dataset_id (FK)
  status (pending | running | completed | failed)
  evaluators (JSONB)
  created_by
  started_at
  completed_at
  created_at

eval_results
  result_id (UUID, PK)
  job_id (FK)
  example_id (FK)
  run_id (FK → runs)
  raw_output (Text)
  expected_output (Text)
  is_correct (Boolean)
  confidence_score (Float)
  evaluator_score (Float)
  latency_ms (Integer)
  cost_usd (Numeric)
  created_at
```

**3. Evaluator Module**

Three evaluators, in implementation order:

*Exact Match* — For classification tasks. Normalize whitespace and case, compare directly. Binary output.

*LLM-as-Judge* — For generation tasks. Separate judge model with no shared context with the answering model. Structured JSON output forced. Score 0-1 with reasoning. If JSON parsing fails, score is null — not zero.

*Confidence Calibration* — Requires prompt to output structured JSON with confidence field. Calibration error per example: `abs(confidence - is_correct)`. Mean Calibration Error across dataset surfaces "confident but wrong" versions. Platt Scaling applied post-hoc for calibrated scores. Minimum 20 examples enforced for calibration jobs to be statistically meaningful.

**4. Metrics Aggregator**

Computes summary statistics per completed eval job:

```
eval_summaries
  summary_id (UUID, PK)
  job_id (FK, unique)
  accuracy (Float)
  mean_confidence (Float)
  mean_calibration_error (Float)
  mean_latency_ms (Float)
  total_cost_usd (Numeric)
  avg_cost_per_example (Numeric)
  cost_per_correct (Numeric)
  judge_score_avg (Float)
  computed_at
```

**5. Version Comparison + Pareto Frontier**

Compares multiple eval jobs (different prompt versions, same dataset) and identifies which versions sit on the efficiency frontier.

Pareto dominance: version A dominates version B if A is at least as accurate as B AND at least as cheap as B, and strictly better on at least one dimension.

```python
def compute_pareto_frontier(summaries):
    frontier = []
    for s in summaries:
        dominated = False
        for other in summaries:
            if other.job_id == s.job_id:
                continue
            if (other.accuracy >= s.accuracy and
                other.avg_cost_per_example <= s.avg_cost_per_example and
                (other.accuracy > s.accuracy or
                 other.avg_cost_per_example < s.avg_cost_per_example)):
                dominated = True
                break
        if not dominated:
            frontier.append(s.job_id)
    return frontier
```

Comparison response surfaces: best_accuracy version, best_cost version, best_calibration version, Pareto-optimal version (lowest cost on frontier).

### API Surface

```
POST /api/v1/datasets
GET  /api/v1/datasets
POST /api/v1/datasets/{id}/examples
GET  /api/v1/datasets/{id}/examples
POST /api/v1/eval/jobs
GET  /api/v1/eval/jobs/{id}
GET  /api/v1/eval/jobs/{id}/results
GET  /api/v1/eval/jobs/{id}/summary
POST /api/v1/eval/compare
GET  /api/v1/eval/compare/{id}
```

### Build Order

Week 1 — Dataset management. Schema, API, basic upload UI. Tests before moving on.

Week 2 — Evaluation orchestrator. Job runner, version-pinned execute endpoint on Chronicle, eval_results table. Tests with mocked LLM calls.

Week 3 — Evaluators. Exact match, LLM-as-judge, confidence calibration. Each tested independently before wiring in.

Week 4 — Metrics aggregator, Pareto frontier, comparison endpoint. Unit test the math directly.

Week 5 — Dashboard. Comparison view, Pareto scatter plot, per-example results table.

---

## Phase 3: Production Hardening + Auto-Optimization

### Status: Architected. Implementation deferred post-MVP.

### What it is

Phase 3 makes PromptOps survive real conditions and adds the automated optimization loop that closes the PromptOps cycle — from manual prompt engineering to machine-guided improvement.

### Components Architected

**1. Multi-Tenancy**

Workspace isolation. Every table gets workspace_id. Every query filters by workspace. API keys resolve to workspaces at middleware level — workspace_id is injected into every route handler as a dependency, not checked after the fact.

```
workspaces
  workspace_id (UUID, PK)
  name
  slug (unique)
  created_at

api_keys
  key_id (UUID, PK)
  workspace_id (FK)
  key_hash (Text)       -- bcrypt, never plaintext
  name
  created_at
  last_used_at
  is_active (Boolean)
```

Most invasive change in Phase 3. Must be done first because everything downstream requires it.

**2. Secret Management**

Provider API keys (Groq, OpenAI, Anthropic) stored per-workspace, encrypted at rest using AES-256 via Fernet symmetric encryption. Encryption key lives in environment variables, never in the database. Key rotation without server restart.

```
provider_credentials
  credential_id (UUID, PK)
  workspace_id (FK)
  provider (groq | openai | anthropic)
  api_key_encrypted (Text)
  created_at
  updated_at
```

**3. Job Queue**

Replace FastAPI BackgroundTasks with Redis + ARQ (async-native task queue). Web server enqueues jobs. Separate ARQ worker process executes them. Gives retry logic with exponential backoff, job persistence across restarts, concurrent job execution, and job priority.

Retry_count and last_error columns added to eval_jobs. Worker stops at configurable max retries (default 3).

Decision rationale — ARQ over Celery: Celery's async support is bolted on. ARQ is async-native, integrates cleanly with asyncpg and FastAPI, significantly simpler operational footprint.

**4. Structured Logging + Distributed Tracing**

Replace unstructured logger calls with structured JSON events via python-json-logger. Every log line is a structured event with consistent fields. Add request_id middleware — UUID per request, injected into all log lines within that request context.

Add parent_run_id to runs table. When evaluation orchestrator calls execute for each dataset example, pass eval_job_id as parent context. Creates full trace: eval_job → N runs. Queryable without scanning entire runs table.

**5. Rate Limiting + Quota Management**

Per-workspace execution quotas. Redis for real-time atomic counter increments. PostgreSQL for audit persistence. Daily reset via APScheduler. Returns HTTP 429 with quota details and reset timestamp on breach.

```
workspace_quotas
  workspace_id (FK, unique)
  max_executions_per_day
  max_tokens_per_day
  max_cost_usd_per_day
  current_executions_today
  current_tokens_today
  current_cost_today
  quota_reset_at
```

**6. EvoPrompt Auto-Optimizer**

The differentiating component. Uses evolutionary algorithms — specifically Differential Evolution — to automatically generate and evaluate improved prompt candidates, based on the EvoPrompt paper from Tsinghua University (ICLR 2024).

The loop:

```
1. Seed: take top N existing versions by target metric
2. For each generation:
   a. LLM generates N new candidates by mutating top performers
   b. Each candidate registered as new PromptVersion in Chronicle
   c. Eval job run for each candidate against dataset
   d. Top performers selected for next generation
   e. Early stopping if best_score flat for 2 generations
3. Best version promoted to production
```

Cost estimation shown before starting: `population_size × max_generations × dataset_size × avg_cost_per_example`. Hard caps enforced: max population 10, max generations 5.

```
optimization_jobs
  job_id (UUID, PK)
  prompt_id (FK)
  dataset_id (FK)
  strategy (differential_evolution | genetic)
  population_size (Integer)
  max_generations (Integer)
  target_metric (accuracy | cost_per_correct | calibration)
  status
  best_version_id (FK, nullable)
  created_at
  completed_at

optimization_generations
  generation_id (UUID, PK)
  job_id (FK)
  generation_number (Integer)
  candidate_version_ids (JSONB)
  eval_job_ids (JSONB)
  best_score (Float)
  created_at
```

**7. Production Deployment**

Gunicorn + Uvicorn workers (not bare uvicorn). Nginx reverse proxy. Redis and PostgreSQL containers with named volumes and backup configuration. Environment-specific config files.

Health endpoint returning database, Redis, worker, and version status. Prometheus metrics via prometheus-fastapi-instrumentator — request counts, latency histograms, active eval jobs, total cost today.

### Known Gaps Deferred to Phase 3

These were identified during Phase 1 and consciously deferred:

- Immutability enforcement at DB layer (PostgreSQL row-level security)
- Parent-child run tracing (parent_run_id column)
- Environment snapshot per run (Chronicle version, model hash)
- Idempotency keys on execution requests
- Connection pool scaling beyond pool_size=20

---

## Technical Stack

```
Backend:     FastAPI + Python 3.9+
Database:    PostgreSQL (asyncpg driver)
ORM:         SQLAlchemy async
Migrations:  Alembic
LLM:         Groq API (extensible to OpenAI, Anthropic)
Auth:        API key middleware (Phase 1), per-workspace keys (Phase 3)
Queue:       FastAPI BackgroundTasks (Phase 2), ARQ + Redis (Phase 3)
Frontend:    Vanilla HTML/CSS/JS
Testing:     pytest + pytest-asyncio + httpx
```

---

## What Each Phase Proves

**Phase 1** proves: prompts can be managed as production artifacts with the same rigor as application code. Versioned, audited, cost-tracked, integration-tested.

**Phase 2** proves: prompt engineering decisions can be made from data, not intuition. Which version is accurate, cheap, calibrated, and where does it sit on the efficiency frontier.

**Phase 3** proves: the evaluation loop can be closed automatically. The system finds better prompts without human trial and error, at bounded cost, using evolutionary search backed by peer-reviewed research.

---

## Resume Description

*Built PromptOps — a three-phase LLMOps platform treating prompts as first-class production artifacts. Phase 1: Chronicle, a prompt version control and execution control plane with immutable versioning, alias-based deployment, crash-safe run logging, and cost tracking, verified with 26 integration tests. Phase 2: An evaluation engine with dataset management, LLM-as-judge scoring, confidence calibration via Platt Scaling, and Pareto frontier analysis for cost-accuracy tradeoff optimization. Phase 3: Architected multi-tenant production hardening with EvoPrompt-inspired automatic prompt optimization using evolutionary algorithms, backed by ICLR 2024 research.*
