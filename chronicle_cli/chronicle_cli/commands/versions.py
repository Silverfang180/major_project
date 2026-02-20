import typer
import asyncio
import json
import httpx
from rich.console import Console
from chronicle_cli.client import api_request
from chronicle_cli.ui.formatters import format_time_ago

console = Console()

async def fetch_prompt_and_versions(prompt_key: str):
    # Step 1: Fetch all prompts and resolve the key to an internal ID
    prompts_res = await api_request("GET", "/api/v1/version-control/prompts")
    prompts = prompts_res.json()
    
    prompt_data = next((p for p in prompts if p.get("key") == prompt_key), None)
    
    if not prompt_data:
        console.print(f"\n[#ef4444]✗ Prompt with key '{prompt_key}' not found.[/#ef4444]\n")
        raise typer.Exit(code=1)
        
    # Backend might use 'prompt_id' or 'id' depending on the serialization schema
    prompt_id = prompt_data.get("prompt_id") or prompt_data.get("id")
    
    # Step 2: Get the version history using the internal ID
    history_res = await api_request("GET", f"/api/v1/version-control/versions/{prompt_id}/history")
    history_data = history_res.json()
    
    return prompt_data, history_data

def list_versions(
    prompt_key: str = typer.Argument(..., help="The key of the prompt"),
    output_json: bool = typer.Option(False, "--json", help="Output raw JSON")
):
    """Show version history for a prompt in reverse chronological order."""
    try:
        prompt_data, versions = asyncio.run(fetch_prompt_and_versions(prompt_key))
    except Exception as e:
        console.print(f"[#ef4444]✗ Unexpected error: {str(e)}[/#ef4444]")
        return

    if output_json:
        console.print_json(data=versions)
        return

    if not versions:
        console.print(f"\n[#6b7280]No versions yet for prompt '{prompt_key}'.[/#6b7280]\n")
        return

    console.print(f"\nVersion History: [bold #0ea5e9]{prompt_key}[/bold #0ea5e9]")
    console.print("───────────────────────────────\n")

    prod_version_id = prompt_data.get("production_version_id")

    for v in versions:
        v_id = v.get("version_id")
        ordinal = v.get("ordinal", "?")
        
        # Header line with optional PRODUCTION badge
        header = f"[bold #0ea5e9]v{ordinal}[/bold #0ea5e9]"
        if v_id == prod_version_id:
            header += " • [bold #4ade80]PRODUCTION[/bold #4ade80]"
            
        console.print(header)
        
        # Metadata
        created_ago = format_time_ago(v.get("created_at"))
        author = v.get("created_by", "system")
        console.print(f"  [#6b7280]Created {created_ago} by {author}[/#6b7280]")
        
        # Extract model from JSONB settings
        settings = v.get("model_settings", {})
        model_name = settings.get("model", "unknown-model")
        console.print(f"  [#6b7280]Model: {model_name}[/#6b7280]")
        
        # Change Note
        note = v.get("change_note", "No note provided.")
        console.print(f"  [white][italic]Note: {note}[/italic][/white]\n")

    console.print(f"[#6b7280]{len(versions)} versions total[/#6b7280]\n")
