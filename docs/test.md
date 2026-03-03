# Chronicle Bug Log

All known bugs identified during development and their resolutions.
Last updated: Phase 2 completion.

---

## Resolved Bugs

### BUG-001: PowerShell Variable Expansion Corrupting JSX
**Phase:** 2 — Frontend wiring  
**Symptom:** Template literals (`${...}`) in App.tsx were evaluated as PowerShell variables during file writes, producing blank strings and broken JSX trees.  
**Root Cause:** Windows PowerShell aggressively interprets `${}` syntax before content reaches the filesystem.  
**Fix:** All file writes routed through a Python script (`fix_app.py`) using raw string literals (`r'''...'''`) and `pathlib.Path.write_text(encoding='utf-8')`. PowerShell never touches the content.  
**Status:** ✅ Resolved

---

### BUG-002: Pareto Scatter Plot Magic Number Formula
**Phase:** 2 — Frontend wiring  
**Symptom:** SVG scatter plot used `cx = 100 - (d.cost * 1800)` — a formula tuned for mock data. Real `cost_per_correct` values are tiny floats (0.000064–0.000100), causing all points to render at x=100 (far right, clustered).  
**Root Cause:** Hardcoded multiplier assumed cost values in the range 0.01–0.05. Real costs from Groq are 3–4 orders of magnitude smaller.  
**Fix:** Replaced with proper min/max normalisation:
```python
cx = 5 + ((cost - minC) / cRange) * 88
cy = 93 - ((accuracy - minA) / aRange) * 86
```
Edge cases handled: single point (cRange=0 defaults to 1), all same cost, all same accuracy.  
**Status:** ✅ Resolved

---

### BUG-003: generate_recommendation Always Returning Fallback String
**Phase:** 2 — Pareto verification  
**Symptom:** `/api/v1/eval/compare/dataset/{id}` returned `"All evaluated versions offer different valid trade-offs..."` — the generic fallback — even with valid Pareto data.  
**Root Cause:** Hallucinated during reporting. The live API was always producing the correct two-option recommendation string. No actual code bug existed.  
**Fix:** Added two regression unit tests to permanently enforce correct behaviour:
- `test_recommendation_two_pareto_points` — asserts "Two viable options" text
- `test_recommendation_fallback_never_fires_with_valid_data` — asserts fallback never fires with valid input  
**Status:** ✅ Resolved (tests added as regression guards)

---

### BUG-004: Command Palette JSX Missing from DOM
**Phase:** 2 — Frontend fixes  
**Symptom:** Pressing ⌘K toggled `isCommandPaletteOpen` state but no overlay appeared. State existed, render did not.  
**Root Cause:** The command palette JSX block was never added to the component return statement.  
**Fix:** Added full command palette overlay with 4 navigation actions wired to real tab switching.  
**Status:** ✅ Resolved

---

### BUG-005: Notification Toast Missing from DOM
**Phase:** 2 — Frontend fixes  
**Symptom:** `notify()` set state correctly but no toast appeared. API calls succeeded silently with no visual feedback.  
**Root Cause:** The toast render block (`{notification && <div>...}`) was never added to the component return statement.  
**Fix:** Added toast render at bottom of DOM tree with success (E2F581) and error (rose-500) variants.  
**Status:** ✅ Resolved

---

### BUG-006: Run Eval Job Button Missing onClick Handler
**Phase:** 2 — Frontend fixes  
**Symptom:** Clicking "Run Evaluation" button did nothing. No network request fired.  
**Root Cause:** Button had no `onClick` handler and the modal component was never built.  
**Fix:** Built full `RunEvalModal` with prompt selector, version selector (auto-fetches on prompt change), evaluator checkboxes, and `handleCreateEvalJob` wired to `POST /api/v1/eval/jobs`.  
**Status:** ✅ Resolved

---

### BUG-007: Evaluations Tab Job Status Not Updating Without Refresh
**Phase:** 2 — Frontend fixes  
**Symptom:** Job status badges showed `running` indefinitely. Users had to manually refresh to see `completed`.  
**Root Cause:** `useEffect` in evaluations tab fetched dashboard once on mount with no polling interval.  
**Fix:** Added `setInterval` polling on `comparisonResult` that activates when any job has `running` or `pending` status. Auto-clears when all jobs reach terminal state.  
**Status:** ✅ Resolved

---

### BUG-008: Variables List Not Rendering in Prompt Tab
**Phase:** 2 — Frontend fixes  
**Symptom:** Extracted `{{variables}}` from prompt text were not displayed below the editor in the Prompt detail tab.  
**Root Cause:** `extractVars()` was called for validation tab but the render block was missing from `detailTab === 'prompt'` section.  
**Fix:** Added variable map render block inside prompt tab displaying each variable as an indigo badge with StatusBadge.  
**Status:** ✅ Resolved

---

### BUG-009: llama-3.1-8b-instant Missing from MODEL_PRICING
**Phase:** 2 — Pareto verification  
**Symptom:** Eval jobs using `llama-3.1-8b-instant` produced `cost_per_correct: null`, making those jobs ineligible for Pareto frontier computation.  
**Root Cause:** `llama-3.1-8b-instant` was not in the `MODEL_PRICING` registry.  
**Fix:** Add to `MODEL_PRICING`:
```python
"llama-3.1-8b-instant": {"prompt": 0.05, "completion": 0.08}  # per 1M tokens
```
**Status:** ✅ Resolved

---

## Known Gaps (Not Bugs — Deferred to Phase 3)

- No `max_length` enforcement on prompt execution path (Pydantic constraint added on create, not on execute)
- No rate limiting on `/execute` or `/eval/jobs` endpoints
- No Prometheus metrics endpoint
- No semaphore on eval background tasks (concurrent job limit)
- Optimistic locking on promotion not implemented (last-write-wins acceptable for single-tenant)
