# PromptOps (Chronicle) System Design Document

**Purpose:** This document provides a comprehensive technical overview of the PromptOps (Chronicle) system. It details the architecture, data models, core components, key workflows, and design philosophies driving both Phase 1 (Version Control & Execution) and Phase 2 (Evaluation Engine). It serves as the definitive reference for the current, implemented state of the system.

## 1. System Overview

**Purpose:** Define the scope and objective of the Chronicle platform.

Chronicle is a fully integrated platform for the operationalization of Large Language Model (LLM) prompts. It bridges the gap between prompt engineering and production deployment by providing structured version control, alias-based execution routing, and automated evaluation pipelines. The system prevents prompt regressions by treating prompts as immutable code artifacts. It allows engineering teams to version, execute, and evaluate prompts deterministically using a unified control plane.

## 2. Architecture Overview

**Purpose:** Illustrate the high-level boundaries and component interactions.

The architecture is built on a decoupled, API-first backend using FastAPI and PostgreSQL, with asynchronous execution patterns for LLM calls. The system is split into three primary verticals: Version Control, Execution Engine, and Evaluation Engine. A supplementary Python CLI provides developer access to these verticals.

```text
+-------------------------------------------------------------+
|                     EXTERNAL INTERFACES                     |
|  +-----------------+  +-----------------+                   |
|  |  Chronicle CLI  |  |   Client Apps   |                   |
|  +-----------------+  +-----------------+                   |
+-----------|--------------------|----------------------------+
            | HTTP/JSON          | HTTP/JSON
+-----------v--------------------v----------------------------+
|                       FASTAPI BACKEND                       |
|                                                             |
|  +-----------------+  +-----------------+ +--------------+  |
|  | Phase 1: VC     |  | Phase 1: Exec   | | Phase 2: Eval|  |
|  | (Prompts, Alias)|  | (Vars, Pricing) | | (Metrics,    |  |
|  |                 |  |                 | |  Synthetic)  |  |
|  +-----------------+  +-----------------+ +--------------+  |
|           |                    |                 |          |
|           |                    |                 |          |
+-----------v--------------------v-----------------v----------+
|                  POSTGRESQL (Asyncpg)                       |
|  +---------+ +----------+ +------+ +----------+ +--------+  |
|  | prompts | | versions | | runs | | datasets | | eval_* |  |
|  +---------+ +----------+ +------+ +----------+ +--------+  |
+-------------------------------------------------------------+
                            |
           +----------------v------------------+
           |           LLM PROVIDERS           |
           |             (Groq)                |
           +-----------------------------------+
```

## 3. Core Design Principles

**Purpose:** Document the foundational rules that guide the system architecture.

Immutable versioning drives the entire system. Once a prompt version is committed, its text and model settings cannot be altered. Changes require a new version with an incremented ordinal identifier. This ensures deterministic execution and reliable rollback capabilities.

Alias-based deployment decouples execution environments from specific version integers. Clients request execution via an alias ("production" or "staging"), and the system resolves this to the currently assigned version ID. This enables zero-downtime prompt updates without client-side code changes.

Crash-safe execution is mandated by the Database-First pattern. The execution engine pre-inserts a `Run` row with a "pending" status before initiating any external LLM network requests. If the network request fails or times out, the `Run` row is updated with an "error" status and exception trace, preventing silent failures and guaranteeing complete execution auditability.

Version-pinned evaluation ensures that evaluation jobs test a specific, immutable prompt iteration. The orchestrator records the exact version ID under test, preventing historical metrics from being invalidated by ongoing prompt engineering.

The synthetic data generation follows a Two-Model validation pipeline. A specialized generator model hypothesizes examples, while a distinct, strict validator model verifies them against criteria. This separation of duties prevents the generator from self-grading and marking its own hallucinations as correct.

Evaluator pipeline ordering mandates that deterministic evaluators (like Exact Match) execute before stochastic or LLM-dependent evaluators (like LLM Judge). This minimizes expensive LLM token usage by fast-failing obvious mismatches.

## 4. Data Architecture

**Purpose:** Detail the relational models and schema evolution.

The database schema utilizes `uuid.uuid4` fields as primary keys across all tables, ensuring globally unique identifiers that avoid enumeration vulnerabilities and simplify distributed data merging, a decision prioritized over the minor performance advantage of integer sequences.

Table `prompts` stores the high-level identity of a prompt, referenced by a human-readable `key` and maintaining a pointer `production_version_id` to the live version. Soft deletes are implemented via `deleted_at`, ensuring historical runs are never orphaned.

Table `prompt_versions` houses the immutable payload. It stores `prompt_text`, `model_settings` (as JSONB), and a sequentially incremented `ordinal` integer relative to the parent prompt. The `is_latest` boolean flag optimizes queries for the most recent draft.

Table `alias_history` tracks the promotion log. It records transitions via `from_version_id` and `to_version_id`, capturing a full audit trail of deployment promotions over time. This enables users to see who promoted which version and when.

Table `runs` captures every execution attempt. It stores `input_vars`, `rendered_prompt`, `response`, `latency_ms`, and calculated `cost_usd`. The `status` enum transitions from pending to either success or error.

Table `datasets` and `dataset_examples` manage ground-truth context for evaluation. Datasets specify a `task_type` ("classification" or "qa"), determining the expected schema within the example's `input_vars` JSON.

Tables `eval_jobs`, `eval_results`, and `eval_job_meta` govern the evaluation engine. `eval_results` holds per-example inferences where the `is_correct` boolean is intentionally nullable to represent pending grading. `eval_job_meta` stores aggregated pipeline metadata such as calibration metrics.

Table `eval_summaries` materializes complex analytical queries. It stores pre-computed metrics like `accuracy`, `cost_per_correct`, and `p95_latency_ms`. Pre-computation at job completion avoids expensive point-in-time SQL aggregations during dashboard rendering.

Alembic migrations track the schema evolution incrementally.
1. `c4e78c22777f_init.py` established prompts and versions.
2. `d768fa3b3957_add_deleted_at_to_prompts_and_versions.py` introduced soft deletions.
3. `add_alias_history.py` enabled deployment tracking.
4. `add_execution_layer.py` constructed the `runs` table.
5. `add_cost_usd.py` added pricing tracking to runs.
6. `0cc75a65b392_update_unique_constraints_for_soft_`.py refined uniqueness checks.
7. `999fdeb013cb_make_to_version_id_nullable.py` corrected alias transitions.
8. `cd14823e07ac_add_eval_jobs.py` implemented evaluation orchestrator state.
9. `2289adf1b0f7_add_evaluation_datasets.py` created the dataset storage.
10. `a1b2c3d4e5f6_add_eval_job_meta.py` added calibration storage.
11. `add_eval_summaries.py` introduced the materialized metric views.

## 5. Phase 1: Chronicle (Version Control & Execution)

**Purpose:** Describe the core prompt management and execution subsystems.

The Version Control System guarantees application-layer immutability. Creating a version establishes a chronological ordinal. Identifying the "latest" version involves unsetting the `is_latest` flag on the previous version and setting it on the new insert within a single database transaction. The promotion model updates the `production_version_id` on the main prompt record and simultaneously writes an entry to the alias history log.

The Execution Control Plane routes requests based on either an `alias` or a `version_id`. When executing via an alias, the backend dereferences the `production_version_id` to locate the target version. The flow executes the pre-insert pending pattern to guarantee crash safety. Post-execution, the `cost_usd` is evaluated using deterministic pricing heuristics based on input and output token lengths specific to the configured LLM model. Unknown models yield a null cost rather than crashing.

The Variable Engine processes raw prompt templates using `{{variable}}` string replacement syntax. It enforces strict validation by checking the keys supplied in the client request against the parsed tokens in the template. Missing variables immediately fail the request with an HTTP 422 Unprocessable Entity, avoiding malformed LLM bounds.

## 6. Phase 2: Evaluation Engine

**Purpose:** Elaborate on the bulk-testing and scoring architecture.

The evaluation engine ranks immutable prompt versions against static datasets. The dataset management system demands that each dataset declare a `task_type`. This instructs the downstream generators and validators on which schema shape to enforce. Examples within datasets are immutable once created, utilizing an optional `source_tag` to trace providence (e.g., manual insertion versus synthetic generation).

The Eval Job Orchestrator executes massive concurrency tasks off the main HTTP thread using FastAPI `BackgroundTasks`. The orchestrator executes direct LLM calls bypassing the `runs` table to isolate evaluation traffic from production execution telemetry, preventing metric pollution. A severe rollback pattern is configured; if any sub-task fails uncontrollably, the job's global status transitions to "failed", but completed evaluator scores are retained in `eval_results` for partial viewing.

The Evaluator Pipeline operates an ordered progression. The `exact_match` evaluator performs string normalization before substring extraction. If multiple evaluators are specified, the orchestrator triggers them sequentially after all inferences are generated. A final pipeline step computes the `EvalSummary`.

### Metrics and Pareto Frontier

**Purpose**: Detail the formulas and algorithms supporting evaluation analytics.

The dashboard displays analytical abstractions of the raw data.
The Pareto Frontier algorithm identifies optimal trade-offs between cost and accuracy. Because all summary entries are extracted in memory, a pure-Python dominance loop is applied. A job summary is considered Pareto-optimal if no other summary exists within the dataset that possesses both a strictly lower `cost_per_correct` and a strictly higher `accuracy`.

The Knee Point algorithm isolates the single most balanced job summary from the derived frontier. Operationalized in a normalized [0, 1] Cartesian space, the algorithm defines a linear vector extending from the lowest-cost coordinate point to the highest-accuracy coordinate point. It then iterates over all frontier nodes to establish the maximum perpendicular geometric distance from this vector. The node with the largest distance is elected as the "knee point". Note that if the underlying provider pricing is absent entirely (yielding 0.0), the formula handles this edge case but the frontier degrades gracefully to a degenerate line on the y-axis.

Calibrations Metrics, including Mean Calibration Error (MCE) and Platt scaling vectors, are computed when a confidence-scoring evaluator provides data.

## 7. Synthetic Dataset Generator

**Purpose:** Explain the configuration-driven dataset synthesis capability.

The Synthetic Dataset Generator alleviates the cold-start problem in prompt testing. It constructs high-quality, complex data using a dual-LLM pipeline. The generation strategy guarantees data quality over data volume. Examples that fail criteria validation are dropped and not padded, resulting in actual counts potentially deviating from configured targets to preserve strict quality bounds.

The generation specification utilizes a Pydantic-validated YAML document. This configuration dictates relative percentage ratios for difficulty levels, dictates the density of edge cases, enforces minimum word-overlap thresholds to ensure diversity among samples, and specifies the array of criteria the validator must verify.

The processing loop extracts required topic groupings in a singular batched LLM operation. It iterates target counts, orchestrating the generator model to serialize strict JSON outputs based on dynamic prompts containing precise difficulty semantics. It feeds this raw payload to a secondary validator model which returns a boolean `passes` flag and a confidence integer. The diversity algorithm filters payloads natively through string overlap thresholding prior to invoking network-bound validation to minimize associated token expenditures.

## 8. Chronicle CLI

**Purpose:** Document the developer terminal tool functions.

The Chronicle CLI enables low-overhead execution operations directly from developer environments.

### Command List
1. `init` configures the backend connection strings in `~/.chronicle/config.json`.
2. `use` modifies the active environment boundary.
3. `list` queries the database for active prompts sequentially.
4. `versions` queries and prints the commit hash equivalents for a specified prompt.
5. `execute` streams an execution resolution context dynamically given a prompt key and sequential variable assignments.

## 9. Key Workflows

**Purpose:** Trace the execution path for primary user journeys.

### Deploying a New Prompt Version
1. Client generates HTTP POST to `/api/v1/version-control/versions` supplying prompt identifier and template.
2. System computes ordinal identifier sequentially.
3. System revokes `is_latest` Boolean flag from predecessor and applies it to the modern iteration.
4. Client generates HTTP POST to `/api/v1/version-control/prompts/{prompt_id}/promote`.
5. System overwrites `production_version_id` to refer to the new iteration and synthesizes an `alias_history` audit manifest.

### Running an Evaluation
1. Client generates HTTP POST to `/api/v1/eval/jobs` specifying a dataset, version array, and metric sequence.
2. Primary thread writes "pending" `EvalJob` to persistence.
3. Background task requests inferences from the LLM adapter across all dataset examples.
4. Background task applies evaluator pipelines to the raw inferences iteratively.
5. System invokes `compute_summary` to materialize analytical vectors and updates `EvalJob` state.

### Generating a Synthetic Dataset
1. Developer initiates the CLI executing `python -m synthetic.cli --config file.yaml`.
2. Application ingests strict Pydantic definitions.
3. Generator module extrapolates topic clusters and queues permutations.
4. Generator requests synthetic text objects strictly conforming to JSON definitions.
5. Validator model assesses object accuracy based on rejection thresholds.
6. Authorized examples merge to PostgreSQL context, dropping rejected segments cleanly.

## 10. Testing Architecture

**Purpose:** Detail internal testing guidelines and components.

The platform sustains rigorous testing constraints executing via strictly synchronous or mocked bindings to assure deterministic coverage. Testing leverages `pytest` and isolates environments utilizing `httpx.AsyncClient` communicating securely with bounded SQLite or local PostgreSQL testing instances. The `tests/test_chronicle_full.py` tests Phase 1 integration end-to-end. The `tests/test_evaluation.py` and `tests/test_synthetic.py` execute mocking boundaries strictly against the `execution.routes.call_llm` component, eliminating volatile external network API dependencies and guaranteeing test consistency. Full coverage is asserted for all endpoint failures and validation branches.

## 11. Deployment

**Purpose:** Explain production considerations.

Deployment requires Python 3.12, PostgreSQL execution access, and Groq API telemetry codes. Alembic must be invoked on launch (`alembic upgrade head`) to construct required relational architecture schema bounds. A standard web server like `uvicorn` securely routes inbound interactions natively toward the `main.app` boundaries. Application connections expect HTTPS resolution. External telemetry tracking relies on Groq integration directly.

## 12. Known Limitations & Future Work

**Purpose:** Identify architectural constraints and the forward roadmap.

The system presently operates strictly utilizing the Groq provider API; external LLM providers inherently generate exception architectures and lack direct abstractions. Cost aggregations are established via static linear arithmetic mapped identically to the `MODEL_PRICING` dictionary; missing telemetry records output `cost_usd == None`. Immutability is an application layer guarantee; database administrators possessing standard elevated access can manipulate records aggressively. The backend is configured natively for singular tenant instances; complex organizational scoping is completely absent.

**Phase 3 Roadmap:**
1. Formulate a multi-vendor LLM connection abstraction interface securely.
2. Advance dynamic and adaptive evaluation generation mechanisms natively.
3. Introduce an application visual frontend utilizing React UI infrastructure cleanly.
4. Develop gradient-based prompt optimization execution loops effectively.
5. Generate a rubric evaluator.

## 13. Research References

**Purpose:** Acknowledge theoretical foundations utilized within the codebase natively.

The system relies upon principles extracted formally from industry literature. Pipeline generation and dataset structuring reflect foundations seen within EvoPrompt execution patterns. Evaluation orchestration mirrors MT-Bench LLM-as-Judge implementations dynamically. The confidence metric implementations harness Platt Scaling paradigms natively.
