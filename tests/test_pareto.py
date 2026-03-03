"""
tests/test_pareto.py

Comprehensive tests for Pareto frontier computation, knee point identification,
and recommendation generation.

Tests are organized into four classes:
- TestParetoFrontier       — compute_pareto_frontier correctness
- TestKneePoint            — identify_knee_point correctness  
- TestGenerateRecommendation — generate_recommendation text correctness
- TestParetoIntegration    — end-to-end with realistic data matching
                             the verified ecommerce-sentiment-eval frontier
"""

import pytest
from uuid import uuid4
from unittest.mock import MagicMock
from evaluation.metrics import compute_pareto_frontier, identify_knee_point, generate_recommendation

# ── Fixtures & Helpers ────────────────────────────────────────────────────────

def make_summary(**kwargs) -> dict:
    """
    Create a minimal summary dict for testing.
    Mirrors the dict structure returned by compute_pareto_frontier.
    Default values allow tests to override only what they care about.
    """
    import types
    s = types.SimpleNamespace()
    s.summary_id = kwargs.get("summary_id", uuid4())
    s.job_id = kwargs.get("job_id", uuid4())
    s.prompt_id = kwargs.get("prompt_id", uuid4())
    s.version_id = kwargs.get("version_id", 1)
    s.dataset_id = kwargs.get("dataset_id", uuid4())
    s.model = kwargs.get("model", "llama-3.3-70b-versatile")
    s.accuracy = kwargs.get("accuracy", 0.8)
    s.cost_per_correct = kwargs.get("cost_per_correct", 0.001)
    s.total_examples = kwargs.get("total_examples", 21)
    s.scored_examples = kwargs.get("scored_examples", 21)
    s.mean_evaluator_score = None
    s.total_cost_usd = None
    s.mean_cost_per_run = None
    s.mean_latency_ms = None
    s.p50_latency_ms = None
    s.p95_latency_ms = None
    s.mce = None
    s.overconfidence_rate = None
    s.underconfidence_rate = None
    s.computed_at = None
    return s


def make_eval_summary(**kwargs):
    """
    For integration tests that need real EvalSummary ORM objects.
    """
    s = MagicMock()
    s.summary_id = kwargs.get("summary_id", uuid4())
    s.job_id = kwargs.get("job_id", uuid4())
    s.prompt_id = kwargs.get("prompt_id", uuid4())
    s.version_id = kwargs.get("version_id", 1)
    s.dataset_id = kwargs.get("dataset_id", uuid4())
    s.model = kwargs.get("model", "llama-3.3-70b-versatile")
    s.accuracy = kwargs.get("accuracy", 0.8)
    s.cost_per_correct = kwargs.get("cost_per_correct", 0.001)
    s.total_examples = kwargs.get("total_examples", 21)
    s.scored_examples = kwargs.get("scored_examples", 21)
    s.mean_evaluator_score = None
    s.total_cost_usd = None
    s.mean_cost_per_run = None
    s.mean_latency_ms = None
    s.p50_latency_ms = None
    s.p95_latency_ms = None
    s.mce = None
    s.overconfidence_rate = None
    s.underconfidence_rate = None
    from datetime import datetime
    s.computed_at = datetime.utcnow()
    return s


# ── TestParetoFrontier ────────────────────────────────────────────────────────

class TestParetoFrontier:

    def test_empty_input(self):
        res = compute_pareto_frontier([])
        assert res == []

    def test_single_point(self):
        s = make_summary(accuracy=0.9, cost_per_correct=0.001)
        res = compute_pareto_frontier([s])
        assert len(res) == 1
        assert res[0]["is_pareto_optimal"] is True

    def test_two_points_neither_dominates(self):
        s1 = make_summary(accuracy=0.9, cost_per_correct=0.002)
        s2 = make_summary(accuracy=0.7, cost_per_correct=0.001)
        res = compute_pareto_frontier([s1, s2])
        assert len(res) == 2
        assert res[0]["is_pareto_optimal"] is True
        assert res[1]["is_pareto_optimal"] is True

    def test_two_points_one_dominates(self):
        s1 = make_summary(job_id=uuid4(), accuracy=0.9, cost_per_correct=0.001)
        s2 = make_summary(job_id=uuid4(), accuracy=0.7, cost_per_correct=0.002)
        res = compute_pareto_frontier([s1, s2])
        
        opt = [r for r in res if r["is_pareto_optimal"]]
        dom = [r for r in res if not r["is_pareto_optimal"]]
        
        assert len(opt) == 1
        assert len(dom) == 1
        assert opt[0]["job_id"] == str(s1.job_id)
        assert dom[0]["job_id"] == str(s2.job_id)

    def test_three_points_with_dominated(self):
        s1 = make_summary(job_id=uuid4(), accuracy=1.0, cost_per_correct=0.0001)
        s2 = make_summary(job_id=uuid4(), accuracy=0.97, cost_per_correct=0.00007)
        s3 = make_summary(job_id=uuid4(), accuracy=0.95, cost_per_correct=0.0001)
        
        res = compute_pareto_frontier([s1, s2, s3])
        opt = [r for r in res if r["is_pareto_optimal"]]
        
        assert len(opt) == 2
        opt_ids = [r["job_id"] for r in opt]
        assert str(s1.job_id) in opt_ids
        assert str(s2.job_id) in opt_ids
        
        dom = [r for r in res if not r["is_pareto_optimal"]]
        assert len(dom) == 1
        assert dom[0]["job_id"] == str(s3.job_id)

    def test_all_points_same_accuracy(self):
        s1 = make_summary(job_id=uuid4(), accuracy=0.8, cost_per_correct=0.001)
        s2 = make_summary(job_id=uuid4(), accuracy=0.8, cost_per_correct=0.002)
        s3 = make_summary(job_id=uuid4(), accuracy=0.8, cost_per_correct=0.003)
        res = compute_pareto_frontier([s1, s2, s3])
        opt = [r for r in res if r["is_pareto_optimal"]]
        assert len(opt) == 1
        assert opt[0]["job_id"] == str(s1.job_id)

    def test_all_points_same_cost(self):
        s1 = make_summary(job_id=uuid4(), accuracy=0.6, cost_per_correct=0.001)
        s2 = make_summary(job_id=uuid4(), accuracy=0.8, cost_per_correct=0.001)
        s3 = make_summary(job_id=uuid4(), accuracy=0.9, cost_per_correct=0.001)
        res = compute_pareto_frontier([s1, s2, s3])
        opt = [r for r in res if r["is_pareto_optimal"]]
        assert len(opt) == 1
        assert opt[0]["job_id"] == str(s3.job_id)

    def test_null_accuracy_excluded(self):
        s1 = make_summary(job_id=uuid4(), accuracy=0.9, cost_per_correct=0.001)
        s2 = make_summary(job_id=uuid4(), accuracy=0.8, cost_per_correct=0.002)
        s3 = make_summary(job_id=uuid4(), accuracy=None, cost_per_correct=0.003)
        res = compute_pareto_frontier([s1, s2, s3])
        
        opt = [r for r in res if r["is_pareto_optimal"]]
        assert len(opt) == 1
        assert opt[0]["job_id"] == str(s1.job_id)
        
        null_pt = [r for r in res if r["job_id"] == str(s3.job_id)][0]
        assert null_pt["is_pareto_optimal"] is False

    def test_null_cost_excluded(self):
        s1 = make_summary(job_id=uuid4(), accuracy=0.9, cost_per_correct=0.001)
        s2 = make_summary(job_id=uuid4(), accuracy=0.8, cost_per_correct=0.002)
        s3 = make_summary(job_id=uuid4(), accuracy=0.7, cost_per_correct=None)
        res = compute_pareto_frontier([s1, s2, s3])
        
        opt = [r for r in res if r["is_pareto_optimal"]]
        assert len(opt) == 1
        assert opt[0]["job_id"] == str(s1.job_id)
        
        null_pt = [r for r in res if r["job_id"] == str(s3.job_id)][0]
        assert null_pt["is_pareto_optimal"] is False

    def test_output_contains_required_keys(self):
        s1 = make_summary()
        res = compute_pareto_frontier([s1])
        keys = res[0].keys()
        assert "job_id" in keys
        assert "version_id" in keys
        assert "model" in keys
        assert "accuracy" in keys
        assert "cost_per_correct" in keys
        assert "is_pareto_optimal" in keys
        assert "dominates" in keys
        assert "dominated_by" in keys

    def test_pareto_count_matches_reality(self):
        v1141 = make_summary(job_id=uuid4(), version_id=1141, accuracy=1.0, cost_per_correct=0.000094)
        v1131 = make_summary(job_id=uuid4(), version_id=1131, accuracy=0.96666, cost_per_correct=0.000068)
        v1136 = make_summary(job_id=uuid4(), version_id=1136, accuracy=0.92857, cost_per_correct=0.000064)
        v1135 = make_summary(job_id=uuid4(), version_id=1135, accuracy=0.95, cost_per_correct=0.000100)
        v1130 = make_summary(job_id=uuid4(), version_id=1130, accuracy=0.0, cost_per_correct=None)
        v1134 = make_summary(job_id=uuid4(), version_id=1134, accuracy=0.9, cost_per_correct=None)

        res = compute_pareto_frontier([v1141, v1131, v1136, v1135, v1130, v1134])
        opt = [r for r in res if r["is_pareto_optimal"]]
        
        assert len(opt) == 3
        opt_versions = [r["version_id"] for r in opt]
        assert 1141 in opt_versions
        assert 1131 in opt_versions
        assert 1136 in opt_versions


# ── TestKneePoint ─────────────────────────────────────────────────────────────

class TestKneePoint:

    def test_none_on_empty_frontier(self):
        assert identify_knee_point([]) is None

    def test_none_on_single_point(self):
        frontier = [{"is_pareto_optimal": True, "cost_per_correct": 0.001, "accuracy": 0.9}]
        assert identify_knee_point(frontier) is None

    def test_none_on_two_points(self):
        frontier = [
            {"is_pareto_optimal": True, "cost_per_correct": 0.001, "accuracy": 0.7},
            {"is_pareto_optimal": True, "cost_per_correct": 0.002, "accuracy": 0.9}
        ]
        assert identify_knee_point(frontier) is None

    def test_knee_identified_on_three_points(self):
        frontier = [
            {"job_id": "p1", "is_pareto_optimal": True, "cost_per_correct": 0.0003, "accuracy": 1.0},
            {"job_id": "p2", "is_pareto_optimal": True, "cost_per_correct": 0.00007, "accuracy": 0.97},
            {"job_id": "p3", "is_pareto_optimal": True, "cost_per_correct": 0.00006, "accuracy": 0.93}
        ]
        knee = identify_knee_point(frontier)
        assert knee is not None
        assert knee["job_id"] == "p2"

    def test_knee_returns_correct_keys(self):
        frontier = [
            {"job_id": "1", "version_id": 1, "is_pareto_optimal": True, "cost_per_correct": 0.003, "accuracy": 1.0},
            {"job_id": "2", "version_id": 2, "is_pareto_optimal": True, "cost_per_correct": 0.001, "accuracy": 0.9},
            {"job_id": "3", "version_id": 3, "is_pareto_optimal": True, "cost_per_correct": 0.0005, "accuracy": 0.8}
        ]
        knee = identify_knee_point(frontier)
        assert "job_id" in knee
        assert "version_id" in knee
        assert "accuracy" in knee
        assert "cost_per_correct" in knee

    def test_knee_is_always_pareto_optimal(self):
        frontier = [
            {"job_id": "1", "is_pareto_optimal": True, "cost_per_correct": 0.003, "accuracy": 1.0},
            {"job_id": "2", "is_pareto_optimal": True, "cost_per_correct": 0.001, "accuracy": 0.9},
            {"job_id": "3", "is_pareto_optimal": True, "cost_per_correct": 0.0005, "accuracy": 0.8},
            {"job_id": "4", "is_pareto_optimal": False, "cost_per_correct": 0.002, "accuracy": 0.8}
        ]
        res = identify_knee_point(frontier)
        assert res["is_pareto_optimal"] is True
        assert res["job_id"] != "4"

    def test_knee_matches_verified_data(self):
        job1131 = "6f1a3364-3062-4c4f-a3ea-4bd3a8bf98e5"
        frontier = [
            {"job_id": "p1141", "is_pareto_optimal": True, "cost_per_correct": 0.000094, "accuracy": 1.0},
            {"job_id": job1131, "is_pareto_optimal": True, "cost_per_correct": 0.000068, "accuracy": 0.96666},
            {"job_id": "p1136", "is_pareto_optimal": True, "cost_per_correct": 0.000064, "accuracy": 0.92857}
        ]
        res = identify_knee_point(frontier)
        assert res["job_id"] == job1131

    def test_knee_on_perfectly_linear_frontier(self):
        frontier = [
            {"job_id": "p1", "is_pareto_optimal": True, "cost_per_correct": 0.003, "accuracy": 1.0},
            {"job_id": "p2", "is_pareto_optimal": True, "cost_per_correct": 0.002, "accuracy": 0.8},
            {"job_id": "p3", "is_pareto_optimal": True, "cost_per_correct": 0.001, "accuracy": 0.6}
        ]
        res = identify_knee_point(frontier)
        assert res is not None

    def test_normalisation_handles_zero_range(self):
        frontier = [
            {"job_id": "p1", "is_pareto_optimal": True, "cost_per_correct": 0.001, "accuracy": 1.0},
            {"job_id": "p2", "is_pareto_optimal": True, "cost_per_correct": 0.001, "accuracy": 0.8},
            {"job_id": "p3", "is_pareto_optimal": True, "cost_per_correct": 0.001, "accuracy": 0.6}
        ]
        try:
            res = identify_knee_point(frontier)
            assert res is None or isinstance(res, dict)
        except ZeroDivisionError:
            pytest.fail("identy_knee_point raised ZeroDivisionError for zero range.")


# ── TestGenerateRecommendation ────────────────────────────────────────────────

class TestGenerateRecommendation:

    def test_empty_frontier_returns_insufficient(self):
        res = generate_recommendation([], None)
        assert "Insufficient data" in res

    def test_single_version_message(self):
        res = generate_recommendation([{"is_pareto_optimal": True}], None)
        assert "Only one version evaluated" in res

    def test_single_dominant_version(self):
        frontier = [
            {"version_id": 5, "model": "m1", "is_pareto_optimal": True, "accuracy": 0.9},
            {"version_id": 6, "model": "m1", "is_pareto_optimal": False, "accuracy": 0.5}
        ]
        res = generate_recommendation(frontier, None)
        assert "dominates all others" in res
        assert "Version 5" in res

    def test_two_pareto_points_no_knee(self):
        frontier = [
            {"version_id": 1, "model": "m1", "is_pareto_optimal": True, "accuracy": 0.9, "cost_per_correct": 0.002},
            {"version_id": 2, "model": "m1", "is_pareto_optimal": True, "accuracy": 0.7, "cost_per_correct": 0.001}
        ]
        res = generate_recommendation(frontier, None)
        assert "Two viable options" in res
        assert "maximises accuracy" in res
        assert "minimises cost" in res

    def test_two_pareto_points_correct_assignment(self):
        frontier = [
            {"version_id": 10, "model": "m1", "is_pareto_optimal": True, "accuracy": 0.9, "cost_per_correct": 0.002},
            {"version_id": 20, "model": "m1", "is_pareto_optimal": True, "accuracy": 0.7, "cost_per_correct": 0.001}
        ]
        res = generate_recommendation(frontier, None)
        assert "version 10 maximises accuracy" in res
        assert "version 20 minimises cost" in res

    def test_knee_point_recommendation(self):
        frontier = [
            {"version_id": 1, "model": "m1", "is_pareto_optimal": True, "accuracy": 1.0, "cost_per_correct": 0.0001},
            {"version_id": 2, "model": "m1", "is_pareto_optimal": True, "accuracy": 0.97, "cost_per_correct": 0.00007},
            {"version_id": 3, "model": "m1", "is_pareto_optimal": True, "accuracy": 0.95, "cost_per_correct": 0.00005}
        ]
        knee = frontier[1]
        res = generate_recommendation(frontier, knee)
        assert "knee point" in res
        assert "Recommended for production" in res
        assert "Version 2" in res

    def test_knee_recommendation_includes_cost_ratio(self):
        frontier = [
            {"version_id": 1, "model": "m1", "is_pareto_optimal": True, "accuracy": 1.0, "cost_per_correct": 0.0001},
            {"version_id": 2, "model": "m1", "is_pareto_optimal": True, "accuracy": 0.97, "cost_per_correct": 0.00007},
            {"version_id": 3, "model": "m1", "is_pareto_optimal": True, "accuracy": 0.95, "cost_per_correct": 0.00005}
        ]
        knee = frontier[1]
        res = generate_recommendation(frontier, knee)
        assert "1.4x" in res

    def test_fallback_never_fires_with_valid_two_point_data(self):
        frontier = [
            {"version_id": 10, "model": "m1", "is_pareto_optimal": True, "accuracy": 0.9, "cost_per_correct": 0.002},
            {"version_id": 20, "model": "m1", "is_pareto_optimal": True, "accuracy": 0.7, "cost_per_correct": 0.001}
        ]
        res = generate_recommendation(frontier, None)
        assert "Insufficient data" not in res

    def test_fallback_never_fires_with_valid_knee_data(self):
        frontier = [
            {"version_id": 1, "model": "m1", "is_pareto_optimal": True, "accuracy": 1.0, "cost_per_correct": 0.0001},
            {"version_id": 2, "model": "m1", "is_pareto_optimal": True, "accuracy": 0.97, "cost_per_correct": 0.00007},
            {"version_id": 3, "model": "m1", "is_pareto_optimal": True, "accuracy": 0.95, "cost_per_correct": 0.00005}
        ]
        res = generate_recommendation(frontier, frontier[1])
        assert "Insufficient data" not in res

    def test_recommendation_contains_real_version_ids(self):
        frontier = [
            {"version_id": 1131, "model": "llama", "is_pareto_optimal": True, "accuracy": 0.966, "cost_per_correct": 0.000068},
            {"version_id": 1141, "model": "llama", "is_pareto_optimal": True, "accuracy": 1.0, "cost_per_correct": 0.000094},
            {"version_id": 1136, "model": "llama", "is_pareto_optimal": True, "accuracy": 0.92, "cost_per_correct": 0.000064}
        ]
        knee = frontier[0]
        res = generate_recommendation(frontier, knee)
        assert "1131" in res
        assert "1141" in res

    def test_recommendation_with_verified_ecommerce_data(self):
        v1131 = {"version_id": 1131, "model": "llama-3.3-70b-versatile", "is_pareto_optimal": True, "accuracy": 0.96666, "cost_per_correct": 0.000068}
        v1141 = {"version_id": 1141, "model": "llama-3.3-70b-versatile", "is_pareto_optimal": True, "accuracy": 1.0, "cost_per_correct": 0.000094}
        v1136 = {"version_id": 1136, "model": "llama-3.3-70b-versatile", "is_pareto_optimal": True, "accuracy": 0.92857, "cost_per_correct": 0.000064}
        frontier = [v1131, v1141, v1136]
        
        res = generate_recommendation(frontier, v1131)
        assert "Version 1131" in res
        assert "97%" in res
        assert "Version 1141" in res
        assert "100%" in res
        assert "1.4x" in res


# ── TestParetoIntegration ─────────────────────────────────────────────────────

class TestParetoIntegration:

    def test_full_pipeline_two_points(self):
        s1 = make_eval_summary(version_id=1, accuracy=0.9, cost_per_correct=0.002)
        s2 = make_eval_summary(version_id=2, accuracy=0.7, cost_per_correct=0.001)
        
        frontier = compute_pareto_frontier([s1, s2])
        knee = identify_knee_point(frontier)
        rec = generate_recommendation(frontier, knee)
        
        assert len(frontier) == 2
        assert knee is None
        assert "Two viable options" in rec

    def test_full_pipeline_three_points_with_dominated(self):
        s1 = make_eval_summary(version_id=1, accuracy=0.9, cost_per_correct=0.002)
        s2 = make_eval_summary(version_id=2, accuracy=0.7, cost_per_correct=0.001)
        s3 = make_eval_summary(version_id=3, accuracy=0.6, cost_per_correct=0.003)
        
        frontier = compute_pareto_frontier([s1, s2, s3])
        knee = identify_knee_point(frontier)
        
        opt_count = sum(1 for p in frontier if p["is_pareto_optimal"])
        assert opt_count == 2
        assert knee is None
        dominated = [p for p in frontier if not p["is_pareto_optimal"]][0]
        assert dominated["version_id"] == 3

    def test_full_pipeline_verified_ecommerce_data(self):
        v1141 = make_eval_summary(version_id=1141, accuracy=1.0, cost_per_correct=0.000094)
        v1131 = make_eval_summary(version_id=1131, accuracy=0.96666, cost_per_correct=0.000068)
        v1136 = make_eval_summary(version_id=1136, accuracy=0.92857, cost_per_correct=0.000064)
        v1135 = make_eval_summary(version_id=1135, accuracy=0.95, cost_per_correct=0.000100)
        v1130 = make_eval_summary(version_id=1130, accuracy=0.0, cost_per_correct=None)
        v1134 = make_eval_summary(version_id=1134, accuracy=0.9, cost_per_correct=None)

        frontier = compute_pareto_frontier([v1141, v1131, v1136, v1135, v1130, v1134])
        knee = identify_knee_point(frontier)
        rec = generate_recommendation(frontier, knee)

        opt_count = sum(1 for p in frontier if p["is_pareto_optimal"])
        assert opt_count == 3
        assert knee is not None
        assert knee["version_id"] == 1131
        assert "knee point" in rec
        assert "Version 1131" in rec

    def test_null_cost_points_never_reach_frontier(self):
        v1 = make_eval_summary(accuracy=0.9, cost_per_correct=0.002)
        v2 = make_eval_summary(accuracy=0.7, cost_per_correct=0.001)
        v3 = make_eval_summary(accuracy=1.0, cost_per_correct=None)
        v4 = make_eval_summary(accuracy=0.8, cost_per_correct=None)

        frontier = compute_pareto_frontier([v1, v2, v3, v4])
        opt_count = sum(1 for p in frontier if p["is_pareto_optimal"])
        
        assert opt_count == 2
        null_pts = [p for p in frontier if p["cost_per_correct"] is None]
        assert len(null_pts) == 2
        assert all(not p["is_pareto_optimal"] for p in null_pts)

    def test_zero_accuracy_point_dominated(self):
        v1 = make_eval_summary(version_id=1, accuracy=0.9, cost_per_correct=0.002)
        v2 = make_eval_summary(version_id=2, accuracy=0.0, cost_per_correct=0.001)
        
        frontier = compute_pareto_frontier([v1, v2])
        zero_pt = next(p for p in frontier if p["version_id"] == 2)
        
        assert zero_pt["is_pareto_optimal"] is False

    def test_pipeline_is_deterministic(self):
        v1131 = make_eval_summary(version_id=1131, accuracy=0.96666, cost_per_correct=0.000068)
        v1141 = make_eval_summary(version_id=1141, accuracy=1.0, cost_per_correct=0.000094)
        v1136 = make_eval_summary(version_id=1136, accuracy=0.92857, cost_per_correct=0.000064)
        v1135 = make_eval_summary(version_id=1135, accuracy=0.95, cost_per_correct=0.000100)
        
        f1 = compute_pareto_frontier([v1131, v1141, v1136, v1135])
        k1 = identify_knee_point(f1)
        r1 = generate_recommendation(f1, k1)

        f2 = compute_pareto_frontier([v1131, v1141, v1136, v1135])
        k2 = identify_knee_point(f2)
        r2 = generate_recommendation(f2, k2)

        assert f1 == f2
        assert k1 == k2
        assert r1 == r2

