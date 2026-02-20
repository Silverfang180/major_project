import typer
from rich.console import Console
from chronicle_cli.config import set_current_environment, load_config

console = Console()

def use_env(
    env_name: str = typer.Argument(..., help="The environment name (e.g., local, prod)")
):
    """Switch the active Chronicle environment."""
    config = load_config()
    if not config or "environments" not in config:
        console.print("[#ef4444]✗[/#ef4444] No environments configured. Run 'chronicle init' first.")
        raise typer.Exit(code=1)
        
    if env_name not in config["environments"]:
        available = ", ".join(config["environments"].keys())
        console.print(f"[#ef4444]✗[/#ef4444] Environment '{env_name}' not found. Available: {available}")
        raise typer.Exit(code=1)
        
    set_current_environment(env_name)
    console.print(f"[#4ade80]✓[/#4ade80] Now using environment: [bold #0ea5e9]{env_name}[/bold #0ea5e9]")
