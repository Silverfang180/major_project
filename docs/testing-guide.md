# Chronicle — Testing Guide

## Prerequisites

1. PostgreSQL running locally with `chronicle` database
2. Virtual environment activated: `.venv\Scripts\Activate.ps1`
3. Migrations applied: `alembic upgrade head`
4. Dependencies installed: `pip install -r requirements.txt`

---

## Running the Test Suite

```powershell
# Run all 27 tests with verbose output
.venv\Scripts\python.exe -m pytest test_chronicle_full.py -v

# Run a specific test section
.venv\Scripts\python.exe -m pytest test_chronicle_full.py -v -k "TestPromptManagement"
.venv\Scripts\python.exe -m pytest test_chronicle_full.py -v -k "TestVersionControl"
.venv\Scripts\python.exe -m pytest test_chronicle_full.py -v -k "TestAliasAndPromotion"
.venv\Scripts\python.exe -m pytest test_chronicle_full.py -v -k "TestExecutionBoundary"
.venv\Scripts\python.exe -m pytest test_chronicle_full.py -v -k "TestRunIntegrity"
.venv\Scripts\python.exe -m pytest test_chronicle_full.py -v -k "TestCostCalculation"
.venv\Scripts\python.exe -m pytest test_chronicle_full.py -v -k "TestAliasHistoryEndpoint"
```

---

## What Each Section Tests

### Section 1 — Prompt Management (5 tests)
| Test | What it verifies |
|---|---|
| `test_create_and_retrieve_prompt` | POST creates prompt, GET returns it with correct fields |
| `test_list_prompts_returns_all` | GET /prompts returns all created prompts |
| `test_duplicate_key_rejected` | Two prompts with same key → 409 Conflict |
| `test_delete_prompt` | DELETE removes prompt, GET returns 404 |
| `test_get_nonexistent_prompt_404` | GET with random UUID → 404 |

### Section 2 — Version Control (4 tests)
| Test | What it verifies |
|---|---|
| `test_create_version_and_ordinal` | First version gets ordinal 1, is_latest=True |
| `test_second_version_supersedes_first` | Second version gets ordinal 2, first loses is_latest |
| `test_version_history_order` | /history returns versions in correct order |
| `test_create_version_for_nonexistent_prompt_404` | Version for missing prompt → 404 |

### Section 3 — Alias & Promotion (3 tests)
| Test | What it verifies |
|---|---|
| `test_promote_sets_production_version_id` | Promote sets production_version_id on prompt |
| `test_promote_to_different_version` | Re-promoting changes production_version_id |
| `test_sequential_promotions_and_alias_history` | Two promotions create two AliasHistory rows in DB |

### Section 4 — Execution Boundary (4 tests)
| Test | What it verifies |
|---|---|
| `test_execute_success` | Execute with valid variables → 200 with response |
| `test_execute_missing_variable` | Missing required variable → 422 |
| `test_execute_no_production_version` | Prompt without promotion → 400 |
| `test_execute_nonexistent_prompt_key` | Unknown prompt key → 404 |

### Section 5 — Run Integrity (4 tests)
| Test | What it verifies |
|---|---|
| `test_successful_run_db_state` | DB row: status=success, cost_usd calculated, latency ≥ 0 |
| `test_run_id_header_present` | X-PromptOps-Run-ID header in response |
| `test_llm_error_produces_error_run` | LLM failure → DB row: status=error, error_message set |
| `test_unknown_model_cost_null_but_success` | Unknown model → status=success but cost_usd=None |

### Section 6 — Cost Calculation (5 unit tests)
| Test | What it verifies |
|---|---|
| `test_known_model_correct_cost` | Correct cost for llama-3.3-70b-versatile |
| `test_unknown_model_returns_none` | Unknown model → None |
| `test_zero_tokens_returns_zero` | 0 tokens → 0.0 cost |
| `test_cost_scales_linearly` | 2x tokens → 2x cost |
| `test_second_model_also_works` | llama3-70b-8192 pricing works |

### Section 7 — Alias History Endpoint (1 test)
| Test | What it verifies |
|---|---|
| `test_promote_twice_returns_two_history_rows` | Promote v1 then v2, GET alias-history returns 2 rows, newest first, correct from/to IDs |

---

## Manual Frontend Testing

Start the server:
```powershell
.venv\Scripts\python.exe -m uvicorn main:app --reload
```

Open `http://localhost:8000/gui/` in your browser. Test flow:

### 1. Prompt Creation
- Click the **+** button in the sidebar → modal opens
- Enter key: `test-greeting`, title: `Greeting Prompt`
- Click Create → prompt appears in sidebar, main panel shows details

### 2. Version Creation
- In the prompt text field: `Hello {{name}}, welcome to {{place}}!`
- Model settings: `{"model": "llama-3.3-70b-versatile", "temperature": 0.7}`
- Change note: `Initial version`
- Click **Create New Version** → version card appears in the timeline

### 3. Promotion
- Hover a version card in the timeline → **Promote to Production** button appears
- Click it → green **PRODUCTION** badge appears, version card gets green border
- Execution panel appears in the main panel with variable inputs

### 4. Execution
- Fill in the variable inputs (`name`, `place`)
- Click **Execute** → run result shows status, latency, response, est. cost
- Trigger error: leave a variable blank → toast says it's required

### 5. Second Version + Re-promotion
- Edit prompt text, add a change note, create another version
- Promote the new version → badge moves, alias history section appears

### 6. Alias History
- After 2+ promotions, the **Promotion History** section appears in the timeline
- Shows from → to version transitions with timestamps

### 7. Run History
- After multiple executions, the **Run History (Session)** table shows all runs
- Each row has run ID, status badge (green/red), latency, and timestamp

### 8. Theme Toggle
- Click the toggle in the header → switches between dark and light themes

### 9. Delete Prompt
- Hover the prompt title → trash icon appears
- Click it → confirm modal → prompt deleted from sidebar
