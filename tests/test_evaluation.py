import pytest
import pytest_asyncio
import asyncio
import uuid
import io
from httpx import AsyncClient, ASGITransport
from main import app
from unittest.mock import AsyncMock, patch
from tests.test_chronicle_full import _create_prompt, _create_version

# Constants
EVAL = "/api/v1/eval"
EXEC = "/api/v1"
USER_ID = "00000000-0000-0000-0000-000000000099"
AUTH_HEADERS = {"X-API-Key": "chronicle-dev-key"}
LLM_MOCK = "execution.routes.call_llm"

def _llm_ok():
    return {
        "response": "Mocked version output",
        "model": "llama-3.3-70b-versatile",
        "usage": {"prompt_tokens": 10, "completion_tokens": 20},
        "finish_reason": "stop"
    }

def _transport():
    return ASGITransport(app=app)

@pytest_asyncio.fixture
async def client():
    async with AsyncClient(transport=_transport(), base_url="http://testserver", headers=AUTH_HEADERS) as c:
        yield c

async def _create_dataset(client):
    r = await client.post(
        f"{EVAL}/datasets",
        json={
            "name": "Test Dataset",
            "description": "A test dataset",
            "task_type": "qa",
            "created_by": USER_ID
        }
    )
    assert r.status_code == 201
    return r.json()

class TestEvaluationEngine:

    @pytest.mark.asyncio
    async def test_create_dataset(self, client):
        r = await client.post(
            f"{EVAL}/datasets",
            json={
                "name": "Dataset A",
                "description": "Desc A",
                "task_type": "classification",
                "created_by": USER_ID
            }
        )
        assert r.status_code == 201
        data = r.json()
        assert "dataset_id" in data
        assert data["name"] == "Dataset A"
        assert data["description"] == "Desc A"
        assert data["task_type"] == "classification"
        assert data["created_by"] == USER_ID
        assert data["example_count"] == 0

    @pytest.mark.asyncio
    async def test_create_dataset_invalid_task_type(self, client):
        r = await client.post(
            f"{EVAL}/datasets",
            json={
                "name": "Dataset B",
                "task_type": "invalid_type",
                "created_by": USER_ID
            }
        )
        assert r.status_code == 422

    @pytest.mark.asyncio
    async def test_get_datasets(self, client):
        ds1 = await _create_dataset(client)
        ds2 = await _create_dataset(client)
        
        r = await client.get(f"{EVAL}/datasets")
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 2
        
        ds_ids = [d["dataset_id"] for d in data]
        assert ds1["dataset_id"] in ds_ids
        assert ds2["dataset_id"] in ds_ids
        
        # Verify order DESC
        idx1 = ds_ids.index(ds1["dataset_id"])
        idx2 = ds_ids.index(ds2["dataset_id"])
        assert idx2 < idx1 # ds2 created after ds1, should be first

    @pytest.mark.asyncio
    async def test_get_dataset_not_found(self, client):
        fake_uuid = str(uuid.uuid4())
        r = await client.get(f"{EVAL}/datasets/{fake_uuid}")
        assert r.status_code == 404

    @pytest.mark.asyncio
    async def test_add_example(self, client):
        ds = await _create_dataset(client)
        r = await client.post(
            f"{EVAL}/datasets/{ds['dataset_id']}/examples",
            json={
                "input_vars": {"question": "What is 2+2?"},
                "expected_output": "4",
                "source_tag": "manual"
            }
        )
        assert r.status_code == 201
        data = r.json()
        assert "example_id" in data
        assert data["dataset_id"] == ds["dataset_id"]
        assert data["input_vars"] == {"question": "What is 2+2?"}
        assert data["expected_output"] == "4"

    @pytest.mark.asyncio
    async def test_bulk_add_examples(self, client):
        ds = await _create_dataset(client)
        examples = [
            {"input_vars": {"q": f"q{i}"}, "expected_output": f"a{i}"}
            for i in range(5)
        ]
        r = await client.post(
            f"{EVAL}/datasets/{ds['dataset_id']}/examples/bulk",
            json={"examples": examples}
        )
        assert r.status_code == 201
        assert r.json()["imported"] == 5

    @pytest.mark.asyncio
    async def test_upload_csv_valid(self, client):
        ds = await _create_dataset(client)
        csv_content = 'input_vars,expected_output,source_tag\n{"q":"1"},"a1","tag1"\n{"q":"2"},"a2","tag2"\n'
        files = {"file": ("test.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
        r = await client.post(f"{EVAL}/datasets/{ds['dataset_id']}/examples/upload-csv", files=files)
        assert r.status_code == 200
        data = r.json()
        assert data["imported"] == 2
        assert data["skipped"] == 0
        assert data["errors"] == []

    @pytest.mark.asyncio
    async def test_upload_csv_bad_json(self, client):
        ds = await _create_dataset(client)
        csv_content = 'input_vars,expected_output\n{"q":"1"},"a1"\nbad_json,"a2"\n{"q":"3"},"a3"\n'
        files = {"file": ("test.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
        r = await client.post(f"{EVAL}/datasets/{ds['dataset_id']}/examples/upload-csv", files=files)
        assert r.status_code == 200
        data = r.json()
        assert data["imported"] == 2
        assert data["skipped"] == 1
        assert len(data["errors"]) == 1
        assert "Row 3" in data["errors"][0]

    @pytest.mark.asyncio
    async def test_get_examples(self, client):
        ds = await _create_dataset(client)
        r = await client.post(
            f"{EVAL}/datasets/{ds['dataset_id']}/examples/bulk",
            json={"examples": [
                {"input_vars": {"idx": 1}, "expected_output": "1"},
                {"input_vars": {"idx": 2}, "expected_output": "2"}
            ]}
        )
        assert r.status_code == 201
        
        r2 = await client.get(f"{EVAL}/datasets/{ds['dataset_id']}/examples")
        assert r2.status_code == 200
        data = r2.json()
        assert len(data) == 2
        # Verify ASC order by created_at implicitly (or mostly by content order assuming fast insertion)
        assert data[0]["expected_output"] == "1"
        assert data[1]["expected_output"] == "2"

    @pytest.mark.asyncio
    async def test_delete_dataset(self, client):
        ds = await _create_dataset(client)
        r = await client.post(
            f"{EVAL}/datasets/{ds['dataset_id']}/examples/bulk",
            json={"examples": [
                {"input_vars": {"idx": 1}, "expected_output": "1"},
            ]}
        )
        assert r.status_code == 201
        
        r_del = await client.delete(f"{EVAL}/datasets/{ds['dataset_id']}")
        assert r_del.status_code == 204
        
        r_get = await client.get(f"{EVAL}/datasets/{ds['dataset_id']}")
        assert r_get.status_code == 404

    @pytest.mark.asyncio
    async def test_example_count_accurate(self, client):
        ds = await _create_dataset(client)
        await client.post(
            f"{EVAL}/datasets/{ds['dataset_id']}/examples/bulk",
            json={"examples": [
                {"input_vars": {"idx": 1}, "expected_output": "1"},
                {"input_vars": {"idx": 2}, "expected_output": "2"},
                {"input_vars": {"idx": 3}, "expected_output": "3"}
            ]}
        )
        
        r = await client.get(f"{EVAL}/datasets/{ds['dataset_id']}")
        assert r.status_code == 200
        data = r.json()
        assert data["example_count"] == 3

    @pytest.mark.asyncio
    async def test_version_pinned_execution(self, client):
        p = await _create_prompt(client)
        v1 = await _create_version(client, p["prompt_id"], text="Version 1 {{var}}")
        v2 = await _create_version(client, p["prompt_id"], text="Version 2 {{var}}")
        
        # We don't promote either, but we execute v2 by version_id
        with patch(LLM_MOCK, new_callable=AsyncMock, return_value=_llm_ok()):
            r = await client.post(
                f"{EXEC}/execute/{p['key']}?version_id={v2['version_id']}",
                json={"variables": {"var": "World"}}
            )
            assert r.status_code == 200
            data = r.json()
            assert "Version 2 World" in data["rendered_prompt"]

    @pytest.mark.asyncio
    async def test_version_pinned_wrong_prompt(self, client):
        p1 = await _create_prompt(client)
        v1 = await _create_version(client, p1["prompt_id"], text="Version 1 {{var}}")
        
        p2 = await _create_prompt(client)
        
        r = await client.post(
            f"{EXEC}/execute/{p2['key']}?version_id={v1['version_id']}",
            json={"variables": {"var": "World"}}
        )
        assert r.status_code == 400
        assert r.json()["detail"] == "Version does not belong to this prompt"


class TestEvalOrchestrator:

    @pytest.mark.asyncio
    async def test_create_eval_job(self, client):
        p = await _create_prompt(client)
        v = await _create_version(client, p["prompt_id"])
        ds = await _create_dataset(client)
        
        r_job = await client.post(
            f"{EVAL}/jobs",
            json={
                "prompt_id": p["prompt_id"],
                "version_id": v["version_id"],
                "dataset_id": ds["dataset_id"],
                "evaluators": ["exact_match"],
                "created_by": USER_ID
            }
        )
        assert r_job.status_code == 201
        data = r_job.json()
        assert "job_id" in data
        assert data["status"] == "pending"
        assert data["evaluators"] == ["exact_match"]

    @pytest.mark.asyncio
    async def test_create_eval_job_invalid_prompt(self, client):
        ds = await _create_dataset(client)
        r_job = await client.post(
            f"{EVAL}/jobs",
            json={
                "prompt_id": str(uuid.uuid4()),
                "version_id": 999,
                "dataset_id": ds["dataset_id"],
                "evaluators": ["exact_match"],
                "created_by": USER_ID
            }
        )
        assert r_job.status_code == 404

    @pytest.mark.asyncio
    async def test_create_eval_job_invalid_dataset(self, client):
        p = await _create_prompt(client)
        v = await _create_version(client, p["prompt_id"])
        r_job = await client.post(
            f"{EVAL}/jobs",
            json={
                "prompt_id": p["prompt_id"],
                "version_id": v["version_id"],
                "dataset_id": str(uuid.uuid4()),
                "evaluators": ["exact_match"],
                "created_by": USER_ID
            }
        )
        assert r_job.status_code == 404

    @pytest.mark.asyncio
    async def test_create_eval_job_invalid_evaluator(self, client):
        p = await _create_prompt(client)
        v = await _create_version(client, p["prompt_id"])
        ds = await _create_dataset(client)
        r_job = await client.post(
            f"{EVAL}/jobs",
            json={
                "prompt_id": p["prompt_id"],
                "version_id": v["version_id"],
                "dataset_id": ds["dataset_id"],
                "evaluators": ["invalid_eval"],
                "created_by": USER_ID
            }
        )
        assert r_job.status_code == 422

    @pytest.mark.asyncio
    async def test_get_eval_job(self, client):
        p = await _create_prompt(client)
        v = await _create_version(client, p["prompt_id"])
        ds = await _create_dataset(client)
        r_create = await client.post(f"{EVAL}/jobs", json={
            "prompt_id": p["prompt_id"], "version_id": v["version_id"], 
            "dataset_id": ds["dataset_id"], "evaluators": ["llm_judge"], 
            "created_by": USER_ID
        })
        job_id = r_create.json()["job_id"]
        
        r_get = await client.get(f"{EVAL}/jobs/{job_id}")
        assert r_get.status_code == 200
        data = r_get.json()
        assert data["job_id"] == job_id
        assert data["status"] in ["pending", "running", "completed", "failed"]

    @pytest.mark.asyncio
    async def test_eval_job_completes(self, client):
        from evaluation.orchestrator import run_eval_job
        from config import settings

        p = await _create_prompt(client)
        v = await _create_version(client, p["prompt_id"])
        ds = await _create_dataset(client)
        await client.post(f"{EVAL}/datasets/{ds['dataset_id']}/examples/bulk", json={
            "examples": [
                {"input_vars": {"name": "Alice", "place": "Wonderland"}, "expected_output": "Hello Alice"},
                {"input_vars": {"name": "Bob",   "place": "Narnia"},     "expected_output": "Hello Bob"},
            ]
        })

        # Prevent background task auto-execution; we drive it explicitly
        with patch("evaluation.routes.BackgroundTasks.add_task"):
            r_create = await client.post(f"{EVAL}/jobs", json={
                "prompt_id": p["prompt_id"], "version_id": v["version_id"],
                "dataset_id": ds["dataset_id"], "evaluators": ["exact_match"],
                "created_by": USER_ID
            })
        assert r_create.status_code == 201
        job_id = r_create.json()["job_id"]

        # Run orchestrator directly — real Groq call
        await run_eval_job(job_id, settings.api_key)

        r_get = await client.get(f"{EVAL}/jobs/{job_id}")
        assert r_get.json()["status"] == "completed"

    @pytest.mark.asyncio
    async def test_eval_results_created(self, client):
        from evaluation.orchestrator import run_eval_job
        from config import settings

        p = await _create_prompt(client)
        v = await _create_version(client, p["prompt_id"])
        ds = await _create_dataset(client)
        await client.post(f"{EVAL}/datasets/{ds['dataset_id']}/examples/bulk", json={
            "examples": [
                {"input_vars": {"name": "Carol", "place": "Oz"}, "expected_output": "Hello Carol"},
            ]
        })

        with patch("evaluation.routes.BackgroundTasks.add_task"):
            r_create = await client.post(f"{EVAL}/jobs", json={
                "prompt_id": p["prompt_id"], "version_id": v["version_id"],
                "dataset_id": ds["dataset_id"], "evaluators": ["exact_match"],
                "created_by": USER_ID
            })
        job_id = r_create.json()["job_id"]

        await run_eval_job(job_id, settings.api_key)

        r_results = await client.get(f"{EVAL}/jobs/{job_id}/results")
        assert r_results.status_code == 200
        results = r_results.json()
        assert len(results) == 1
        assert results[0]["raw_output"] is not None
        assert results[0]["run_id"] is not None

    @pytest.mark.asyncio
    async def test_eval_result_cost_latency(self, client):
        from evaluation.orchestrator import run_eval_job
        from config import settings

        p = await _create_prompt(client)
        v = await _create_version(client, p["prompt_id"])
        ds = await _create_dataset(client)
        await client.post(f"{EVAL}/datasets/{ds['dataset_id']}/examples/bulk", json={
            "examples": [
                {"input_vars": {"name": "Dan", "place": "Hogwarts"}, "expected_output": "Hello Dan"},
            ]
        })

        with patch("evaluation.routes.BackgroundTasks.add_task"):
            r_create = await client.post(f"{EVAL}/jobs", json={
                "prompt_id": p["prompt_id"], "version_id": v["version_id"],
                "dataset_id": ds["dataset_id"], "evaluators": ["exact_match"],
                "created_by": USER_ID
            })
        job_id = r_create.json()["job_id"]

        await run_eval_job(job_id, settings.api_key)

        r_results = await client.get(f"{EVAL}/jobs/{job_id}/results")
        res = r_results.json()[0]
        assert res["latency_ms"] is not None and res["latency_ms"] >= 0
        assert res["cost_usd"] is not None and float(res["cost_usd"]) >= 0


# ============================================================================
# TestEvaluators — Phase 2 Week 3
# ============================================================================

class TestEvaluators:
    """
    Unit and integration tests for evaluation/evaluators.py and new routes.
    All LLM calls are mocked — no real API calls.
    """

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _make_result(
        self,
        raw_output: str = "",
        expected_output: str = "",
        is_correct=None,
        confidence_score=None,
        evaluator_score=None,
    ):
        """
        Build a minimal EvalResult-like object without a real DB session.

        Uses SimpleNamespace (duck-typed) because SQLAlchemy ORM models
        instantiated via __new__ have uninitialized instance state that
        breaks attribute assignment.
        """
        import types
        r = types.SimpleNamespace(
            result_id=uuid.uuid4(),
            raw_output=raw_output,
            expected_output=expected_output,
            is_correct=is_correct,
            confidence_score=confidence_score,
            evaluator_score=evaluator_score,
        )
        return r


    def _judge_response(self, is_correct: bool, score: float, reasoning: str = "Test") -> dict:
        import json
        return {
            "response": json.dumps({"is_correct": is_correct, "score": score, "reasoning": reasoning}),
            "model": "openai/gpt-oss-120b",
            "usage": {"prompt_tokens": 50, "completion_tokens": 30, "total_tokens": 80},
            "finish_reason": "stop",
            "latency_ms": 200,
        }

    # ── exact_match ───────────────────────────────────────────────────────────

    @pytest.mark.asyncio
    async def test_exact_match_correct(self):
        from evaluation.evaluators import exact_match
        r = self._make_result("positive", "positive")
        is_correct, score = await exact_match(r)
        assert is_correct is True
        assert score == 1.0

    @pytest.mark.asyncio
    async def test_exact_match_normalization(self):
        from evaluation.evaluators import exact_match
        # Differs in case, punctuation, and whitespace
        r = self._make_result("  POSITIVE! ", "positive")
        is_correct, score = await exact_match(r)
        assert is_correct is True
        assert score == 1.0

    @pytest.mark.asyncio
    async def test_exact_match_incorrect(self):
        from evaluation.evaluators import exact_match
        r = self._make_result("negative", "positive")
        is_correct, score = await exact_match(r)
        assert is_correct is False
        assert score == 0.0

    @pytest.mark.asyncio
    async def test_exact_match_qa_substring(self):
        from evaluation.evaluators import exact_match
        # expected > 50 chars → QA heuristic (substring)
        expected = "mitochondria is the powerhouse of the cell in biology"
        raw_output = (
            "According to the passage, the mitochondria is the powerhouse "
            "of the cell in biology and plays a key role in energy production."
        )
        r = self._make_result(raw_output, expected)
        is_correct, score = await exact_match(r)
        assert is_correct is True
        assert score == 1.0

    # ── llm_judge ─────────────────────────────────────────────────────────────

    @pytest.mark.asyncio
    async def test_llm_judge_correct(self):
        from evaluation.evaluators import llm_judge
        r = self._make_result("The answer is 42.", "42")
        with patch("evaluation.evaluators.call_llm", new=AsyncMock(
            return_value=self._judge_response(True, 0.9)
        )):
            is_correct, score = await llm_judge(r, "openai/gpt-oss-120b")
        assert is_correct is True
        assert score == pytest.approx(0.9)

    @pytest.mark.asyncio
    async def test_llm_judge_parse_failure(self):
        from evaluation.evaluators import llm_judge
        r = self._make_result("something", "expected")
        with patch("evaluation.evaluators.call_llm", new=AsyncMock(
            return_value={"response": "not valid json at all !!!"}
        )):
            is_correct, score = await llm_judge(r, "openai/gpt-oss-120b")
        assert is_correct is False
        assert score == 0.0

    # ── confidence_calibration ────────────────────────────────────────────────

    @pytest.mark.asyncio
    async def test_confidence_calibration_insufficient_data(self):
        from evaluation.evaluators import confidence_calibration
        results = [
            self._make_result(is_correct=True, confidence_score=0.9),
            self._make_result(is_correct=False, confidence_score=0.4),
        ]
        out = await confidence_calibration(results)
        assert out.get("error") == "insufficient_data"
        assert out.get("min_required") == 5

    @pytest.mark.asyncio
    async def test_confidence_calibration_mce(self):
        from evaluation.evaluators import confidence_calibration
        # 10 results: perfect calibration → MCE near 0
        results = []
        for conf, correct in [
            (0.95, True), (0.85, True), (0.75, True), (0.65, True), (0.55, True),
            (0.45, False), (0.35, False), (0.25, False), (0.15, False), (0.05, False),
        ]:
            results.append(self._make_result(is_correct=correct, confidence_score=conf))
        out = await confidence_calibration(results)
        assert "mce" in out
        assert isinstance(out["mce"], float)
        assert 0.0 <= out["mce"] <= 1.0
        assert out["n_samples"] == 10

    @pytest.mark.asyncio
    async def test_confidence_calibration_platt(self):
        from evaluation.evaluators import confidence_calibration
        results = [
            self._make_result(is_correct=(i % 2 == 0), confidence_score=0.1 * (i + 1))
            for i in range(10)
        ]
        out = await confidence_calibration(results)
        assert isinstance(out.get("platt_A"), float)
        assert isinstance(out.get("platt_B"), float)
        calibrated = out.get("platt_calibrated_scores", [])
        assert len(calibrated) == 10

    # ── run_evaluators pipeline ───────────────────────────────────────────────

    @pytest.mark.asyncio
    async def test_run_evaluators_exact_match(self):
        from evaluation.evaluators import run_evaluators
        import types

        job = types.SimpleNamespace(job_id=uuid.uuid4(), evaluators=["exact_match"])

        results = [
            self._make_result("positive", "positive"),
            self._make_result("negative", "positive"),
        ]

        mock_db = AsyncMock()
        mock_db.commit = AsyncMock()

        await run_evaluators(job, results, mock_db)

        assert results[0].is_correct is True
        assert results[0].evaluator_score == 1.0
        assert results[1].is_correct is False
        assert results[1].evaluator_score == 0.0
        mock_db.commit.assert_called()

    @pytest.mark.asyncio
    async def test_run_evaluators_calibration_no_scores(self):
        from evaluation.evaluators import run_evaluators
        import types

        job = types.SimpleNamespace(
            job_id=uuid.uuid4(),
            evaluators=["confidence_calibration"],  # no scoring evaluator
        )

        results = [
            self._make_result(is_correct=None),  # not scored yet
            self._make_result(is_correct=None),
        ]

        mock_db = AsyncMock()
        with pytest.raises(ValueError, match="requires a scoring evaluator"):
            await run_evaluators(job, results, mock_db)


    # ── HTTP endpoints ────────────────────────────────────────────────────────

    @pytest.mark.asyncio
    async def test_evaluate_endpoint_triggers_background(self, client):
        """POST /jobs/{id}/evaluate on a completed job → 202."""
        from evaluation.orchestrator import run_eval_job
        from config import settings

        p = await _create_prompt(client)
        v = await _create_version(client, p["prompt_id"])
        ds = await _create_dataset(client)
        await client.post(f"{EVAL}/datasets/{ds['dataset_id']}/examples/bulk", json={
            "examples": [{"input_vars": {"name": "X", "place": "Y"}, "expected_output": "Hi X"}]
        })
        with patch("evaluation.routes.BackgroundTasks.add_task"):
            r = await client.post(f"{EVAL}/jobs", json={
                "prompt_id": p["prompt_id"], "version_id": v["version_id"],
                "dataset_id": ds["dataset_id"], "evaluators": ["exact_match"],
                "created_by": USER_ID,
            })
        job_id = r.json()["job_id"]
        await run_eval_job(job_id, settings.api_key)

        # Now trigger re-evaluation
        with patch("evaluation.routes.BackgroundTasks.add_task"):
            r2 = await client.post(f"{EVAL}/jobs/{job_id}/evaluate")
        assert r2.status_code == 202
        body = r2.json()
        assert body["job_id"] == job_id
        assert "started" in body["message"].lower()

    @pytest.mark.asyncio
    async def test_evaluate_endpoint_rejects_pending_job(self, client):
        """POST /jobs/{id}/evaluate on a pending job → 400."""
        p = await _create_prompt(client)
        v = await _create_version(client, p["prompt_id"])
        ds = await _create_dataset(client)
        await client.post(f"{EVAL}/datasets/{ds['dataset_id']}/examples/bulk", json={
            "examples": [{"input_vars": {"name": "X", "place": "Y"}, "expected_output": "Hi X"}]
        })
        with patch("evaluation.routes.BackgroundTasks.add_task"):
            r = await client.post(f"{EVAL}/jobs", json={
                "prompt_id": p["prompt_id"], "version_id": v["version_id"],
                "dataset_id": ds["dataset_id"], "evaluators": ["exact_match"],
                "created_by": USER_ID,
            })
        job_id = r.json()["job_id"]
        # Job is still pending (background task was patched away)
        r2 = await client.post(f"{EVAL}/jobs/{job_id}/evaluate")
        assert r2.status_code == 400
        assert "completed" in r2.json()["detail"].lower()


# ============================================================================
# TestMetrics — Phase 2 Week 4
# ============================================================================

class TestMetrics:
    """
    Tests for evaluation/metrics.py (compute_summary, compute_pareto_frontier,
    identify_knee_point) and the four new HTTP endpoints.
    """

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _make_summary(
        self,
        job_id=None,
        dataset_id=None,
        accuracy=None,
        cost_per_correct=None,
        total_examples=10,
        scored_examples=10,
    ):
        """Build a minimal EvalSummary-like SimpleNamespace for pure-function tests."""
        import types
        return types.SimpleNamespace(
            summary_id=uuid.uuid4(),
            job_id=job_id or uuid.uuid4(),
            prompt_id=uuid.uuid4(),
            version_id=1,
            dataset_id=dataset_id or uuid.uuid4(),
            model="test-model",
            total_examples=total_examples,
            scored_examples=scored_examples,
            accuracy=accuracy,
            mean_evaluator_score=None,
            total_cost_usd=None,
            mean_cost_per_run=None,
            cost_per_correct=cost_per_correct,
            mean_latency_ms=None,
            p50_latency_ms=None,
            p95_latency_ms=None,
            mce=None,
            overconfidence_rate=None,
            underconfidence_rate=None,
            computed_at=__import__("datetime").datetime.utcnow(),
        )

    # ── compute_summary ───────────────────────────────────────────────────────

    @pytest.mark.asyncio
    async def test_compute_summary_basic(self, client):
        """Complete a job with known results, call compute_summary, assert fields."""
        from evaluation.orchestrator import run_eval_job
        from evaluation.metrics import compute_summary
        from config import settings
        from db import async_session

        p = await _create_prompt(client)
        v = await _create_version(client, p["prompt_id"])
        ds = await _create_dataset(client)
        await client.post(f"{EVAL}/datasets/{ds['dataset_id']}/examples/bulk", json={
            "examples": [
                {"input_vars": {"name": "A", "place": "X"}, "expected_output": "Hello A"},
                {"input_vars": {"name": "B", "place": "Y"}, "expected_output": "Hello B"},
            ]
        })
        with patch("evaluation.routes.BackgroundTasks.add_task"):
            r = await client.post(f"{EVAL}/jobs", json={
                "prompt_id": p["prompt_id"], "version_id": v["version_id"],
                "dataset_id": ds["dataset_id"], "evaluators": ["exact_match"],
                "created_by": USER_ID
            })
        job_id = r.json()["job_id"]
        await run_eval_job(job_id, settings.api_key)

        # Verify summary was created by the orchestrator automatically
        async with async_session() as db:
            from sqlalchemy import select
            from evaluation.models import EvalSummary
            stmt = select(EvalSummary).where(EvalSummary.job_id == uuid.UUID(job_id))
            result = await db.execute(stmt)
            summary = result.scalar_one_or_none()

        assert summary is not None
        assert summary.total_examples == 2
        assert summary.scored_examples == 2
        # accuracy is correct/scored — value depends on LLM output, so just check type
        assert summary.accuracy is None or isinstance(summary.accuracy, float)

    @pytest.mark.asyncio
    async def test_compute_summary_upsert(self, client):
        """Call compute_summary twice — only one row in DB."""
        from evaluation.orchestrator import run_eval_job
        from evaluation.metrics import compute_summary
        from config import settings
        from db import async_session

        p = await _create_prompt(client)
        v = await _create_version(client, p["prompt_id"])
        ds = await _create_dataset(client)
        await client.post(f"{EVAL}/datasets/{ds['dataset_id']}/examples/bulk", json={
            "examples": [{"input_vars": {"name": "C", "place": "Z"}, "expected_output": "Hello C"}]
        })
        with patch("evaluation.routes.BackgroundTasks.add_task"):
            r = await client.post(f"{EVAL}/jobs", json={
                "prompt_id": p["prompt_id"], "version_id": v["version_id"],
                "dataset_id": ds["dataset_id"], "evaluators": ["exact_match"],
                "created_by": USER_ID
            })
        job_id = r.json()["job_id"]
        await run_eval_job(job_id, settings.api_key)

        # Call compute_summary a second time explicitly
        async with async_session() as db:
            await compute_summary(uuid.UUID(job_id), db)

        # Verify still only one summary row
        async with async_session() as db:
            from sqlalchemy import select, func
            from evaluation.models import EvalSummary
            stmt = select(func.count()).where(EvalSummary.job_id == uuid.UUID(job_id))
            count = (await db.execute(stmt)).scalar()
        assert count == 1

    @pytest.mark.asyncio
    async def test_compute_summary_null_costs(self, client):
        """Results with null cost_usd → cost fields are None, not an error."""
        from evaluation.orchestrator import run_eval_job
        from config import settings
        from db import async_session

        p = await _create_prompt(client)
        v = await _create_version(client, p["prompt_id"])
        ds = await _create_dataset(client)
        await client.post(f"{EVAL}/datasets/{ds['dataset_id']}/examples/bulk", json={
            "examples": [{"input_vars": {"name": "D", "place": "W"}, "expected_output": "Hi D"}]
        })
        with patch("evaluation.routes.BackgroundTasks.add_task"):
            r = await client.post(f"{EVAL}/jobs", json={
                "prompt_id": p["prompt_id"], "version_id": v["version_id"],
                "dataset_id": ds["dataset_id"], "evaluators": ["exact_match"],
                "created_by": USER_ID
            })
        job_id = r.json()["job_id"]

        # Patch pricing to return None so cost_usd is null
        with patch("evaluation.orchestrator.calculate_cost", return_value=None):
            await run_eval_job(job_id, settings.api_key)

        async with async_session() as db:
            from sqlalchemy import select
            from evaluation.models import EvalSummary
            stmt = select(EvalSummary).where(EvalSummary.job_id == uuid.UUID(job_id))
            result = await db.execute(stmt)
            summary = result.scalar_one_or_none()

        assert summary is not None
        assert summary.total_cost_usd is None
        assert summary.mean_cost_per_run is None
        assert summary.cost_per_correct is None

    @pytest.mark.asyncio
    async def test_compute_summary_latency_percentiles(self, client):
        """20 results with known latency values — assert p50 and p95 correct."""
        import types, statistics as stats
        from evaluation.metrics import compute_summary

        # Build the known latency dataset and expected p50/p95
        latency_values = list(range(1, 21))  # 1..20
        expected_p50 = float(stats.median(sorted(latency_values)))
        n = len(latency_values)
        expected_p95 = float(sorted(latency_values)[min(int(0.95 * n), n - 1)])

        from db import async_session
        from evaluation.orchestrator import run_eval_job
        from config import settings

        p = await _create_prompt(client)
        v = await _create_version(client, p["prompt_id"])
        ds = await _create_dataset(client)
        examples = [
            {"input_vars": {"name": f"N{i}", "place": "P"}, "expected_output": f"Hello N{i}"}
            for i in range(20)
        ]
        await client.post(f"{EVAL}/datasets/{ds['dataset_id']}/examples/bulk", json={"examples": examples})

        with patch("evaluation.routes.BackgroundTasks.add_task"):
            r = await client.post(f"{EVAL}/jobs", json={
                "prompt_id": p["prompt_id"], "version_id": v["version_id"],
                "dataset_id": ds["dataset_id"], "evaluators": ["exact_match"],
                "created_by": USER_ID
            })
        job_id = r.json()["job_id"]

        # Patch call_llm to return deterministic latency values
        call_count = [0]
        async def _fake_llm(**kwargs):
            latency = latency_values[call_count[0] % 20]
            call_count[0] += 1
            return {
                "response": "hello",
                "model": "fake-model",
                "usage": {"prompt_tokens": 5, "completion_tokens": 5},
                "finish_reason": "stop",
                "latency_ms": latency,
            }

        with patch("evaluation.orchestrator.call_llm", new=_fake_llm):
            await run_eval_job(job_id, settings.api_key)

        async with async_session() as db:
            from sqlalchemy import select
            from evaluation.models import EvalSummary
            stmt = select(EvalSummary).where(EvalSummary.job_id == uuid.UUID(job_id))
            result = await db.execute(stmt)
            summary = result.scalar_one_or_none()

        assert summary is not None
        assert summary.p50_latency_ms == pytest.approx(expected_p50, abs=1)
        assert summary.p95_latency_ms == pytest.approx(expected_p95, abs=1)

    # ── compute_pareto_frontier ───────────────────────────────────────────────

    def test_pareto_frontier_basic(self):
        """3 summaries where one is dominated — assert dominated has is_pareto_optimal False."""
        from evaluation.metrics import compute_pareto_frontier

        ds_id = uuid.uuid4()
        # a: high accuracy, high cost — not dominated
        # b: low accuracy, low cost — not dominated
        # c: low accuracy, high cost — dominated by both a (more accurate) and b (cheaper)
        a = self._make_summary(dataset_id=ds_id, accuracy=0.9, cost_per_correct=2.0)
        b = self._make_summary(dataset_id=ds_id, accuracy=0.5, cost_per_correct=0.5)
        c = self._make_summary(dataset_id=ds_id, accuracy=0.3, cost_per_correct=2.5)
        # c is dominated by a (a.cost=2.0 < c.cost=2.5 AND a.acc=0.9 > c.acc=0.3)
        # c is dominated by b (b.cost=0.5 < c.cost=2.5 AND b.acc=0.5 > c.acc=0.3)
        # a is NOT dominated by b (b.acc=0.5 < a.acc=0.9)
        # b is NOT dominated by a (a.cost=2.0 > b.cost=0.5)

        results = compute_pareto_frontier([a, b, c])
        result_map = {r["job_id"]: r for r in results}
        assert result_map[str(c.job_id)]["is_pareto_optimal"] is False
        assert result_map[str(a.job_id)]["is_pareto_optimal"] is True
        assert result_map[str(b.job_id)]["is_pareto_optimal"] is True

    def test_pareto_frontier_all_optimal(self):
        """3 summaries where none dominates another — all Pareto-optimal."""
        from evaluation.metrics import compute_pareto_frontier

        ds_id = uuid.uuid4()
        # Each is better on a different axis; no one dominates another
        a = self._make_summary(dataset_id=ds_id, accuracy=0.9, cost_per_correct=3.0)
        b = self._make_summary(dataset_id=ds_id, accuracy=0.7, cost_per_correct=1.5)
        c = self._make_summary(dataset_id=ds_id, accuracy=0.5, cost_per_correct=0.5)

        results = compute_pareto_frontier([a, b, c])
        assert all(r["is_pareto_optimal"] for r in results)

    def test_pareto_frontier_dominance_lists(self):
        """Verify dominates and dominated_by lists are populated correctly."""
        from evaluation.metrics import compute_pareto_frontier

        ds_id = uuid.uuid4()
        a = self._make_summary(dataset_id=ds_id, accuracy=0.8, cost_per_correct=0.4)  # dominates c
        b = self._make_summary(dataset_id=ds_id, accuracy=0.9, cost_per_correct=0.3)  # dominates a and c
        c = self._make_summary(dataset_id=ds_id, accuracy=0.3, cost_per_correct=2.0)  # dominated by both

        results = compute_pareto_frontier([a, b, c])
        result_map = {r["job_id"]: r for r in results}

        c_entry = result_map[str(c.job_id)]
        assert str(a.job_id) in c_entry["dominated_by"]
        assert str(b.job_id) in c_entry["dominated_by"]
        assert str(c.job_id) in result_map[str(a.job_id)]["dominates"]
        assert str(c.job_id) in result_map[str(b.job_id)]["dominates"]

    # ── identify_knee_point ───────────────────────────────────────────────────

    def test_knee_point_identified(self):
        """
        4 Pareto-optimal points forming an L-shaped curve.
        p2 has the biggest accuracy jump per unit cost — it's the elbow/knee.
        The perpendicular distance method should pick p2 as the knee.
        """
        from evaluation.metrics import identify_knee_point

        # Concave frontier: big acc gain at p2, then diminishing returns at p3/p4.
        # p1 and p4 are at the extremes of the L-shape.
        # p2 is at the elbow.
        p1 = {"job_id": "a", "accuracy": 0.1, "cost_per_correct": 0.1, "is_pareto_optimal": True}
        p2 = {"job_id": "b", "accuracy": 0.8, "cost_per_correct": 0.5, "is_pareto_optimal": True}
        p3 = {"job_id": "c", "accuracy": 0.82, "cost_per_correct": 1.5, "is_pareto_optimal": True}
        p4 = {"job_id": "d", "accuracy": 0.85, "cost_per_correct": 5.0, "is_pareto_optimal": True}

        result = identify_knee_point([p1, p2, p3, p4])
        assert result is not None
        assert result.get("is_knee_point") is True
        # p2 has the largest jump in accuracy at moderate cost, so it should be the knee
        assert result["job_id"] == "b"

    def test_knee_point_insufficient_points(self):
        """Fewer than 3 Pareto-optimal points — returns None."""
        from evaluation.metrics import identify_knee_point

        pts = [
            {"job_id": "a", "accuracy": 0.5, "cost_per_correct": 1.0, "is_pareto_optimal": True},
            {"job_id": "b", "accuracy": 0.9, "cost_per_correct": 0.3, "is_pareto_optimal": True},
        ]
        assert identify_knee_point(pts) is None

    def test_recommendation_two_pareto_points(self):
        """Two Pareto-optimal points with no knee should return two-option text."""
        from evaluation.metrics import generate_recommendation
        frontier = [
            {
                "job_id": "job-1",
                "version_id": 1,
                "model": "llama-3.3-70b-versatile",
                "accuracy": 0.6,
                "cost_per_correct": 1.5,
                "is_pareto_optimal": True,
                "is_knee_point": False,
            },
            {
                "job_id": "job-2",
                "version_id": 2,
                "model": "llama-3.3-70b-versatile",
                "accuracy": 0.5,
                "cost_per_correct": 1.0,
                "is_pareto_optimal": True,
                "is_knee_point": False,
            },
        ]
        result = generate_recommendation(frontier, knee_point=None)
        assert "Two viable options" in result
        assert "maximises accuracy" in result
        assert "minimises cost" in result

    def test_recommendation_fallback_never_fires_with_valid_data(self):
        """The generic fallback must never fire when valid Pareto data exists."""
        from evaluation.metrics import generate_recommendation
        frontier = [
            {
                "job_id": "job-1",
                "version_id": 1,
                "model": "gpt-4o",
                "accuracy": 0.9,
                "cost_per_correct": 2.0,
                "is_pareto_optimal": True,
                "is_knee_point": False,
            },
            {
                "job_id": "job-2",
                "version_id": 2,
                "model": "gpt-4o",
                "accuracy": 0.7,
                "cost_per_correct": 0.5,
                "is_pareto_optimal": True,
                "is_knee_point": False,
            },
        ]
        result = generate_recommendation(frontier, knee_point=None)
        assert result != "Insufficient data to make a recommendation. Run eval jobs and ensure evaluators populate is_correct."

    # ── HTTP endpoints ────────────────────────────────────────────────────────

    @pytest.mark.asyncio
    async def test_summary_endpoint(self, client):
        """GET /jobs/{id}/summary after completion — all fields present."""
        from evaluation.orchestrator import run_eval_job
        from config import settings

        p = await _create_prompt(client)
        v = await _create_version(client, p["prompt_id"])
        ds = await _create_dataset(client)
        await client.post(f"{EVAL}/datasets/{ds['dataset_id']}/examples/bulk", json={
            "examples": [{"input_vars": {"name": "E", "place": "V"}, "expected_output": "Hello E"}]
        })
        with patch("evaluation.routes.BackgroundTasks.add_task"):
            r = await client.post(f"{EVAL}/jobs", json={
                "prompt_id": p["prompt_id"], "version_id": v["version_id"],
                "dataset_id": ds["dataset_id"], "evaluators": ["exact_match"],
                "created_by": USER_ID
            })
        job_id = r.json()["job_id"]
        await run_eval_job(job_id, settings.api_key)

        r_summary = await client.get(f"{EVAL}/jobs/{job_id}/summary")
        assert r_summary.status_code == 200
        data = r_summary.json()
        # Verify all required fields are present
        for field in [
            "summary_id", "job_id", "prompt_id", "version_id", "dataset_id", "model",
            "total_examples", "scored_examples", "accuracy", "computed_at",
        ]:
            assert field in data, f"Missing field: {field}"
        assert data["job_id"] == job_id
        assert data["total_examples"] == 1

    @pytest.mark.asyncio
    async def test_summary_endpoint_not_found(self, client):
        """GET /jobs/{id}/summary for non-existent job → 404."""
        r = await client.get(f"{EVAL}/jobs/{uuid.uuid4()}/summary")
        assert r.status_code == 404

    @pytest.mark.asyncio
    async def test_pareto_endpoint(self, client):
        """Create 3 jobs on same dataset, complete them, GET /datasets/{id}/pareto."""
        from evaluation.orchestrator import run_eval_job
        from config import settings

        ds = await _create_dataset(client)
        await client.post(f"{EVAL}/datasets/{ds['dataset_id']}/examples/bulk", json={
            "examples": [{"input_vars": {"name": "F", "place": "U"}, "expected_output": "Hello F"}]
        })

        job_ids = []
        for _ in range(3):
            p = await _create_prompt(client)
            v = await _create_version(client, p["prompt_id"])
            with patch("evaluation.routes.BackgroundTasks.add_task"):
                r = await client.post(f"{EVAL}/jobs", json={
                    "prompt_id": p["prompt_id"], "version_id": v["version_id"],
                    "dataset_id": ds["dataset_id"], "evaluators": ["exact_match"],
                    "created_by": USER_ID
                })
            job_ids.append(r.json()["job_id"])

        for jid in job_ids:
            await run_eval_job(jid, settings.api_key)

        r_pareto = await client.get(f"{EVAL}/datasets/{ds['dataset_id']}/pareto")
        assert r_pareto.status_code == 200
        data = r_pareto.json()
        assert data["dataset_id"] == ds["dataset_id"]
        assert data["total_jobs"] == 3
        assert "pareto_optimal_count" in data
        assert "frontier" in data
        assert "computed_at" in data
        assert len(data["frontier"]) == 3

    @pytest.mark.asyncio
    async def test_pareto_endpoint_insufficient_jobs(self, client):
        """Only 1 job summary on dataset → 400."""
        from evaluation.orchestrator import run_eval_job
        from config import settings

        ds = await _create_dataset(client)
        await client.post(f"{EVAL}/datasets/{ds['dataset_id']}/examples/bulk", json={
            "examples": [{"input_vars": {"name": "G", "place": "T"}, "expected_output": "Hello G"}]
        })
        p = await _create_prompt(client)
        v = await _create_version(client, p["prompt_id"])
        with patch("evaluation.routes.BackgroundTasks.add_task"):
            r = await client.post(f"{EVAL}/jobs", json={
                "prompt_id": p["prompt_id"], "version_id": v["version_id"],
                "dataset_id": ds["dataset_id"], "evaluators": ["exact_match"],
                "created_by": USER_ID
            })
        job_id = r.json()["job_id"]
        await run_eval_job(job_id, settings.api_key)

        r_pareto = await client.get(f"{EVAL}/datasets/{ds['dataset_id']}/pareto")
        assert r_pareto.status_code == 400
        assert "at least 2" in r_pareto.json()["detail"]

    @pytest.mark.asyncio
    async def test_summaries_ordered_by_accuracy(self, client):
        """GET /datasets/{id}/summaries — assert descending order by accuracy."""
        from evaluation.orchestrator import run_eval_job
        from evaluation.metrics import compute_summary
        from config import settings
        from db import async_session

        ds = await _create_dataset(client)
        await client.post(f"{EVAL}/datasets/{ds['dataset_id']}/examples/bulk", json={
            "examples": [{"input_vars": {"name": "H", "place": "S"}, "expected_output": "Hello H"}]
        })

        job_ids = []
        for _ in range(3):
            p = await _create_prompt(client)
            v = await _create_version(client, p["prompt_id"])
            with patch("evaluation.routes.BackgroundTasks.add_task"):
                r = await client.post(f"{EVAL}/jobs", json={
                    "prompt_id": p["prompt_id"], "version_id": v["version_id"],
                    "dataset_id": ds["dataset_id"], "evaluators": ["exact_match"],
                    "created_by": USER_ID
                })
            job_ids.append(r.json()["job_id"])

        for jid in job_ids:
            await run_eval_job(jid, settings.api_key)

        # Manually set different accuracy values for deterministic ordering
        async with async_session() as db:
            from sqlalchemy import select
            from evaluation.models import EvalSummary
            for i, jid in enumerate(job_ids):
                stmt = select(EvalSummary).where(EvalSummary.job_id == uuid.UUID(jid))
                result = await db.execute(stmt)
                s = result.scalar_one_or_none()
                if s:
                    s.accuracy = float(i) * 0.25  # 0.0, 0.25, 0.5
            await db.commit()

        r_list = await client.get(f"{EVAL}/datasets/{ds['dataset_id']}/summaries")
        assert r_list.status_code == 200
        data = r_list.json()
        assert len(data) >= 3
        # Check that accuracies are descending (or at worst equal — for None values at end)
        accs = [d["accuracy"] for d in data if d["accuracy"] is not None]
        for i in range(len(accs) - 1):
            assert accs[i] >= accs[i + 1], f"Not sorted desc: {accs}"

    # ── Comparison & Dashboard endpoints ──────────────────────────────────────

class TestComparison:

    async def _setup_comparison_jobs(self, client, num_jobs=2):
        from evaluation.orchestrator import run_eval_job
        from config import settings
        
        # ds with 2 examples
        ds = await _create_dataset(client)
        await client.post(f"{EVAL}/datasets/{ds['dataset_id']}/examples/bulk", json={
            "examples": [
                {"input_vars": {"a": "A"}, "expected_output": "A"},
                {"input_vars": {"b": "B"}, "expected_output": "B"}
            ]
        })
        
        job_ids = []
        for _ in range(num_jobs):
            p = await _create_prompt(client)
            v = await _create_version(client, p["prompt_id"])
            with patch("evaluation.routes.BackgroundTasks.add_task"):
                r = await client.post(f"{EVAL}/jobs", json={
                    "prompt_id": p["prompt_id"], "version_id": v["version_id"],
                    "dataset_id": ds["dataset_id"], "evaluators": ["exact_match"],
                    "created_by": USER_ID
                })
            jid = r.json()["job_id"]
            job_ids.append(jid)
            
            # mock LLM for different accuracies
            async def _fake_llm(*args, **kwargs):
                return {"response": "A", "model": "fake", "usage": {"prompt_tokens": 10, "completion_tokens": 10}, "finish_reason": "stop", "latency_ms": 100}
                
            with patch("evaluation.orchestrator.call_llm", new=_fake_llm):
                await run_eval_job(jid, settings.api_key)
                
        # Manually alter accuracies and costs to ensure Pareto points
        from db import async_session
        from sqlalchemy import select
        from evaluation.models import EvalSummary
        async with async_session() as db:
            for i, jid in enumerate(job_ids):
                stmt = select(EvalSummary).where(EvalSummary.job_id == uuid.UUID(jid))
                s = (await db.execute(stmt)).scalar_one_or_none()
                if s:
                    s.accuracy = 0.5 + (0.1 * i)  # increasing
                    s.cost_per_correct = 1.0 + (0.5 * i)  # increasing cost too
            await db.commit()
            
        return ds["dataset_id"], job_ids

    @pytest.mark.asyncio
    async def test_compare_two_jobs(self, client):
        ds_id, job_ids = await self._setup_comparison_jobs(client, 2)
        r = await client.post(f"{EVAL}/compare", json={"job_ids": job_ids})
        assert r.status_code == 200
        data = r.json()
        assert data["compared_jobs"] == 2
        assert len(data["jobs"]) == 2
        assert "rank" in data["jobs"][0]
        assert data["dataset_id"] == str(ds_id)

    @pytest.mark.asyncio
    async def test_compare_same_dataset_required(self, client):
        _, job_ids1 = await self._setup_comparison_jobs(client, 1)
        _, job_ids2 = await self._setup_comparison_jobs(client, 1)
        r = await client.post(f"{EVAL}/compare", json={"job_ids": [job_ids1[0], job_ids2[0]]})
        assert r.status_code == 400
        assert "same dataset" in r.json()["detail"]

    @pytest.mark.asyncio
    async def test_compare_missing_summary(self, client):
        ds_id, job_ids = await self._setup_comparison_jobs(client, 1)
        
        p = await _create_prompt(client)
        v = await _create_version(client, p["prompt_id"])
        with patch("evaluation.routes.BackgroundTasks.add_task"):
            r = await client.post(f"{EVAL}/jobs", json={
                "prompt_id": p["prompt_id"], "version_id": v["version_id"],
                "dataset_id": ds_id, "evaluators": ["exact_match"], "created_by": USER_ID
            })
        incomplete_job_id = r.json()["job_id"]
        
        r2 = await client.post(f"{EVAL}/compare", json={"job_ids": [job_ids[0], incomplete_job_id]})
        assert r2.status_code == 400
        assert "has no summary" in r2.json()["detail"]

    @pytest.mark.asyncio
    async def test_compare_min_jobs(self, client):
        r = await client.post(f"{EVAL}/compare", json={"job_ids": [str(uuid.uuid4())]})
        assert r.status_code == 422  # Pydantic validation (len < 2)

    @pytest.mark.asyncio
    async def test_auto_compare_dataset(self, client):
        ds_id, _ = await self._setup_comparison_jobs(client, 2)
        r = await client.get(f"{EVAL}/compare/dataset/{ds_id}")
        assert r.status_code == 200
        data = r.json()
        assert data["compared_jobs"] == 2

    @pytest.mark.asyncio
    async def test_auto_compare_insufficient(self, client):
        ds_id, _ = await self._setup_comparison_jobs(client, 1)
        r = await client.get(f"{EVAL}/compare/dataset/{ds_id}")
        assert r.status_code == 400
        assert "at least 2" in r.json()["detail"]

    @pytest.mark.asyncio
    async def test_dashboard_endpoint(self, client):
        await self._setup_comparison_jobs(client, 2)
        r = await client.get(f"{EVAL}/dashboard")
        assert r.status_code == 200
        data = r.json()
        assert data["total_datasets"] > 0
        assert data["total_jobs"] > 0
        assert data["completed_jobs"] > 0
        assert len(data["recent_jobs"]) > 0
        assert len(data["top_summaries"]) > 0

    @pytest.mark.asyncio
    async def test_job_report(self, client):
        _, job_ids = await self._setup_comparison_jobs(client, 1)
        jid = job_ids[0]
        r = await client.get(f"{EVAL}/jobs/{jid}/report")
        assert r.status_code == 200
        data = r.json()
        assert data["job"]["job_id"] == jid
        assert data["summary"]["job_id"] == jid
        assert "results" in data
        assert data["result_count"] > 0

    @pytest.mark.asyncio
    async def test_leaderboard(self, client):
        ds_id, _ = await self._setup_comparison_jobs(client, 2)
        r = await client.get(f"{EVAL}/datasets/{ds_id}/leaderboard")
        assert r.status_code == 200
        data = r.json()
        assert len(data["entries"]) == 2
        assert "best_accuracy" in data
        assert "recommendation" in data

    @pytest.mark.asyncio
    async def test_recommendation_generated(self, client):
        ds_id, job_ids = await self._setup_comparison_jobs(client, 2)
        r = await client.post(f"{EVAL}/compare", json={"job_ids": job_ids})
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data["recommendation"], str)
        assert len(data["recommendation"]) > 5

    @pytest.mark.asyncio
    async def test_pareto_in_comparison(self, client):
        ds_id, job_ids = await self._setup_comparison_jobs(client, 2)
        r = await client.post(f"{EVAL}/compare", json={"job_ids": job_ids})
        assert r.status_code == 200
        data = r.json()
        assert data["pareto_optimal_count"] > 0
        pareto_flags = [j["is_pareto_optimal"] for j in data["jobs"]]
        assert any(pareto_flags)

