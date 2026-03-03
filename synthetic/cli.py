"""
CLI entrypoint for the PromptOps synthetic dataset generator.

Usage:
    python -m synthetic.cli generate --config <path-to-yaml> [--dry-run]

Reads API credentials from ~/.chronicle/config.json (same file as chronicle CLI).
"""

from __future__ import annotations

import asyncio
import csv
import json
import sys
import time
from pathlib import Path
from typing import Optional

import httpx
import typer
from pydantic import ValidationError
from rich import box
from rich.console import Console
from rich.panel import Panel
from rich.progress import BarColumn, Progress, SpinnerColumn, TaskProgressColumn, TextColumn
from rich.table import Table

from synthetic.config import SyntheticConfig, load_config
from synthetic.generator import generate_dataset

app = typer.Typer(
    name="promptops-synth",
    help="PromptOps synthetic dataset generator.",
    add_completion=False,
)
console = Console()

EVAL_API = "/api/v1/eval"


# ---------------------------------------------------------------------------
# Config helpers (mirrors chronicle_cli pattern)
# ---------------------------------------------------------------------------

def _get_context() -> dict:
    """Read ~/.chronicle/config.json and return the active environment context."""
    # Import here so this tool can also run standalone (without chronicle_cli installed)
    try:
        from chronicle_cli.config import get_current_context  # type: ignore
        ctx = get_current_context()
    except ImportError:
        ctx = None

    if not ctx:
        console.print("[#ef4444]✗[/#ef4444] Not configured. Run 'chronicle init' first.")
        raise typer.Exit(code=1)
    return ctx


def _api(method: str, path: str, ctx: dict, **kwargs) -> httpx.Response:
    """Synchronous HTTP helper that reuses the chronicle auth pattern."""
    url = f"{ctx['backend_url']}{path}"
    headers = {"X-API-Key": ctx["api_key"], "Content-Type": "application/json"}
    try:
        with httpx.Client() as client:
            r = client.request(method, url, headers=headers, timeout=30.0, **kwargs)
            r.raise_for_status()
            return r
    except httpx.ConnectError:
        console.print(f"[#ef4444]✗[/#ef4444] Could not connect to {ctx['backend_url']}")
        raise typer.Exit(code=1)
    except httpx.HTTPStatusError as e:
        console.print(f"[#ef4444]✗[/#ef4444] API error {e.response.status_code}: {e.response.text[:200]}")
        raise typer.Exit(code=1)


# ---------------------------------------------------------------------------
# Command
# ---------------------------------------------------------------------------

@app.command()
def generate(
    config_path: str = typer.Option(..., "--config", help="Path to YAML config file"),
    dry_run: bool = typer.Option(False, "--dry-run", help="Print plan without making LLM calls"),
):
    """Generate a synthetic evaluation dataset using a two-model LLM pipeline."""

    # ── Load & validate config ────────────────────────────────────────────────
    try:
        cfg = load_config(config_path)
    except FileNotFoundError:
        console.print(f"[#ef4444]✗[/#ef4444] Config file not found: {config_path}")
        raise typer.Exit(code=1)
    except ValidationError as e:
        console.print("[#ef4444]✗ Config validation failed:[/#ef4444]")
        for err in e.errors():
            loc = " → ".join(str(x) for x in err["loc"])
            console.print(f"  [#ef4444]•[/#ef4444] {loc}: {err['msg']}")
        raise typer.Exit(code=1)

    # ── Dry-run: print plan and exit ──────────────────────────────────────────
    if dry_run:
        _print_dry_run_plan(cfg)
        return

    # ── Connect to backend ────────────────────────────────────────────────────
    ctx = _get_context()

    # ── Dataset creation / lookup ─────────────────────────────────────────────
    dataset_id = _resolve_dataset(cfg, ctx)

    # ── Run generation with live progress bar ─────────────────────────────────
    accepted_count = 0
    rejected_count = 0
    total_target = cfg.generation.size
    start_ts = time.monotonic()

    accepted_examples: list[dict] = []

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TaskProgressColumn(),
        TextColumn("[#6b7280]{task.fields[detail]}[/#6b7280]"),
        console=console,
        transient=False,
    ) as progress:
        task_id = progress.add_task(
            f"[#0ea5e9]Generating[/#0ea5e9] {cfg.dataset.name}",
            total=total_target,
            detail="starting…",
        )

        def on_progress(source_tag: str, accepted: bool) -> None:
            nonlocal accepted_count, rejected_count
            if accepted:
                accepted_count += 1
                progress.update(
                    task_id,
                    advance=1,
                    detail=f"✓ {source_tag}",
                )
            else:
                rejected_count += 1
                progress.update(
                    task_id,
                    detail=f"✗ rejected ({source_tag})",
                )

        accepted_examples = asyncio.run(
            generate_dataset(cfg, on_progress=on_progress)
        )

    elapsed = time.monotonic() - start_ts
    skipped_count = total_target - accepted_count

    # ── Push to DB ────────────────────────────────────────────────────────────
    if cfg.output.push_to_db and accepted_examples:
        _bulk_upload(dataset_id, accepted_examples, ctx)

    # ── Save CSV ──────────────────────────────────────────────────────────────
    if cfg.output.save_csv and accepted_examples:
        _save_csv(cfg, accepted_examples)

    # ── Final summary table ───────────────────────────────────────────────────
    _print_summary(cfg, accepted_count, rejected_count, skipped_count, elapsed)


# ---------------------------------------------------------------------------
# Dataset helpers
# ---------------------------------------------------------------------------

def _resolve_dataset(cfg: SyntheticConfig, ctx: dict) -> str:
    """Return dataset_id — either existing or newly created."""
    r = _api("GET", f"{EVAL_API}/datasets", ctx)
    datasets = r.json()

    existing = next(
        (d for d in datasets if d.get("name") == cfg.dataset.name), None
    )

    if existing:
        if cfg.dataset.if_exists == "fail":
            console.print(
                f"[#ef4444]✗[/#ef4444] Dataset '{cfg.dataset.name}' already exists "
                "and if_exists=fail."
            )
            raise typer.Exit(code=1)
        # append
        dataset_id = existing["dataset_id"]
        console.print(
            f"[#0ea5e9]→[/#0ea5e9] Appending to existing dataset [bold]{cfg.dataset.name}[/bold] "
            f"(id: {dataset_id})"
        )
        return dataset_id

    # Create new dataset
    payload = {
        "name": cfg.dataset.name,
        "description": cfg.dataset.description,
        "task_type": cfg.dataset.task_type,
        "created_by": "promptops-synth",
    }
    r = _api("POST", f"{EVAL_API}/datasets", ctx, json=payload)
    dataset_id = r.json()["dataset_id"]
    console.print(
        f"[#4ade80]✓[/#4ade80] Created dataset [bold]{cfg.dataset.name}[/bold] "
        f"(id: {dataset_id})"
    )
    return dataset_id


def _bulk_upload(dataset_id: str, examples: list[dict], ctx: dict) -> None:
    """Upload accepted examples via the bulk endpoint."""
    payload = {"examples": examples}
    _api("POST", f"{EVAL_API}/datasets/{dataset_id}/examples/bulk", ctx, json=payload)
    console.print(
        f"[#4ade80]✓[/#4ade80] Uploaded {len(examples)} examples to dataset {dataset_id}"
    )


def _save_csv(cfg: SyntheticConfig, examples: list[dict]) -> None:
    """Write examples to a CSV file."""
    csv_dir = Path(cfg.output.csv_path)
    csv_dir.mkdir(parents=True, exist_ok=True)
    csv_file = csv_dir / f"{cfg.dataset.name}.csv"

    with open(csv_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["input_vars", "expected_output", "source_tag"])
        writer.writeheader()
        for ex in examples:
            writer.writerow({
                "input_vars": json.dumps(ex["input_vars"]),
                "expected_output": ex["expected_output"],
                "source_tag": ex["source_tag"],
            })
    console.print(f"[#4ade80]✓[/#4ade80] CSV saved to {csv_file}")


# ---------------------------------------------------------------------------
# Display helpers
# ---------------------------------------------------------------------------

def _print_dry_run_plan(cfg: SyntheticConfig) -> None:
    from execution.pricing import MODEL_PRICING

    diff = cfg.generation.difficulty
    size = cfg.generation.size
    edge_count = int(size * cfg.generation.edge_cases.ratio)

    import math
    easy_n = math.floor(size * diff.easy.ratio)
    hard_n = math.floor(size * diff.hard.ratio)
    medium_n = size - easy_n - hard_n

    plan_table = Table(
        title=f"[bold #0ea5e9]Dry-Run Plan — {cfg.dataset.name}[/bold #0ea5e9]",
        box=box.ROUNDED,
        border_style="#6366f1",
        show_header=True,
        header_style="bold white",
    )
    plan_table.add_column("Field", style="#6b7280")
    plan_table.add_column("Value", style="white")

    plan_table.add_row("Task type", cfg.dataset.task_type)
    plan_table.add_row("Total examples", str(size))
    plan_table.add_row("Easy", f"{easy_n} ({diff.easy.ratio:.0%})")
    plan_table.add_row("Medium", f"{medium_n} ({diff.medium.ratio:.0%})")
    plan_table.add_row("Hard", f"{hard_n} ({diff.hard.ratio:.0%})")
    plan_table.add_row("Edge cases", f"{edge_count} ({cfg.generation.edge_cases.ratio:.0%})")
    plan_table.add_row("Edge types", ", ".join(cfg.generation.edge_cases.types))
    plan_table.add_row("Topic variants", str(cfg.generation.diversity.required_topic_variants))
    plan_table.add_row("Generator model", cfg.models.generator)
    plan_table.add_row("Validator model", cfg.models.validator)
    plan_table.add_row("Delay per call", f"{cfg.models.delay_seconds}s")
    plan_table.add_row("Max retry attempts", str(cfg.validation.max_regeneration_attempts))
    plan_table.add_row("Push to DB", str(cfg.output.push_to_db))
    plan_table.add_row("Save CSV", str(cfg.output.save_csv))

    gen_pricing = MODEL_PRICING.get(cfg.models.generator, {})
    val_pricing = MODEL_PRICING.get(cfg.models.validator, {})
    gen_known = gen_pricing.get("input_cost_per_1k", 0.0) > 0
    val_known = val_pricing.get("input_cost_per_1k", 0.0) > 0
    plan_table.add_row(
        "Pricing info",
        "available" if (gen_known and val_known) else "TODO (0.0 placeholders in pricing.py)"
    )

    console.print()
    console.print(plan_table)
    console.print(
        "\n[#6b7280]No LLM calls made. Remove --dry-run to execute.[/#6b7280]\n"
    )


def _print_summary(
    cfg: SyntheticConfig,
    accepted: int,
    rejected: int,
    skipped: int,
    elapsed: float,
) -> None:
    from execution.pricing import MODEL_PRICING

    # Rough cost estimate: assume ~500 tokens/call average
    avg_tokens = 500
    total_calls = accepted + rejected + skipped
    gen_pricing = MODEL_PRICING.get(cfg.models.generator, {})
    val_pricing = MODEL_PRICING.get(cfg.models.validator, {})
    gen_cost_per_call = (avg_tokens / 1000) * (
        gen_pricing.get("input_cost_per_1k", 0.0) + gen_pricing.get("output_cost_per_1k", 0.0)
    )
    val_cost_per_call = (avg_tokens / 1000) * (
        val_pricing.get("input_cost_per_1k", 0.0) + val_pricing.get("output_cost_per_1k", 0.0)
    )
    estimated_cost = (total_calls * gen_cost_per_call) + (accepted + rejected) * val_cost_per_call

    table = Table(
        title="[bold white]Generation Summary[/bold white]",
        box=box.ROUNDED,
        border_style="#0ea5e9",
        show_header=False,
    )
    table.add_column("Metric", style="#6b7280")
    table.add_column("Value", style="white")

    table.add_row("Dataset", cfg.dataset.name)
    table.add_row("Accepted", f"[#4ade80]{accepted}[/#4ade80]")
    table.add_row("Rejected", str(rejected))
    table.add_row("Skipped", f"[#ef4444]{skipped}[/#ef4444]" if skipped else "0")
    table.add_row("Time elapsed", f"{elapsed:.1f}s")
    table.add_row(
        "Est. token cost",
        f"${estimated_cost:.6f}" if estimated_cost > 0 else "N/A (pricing not set)"
    )

    console.print()
    console.print(table)
    console.print()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    app()
