"""
SyntheticConfig — Pydantic v2 schema for synthetic dataset generation YAML files.
"""

from __future__ import annotations

from typing import List, Optional
import yaml
from pydantic import BaseModel, field_validator, model_validator


# ---------------------------------------------------------------------------
# Sub-models
# ---------------------------------------------------------------------------

class DifficultyLevel(BaseModel):
    ratio: float
    definition: str


class DifficultyConfig(BaseModel):
    easy: DifficultyLevel
    medium: DifficultyLevel
    hard: DifficultyLevel


class EdgeCasesConfig(BaseModel):
    ratio: float
    types: List[str]

    @field_validator("ratio")
    @classmethod
    def ratio_in_range(cls, v: float) -> float:
        if not (0.0 <= v <= 0.5):
            raise ValueError(f"edge_cases.ratio must be between 0.0 and 0.5, got {v}")
        return v


class DiversityConfig(BaseModel):
    enforce: bool
    min_word_overlap_threshold: float
    required_topic_variants: int


class GenerationConfig(BaseModel):
    size: int
    difficulty: DifficultyConfig
    edge_cases: EdgeCasesConfig
    diversity: DiversityConfig

    @field_validator("size")
    @classmethod
    def size_in_range(cls, v: int) -> int:
        if not (1 <= v <= 100):
            raise ValueError(f"generation.size must be between 1 and 100, got {v}")
        return v

    @model_validator(mode="after")
    def ratios_sum_to_one(self) -> "GenerationConfig":
        total = (
            self.difficulty.easy.ratio
            + self.difficulty.medium.ratio
            + self.difficulty.hard.ratio
        )
        if abs(total - 1.0) > 0.01:
            raise ValueError(
                f"difficulty ratios must sum to 1.0 ± 0.01, got {total:.4f}"
            )
        return self


class DatasetConfig(BaseModel):
    name: str
    task_type: str
    description: str
    if_exists: str

    @field_validator("task_type")
    @classmethod
    def valid_task_type(cls, v: str) -> str:
        if v not in ("classification", "qa"):
            raise ValueError(f"task_type must be 'classification' or 'qa', got '{v}'")
        return v

    @field_validator("if_exists")
    @classmethod
    def valid_if_exists(cls, v: str) -> str:
        if v not in ("fail", "append"):
            raise ValueError(f"if_exists must be 'fail' or 'append', got '{v}'")
        return v


class DomainConfig(BaseModel):
    topic: str
    labels: Optional[List[str]] = None
    context_style: Optional[str] = None
    answer_type: Optional[str] = None


class ValidationConfig(BaseModel):
    criteria: List[str]
    rejection_threshold: float
    max_regeneration_attempts: int


class ModelsConfig(BaseModel):
    generator: str
    validator: str
    delay_seconds: float
    max_tokens_per_call: int = 500

    @model_validator(mode="after")
    def models_in_pricing(self) -> "ModelsConfig":
        # Import here to avoid circular deps at module load time
        from execution.pricing import MODEL_PRICING
        for field_name, model_id in [("generator", self.generator), ("validator", self.validator)]:
            if model_id not in MODEL_PRICING:
                raise ValueError(
                    f"models.{field_name} '{model_id}' is not a valid model ID. "
                    f"Valid IDs: {list(MODEL_PRICING.keys())}"
                )
        return self


class OutputConfig(BaseModel):
    push_to_db: bool
    save_csv: bool
    csv_path: str


# ---------------------------------------------------------------------------
# Root config
# ---------------------------------------------------------------------------

class SyntheticConfig(BaseModel):
    dataset: DatasetConfig
    generation: GenerationConfig
    domain: DomainConfig
    validation: ValidationConfig
    models: ModelsConfig
    output: OutputConfig


def load_config(path: str) -> SyntheticConfig:
    """Load and validate a YAML config file into a SyntheticConfig."""
    with open(path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    return SyntheticConfig(**data)
