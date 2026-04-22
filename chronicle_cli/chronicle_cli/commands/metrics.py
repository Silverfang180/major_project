import typer
import asyncio
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich import box
from chronicle_cli.client import api_request

console = Console()

async def fetch_metrics():
    response = await api_request("GET", "/api/v1/metrics/summary")
    return response.json()

def metrics_cmd():
    """Display system metrics and telemetry."""
    try:
        data = asyncio.run(fetch_metrics())
    except Exception as e:
        console.print(f"Failed to fetch metrics inside command: {str(e)}")
        # Client handles the printing and exiting for standard HTTP errors
        return

    kpis = data.get("kpis", {})
    
    # Overview Panel
    overview_text = (
        f"[bold white]Total Requests:[/bold white] [cyan]{kpis.get('total_requests', 0)}[/cyan]\n"
        f"[bold white]Total Errors:[/bold white]   [{'red' if kpis.get('total_errors', 0) > 0 else 'green'}]{kpis.get('total_errors', 0)}[/{'red' if kpis.get('total_errors', 0) > 0 else 'green'}]\n"
        f"[bold white]Error Rate:[/bold white]     [{'red' if kpis.get('error_rate_percent', 0) > 0 else 'green'}]{kpis.get('error_rate_percent', 0)}%[/{'red' if kpis.get('error_rate_percent', 0) > 0 else 'green'}]\n"
        f"[bold white]Avg Latency:[/bold white]    [{'yellow' if kpis.get('average_latency_ms', 0) > 500 else 'green'}]{kpis.get('average_latency_ms', 0)}ms[/{'yellow' if kpis.get('average_latency_ms', 0) > 500 else 'green'}]"
    )
    
    console.print()
    console.print(Panel(
        overview_text, 
        title="[bold]System KPIs[/bold]", 
        border_style="#6366f1", 
        box=box.ROUNDED,
        expand=False
    ))
    
    # Detailed Metrics Table
    raw = data.get("raw_metrics", [])
    console.print("\n  [bold]Prometheus Counters[/bold]")
    if raw:
        table = Table(box=box.MINIMAL, show_header=True, header_style="bold #0ea5e9")
        table.add_column("Metric Name", style="dim")
        table.add_column("Type", style="magenta")
        table.add_column("Samples", justify="right", style="green")
        
        # Display first 12 metrics to avoid flooding the terminal
        for m in raw[:12]:
            name = m.get("name", "unknown")
            mtype = m.get("type", "unknown")
            samples = m.get("samples", [])
            val = str(samples[0].get("value", 0)) if samples else "N/A"
            if len(samples) > 1:
                val += f" (+{len(samples)-1} variants)"
            table.add_row(name, mtype, val)
            
        console.print(table)
        console.print("  [#6b7280](Showing subset of total metrics)[/#6b7280]\n")
    else:
        console.print("  [#ef4444]No telemetry data found.[/#ef4444]\n")
