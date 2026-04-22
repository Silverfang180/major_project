import typer
import asyncio
import re
import httpx
from typing import List
from rich.console import Console
from rich.prompt import Prompt
from rich.panel import Panel
from rich.text import Text
from rich import box
from chronicle_cli.client import api_request

console = Console()

async def fetch_execute_context(prompt_key: str):
    """Resolves prompt key to ID, then fetches production version details."""
    # Step 1: Resolve key to ID
    prompts_res = await api_request("GET", "/api/v1/version-control/prompts")
    prompts = prompts_res.json()
    
    prompt_data = next((p for p in prompts if p.get("key") == prompt_key), None)
    
    if not prompt_data:
        console.print(f"\n[#ef4444]✗ Prompt '{prompt_key}' not found.[/#ef4444]\n")
        raise typer.Exit(code=1)
        
    prod_v_id = prompt_data.get("production_version_id")
    if not prod_v_id:
        console.print("\n[#ef4444]✗ Prompt has no production version. Promote a version first.[/#ef4444]\n")
        raise typer.Exit(code=1)
        
    prompt_id = prompt_data.get("prompt_id") or prompt_data.get("id")
    
    # Step 2: Fetch history to get production version details
    history_res = await api_request("GET", f"/api/v1/version-control/versions/{prompt_id}/history")
    versions = history_res.json()
    
    prod_version = next((v for v in versions if v.get("version_id") == prod_v_id), None)
    if not prod_version:
        console.print("\n[#ef4444]✗ Production version data could not be found in history.[/#ef4444]\n")
        raise typer.Exit(code=1)
        
    return prompt_data, prod_version

async def execute_prompt(prompt_key: str, variables: dict) -> tuple[dict, httpx.Headers]:
    """Calls the execution endpoint."""
    response = await api_request(
        "POST", 
        f"/api/v1/execute/{prompt_key}?alias=production",
        json={"variables": variables},
        timeout=60.0 
    )
    return response.json(), response.headers

def execute_command(
    prompt_key: str = typer.Argument(..., help="The key of the prompt to execute"),
    var: List[str] = typer.Option([], "--var", help="Pass variables as key=value"),
    output_json: bool = typer.Option(False, "--json", help="Output raw JSON response"),
    quiet: bool = typer.Option(False, "--quiet", help="Only output the response text")
):
    """Execute the production version of a prompt with variables."""
    cli_vars = {}
    for v in var:
        if "=" in v:
            k, val = v.split("=", 1)
            cli_vars[k.strip()] = val.strip()
        else:
            console.print(f"[#ef4444]✗[/#ef4444] Invalid var format '{v}'. Use key=value.")
            raise typer.Exit(code=1)

    try:
        prompt_data, prod_version = asyncio.run(fetch_execute_context(prompt_key))
    except Exception as e:
        if hasattr(e, "response"):
            console.print(f"\n[#ef4444]✗ Failed to fetch prompt:[/line] {e.response.text}[/#ef4444]\n")
        else:
            console.print(f"\n[#ef4444]✗ Failed to fetch prompt:[/line] {e}[/#ef4444]\n")
        return

    prompt_text = prod_version.get("prompt_text", "")
    required_vars = list(set(re.findall(r"\{\{\s*([^}\s]+)\s*\}\}", prompt_text)))
    final_vars = cli_vars.copy()
    ordinal = prod_version.get("ordinal", "?")
    
    if not quiet and not output_json:
        console.print(f"\n[bold white]Execute:[/bold white] [bold #0ea5e9]{prompt_key}[/bold #0ea5e9]")
        console.print("──────────────────────────────────────────────────\n")
            
    # Interactive prompt for missing variables
    for req_var in required_vars:
        if req_var not in final_vars:
            if output_json or quiet:
                console.print(f"[#ef4444]✗[/#ef4444] Missing required variable: {req_var}")
                raise typer.Exit(code=1)
            val = Prompt.ask(f"[bold #0ea5e9]{req_var}[/bold #0ea5e9]")
            final_vars[req_var] = val
            
    if not quiet and not output_json:
        console.print("\n[#6b7280]Executing (alias=production)…[/#6b7280]\n")
        
    try:
        result, headers = asyncio.run(execute_prompt(prompt_key, final_vars))
    except Exception as e:
        if hasattr(e, "response"):
            import json
            try:
                detail = json.loads(e.response.text).get("detail", e.response.text)
            except:
                detail = e.response.text
            console.print(f"\n[#ef4444]✗ Execution failed: {detail}[/#ef4444]\n")
        else:
            console.print(f"\n[#ef4444]✗ Execution failed: {str(e)}[/#ef4444]\n")
        return

    if output_json:
        console.print_json(data=result)
        return

    # Extract telemetry
    response_text = result.get("response", result.get("raw_response", str(result)))
    latency = result.get("latency_ms", "Unknown")
    
    # Fallbacks depending on exact backend schema shape
    tokens_in = result.get("tokens", {}).get("prompt", "?")
    tokens_out = result.get("tokens", {}).get("completion", "?")
    if tokens_in == "?" and "prompt_tokens" in result:
        tokens_in = result["prompt_tokens"]
        tokens_out = result.get("completion_tokens", "?")
        
    cost = result.get("cost_usd")
    cost_str = f"${cost:.6f}" if cost is not None else "Unknown"
    status = result.get("status", "success")
    status_color = "#4ade80" if status == "success" else "#ef4444"

    if quiet:
        console.print(response_text)
        return

    # Output the Response
    console.print(response_text)
    console.print("\n──────────────────────────────────────────────────")
    
    # Output the structured Telemetry Box
    telemetry_text = (
        f" Alias Resolution : [bold white]production[/bold white] → [bold #0ea5e9]v{ordinal}[/bold #0ea5e9]\n"
        f" Status           : [{status_color}]{status}[/{status_color}]\n"
        f" Latency          : [white]{latency}ms[/white]\n"
        f" Token Usage      : [white]{tokens_in} prompt[/white] / [white]{tokens_out} completion[/white]\n"
        f" Cost             : [white]{cost_str}[/white]"
    )
    
    console.print(Panel(
        telemetry_text,
        title="[bold #6b7280]Execution Telemetry[/bold #6b7280]",
        title_align="left",
        border_style="#0ea5e9",
        box=box.ROUNDED,
        expand=False
    ))
    console.print()
