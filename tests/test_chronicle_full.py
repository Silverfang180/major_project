"""
test_chronicle_full.py — Complete Integration Test Suite for Chronicle

Prerequisites:
    pip install pytest pytest-asyncio httpx

Run:
    pytest test_chronicle_full.py -v

Requires a running PostgreSQL with migrations applied (alembic upgrade head).
"""

import pytest
import pytest_asyncio
import uuid
from unittest.mock import AsyncMock, patch

from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select

from main import app
from config import settings
from version_control.alias_history import AliasHistory
from execution.models import Run
from execution.pricing import calculate_cost
from execution.llm_service import LLMError


# -------------------------------------------------------------------
# Constants — derived from main.py router prefixes and route decorators
# -------------------------------------------------------------------
VC = "/api/v1/version-control"
EXEC = "/api/v1"
USER_ID = "00000000-0000-0000-0000-000000000099"
AUTH_HEADERS = {"X-API-Key": "chronicle-dev-key"}
# execution/routes.py line 26: from execution.llm_service import call_llm
LLM_MOCK = "execution.routes.call_llm"


# -------------------------------------------------------------------
# Helpers
# -------------------------------------------------------------------
def _key():
    return f"t-{uuid.uuid4().hex[:10]}"


def _llm_ok(model="llama-3.3-70b-versatile", pt=10, ct=20):
    """Mock return matching llm_service.call_llm dict structure."""
    return {
        "response": "Mocked output",
        "model": model,
        "usage": {"prompt_tokens": pt, "completion_tokens": ct, "total_tokens": pt + ct},
        "finish_reason": "stop",
        "latency_ms": 42,
    }


def _transport():
    return ASGITransport(app=app)


async def _make_client():
    return AsyncClient(transport=_transport(), base_url="http://testserver", headers=AUTH_HEADERS)


async def _create_prompt(client, key=None):
    key = key or _key()
    r = await client.post(
        f"{VC}/prompts",
        json={"key": key, "title": f"P-{key}", "created_by": USER_ID},
    )
    assert r.status_code == 201, f"create_prompt failed: {r.status_code} {r.text}"
    return r.json()


async def _create_version(client, prompt_id, text="Hello {{name}}, welcome to {{place}}!",
                           model="llama-3.3-70b-versatile"):
    r = await client.post(
        f"{VC}/versions",
        json={
            "prompt_id": prompt_id,
            "prompt_text": text,
            "model_settings": {"model": model, "temperature": 0.5},
            "change_note": "auto",
            "created_by": USER_ID,
        },
    )
    assert r.status_code == 201, f"create_version failed: {r.status_code} {r.text}"
    return r.json()


async def _promote(client, prompt_id, version_id):
    r = await client.post(
        f"{VC}/prompts/{prompt_id}/promote",
        json={"version_id": version_id},
    )
    assert r.status_code == 200, f"promote failed: {r.status_code} {r.text}"
    return r.json()


async def _full_setup(client):
    """Create prompt + version + promote. Returns dict."""
    p = await _create_prompt(client)
    v = await _create_version(client, p["prompt_id"])
    await _promote(client, p["prompt_id"], v["version_id"])
    return {"key": p["key"], "prompt_id": p["prompt_id"], "version_id": v["version_id"]}


async def _get_db_session():
    engine = create_async_engine(settings.database_url)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    session = factory()
    return session, engine


# ===================================================================
# SECTION 1 — Prompt Management
# ===================================================================
class TestPromptManagement:

    async def test_create_prompt_201(self):
        async with AsyncClient(transport=_transport(), base_url="http://testserver", headers=AUTH_HEADERS) as c:
            key = _key()
            r = await c.post(
                f"{VC}/prompts",
                json={"key": key, "title": "My Prompt", "created_by": USER_ID},
            )
            assert r.status_code == 201
            body = r.json()
            assert body["key"] == key
            assert body["title"] == "My Prompt"
            assert body["created_by"] == USER_ID
            assert "prompt_id" in body
            assert "created_at" in body

    async def test_list_prompts_includes_created(self):
        async with AsyncClient(transport=_transport(), base_url="http://testserver", headers=AUTH_HEADERS) as c:
            p = await _create_prompt(c)
            r = await c.get(f"{VC}/prompts")
            assert r.status_code == 200
            keys = [item["key"] for item in r.json()]
            assert p["key"] in keys

    async def test_duplicate_key_rejected(self):
        async with AsyncClient(transport=_transport(), base_url="http://testserver", headers=AUTH_HEADERS) as c:
            key = _key()
            await _create_prompt(c, key=key)
            r2 = await c.post(
                f"{VC}/prompts",
                json={"key": key, "title": "Dup", "created_by": USER_ID},
            )
            assert r2.status_code == 409

    async def test_version_for_nonexistent_prompt_rejected(self):
        async with AsyncClient(transport=_transport(), base_url="http://testserver", headers=AUTH_HEADERS) as c:
            r = await c.post(
                f"{VC}/versions",
                json={
                    "prompt_id": str(uuid.uuid4()),
                    "prompt_text": "text",
                    "change_note": "test",
                    "created_by": USER_ID,
                },
            )
            assert r.status_code == 404


# ===================================================================
# SECTION 2 — Version Control
# ===================================================================
class TestVersionControl:

    async def test_first_version_ordinal_and_latest(self):
        async with AsyncClient(transport=_transport(), base_url="http://testserver", headers=AUTH_HEADERS) as c:
            p = await _create_prompt(c)
            v = await _create_version(c, p["prompt_id"])
            assert v["ordinal"] == 1
            assert v["is_latest"] is True

    async def test_second_version_increments_ordinal(self):
        async with AsyncClient(transport=_transport(), base_url="http://testserver", headers=AUTH_HEADERS) as c:
            p = await _create_prompt(c)
            await _create_version(c, p["prompt_id"], text="V1 {{name}} {{place}}")
            v2 = await _create_version(c, p["prompt_id"], text="V2 {{name}} {{place}}")
            assert v2["ordinal"] == 2
            assert v2["is_latest"] is True
            # Check v1 is no longer latest via history
            hist = await c.get(f"{VC}/versions/{p['prompt_id']}/history")
            v1_row = next(v for v in hist.json() if v["ordinal"] == 1)
            assert v1_row["is_latest"] is False

    async def test_version_history_descending_order(self):
        async with AsyncClient(transport=_transport(), base_url="http://testserver", headers=AUTH_HEADERS) as c:
            p = await _create_prompt(c)
            await _create_version(c, p["prompt_id"], text="V1 {{name}} {{place}}")
            await _create_version(c, p["prompt_id"], text="V2 {{name}} {{place}}")
            r = await c.get(f"{VC}/versions/{p['prompt_id']}/history")
            assert r.status_code == 200
            ordinals = [v["ordinal"] for v in r.json()]
            assert ordinals == sorted(ordinals, reverse=True)

    async def test_soft_delete_version(self):
        async with AsyncClient(transport=_transport(), base_url="http://testserver", headers=AUTH_HEADERS) as c:
            p = await _create_prompt(c)
            v = await _create_version(c, p["prompt_id"])
            r = await c.delete(f"{VC}/versions/{v['version_id']}")
            assert r.status_code == 204


# ===================================================================
# SECTION 3 — Alias and Promotion
# ===================================================================
class TestAliasAndPromotion:

    async def test_promote_valid_version(self):
        async with AsyncClient(transport=_transport(), base_url="http://testserver", headers=AUTH_HEADERS) as c:
            p = await _create_prompt(c)
            v = await _create_version(c, p["prompt_id"])
            r = await c.post(
                f"{VC}/prompts/{p['prompt_id']}/promote",
                json={"version_id": v["version_id"]},
            )
            assert r.status_code == 200
            assert r.json()["production_version_id"] == v["version_id"]

    async def test_promote_wrong_prompt_rejected(self):
        async with AsyncClient(transport=_transport(), base_url="http://testserver", headers=AUTH_HEADERS) as c:
            p1 = await _create_prompt(c)
            p2 = await _create_prompt(c)
            v2 = await _create_version(c, p2["prompt_id"])
            r = await c.post(
                f"{VC}/prompts/{p1['prompt_id']}/promote",
                json={"version_id": v2["version_id"]},
            )
            assert r.status_code == 400

    async def test_promote_nonexistent_version_rejected(self):
        async with AsyncClient(transport=_transport(), base_url="http://testserver", headers=AUTH_HEADERS) as c:
            p = await _create_prompt(c)
            r = await c.post(
                f"{VC}/prompts/{p['prompt_id']}/promote",
                json={"version_id": 999999999},
            )
            assert r.status_code == 404

    async def test_sequential_promotions_and_alias_history(self):
        async with AsyncClient(transport=_transport(), base_url="http://testserver", headers=AUTH_HEADERS) as c:
            p = await _create_prompt(c)
            pid = p["prompt_id"]
            v1 = await _create_version(c, pid, text="V1 {{name}} {{place}}")
            v2 = await _create_version(c, pid, text="V2 {{name}} {{place}}")

            await _promote(c, pid, v1["version_id"])
            await _promote(c, pid, v2["version_id"])

            # API: production now points to v2
            r = await c.get(f"{VC}/prompts/{pid}")
            assert r.json()["production_version_id"] == v2["version_id"]

        # DB: alias_history has exactly 2 rows for this prompt
        session, engine = await _get_db_session()
        try:
            stmt = (
                select(AliasHistory)
                .where(AliasHistory.prompt_id == uuid.UUID(pid))
                .order_by(AliasHistory.changed_at)
            )
            result = await session.execute(stmt)
            rows = result.scalars().all()
            assert len(rows) == 2
            assert rows[0].from_version_id is None
            assert rows[0].to_version_id == v1["version_id"]
            assert rows[1].from_version_id == v1["version_id"]
            assert rows[1].to_version_id == v2["version_id"]
        finally:
            await session.close()
            await engine.dispose()


# ===================================================================
# SECTION 4 — Execution Boundary
# ===================================================================
class TestExecutionBoundary:

    async def test_execute_no_promoted_version_404(self):
        async with AsyncClient(transport=_transport(), base_url="http://testserver", headers=AUTH_HEADERS) as c:
            p = await _create_prompt(c)
            await _create_version(c, p["prompt_id"])
            r = await c.post(f"{EXEC}/execute/{p['key']}", json={"variables": {}})
            assert r.status_code == 404

    async def test_execute_unsupported_alias_400(self):
        async with AsyncClient(transport=_transport(), base_url="http://testserver", headers=AUTH_HEADERS) as c:
            s = await _full_setup(c)
            r = await c.post(
                f"{EXEC}/execute/{s['key']}",
                params={"alias": "staging"},
                json={"variables": {"name": "A", "place": "B"}},
            )
            assert r.status_code == 400

    async def test_execute_missing_variable_422(self):
        async with AsyncClient(transport=_transport(), base_url="http://testserver", headers=AUTH_HEADERS) as c:
            s = await _full_setup(c)
            with patch(LLM_MOCK, new_callable=AsyncMock) as mock:
                r = await c.post(
                    f"{EXEC}/execute/{s['key']}",
                    json={"variables": {"name": "Alice"}},  # missing 'place'
                )
                assert r.status_code == 422
                mock.assert_not_called()

    async def test_execute_unknown_key_404(self):
        async with AsyncClient(transport=_transport(), base_url="http://testserver", headers=AUTH_HEADERS) as c:
            r = await c.post(
                f"{EXEC}/execute/nonexistent-key-xyz",
                json={"variables": {}},
            )
            assert r.status_code == 404

    async def test_execute_success(self):
        async with AsyncClient(transport=_transport(), base_url="http://testserver", headers=AUTH_HEADERS) as c:
            s = await _full_setup(c)
            with patch(LLM_MOCK, new_callable=AsyncMock, return_value=_llm_ok()):
                r = await c.post(
                    f"{EXEC}/execute/{s['key']}",
                    json={"variables": {"name": "Alice", "place": "Wonderland"}},
                )
            assert r.status_code == 200
            body = r.json()
            assert "run_id" in body
            assert "rendered_prompt" in body
            assert "response" in body
            assert "latency_ms" in body
            assert body["status"] == "success"
            assert r.headers.get("x-promptops-run-id") is not None


# ===================================================================
# SECTION 5 — Run Integrity (the three changes)
# ===================================================================
class TestRunIntegrity:

    async def test_successful_run_db_state(self):
        async with AsyncClient(transport=_transport(), base_url="http://testserver", headers=AUTH_HEADERS) as c:
            s = await _full_setup(c)
            variables = {"name": "Alice", "place": "Wonderland"}
            with patch(LLM_MOCK, new_callable=AsyncMock, return_value=_llm_ok(pt=100, ct=200)):
                r = await c.post(
                    f"{EXEC}/execute/{s['key']}", json={"variables": variables}
                )
            assert r.status_code == 200
            run_id = r.json()["run_id"]

        session, engine = await _get_db_session()
        try:
            result = await session.execute(select(Run).where(Run.run_id == run_id))
            run = result.scalar_one()
            assert run.status == "success"
            assert "Alice" in run.rendered_prompt
            assert "Wonderland" in run.rendered_prompt
            assert run.input_vars == variables
            assert run.cost_usd is not None
            assert float(run.cost_usd) > 0
            assert run.latency_ms >= 0
            assert run.version_id == s["version_id"]
            assert run.alias_used == "production"
        finally:
            await session.close()
            await engine.dispose()

    async def test_llm_error_run_db_state(self):
        async with AsyncClient(transport=_transport(), base_url="http://testserver", headers=AUTH_HEADERS) as c:
            s = await _full_setup(c)
            with patch(LLM_MOCK, new_callable=AsyncMock, side_effect=LLMError("Provider down")):
                r = await c.post(
                    f"{EXEC}/execute/{s['key']}",
                    json={"variables": {"name": "A", "place": "B"}},
                )
            assert r.status_code == 502
            run_id = int(r.headers["x-promptops-run-id"])

        session, engine = await _get_db_session()
        try:
            result = await session.execute(select(Run).where(Run.run_id == run_id))
            run = result.scalar_one()
            assert run.status == "error"
            assert run.status != "pending"
            assert run.error_message is not None
            assert "Provider down" in run.error_message
        finally:
            await session.close()
            await engine.dispose()

    async def test_generic_exception_run_db_state(self):
        async with AsyncClient(transport=_transport(), base_url="http://testserver", headers=AUTH_HEADERS) as c:
            s = await _full_setup(c)
            with patch(LLM_MOCK, new_callable=AsyncMock, side_effect=Exception("Timeout simulation")):
                r = await c.post(
                    f"{EXEC}/execute/{s['key']}",
                    json={"variables": {"name": "A", "place": "B"}},
                )
            assert r.status_code == 502
            run_id = int(r.headers["x-promptops-run-id"])

        session, engine = await _get_db_session()
        try:
            result = await session.execute(select(Run).where(Run.run_id == run_id))
            run = result.scalar_one()
            assert run.status == "error"
            assert run.status != "pending"
            assert run.error_message is not None
            assert "Timeout simulation" in run.error_message
        finally:
            await session.close()
            await engine.dispose()

    async def test_unknown_model_cost_null_but_success(self):
        async with AsyncClient(transport=_transport(), base_url="http://testserver", headers=AUTH_HEADERS) as c:
            s = await _full_setup(c)
            with patch(LLM_MOCK, new_callable=AsyncMock, return_value=_llm_ok(model="unknown-xyz")):
                r = await c.post(
                    f"{EXEC}/execute/{s['key']}",
                    json={"variables": {"name": "A", "place": "B"}},
                )
            assert r.status_code == 200
            run_id = r.json()["run_id"]

        session, engine = await _get_db_session()
        try:
            result = await session.execute(select(Run).where(Run.run_id == run_id))
            run = result.scalar_one()
            assert run.status == "success"
            assert run.cost_usd is None
        finally:
            await session.close()
            await engine.dispose()


# ===================================================================
# SECTION 6 — Cost Calculation Unit Tests (no DB, no HTTP)
# ===================================================================
class TestCostCalculation:

    def test_known_model_correct_cost(self):
        # (1000/1000 * 0.00059) + (1000/1000 * 0.00079) = 0.00138
        result = calculate_cost("llama-3.3-70b-versatile", 1000, 1000)
        assert result == pytest.approx(0.00138)

    def test_unknown_model_returns_none(self):
        assert calculate_cost("nonexistent-model", 1000, 1000) is None

    def test_zero_tokens_returns_zero(self):
        assert calculate_cost("llama-3.3-70b-versatile", 0, 0) == 0.0

    def test_cost_scales_linearly(self):
        cost_1k = calculate_cost("llama-3.3-70b-versatile", 1000, 1000)
        cost_2k = calculate_cost("llama-3.3-70b-versatile", 2000, 2000)
        assert cost_2k == pytest.approx(cost_1k * 2)

    def test_second_model_also_works(self):
        result = calculate_cost("openai/gpt-oss-20b", 1000, 1000)
        assert result is not None  # model is recognised in pricing dict


# ===================================================================
# SECTION 7 — Alias History Endpoint
# ===================================================================
class TestAliasHistoryEndpoint:

    async def test_promote_twice_returns_two_history_rows(self):
        async with AsyncClient(transport=_transport(), base_url="http://testserver", headers=AUTH_HEADERS) as c:
            p = await _create_prompt(c)
            v1 = await _create_version(c, p["prompt_id"])
            v2 = await _create_version(c, p["prompt_id"], text="Version 2: {{name}} at {{place}}")

            # Promote v1 then v2
            await _promote(c, p["prompt_id"], v1["version_id"])
            await _promote(c, p["prompt_id"], v2["version_id"])

            # Fetch alias history via the new endpoint
            r = await c.get(f"{VC}/prompts/{p['prompt_id']}/alias-history")
            assert r.status_code == 200

            history = r.json()
            assert len(history) == 2

            # Newest first (descending by changed_at)
            newest = history[0]
            oldest = history[1]

            # Second promotion: v1 -> v2
            assert newest["from_version_id"] == v1["version_id"]
            assert newest["to_version_id"] == v2["version_id"]

            # First promotion: None -> v1
            assert oldest["from_version_id"] is None
            assert oldest["to_version_id"] == v1["version_id"]

            # Both have timestamps
            assert newest["changed_at"] is not None
            assert oldest["changed_at"] is not None


# ===================================================================
# SECTION 8 — Authentication
# ===================================================================
import re as _re


class TestAuthentication:

    async def test_missing_api_key_returns_401(self):
        async with AsyncClient(transport=_transport(), base_url="http://testserver") as c:
            r = await c.get(f"{VC}/prompts")
            assert r.status_code == 401

    async def test_wrong_api_key_returns_401(self):
        async with AsyncClient(transport=_transport(), base_url="http://testserver", headers={"X-API-Key": "wrong-key"}) as c:
            r = await c.get(f"{VC}/prompts")
            assert r.status_code == 401

    async def test_correct_api_key_passes_through(self):
        async with AsyncClient(transport=_transport(), base_url="http://testserver", headers=AUTH_HEADERS) as c:
            r = await c.get(f"{VC}/prompts")
            assert r.status_code == 200

    async def test_auto_generated_key_matches_pattern(self):
        async with AsyncClient(transport=_transport(), base_url="http://testserver", headers=AUTH_HEADERS) as c:
            r = await c.post(
                f"{VC}/prompts",
                json={"title": "My Test Prompt", "created_by": USER_ID},
            )
            assert r.status_code == 201
            key = r.json()["key"]
            assert _re.match(r'^[a-z0-9-]+-[a-z0-9]{6}$', key), f"Key '{key}' does not match expected pattern"
            assert "my-test-prompt" in key
