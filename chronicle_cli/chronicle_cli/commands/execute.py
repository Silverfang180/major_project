import typer
import asyncio
import re
import httpx
from typing import List, Optional
from rich.console import Console
from rich.prompt import Prompt
from chronicle_cli.client import api_request

console = Console()

async def fetch_execute_context(prompt_key: str):
    """Fetches the prompt and its production version details by resolving the key to an ID first."""
    # Step 1: Resolve prompt_key to prompt_data
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
    
    # Step 2: Fetch history using internal ID to find the production version data
    history_res = await api_request("GET", f"/api/v1/version-control/versions/{prompt_id}/history")
    versions = history_res.json()
    
    prod_version = next((v for v in versions if v.get("version_id") == prod_v_id), None)
    if not prod_version:
        console.print("\n[#ef4444]✗ Production version data could not be found in history.[/#ef4444]\n")
        raise typer.Exit(code=1)
        
    return prompt_data, prod_version

async def execute_prompt(prompt_key: str, variables: dict) -> tuple[dict, httpx.Headers]:
    """Calls the execution endpoint and returns the response JSON and headers."""
    # Assuming the backend accepts the variables dict directly as the JSON body
    # Adjust payload structure here if your backend expects {"variables": {...}}
    response = await api_request(
        "POST", 
        f"/api/v1/execute/{prompt_key}?alias=production",
        json={"variables": variables}, # Wrap in variables object as suggested
        timeout=60.0  # LLM calls can take a while
    )
    return response.json(), response.headers

def execute_command(
    ctx: typer.Context,
    prompt_key: str = typer.Argument(..., help="The key of the prompt to execute"),
    var: List[str] = typer.Option([], "--var", help="Pass variables as key=value"),
    output_json: bool = typer.Option(False, "--json", help="Output raw JSON response"),
    quiet: bool = typer.Option(False, "--quiet", help="Only output the response text")
):
    """Execute the production version of a prompt with variables."""
    # Parse --var inputs into a dictionary
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
    except Exception:
        return

    prompt_text = prod_version.get("prompt_text", "")
    
    # Extract unique variables from {{placeholder}}
    required_vars = list(set(re.findall(r"\{\{\s*([^}\s]+)\s*\}\}", prompt_text)))
    
    # Merge CLI vars, prompt for missing ones
    final_vars = cli_vars.copy()
    
    if not quiet and not output_json:
        console.print(f"\nExecute: [bold #0ea5e9]{prompt_key}[/bold #0ea5e9]")
        console.print("───────────────────────────────\n")
        
        ordinal = prod_version.get("ordinal", "?")
        settings = prod_version.get("model_settings", {})
        model_name = settings.get("model", "unknown-model")
        
        console.print(f"[#6b7280]Production version: v{ordinal}[/#6b7280]")
        console.print(f"[#6b7280]Model: {model_name}[/#6b7280]")
        
        if required_vars:
            vars_str = ", ".join(required_vars)
            console.print(f"[#6b7280]Variables required: {vars_str}[/#6b7280]\n")
        else:
            console.print("[#6b7280]Variables required: None[/#6b7280]\n")
            
    # Interactive prompt for missing variables
    for req_var in required_vars:
        if req_var not in final_vars:
            if output_json or quiet:
                console.print(f"[#ef4444]✗[/#ef4444] Missing required variable: {req_var}")
                raise typer.Exit(code=1)
            
            # Interactive prompt
            val = Prompt.ask(f"[bold #0ea5e9]{req_var}[/bold #0ea5e9]")
            final_vars[req_var] = val
            
    if not quiet and not output_json:
        console.print("\n[#6b7280]Executing…[/#6b7280]\n")
        
    try:
        result, headers = asyncio.run(execute_prompt(prompt_key, final_vars))
    except Exception:
        return

    if output_json:
        console.print_json(data=result)
        return

    # Assuming backend returns {"response": "...", "latency_ms": 482, "tokens": {"prompt": 44, "completion": 49}, "cost_usd": 0.000066}
    # Adjust these dictionary keys to match your exact backend response schema
    response_text = result.get("response", result.get("raw_response", str(result)))
    latency = result.get("latency_ms", 0)
    
    tokens_in = result.get("tokens", {}).get("prompt", "?")
    tokens_out = result.get("tokens", {}).get("completion", "?")
    
    cost = result.get("cost_usd")
    cost_str = f"${cost:.6f}" if cost is not None else "Unknown"
    
    run_id = headers.get("X-PromptOps-Run-ID", "Unknown")
    status_color = "#4ade80" if result.get("status", "success") == "success" else "#ef4444"

    if quiet:
        console.print(response_text)
        return

    console.print(f"Run ID: [bold]{run_id}[/bold]")
    console.print(f"Status: [{status_color}]{result.get('status', 'success')}[/{status_color}]")
    console.print(f"Latency: {latency}ms")
    console.print(f"Tokens: {tokens_in} in / {tokens_out} out")
    console.print(f"Cost: {cost_str}\n")
    
    console.print("Response:")
    console.print("───────────────────────────────")
    console.print(response_text)
    console.print()
