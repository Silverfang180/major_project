# Chronicle Bug Log & Tracker

This document maintains a comprehensive historical log of all documented bugs identified and resolved during the development of Chronicle Phase 1 and Phase 2. 
Last updated: Phase 2 completion.

---

## Resolved Bugs

### BUG-001: PowerShell Variable Expansion Corrupting JSX
**Phase:** 1 & 2 — Frontend wiring / scripts
**Symptom:** React JSX files generated or modified via scripts were entirely blank or missing key interpolation variables like `${data}`.
**Root Cause:** Windows PowerShell eagerly evaluated JS template literals (`${...}`) as empty script variables during the file write process, destroying the frontend code string.
**Fix:** Transitioned scripting write interactions to Python's raw string (`r'''...'''`) path writes to bypass native PowerShell string evaluation entirely.
**Status:** ✅ Resolved

---

### BUG-002: Pareto Scatter Plot Magic Number Formula
**Phase:** 2 — Frontend wiring
**Symptom:** The Cost vs. Accuracy plot rendered as a single clustered dot squished into the corner of the graph instead of an expanded visual curve.
**Root Cause:** Charting coordinates utilized hardcoded scaling logic (`100 - (cost * 1800)`) under the assumption that evaluation costs would sit around $0.05. Actual API execution costs were dramatically cheaper ($0.000064), causing the math to snap all points to a singular pixel near `x=100`.
**Fix:** Implemented dynamic "Min/Max Normalization" across plotted objects to dynamically structure visual scaling specifically based on the upper and lower mathematical boundaries of the test batch (`cx = 5 + ((cost - minC) / cRange) * 88`).
**Status:** ✅ Resolved

---

### BUG-003: generate_recommendation Always Returning Fallback String
**Phase:** 2 — Pareto verification
**Symptom:** The string generator providing automated English deployment recommendations would consistently spit out the fallback text: `"All evaluated versions offer different valid trade-offs..."` even for fully solved matrices.
**Root Cause:** Hallucinated conditions logic masked valid returns. The live API was correctly producing data but lacking execution paths to read the optimal alias.
**Fix:** Wrote specific programmatic formatting conditionals to identify and isolate pure linear cases versus curve knee-point identification. Regression tests were explicitly added to enforce stability.
**Status:** ✅ Resolved

---

### BUG-004: Command Palette JSX Missing from DOM
**Phase:** 1 / 2 — Frontend fixes
**Symptom:** Pressing ⌘K toggled `isCommandPaletteOpen` state but no overlay appeared.
**Root Cause:** The `CommandPalette` React component was successfully loaded in memory but actively unmounted/omitted from the main DOM tree renderer.
**Fix:** Re-parented the component into the standard `<App />` root rendering hierarchy to guarantee constant availability.
**Status:** ✅ Resolved

---

### BUG-005: Notification Toast Missing from DOM
**Phase:** 1 / 2 — Frontend fixes
**Symptom:** Execution alerts, success messages, and system validation warnings were completely invisible despite firing internal JavaScript `notify()` functions.
**Root Cause:** The `Toaster` provider system render block (`{notification && <div>...}`) was omitted from the root application tree. 
**Fix:** Injected the Shadcn UI `<Toaster />` component into the `main.jsx` wrapper hierarchy at the bottom of the DOM tree.
**Status:** ✅ Resolved

---

### BUG-006: Run Eval Job Button Missing onClick Handler
**Phase:** 2 — Frontend fixes
**Symptom:** Clicking the primary "Run Evaluation" confirmation button within the modal did absolutely nothing. No network request fired.
**Root Cause:** The modal form contained the correct state tracking values, but the primary button lacked the explicit `onClick={handleSubmit}` executing property.
**Fix:** Wired the correct UI dispatcher (`handleCreateEvalJob`) back to the specific button element to POST to `/api/v1/eval/jobs`.
**Status:** ✅ Resolved

---

### BUG-007: Evaluations Tab Job Status Not Polling Without Refresh
**Phase:** 2 — Frontend fixes
**Symptom:** Triggered Evaluation Jobs would endlessly display "Running", even after the backend had formally completed execution. Users had to manually refresh to see "Completed".
**Root Cause:** The frontend dashboard required manual page refreshes to re-fetch the job lifecycle state, strictly evaluating `useEffect` once on mount.
**Fix:** Established a `setInterval` hook initialized contextually only when an active job reads `pending` or `running` to silently query the dashboard endpoint every two seconds until resolution.
**Status:** ✅ Resolved

---

### BUG-008: Variables List Not Rendering in Prompt Tab
**Phase:** 1 / 2 — Frontend fixes
**Symptom:** Creating prompts with strict templating markers (like `{{customer_id}}`) successfully caught variables on the backend, but the interface remained totally blank where the variable requirements list should populate inside the Editor tab.
**Root Cause:** `extractVars()` was successfully parsing strings, but the mapped render UI block was omitted entirely under the `detailTab === 'prompt'` logical condition.
**Fix:** Repaired the regex detection map to visually render required variables as mapped indigo `StatusBadge` components directly beneath the text input.
**Status:** ✅ Resolved

---

### BUG-009: llama-3.1-8b-instant Missing from MODEL_PRICING
**Phase:** 2 — Pareto verification
**Symptom:** Evaluation Pareto algorithms fully crashed during pipeline tests utilizing the `llama-3.1-8b-instant` model tier.
**Root Cause:** The model was missing from the internal execution `MODEL_PRICING` dictionary mapping file, resulting in fractional mathematics throwing a `cost_per_correct: null` exception breaking the frontier logic.
**Fix:** Added static tier mapping: `{"input_cost_per_1k": 0.00005, "output_cost_per_1k": 0.00008}` directly into `execution/pricing.py`.
**Status:** ✅ Resolved

---

### BUG-010: Pareto Weak Dominance and Zero Bounds Leakage
**Phase:** 2 — Testing & Verification
**Symptom:** Generating Pareto datasets with perfectly identical accuracies or identical costs resulted in all values arbitrarily marking as `is_pareto_optimal=True` despite obvious cost inefficiencies. Additionally, models returning 0.0% precision were inexplicably ranked on the curve geometry.
**Root Cause:** The `compute_pareto_frontier` math in `metrics.py` utilized strict operator logic (`>` and `<`) rather than Weak Dominance bounded variables. It also lacked exception gating for pure zero results on testing sets. A string interpolator in `generate_recommendation` also caused case assertion test failures.
**Fix:** Refactored the matrix dominance boolean logic to verify `(other.cost <= candidate.cost and other.acc >= candidate.acc)` with at least one strict modifier. Enforced hardcoded manual exclusion of 0.0 accuracy results, and synchronized string casings for "Version".
**Status:** ✅ Resolved

---

## Known Gaps (Phase 3 Deferred Items)

Several engineering limitations strictly remain due to time/scope boundaries. These are deferred as explicit priorities for Phase 3 development:

- **Lack of Execution Rate Limiting:** No true queue system architecture exists. Evaluation jobs currently fire LLM requests sequentially to avoid breaking Free-Tier Groq rate limitations. It requires queuing via Semaphore throttling for mass asynchronous scalability.
- **No Input Size Limits:** No `max_length` enforcement natively sits on the prompt execution path (only Pydantic constraint during initial creation).
- **No Active Prometheus Metrics / System Hooks:** Execution errors and latency bottlenecks are strictly tracked in PostgreSQL, lacking an explicit visualization metric integration (Prometheus/Grafana base layers) to ping administrators if failure rates abruptly spike.
- **Single Asyncio Thread Starvation:** FastAPI's `BackgroundTasks` executes heavy Evaluation background calculations on the same core thread as active web requests without delegating to a true async worker group. 
- **Optimistic Locking / Multi-User Race Conditions:** Single-tenant structure handles operations directly. Promoting variables concurrently relies completely on raw last-write-wins architecture, an acceptable tradeoff for single-tenancy but a strict debt for scaling to teams.
