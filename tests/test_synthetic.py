"""
Tests for the synthetic dataset generator.

All LLM calls are mocked — no real API calls are made.
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Optional
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic import ValidationError

# ── Paths ─────────────────────────────────────────────────────────────────────
CONFIGS_DIR = Path(__file__).parent.parent / "synthetic" / "configs"
CLASSIFICATION_YAML = CONFIGS_DIR / "classification_example.yaml"
QA_YAML = CONFIGS_DIR / "qa_example.yaml"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_llm_response(text: str) -> dict:
    return {
        "response": text,
        "model": "llama-3.3-70b-versatile",
        "usage": {"prompt_tokens": 100, "completion_tokens": 150, "total_tokens": 250},
        "finish_reason": "stop",
        "latency_ms": 300,
    }


def _classification_example() -> dict:
    return {
        "input_text": "This product is absolutely amazing! Best purchase ever.",
        "expected_label": "positive",
        "difficulty": "easy",
        "edge_case_type": None,
        "topic_variant": "Electronics reviews",
        "generation_reasoning": "Unambiguous positive sentiment expressed directly.",
    }


def _qa_example() -> dict:
    return {
        "context": "The mitochondria is the powerhouse of the cell.",
        "question": "What is described as the powerhouse of the cell?",
        "expected_answer": "The mitochondria",
        "answer_span": "The mitochondria",
        "difficulty": "easy",
        "edge_case_type": None,
        "topic_variant": "Cell biology",
        "generation_reasoning": "Direct extraction from a single sentence.",
    }


def _validator_response(passes: bool, confidence: float) -> str:
    return json.dumps({
        "passes": passes,
        "confidence": confidence,
        "failed_criteria": [] if passes else ["label does not match sentiment"],
        "reasoning": "Test reasoning.",
    })


# ── Step 1: Config ─────────────────────────────────────────────────────────────

class TestConfig:

    def test_config_loads_valid_yaml(self):
        from synthetic.config import load_config
        cfg = load_config(str(CLASSIFICATION_YAML))
        assert cfg.dataset.name == "ecommerce-sentiment-eval"
        assert cfg.dataset.task_type == "classification"
        assert cfg.generation.size == 50
        assert cfg.generation.difficulty.easy.ratio == pytest.approx(0.2)
        assert cfg.models.generator == "llama-3.3-70b-versatile"
        assert cfg.models.validator == "openai/gpt-oss-120b"
        assert cfg.domain.labels == ["positive", "negative", "neutral"]

    def test_config_invalid_ratios(self):
        from synthetic.config import SyntheticConfig
        raw = {
            "dataset": {"name": "x", "task_type": "classification", "description": "d", "if_exists": "fail"},
            "generation": {
                "size": 10,
                "difficulty": {
                    "easy": {"ratio": 0.3, "definition": "easy"},
                    "medium": {"ratio": 0.3, "definition": "medium"},
                    "hard": {"ratio": 0.3, "definition": "hard"},   # sum = 0.9 — should fail
                },
                "edge_cases": {"ratio": 0.1, "types": ["negation"]},
                "diversity": {"enforce": True, "min_word_overlap_threshold": 0.3, "required_topic_variants": 2},
            },
            "domain": {"topic": "t", "labels": ["a", "b"]},
            "validation": {"criteria": ["c"], "rejection_threshold": 0.7, "max_regeneration_attempts": 2},
            "models": {"generator": "llama-3.3-70b-versatile", "validator": "openai/gpt-oss-120b", "delay_seconds": 0.0},
            "output": {"push_to_db": False, "save_csv": False, "csv_path": "./out"},
        }
        with pytest.raises(ValidationError, match="ratios must sum to 1.0"):
            SyntheticConfig(**raw)

    def test_config_invalid_model(self):
        from synthetic.config import SyntheticConfig
        raw = {
            "dataset": {"name": "x", "task_type": "classification", "description": "d", "if_exists": "fail"},
            "generation": {
                "size": 10,
                "difficulty": {
                    "easy": {"ratio": 0.2, "definition": "easy"},
                    "medium": {"ratio": 0.6, "definition": "medium"},
                    "hard": {"ratio": 0.2, "definition": "hard"},
                },
                "edge_cases": {"ratio": 0.1, "types": ["negation"]},
                "diversity": {"enforce": True, "min_word_overlap_threshold": 0.3, "required_topic_variants": 2},
            },
            "domain": {"topic": "t", "labels": ["a", "b"]},
            "validation": {"criteria": ["c"], "rejection_threshold": 0.7, "max_regeneration_attempts": 2},
            "models": {"generator": "not-a-real-model-xyz", "validator": "openai/gpt-oss-120b", "delay_seconds": 0.0},
            "output": {"push_to_db": False, "save_csv": False, "csv_path": "./out"},
        }
        with pytest.raises(ValidationError, match="not-a-real-model-xyz"):
            SyntheticConfig(**raw)


# ── Step 2: Diversity ─────────────────────────────────────────────────────────

class TestDiversity:

    def test_diversity_check_similar(self):
        from synthetic.diversity import is_too_similar
        candidate = "The quick brown fox jumps over the lazy dog"
        existing = ["The quick brown fox jumps over the lazy dog easily"]
        assert is_too_similar(candidate, existing, threshold=0.5) is True

    def test_diversity_check_distinct(self):
        from synthetic.diversity import is_too_similar
        candidate = "Machine learning models require large datasets to train effectively."
        existing = ["The weather in Paris is rainy and cold during winter months."]
        assert is_too_similar(candidate, existing, threshold=0.3) is False


# ── Step 3: Validator ─────────────────────────────────────────────────────────

class TestValidator:

    def _make_config(self, threshold: float = 0.75) -> object:
        from synthetic.config import load_config
        cfg = load_config(str(CLASSIFICATION_YAML))
        # Override threshold without full reconstruction
        object.__setattr__(cfg.validation, "rejection_threshold", threshold)
        return cfg

    @pytest.mark.asyncio
    async def test_validator_passes_good_example(self):
        from synthetic.validator import validate_example
        cfg = self._make_config(threshold=0.75)
        example = _classification_example()

        with patch("synthetic.validator.call_llm", new=AsyncMock(
            return_value=_make_llm_response(_validator_response(True, 0.9))
        )):
            passes, result = await validate_example(example, cfg, [])

        assert passes is True
        assert result["passes"] is True

    @pytest.mark.asyncio
    async def test_validator_rejects_low_confidence(self):
        from synthetic.validator import validate_example
        cfg = self._make_config(threshold=0.75)
        example = _classification_example()

        with patch("synthetic.validator.call_llm", new=AsyncMock(
            return_value=_make_llm_response(_validator_response(True, 0.4))
        )):
            passes, result = await validate_example(example, cfg, [])

        assert passes is False  # confidence 0.4 < threshold 0.75

    @pytest.mark.asyncio
    async def test_validator_rejects_similar_input(self):
        from synthetic.validator import validate_example
        cfg = self._make_config()
        example = _classification_example()
        existing = [example["input_text"]]  # exact duplicate

        mock_llm = AsyncMock()
        with patch("synthetic.validator.call_llm", new=mock_llm):
            passes, result = await validate_example(example, cfg, existing)

        # Should fail on diversity check WITHOUT calling LLM
        mock_llm.assert_not_called()
        assert passes is False
        assert result.get("error") == "diversity_rejected"


# ── Step 4: Generator ─────────────────────────────────────────────────────────

def _make_full_config(size: int = 10, max_attempts: int = 3):
    """Build a minimal valid SyntheticConfig programmatically."""
    from synthetic.config import SyntheticConfig
    raw = {
        "dataset": {"name": "test-ds", "task_type": "classification", "description": "d", "if_exists": "fail"},
        "generation": {
            "size": size,
            "difficulty": {
                "easy": {"ratio": 0.2, "definition": "easy"},
                "medium": {"ratio": 0.6, "definition": "medium"},
                "hard": {"ratio": 0.2, "definition": "hard"},
            },
            "edge_cases": {"ratio": 0.0, "types": ["negation"]},
            "diversity": {"enforce": False, "min_word_overlap_threshold": 0.9, "required_topic_variants": 2},
        },
        "domain": {"topic": "e-commerce reviews", "labels": ["positive", "negative", "neutral"]},
        "validation": {"criteria": ["quality"], "rejection_threshold": 0.5, "max_regeneration_attempts": max_attempts},
        "models": {"generator": "llama-3.3-70b-versatile", "validator": "openai/gpt-oss-120b", "delay_seconds": 0.0},
        "output": {"push_to_db": False, "save_csv": False, "csv_path": "./out"},
    }
    return SyntheticConfig(**raw)


class TestGenerator:

    def _gen_response(self, label: str = "positive", text: str = "Great product!") -> dict:
        return _make_llm_response(json.dumps({
            "input_text": text,
            "expected_label": label,
            "difficulty": "easy",
            "edge_case_type": None,
            "topic_variant": "Electronics",
            "generation_reasoning": "Clear positive sentiment.",
        }))

    def _variant_response(self) -> dict:
        return _make_llm_response('["Electronics", "Clothing"]')

    def _val_response(self, passes: bool = True, confidence: float = 0.9) -> dict:
        return _make_llm_response(_validator_response(passes, confidence))

    @pytest.mark.asyncio
    async def test_generator_produces_correct_count(self):
        from synthetic.generator import generate_dataset
        cfg = _make_full_config(size=10)

        call_count = [0]
        def mock_llm_factory(text="Great product!", label="positive"):
            async def mock(*args, **kwargs):
                # First call = topic variants; subsequent = gen/validate alternating
                call_count[0] += 1
                if call_count[0] == 1:
                    return self._variant_response()
                # Even calls = generator, odd = validator (rough pattern doesn't matter)
                return _make_llm_response(json.dumps({
                    "input_text": f"Product {call_count[0]}. Very good.",
                    "expected_label": "positive",
                    "difficulty": "easy",
                    "edge_case_type": None,
                    "topic_variant": "Electronics",
                    "generation_reasoning": "Clear.",
                }))
            return mock

        with patch("synthetic.generator.call_llm", new=AsyncMock(side_effect=mock_llm_factory())):
            with patch("synthetic.validator.call_llm", new=AsyncMock(
                return_value=self._val_response(True, 0.9)
            )):
                results = await generate_dataset(cfg)

        assert len(results) == 10

    @pytest.mark.asyncio
    async def test_generator_retries_on_rejection(self):
        """First validation fails, second passes — retry logic should accept the example."""
        from synthetic.generator import generate_dataset
        cfg = _make_full_config(size=1, max_attempts=3)

        gen_calls = [0]
        async def gen_llm(*args, **kwargs):
            gen_calls[0] += 1
            if gen_calls[0] == 1:
                return self._variant_response()
            return _make_llm_response(json.dumps({
                "input_text": f"Attempt {gen_calls[0]} text.",
                "expected_label": "positive",
                "difficulty": "easy",
                "edge_case_type": None,
                "topic_variant": "Electronics",
                "generation_reasoning": "Test.",
            }))

        val_calls = [0]
        async def val_llm(*args, **kwargs):
            val_calls[0] += 1
            # First validation fails, second passes
            passes = val_calls[0] > 1
            return self._val_response(passes, 0.9 if passes else 0.3)

        with patch("synthetic.generator.call_llm", new=AsyncMock(side_effect=gen_llm)):
            with patch("synthetic.validator.call_llm", new=AsyncMock(side_effect=val_llm)):
                results = await generate_dataset(cfg)

        assert len(results) == 1
        assert val_calls[0] == 2  # validated twice

    @pytest.mark.asyncio
    async def test_generator_skips_after_max_attempts(self):
        """Validator always fails — example should be skipped, not padded."""
        from synthetic.generator import generate_dataset
        cfg = _make_full_config(size=1, max_attempts=2)

        call_no = [0]
        async def gen_llm(*args, **kwargs):
            call_no[0] += 1
            if call_no[0] == 1:
                return self._variant_response()
            return _make_llm_response(json.dumps({
                "input_text": "Some text.",
                "expected_label": "positive",
                "difficulty": "easy",
                "edge_case_type": None,
                "topic_variant": "Test",
                "generation_reasoning": "Test.",
            }))

        with patch("synthetic.generator.call_llm", new=AsyncMock(side_effect=gen_llm)):
            with patch("synthetic.validator.call_llm", new=AsyncMock(
                return_value=self._val_response(False, 0.2)  # always fails
            )):
                results = await generate_dataset(cfg)

        assert len(results) == 0  # skipped, not padded

    @pytest.mark.asyncio
    async def test_source_tag_format(self):
        """Accepted examples must have correctly formatted source_tags."""
        from synthetic.generator import generate_dataset
        cfg = _make_full_config(size=2)
        # No edge cases (edge ratio = 0.0 in _make_full_config)

        call_no = [0]
        async def gen_llm(*args, **kwargs):
            call_no[0] += 1
            if call_no[0] == 1:
                return self._variant_response()
            return _make_llm_response(json.dumps({
                "input_text": f"Product review {call_no[0]}.",
                "expected_label": "positive",
                "difficulty": "easy",
                "edge_case_type": None,
                "topic_variant": "Test",
                "generation_reasoning": "Clear.",
            }))

        with patch("synthetic.generator.call_llm", new=AsyncMock(side_effect=gen_llm)):
            with patch("synthetic.validator.call_llm", new=AsyncMock(
                return_value=self._val_response(True, 0.9)
            )):
                results = await generate_dataset(cfg)

        for ex in results:
            tag = ex["source_tag"]
            assert tag.startswith("synthetic-")
            parts = tag.split("-")
            assert parts[1] in ("easy", "medium", "hard")
            # Standard (no edge case) ends with "standard"
            assert parts[2] == "standard"


# ── Step 5: CLI dry-run ───────────────────────────────────────────────────────

class TestCLI:

    def test_dry_run_exits_without_llm_calls(self):
        """--dry-run must not invoke call_llm at all."""
        from typer.testing import CliRunner
        from synthetic.cli import app

        runner = CliRunner()
        mock_llm = MagicMock()

        with patch("synthetic.generator.call_llm", new=mock_llm):
            with patch("synthetic.validator.call_llm", new=mock_llm):
                # In Typer 0.24.0, single-command apps are flattened — the
                # 'generate' subcommand IS the root. Do not pass 'generate' as an arg.
                result = runner.invoke(
                    app,
                    ["--config", str(CLASSIFICATION_YAML), "--dry-run"],
                )

        mock_llm.assert_not_called()
        assert result.exit_code == 0
        # Plan table content should be present
        assert "Plan" in result.output or "Generating" in result.output or "classification" in result.output

