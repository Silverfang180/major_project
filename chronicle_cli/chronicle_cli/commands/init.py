import typer
import httpx
from rich.console import Console
from rich.prompt import Prompt
from chronicle_cli.config import save_environment

console = Console()

def init():
    """Interactive setup for the Chronicle CLI."""
    console.print("\nChronicle CLI Setup")
    console.print("───────────────────────────────\n")
    
    env_name = Prompt.ask("Environment name", default="local")
    backend_url = Prompt.ask("Backend URL", default="http://localhost:8000")
    api_key = Prompt.ask("API Key", default="chronicle-dev-key")
    
    # Test connection via sync client (no need for client.py here since config isn't saved yet)
    try:
        with httpx.Client() as client:
            response = client.get(f"{backend_url.rstrip('/')}/health", timeout=5.0)
            response.raise_for_status()
    except httpx.ConnectError:
        console.print(f"\n[#ef4444]✗[/#ef4444] Could not connect to {backend_url}. Is the server running?")
        raise typer.Exit(code=1)
    except httpx.HTTPStatusError as e:
        console.print(f"\n[#ef4444]✗[/#ef4444] Health check failed with status {e.response.status_code}. Is this a Chronicle backend?")
        raise typer.Exit(code=1)
        
    # Save config
    save_environment(env_name, backend_url, api_key)
    
    console.print(f"\n[#4ade80]✓[/#4ade80] Configuration saved for environment: [bold #0ea5e9]{env_name}[/bold #0ea5e9]")
    console.print("[#4ade80]✓[/#4ade80] Connected successfully\n")
    console.print("Run '[bold #0ea5e9]chronicle list[/bold #0ea5e9]' to see your prompts.\n")
