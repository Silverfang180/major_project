import pytest
import pytest_asyncio
import uuid
import subprocess
import os
import sys
from httpx import AsyncClient
from sqlalchemy import select

# Import everything from test_chronicle_full so this becomes a superset
from test_chronicle_full import (
    _transport, _create_prompt, _create_version, _promote, _full_setup, _get_db_session,
    VC, EXEC, USER_ID, AUTH_HEADERS,
    TestPromptManagement, TestVersionControl, TestAliasAndPromotion, TestExecutionBoundary, 
    TestRunIntegrity, TestCostCalculation, TestAliasHistoryEndpoint, TestAuthentication
)

from version_control.models import Prompt, PromptVersion
from version_control.alias_history import AliasHistory

class TestDeletionGraphStress:

    async def _create_complex_prompt(self, c: AsyncClient):
        p = await _create_prompt(c)

        # Create multiple versions
        v1 = await _create_version(c, p['prompt_id'])
        v2 = await _create_version(c, p['prompt_id'])
        v3 = await _create_version(c, p['prompt_id'])

        # Promote multiple times to create alias history graph
        await c.post(f"{VC}/prompts/{p['prompt_id']}/promote", json={"version_id": v1['version_id']})
        await c.post(f"{VC}/prompts/{p['prompt_id']}/promote", json={"version_id": v2['version_id']})
        await c.post(f"{VC}/prompts/{p['prompt_id']}/promote", json={"version_id": v3['version_id']})

        return p

    async def test_hard_delete_with_alias_history_integrity(self):
        async with AsyncClient(transport=_transport(), base_url="http://testserver", headers=AUTH_HEADERS) as c:
            p = await self._create_complex_prompt(c)

            # Hard delete
            r = await c.delete(f"{VC}/prompts/{p['prompt_id']}?permanent=true")
            assert r.status_code == 204

            session, engine = await _get_db_session()
            try:
                # Prompt gone
                res = await session.execute(
                    select(Prompt).where(Prompt.prompt_id == uuid.UUID(p['prompt_id']))
                )
                assert res.scalar_one_or_none() is None

                # Versions gone
                res = await session.execute(
                    select(PromptVersion).where(PromptVersion.prompt_id == uuid.UUID(p['prompt_id']))
                )
                assert res.scalar_one_or_none() is None

                # AliasHistory survives
                res = await session.execute(select(AliasHistory))
                history = res.scalars().all()

                # Should not crash, and rows should exist
                assert len(history) > 0

                # All to_version_id that referenced deleted versions should now be NULL
                for row in history:
                    if row.to_version_id is not None:
                        # Should not reference a deleted version
                        res = await session.execute(
                            select(PromptVersion).where(
                                PromptVersion.version_id == row.to_version_id
                            )
                        )
                        assert res.scalar_one_or_none() is not None or row.to_version_id is None

            finally:
                await session.close()
                await engine.dispose()

    async def test_soft_then_hard_delete(self):
        async with AsyncClient(transport=_transport(), base_url="http://testserver", headers=AUTH_HEADERS) as c:
            p = await self._create_complex_prompt(c)

            # Soft delete
            r = await c.delete(f"{VC}/prompts/{p['prompt_id']}?permanent=false")
            assert r.status_code == 204

            # Hard delete
            r = await c.delete(f"{VC}/prompts/{p['prompt_id']}?permanent=true")
            assert r.status_code == 204

    async def test_soft_restore_then_hard_delete(self):
        async with AsyncClient(transport=_transport(), base_url="http://testserver", headers=AUTH_HEADERS) as c:
            p = await self._create_complex_prompt(c)

            # Soft delete
            await c.delete(f"{VC}/prompts/{p['prompt_id']}?permanent=false")

            # Restore
            r = await c.post(f"{VC}/prompts/{p['prompt_id']}/restore")
            assert r.status_code == 200

            # Hard delete after restore
            r = await c.delete(f"{VC}/prompts/{p['prompt_id']}?permanent=true")
            assert r.status_code == 204

    async def test_auto_prune_path(self):
        async with AsyncClient(transport=_transport(), base_url="http://testserver", headers=AUTH_HEADERS) as c:
            p = await self._create_complex_prompt(c)

            # Soft delete
            await c.delete(f"{VC}/prompts/{p['prompt_id']}?permanent=false")

            session, engine = await _get_db_session()
            try:
                # Force deleted_at to 30 days ago
                res = await session.execute(
                    select(Prompt).where(Prompt.prompt_id == uuid.UUID(p['prompt_id']))
                )
                prompt = res.scalar_one()
                from datetime import datetime, timedelta
                prompt.deleted_at = datetime.utcnow() - timedelta(days=30)
                await session.commit()
            finally:
                await session.close()
                await engine.dispose()

            # Trigger auto-prune
            r = await c.get(f"{VC}/prompts/trash/all")
            assert r.status_code == 200

    async def test_soft_delete_uniqueness_policy(self):
        async with AsyncClient(transport=_transport(), base_url="http://testserver", headers=AUTH_HEADERS) as c:
            p = await _create_prompt(c)
            # Soft delete
            await c.delete(f"{VC}/prompts/{p['prompt_id']}?permanent=false")

            # Create new prompt with same key
            payload = {"key": p['key'], "title": "New", "created_by": USER_ID}
            r = await c.post(f"{VC}/prompts", json=payload)
            assert r.status_code == 201

    async def test_restore_breaks_uniqueness_conflict(self):
        async with AsyncClient(transport=_transport(), base_url="http://testserver", headers=AUTH_HEADERS) as c:
            p = await _create_prompt(c)
            # Soft delete
            await c.delete(f"{VC}/prompts/{p['prompt_id']}?permanent=false")

            # Create new prompt with same key
            payload = {"key": p['key'], "title": "New", "created_by": USER_ID}
            await c.post(f"{VC}/prompts", json=payload)

            # Restore original logically fails gracefully
            r = await c.post(f"{VC}/prompts/{p['prompt_id']}/restore")
            assert r.status_code == 409

    async def test_version_uniqueness_integrity(self):
        async with AsyncClient(transport=_transport(), base_url="http://testserver", headers=AUTH_HEADERS) as c:
            p = await _create_prompt(c)
            v1 = await _create_version(c, p['prompt_id'])
            
            # Since create_version increments via func.max over the whole table,
            # we want to manually force a test scenario where an ordinal duplicates temporarily.
            # However this checks that if an ordinal is soft deleted, the unique constraint handles it smoothly.
            await c.delete(f"{VC}/versions/{v1['version_id']}?permanent=false")

            v2 = await _create_version(c, p['prompt_id'])
            # The backend ordinal calculation includes soft-deleted versions, so it monotonically increases to 2.
            assert v2['ordinal'] == 2

            # Restoring v1 works smoothly without causing two "latest" because we properly managed flags
            # and is_latest uniqueness constraint only triggers when is_latest=True AND deleted_at IS NULL
            r = await c.post(f"{VC}/versions/{v1['version_id']}/restore")
            # Wait, v1 currently is_latest=False because creating v2 demoted it. 
            # So restoring it will restore a non-latest history version with ordinal 1, which works perfectly.
            assert r.status_code == 200

    async def test_auto_prune_concurrency_risk(self):
        async with AsyncClient(transport=_transport(), base_url="http://testserver", headers=AUTH_HEADERS) as c:
            p = await self._create_complex_prompt(c)
            await c.delete(f"{VC}/prompts/{p['prompt_id']}?permanent=false")

            session, engine = await _get_db_session()
            try:
                res = await session.execute(select(Prompt).where(Prompt.prompt_id == uuid.UUID(p['prompt_id'])))
                prompt = res.scalar_one()
                from datetime import datetime, timedelta
                prompt.deleted_at = datetime.utcnow() - timedelta(days=30)
                await session.commit()
            finally:
                await session.close()
                await engine.dispose()

            import asyncio
            r1, r2 = await asyncio.gather(
                c.get(f"{VC}/prompts/trash/all"),
                c.get(f"{VC}/prompts/trash/all")
            )
            assert r1.status_code == 200
            assert r2.status_code == 200

class TestChronicleCLI:
    def test_cli_help(self):
        env = os.environ.copy()
        env["PYTHONPATH"] = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "chronicle_cli"))
        result = subprocess.run(
            [sys.executable, "-m", "chronicle_cli.main", "--help"],
            capture_output=True, text=True, env=env
        )
        assert result.returncode == 0
        assert "Usage:" in result.stdout
        assert "prompts" in result.stdout
        assert "versions" in result.stdout
        assert "execute" in result.stdout

    def test_cli_prompts_list(self):
        # This tests requires the server to be running on localhost:8000
        env = os.environ.copy()
        env["PYTHONPATH"] = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "chronicle_cli"))
        env["CHRONICLE_API_URL"] = "http://127.0.0.1:8000/api/v1"
        env["CHRONICLE_API_KEY"] = "chronicle-dev-key"
        
        result = subprocess.run(
            [sys.executable, "-m", "chronicle_cli.main", "prompts", "list"],
            capture_output=True, text=True, env=env
        )
        if "Connection" in result.stderr or "Connection" in result.stdout or "Error" in result.stderr:
            pytest.skip(f"Server is not running on localhost:8000 or config missing. Output: {result.stderr}")
        else:
            assert result.returncode == 0
            assert "Key" in result.stdout or "Title" in result.stdout
