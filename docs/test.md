# Chronicle Testing & Bug Documentation

## 1. Known Bugs and Context

Throughout the development of the Chronicle project (a version-controlled prompt management system), several complex bugs emerged due to the interplay of SQLAlchemy ORM, PostgreSQL constraints, and the frontend assumptions.

### Bug 1.1: CircularDependencyError on Prompt Deletion
- **Context**: The `Prompt` model and `PromptVersion` model reference each other. A `Prompt` has a list of `PromptVersion`s, and a `Prompt` also points to a specific `production_version_id`.
- **Symptom**: Calling `await db.delete(prompt)` failed with a `CircularDependencyError`. The SQLAlchemy Unit-of-Work could not figure out which row to delete first because of the mutual circular reference.

### Bug 1.2: NotNullViolationError on Cascading Deletes
- **Context**: The `AliasHistory` table records when a prompt changes from one version to another. It uses foreign keys pointing to `PromptVersion`. These foreign keys were configured with `ondelete="SET NULL"`.
- **Symptom**: When a `Prompt` and its underlying `PromptVersion`s were successfully deleted, PostgreSQL tried to set the `to_version_id` column in `AliasHistory` to `NULL`. However, the column was defined as `nullable=False`, leading to a crash and transaction rollback.

### Bug 1.3: Missing Soft Delete Implementation (NoResultFound)
- **Context**: The frontend UI contained a "Trash Bin" that sent `DELETE` requests with `?permanent=false` and expected items to be sent to a trash state.
- **Symptom**: The backend ignored this flag and hard-deleted the rows entirely. When executing complex graph stress tests (like soft-deleting and then attempting a hard delete or a restore), the tests crashed with `NoResultFound` because the items were already obliterated from the database. Furthermore, the `TrashBin` UI had no corresponding API endpoints to interact with.

### Bug 1.4: Misplaced Static Files Directory
- **Context**: The FastAPI instance (`main.py`) expects to mount a static `files/` directory (`app.mount("/gui", ...)`).
- **Symptom**: The `files/` directory was accidentally archived into an `archive/` folder during a file reorganization sprint, leading to a `RuntimeError` at application startup.

---

## 2. Fixes and Approaches

### Solution 2.1: Bypassing ORM Cascades for Delets
- **Approach**: To fix the `CircularDependencyError`, we abandoned the automatic SQLAlchemy ORM cascade deletions entirely.
- **Fix**: The `delete_prompt` endpoint was refactored to:
  1.  Manually break the circular pointer by setting `prompt.production_version_id = None`.
  2.  Evict the `prompt` from the ORM session state using `db.expunge()`.
  3.  Execute **Core SQL bulk `DELETE` statements** (`await db.execute(delete(PromptVersion).where(...))`) to wipe out the database rows. This ignores SQLAlchemy's automatic sorting algorithms and explicitly dictates the deletion boundaries.

### Solution 2.2: Altering the Database Constraint
- **Approach**: Ensure the model constraints match the `ondelete` foreign key rules.
- **Fix**: Modified `AliasHistory.to_version_id` and `AliasHistory.from_version_id` to `nullable=True`. Generated and applied an Alembic migration (`make_to_version_id_nullable`) to update the live PostgreSQL schema smoothly without data loss.

### Solution 2.3: Building the Complete Soft Delete Lifecycle
- **Approach**: Implement a standard "Trash" lifecycle.
- **Fix**: 
  - Added `deleted_at: DateTime` columns to `Prompt` and `PromptVersion`.
  - Upgraded models and schemas to expose these columns.
  - Added a global `deleted_at.is_(None)` filter to all `GET` routes (`list_prompts`, `get_version_history`).
  - Added `?permanent=bool` logic to the `DELETE` routes, filling the `deleted_at` timestamp if `False`.
  - Added 4 brand new API endpoints (`/restore` and `/trash/all`) to allow the frontend to safely populate and resurrect the trash bin.

### Solution 2.4: Restoring Directory Structure
- **Fix**: Created new appropriately named backup directories (`scripts`, `logs`) while returning the `files/` directory back to the root of the project to satisfy the hardcoded path.

### Solution 2.5: Soft Delete Edge Cases & Concurrency
- **Context**: Soft deleting items exposes risk around database constraint uniqueness (e.g., creating a prompt with the same key as a soft-deleted one) and concurrency (multiple users emptying the trash bin simultaneously).
- **Fixes Implement**:
  1. *Uniqueness Under Soft Delete*: Dropped hard unique constraints on `Prompt.key` and `PromptVersion` ordinals. Replaced them with partial indexes: `postgresql_where=Column("deleted_at").is_(None)`. You can now safely soft-delete "prompt alpha", create a new "prompt alpha", and the database accepts it.
  2. *Restore Conflicts*: If you attempt to restore the original "prompt alpha" while the new one is active, the database throws an `IntegrityError`. We wrapped the restore endpoints in a `handle_db_errors` try-catch block which gracefully returns a `409 Conflict`.
  3. *Auto-Prune Concurrency*: The `/trash/all` endpoints auto-prune items 30 days old. Instead of looping in python, this uses a pure SQL `DELETE` query. SQL DELETE is inherently idempotent and row-locked. If two requests hit the endpoint simultaneously, one will delete the rows and the other will peacefully delete 0 rows, throwing no exceptions.

---

## 3. Testing Documentation

### 3.1 Total Tests Executed
Currently, the system is tested via a comprehensive integration suite (`tests/test_comprehensive.py`).
- **Total Tests Written**: 41
- **Current Status**: 40 Passed, 1 Skipped (The skipped CLI test requires the frontend server to be running on localhost port 8000 on a separate thread).

### 3.2 Testing Philosophy

**1. Integration over Unit Isolation**  
Instead of mocking the database or LLM endpoints, our Python tests instantiate `AsyncClient` to fire HTTP requests directly against a full test database container. This ensures that the FastAPI application routing, SQLAlchemy models, Pydantic schemas, and Alembic migrations implicitly agree with each other. If one component fails, the test suite captures the holistic failure.

**2. State Transition Stress Testing**  
Because Prompt Version Control systems are highly stateful and interdependent, we test the transition of entities aggressively.
- The `TestDeletionGraphStress` test pushes the data model to the extreme by creating a root `Prompt`, branching 3 `PromptVersion`s, promoting them sequentially to construct a deep `AliasHistory` web, and then bouncing the prompt between soft-deleted and restored states before finally executing a permanent hard delete.
- This verifies that data cascading works reliably and the application doesn't trip on leftover foreign keys.

**3. Test Structure**  
The full suite is organized categorically to match the feature domains:
1.  **Prompt Management**: Creation, listing, duplicate rejection, and 404 handling.
2.  **Version Control**: Version increments, descending history ordering, and soft-delete acceptance.
3.  **Alias and Promotion**: Moving the production pointers and verifying the audit trail generation.
4.  **Execution Boundary**: Ensuring the Variable Injection Engine replaces variables inside version strings.
5.  **Run Integrity**: Emulating successful and failed LLM runs to test cost tracking endpoints.
6.  **Cost Calculation**: Specific unit math tests.
7.  **Alias History Endpoint**: Pagination testing for the history audit table.
8.  **Authentication**: Asserting that wrong/missing keys yield 401s and custom key formats are respected.
9.  **Deletion Graph Stress**: Heavy load testing of the ORM/SQL relationships.
10. **CLI Component Testing**: Spawning parallel `subprocess` runs to ensure the `chronicle_cli` Python  module outputs standard interactive text directly.
