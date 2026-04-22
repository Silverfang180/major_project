import typer
import asyncio
import time
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from rich.prompt import Prompt, Confirm
from rich.live import Live
from rich.spinner import Spinner

from chronicle_cli.client import api_request
from chronicle_cli.ui.formatters import format_time_ago

console = Console()
eval_app = typer.Typer(help="Manage and run evaluation jobs.")


# --- Helpers ---
def run_async(coro):
    return asyncio.run(coro)

async def _fetch_json(path: str):
    resp = await api_request("GET", path)
    return resp.json()

async def _post_json(path: str, data: dict):
    resp = await api_request("POST", path, json=data)
    return resp.json()

# --- Commands ---

@eval_app.command(name="datasets")
def list_datasets():
    """List all evaluation datasets."""
    datasets = run_async(_fetch_json("/api/v1/eval/datasets"))
    
    if not datasets:
        console.print("No datasets found.")
        return
        
    table = Table(title="Evaluation Datasets")
    table.add_column("Dataset ID", style="cyan", no_wrap=True)
    table.add_column("Name", style="white")
    table.add_column("Task Type", justify="center")
    table.add_column("Examples", justify="right", style="green")
    table.add_column("Created", style="dim")
    
    for ds in datasets:
        did = str(ds.get("dataset_id", ""))[:8]
        name = ds.get("name", "Unknown")
        ttype = ds.get("task_type", "")
        
        type_color = "magenta"
        if ttype == "classification":
            type_color = "magenta"
        elif ttype == "qa":
            type_color = "cyan"
        elif ttype == "generation":
            type_color = "yellow"
            
        type_str = f"[{type_color}]{ttype}[/{type_color}]"
        examples = str(ds.get("example_count", 0))
        created = format_time_ago(ds.get("created_at", ""))
        
        table.add_row(did, name, type_str, examples, created)
        
    console.print(table)


@eval_app.command(name="run")
def run_eval_job(
    prompt_key: str = typer.Option(None, "--prompt", help="Prompt key"),
    version_id: int = typer.Option(None, "--version", help="Version ordinal/ID"),
    dataset_id: str = typer.Option(None, "--dataset", help="Dataset ID"),
    evals: str = typer.Option(None, "--evaluators", help="Comma-separated list of evaluators")
):
    """Run a new evaluation job. Interactive by default."""
    async def _flow():
        # 1. Prompt selection
        prompts = await _fetch_json("/api/v1/version-control/prompts")
        selected_prompt = None
        
        if prompt_key:
            selected_prompt = next((p for p in prompts if p["key"] == prompt_key), None)
            if not selected_prompt:
                console.print(f"[red]Prompt key '{prompt_key}' not found.[/red]")
                raise typer.Exit(1)
        else:
            ptable = Table(title="Available Prompts")
            ptable.add_column("Key", style="cyan")
            ptable.add_column("Title")
            for p in prompts:
                ptable.add_row(p["key"], p.get("title", ""))
            console.print(ptable)
            
            p_map = {p["key"]: p for p in prompts}
            choices = list(p_map.keys())
            chosen_key = Prompt.ask("Select prompt key", choices=choices)
            selected_prompt = p_map[chosen_key]
            
        pid = selected_prompt["prompt_id"]
        pkey = selected_prompt["key"]

        # 2. Version selection
        versions = await _fetch_json(f"/api/v1/version-control/versions/{pid}/history")
        selected_version_id = None
        
        if version_id:
            selected_version_id = version_id
        else:
            vtable = Table(title=f"Versions for {pkey}")
            vtable.add_column("Ordinal", style="cyan")
            vtable.add_column("Model")
            for v in versions:
                vtable.add_row(str(v["version_id"]), v.get("model_settings", {}).get("model", "unknown"))
            console.print(vtable)
            
            v_choices = [str(v["version_id"]) for v in versions]
            chosen_v = Prompt.ask("Select version ordinal", choices=v_choices)
            selected_version_id = int(chosen_v)
            
        # 3. Dataset selection
        datasets = await _fetch_json("/api/v1/eval/datasets")
        selected_ds_id = None
        ds_name = ""
        
        if dataset_id:
            ds = next((d for d in datasets if str(d["dataset_id"]) == dataset_id or str(d["dataset_id"]).startswith(dataset_id)), None)
            if not ds:
                console.print(f"[red]Dataset '{dataset_id}' not found.[/red]")
                raise typer.Exit(1)
            selected_ds_id = ds["dataset_id"]
            ds_name = ds["name"]
        else:
            dtable = Table(title="Available Datasets")
            dtable.add_column("ID (short)", style="cyan")
            dtable.add_column("Name")
            for d in datasets:
                dtable.add_row(str(d["dataset_id"])[:8], d["name"])
            console.print(dtable)
            
            d_map = {str(d["dataset_id"])[:8]: d for d in datasets}
            full_map = {str(d["dataset_id"]): d for d in datasets}
            choices = list(d_map.keys()) + list(full_map.keys())
            chosen_d = Prompt.ask("Select dataset ID")
            if chosen_d in d_map:
                ds = d_map[chosen_d]
            elif chosen_d in full_map:
                ds = full_map[chosen_d]
            else:
                console.print("[red]Invalid dataset selected.[/red]")
                raise typer.Exit(1)
            selected_ds_id = ds["dataset_id"]
            ds_name = ds["name"]
            
        # 4. Evaluators
        evaluators_list = []
        if evals:
            evaluators_list = [e.strip() for e in evals.split(",")]
        else:
            avail = ["exact_match", "llm_judge", "confidence_calibration"]
            for e in avail:
                if Confirm.ask(f"Use evaluator: {e}?"):
                    evaluators_list.append(e)
            if not evaluators_list:
                console.print("[red]Must select at least one evaluator.[/red]")
                raise typer.Exit(1)
                
        # 5. Confirm
        if not (prompt_key and version_id and dataset_id and evals):
            if not Confirm.ask(f"Run eval job for {pkey} v{selected_version_id} on {ds_name}?"):
                console.print("Cancelled.")
                raise typer.Exit(0)
                
        # 6. POST
        payload = {
            "prompt_id": pid,
            "version_id": selected_version_id,
            "dataset_id": selected_ds_id,
            "evaluators": evaluators_list,
            "created_by": "00000000-0000-0000-0000-000000000099" # placeholder user ID equivalent
        }
        
        job = await _post_json("/api/v1/eval/jobs", payload)
        
        console.print(f"\n[green]Job created successfully![/green]")
        console.print(f"Job ID: [cyan]{job['job_id']}[/cyan]")
        console.print(f"Use `chronicle eval status {job['job_id']}` to track progress.")

    run_async(_flow())


def render_status_panel(job: dict) -> Panel:
    jid = job["job_id"]
    status = job["status"]
    color = {"pending": "yellow", "running": "blue", "completed": "green", "failed": "red"}.get(status, "white")
    
    started = format_time_ago(job.get("started_at")) if job.get("started_at") else "N/A"
    completed = format_time_ago(job.get("completed_at")) if job.get("completed_at") else "N/A"
    evals = ", ".join(job.get("evaluators", []))
    
    txt = f"Status: [{color}]{status}[/{color}]\n"
    txt += f"Started: {started}\nCompleted: {completed}\nEvaluators: {evals}\n"
    
    if status == "completed":
        txt += f"\n[green]View full results:[/green] chronicle eval report {jid}"
        
    return Panel(txt, title=f"Eval Job: {jid}", border_style=color)

@eval_app.command(name="status")
def job_status(job_id: str, watch: bool = typer.Option(False, "--watch", help="Poll until finished")):
    """Check the status of an evaluation job."""
    async def _fetch():
        return await _fetch_json(f"/api/v1/eval/jobs/{job_id}")

    if not watch:
        job = run_async(_fetch())
        console.print(render_status_panel(job))
        return

    # Watch loop
    async def _watch():
        with Live(Spinner("dots", text="Checking status..."), refresh_per_second=4, console=console) as live:
            while True:
                try:
                    job = await _fetch()
                    status = job["status"]
                    if status in ["completed", "failed"]:
                        live.update(render_status_panel(job))
                        break
                    
                    color = "blue" if status == "running" else "yellow"
                    spinner = Spinner("dots", text=f"Job [{color}]{status}[/{color}] - polling every 3s...")
                    live.update(spinner)
                    
                    await asyncio.sleep(3)
                except Exception as e:
                    live.update(f"[red]Error polling status: {e}[/red]")
                    break
    
    run_async(_watch())


@eval_app.command(name="report")
def job_report(job_id: str):
    """View detailed report and results for a completed job."""
    async def _flow():
        report = await _fetch_json(f"/api/v1/eval/jobs/{job_id}/report")
        
        summ = report.get("summary", {})
        if not summ:
            console.print("[red]No summary available. Job might not be completed.[/red]")
            return
            
        # Panel 1: Summary metrics
        s_txt = (
            f"Accuracy: [green]{(summ.get('accuracy') or 0)*100:.1f}%[/green]\n"
            f"Cost per Correct: [yellow]${summ.get('cost_per_correct') or 0:.6f}[/yellow]\n"
            f"Total Cost: ${summ.get('total_cost_usd') or 0:.6f}\n"
            f"Mean Score: {summ.get('mean_evaluator_score') or 'N/A'}\n"
            f"Latency (p50/p95): {summ.get('p50_latency_ms') or 'N/A'}ms / {summ.get('p95_latency_ms') or 'N/A'}ms\n"
            f"Examples (Scored/Total): {summ.get('scored_examples')}/{summ.get('total_examples')}"
        )
        console.print(Panel(s_txt, title="Summary Metrics", border_style="cyan"))
        
        # Panel 3: Meta Calibration
        meta = report.get("meta")
        if meta and meta.get("calibration_metrics"):
            cm = meta["calibration_metrics"]
            m_txt = (
                f"MCE: {cm.get('mce') or 'N/A'}\n"
                f"Overconfidence Rate: {(cm.get('overconfidence_rate') or 0)*100:.1f}%\n"
                f"Underconfidence Rate: {(cm.get('underconfidence_rate') or 0)*100:.1f}%"
            )
            console.print(Panel(m_txt, title="Calibration Metrics", border_style="magenta"))
            
        # Panel 2: Results Table
        results = report.get("results", [])
        rtable = Table(title="Results (first 20)")
        rtable.add_column("#", justify="right")
        rtable.add_column("Expected")
        rtable.add_column("Got")
        rtable.add_column("Correct", justify="center")
        rtable.add_column("Score")
        rtable.add_column("Cost")
        rtable.add_column("Latency")
        
        for i, r in enumerate(results[:20]):
            correct_val = r.get("is_correct")
            if correct_val is True:
                c_str = "[green]✓[/green]"
                row_style = "green"
            elif correct_val is False:
                c_str = "[red]✗[/red]"
                row_style = "red"
            else:
                c_str = "-"
                row_style = "dim"
                
            raw = str(r.get("raw_output", "")).replace("\n", " ")
            if len(raw) > 40: raw = raw[:37] + "..."
            
            exp = str(r.get("expected_output", "")).replace("\n", " ")
            if len(exp) > 30: exp = exp[:27] + "..."
            
            sc = f"{r.get('evaluator_score') or 0:.2f}"
            co = f"${r.get('cost_usd') or 0:.6f}"
            la = f"{r.get('latency_ms') or 0}ms"
            
            rtable.add_row(str(i+1), exp, raw, c_str, sc, co, la, style=row_style)
            
        console.print(rtable)
        if len(results) > 20:
            console.print(f"[dim]...and {len(results)-20} more rows.[/dim]")

    run_async(_flow())


@eval_app.command(name="compare")
def compare_dataset(dataset_id: str):
    """Compare all eval jobs on a dataset (Pareto Analysis)."""
    async def _flow():
        # Resolve short ID if necessary
        actual_dataset_id = dataset_id
        if len(dataset_id) < 32:
            datasets = await _fetch_json("/api/v1/eval/datasets")
            ds = next((d for d in datasets if str(d["dataset_id"]).startswith(dataset_id)), None)
            if not ds:
                console.print(f"[red]Could not resolve dataset ID '{dataset_id}'[/red]")
                return
            actual_dataset_id = ds["dataset_id"]

        comp = await _fetch_json(f"/api/v1/eval/compare/dataset/{actual_dataset_id}")
        
        rec = comp.get("recommendation", "No recommendation available.")
        console.print(Panel(rec, title="Recommendation", border_style="#6366f1"))
        
        frontier = comp.get("jobs", [])
        if not frontier:
            console.print("[dim]No frontier data computed.[/dim]")
            return
        
        # Sort by rank
        frontier.sort(key=lambda x: x.get("rank", 999))
            
        # Section 2: Table
        table = Table(title="Pareto Frontier")
        table.add_column("Rank", justify="right")
        table.add_column("Version", style="cyan")
        table.add_column("Model")
        table.add_column("Accuracy", justify="right")
        table.add_column("Cost/Correct", justify="right")
        table.add_column("Pareto", justify="center")
        table.add_column("Knee", justify="center")
        
        for p in frontier:
            opt = p.get("is_pareto_optimal", False)
            knee = p.get("is_knee_point", False)
            
            opt_str = "[green]o[/green]" if opt else "[red].[/red]"
            knee_str = "[yellow]*[/yellow]" if knee else ""
            acc = f"{(p.get('accuracy') or 0.0)*100:.1f}%"
            cpc = p.get("cost_per_correct")
            cpc_str = f"${cpc:.6f}" if cpc is not None else "N/A"
            rank = str(p.get("rank", "-"))
            
            table.add_row(rank, str(p.get("version_id")), p.get("model", ""), acc, cpc_str, opt_str, knee_str)
            
        console.print(table)
        
        # Section 3: Simple ASCII Scatter
        p_opts = [p for p in frontier if p.get("is_pareto_optimal", False)]
        if len(p_opts) > 1:
            console.print("\n[dim]Pareto Curve Geometry:[/dim]")
            costs = [p.get("cost_per_correct") for p in p_opts if p.get("cost_per_correct") is not None]
            accs = [p.get("accuracy") for p in p_opts if p.get("accuracy") is not None]
            
            if costs and accs:
                min_c, max_c = min(costs), max(costs)
                min_a, max_a = min(accs), max(accs)
                c_range = max_c - min_c if max_c > min_c else 1
                a_range = max_a - min_a if max_a > min_a else 1
                
                # 20 cols (x), 10 rows (y)
                grid = [[" " for _ in range(20)] for _ in range(10)]
                
                for p in frontier:
                    c = p.get("cost_per_correct")
                    a = p.get("accuracy")
                    if c is None or a is None: continue
                    
                    x = int(((c - min_c) / c_range) * 19)
                    # y=0 is top, y=9 is bottom. High accuracy should be y=0
                    y = 9 - int(((a - min_a) / a_range) * 9)
                    
                    x = max(0, min(19, x))
                    y = max(0, min(9, y))
                    
                    char = "."
                    if p.get("is_pareto_optimal"):
                        char = "o"
                    if p.get("is_knee_point"):
                        char = "*"
                        
                    grid[y][x] = char
                    
                console.print(Panel("\n".join("".join(row) for row in grid), title="Accuracy vs Cost (Right is cheaper)"))

    run_async(_flow())
