import typer
import asyncio
import json
from rich.console import Console
from chronicle_cli.client import api_request
from chronicle_cli.ui.formatters import format_time_ago

console = Console()

async def fetch_prompts():
    response = await api_request("GET", "/api/v1/version-control/prompts")
    return response.json()

def list_prompts(
    output_json: bool = typer.Option(False, "--json", help="Output raw JSON")
):
    """List all prompts with their production status."""
    try:
        prompts = asyncio.run(fetch_prompts())
    except Exception:
        # Client handles the printing and exiting for standard HTTP errors
        return

    if output_json:
        console.print_json(data=prompts)
        return

    if not prompts:
        console.print("No prompts yet. Create one via the Chronicle GUI.")
        return

    console.print("\nPrompts")
    console.print("───────────────────────────────\n")

    for p in prompts:
        key = p.get("key", "unknown-key")
        title = p.get("title", "Untitled")
        
        # Display Prompt Key (accent) and Title
        console.print(f"[bold #0ea5e9]{key:<35}[/bold #0ea5e9] {title}")
        
        # Production Status
        # Note: Depending on backend schema, we check for production_version_id
        prod_id = p.get("production_version_id")
        # If the backend returns the ordinal directly, we use it. Otherwise we just show it's in production.
        prod_ordinal = p.get("production_version_ordinal") 
        
        if prod_id:
            ordinal_text = f"v{prod_ordinal} " if prod_ordinal else ""
            console.print(f"  [#4ade80]✓ {ordinal_text}in production[/#4ade80]")
        else:
            console.print("  [#ef4444]⚠ no production version[/#ef4444]")
            
        # Version count and timestamps
        v_count = p.get("version_count", 0)
        updated_at = format_time_ago(p.get("updated_at") or p.get("created_at"))
        
        v_text = "version" if v_count == 1 else "versions"
        console.print(f"  [#6b7280]{v_count} {v_text} • last updated {updated_at}[/#6b7280]\n")

    console.print(f"[#6b7280]{len(prompts)} prompts total[/#6b7280]\n")
