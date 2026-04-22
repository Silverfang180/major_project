import typer
import time
from rich.console import Console
from rich.panel import Panel
from rich.text import Text
from rich import box

# Import the raw functions, not the modules
from chronicle_cli.commands.init import init
from chronicle_cli.commands.use import use_env
from chronicle_cli.commands.list import list_prompts
from chronicle_cli.commands.versions import list_versions
from chronicle_cli.commands.execute import execute_command
from chronicle_cli.commands.eval import eval_app
from chronicle_cli.commands.metrics import metrics_cmd
from chronicle_cli.config import get_current_context

console = Console()
app = typer.Typer(
    help="Chronicle CLI — Operationalizing prompts.",
    add_completion=False,
    invoke_without_command=True
)

# Register functions directly as flat commands (no subgroups)
app.command(name="init", help="Configure backend connection")(init)
app.command(name="use", help="Switch environments")(use_env)
app.command(name="list", help="List all prompts")(list_prompts)
app.command(name="versions", help="Show version history for a prompt")(list_versions)
app.command(name="execute", help="Execute a prompt with variables")(execute_command)
app.command(name="metrics", help="Display system metrics and telemetry")(metrics_cmd)
app.add_typer(eval_app, name="eval")

BLOCK_LOGO = """
[#0ea5e9]██████╗ ██╗  ██╗██████╗  ██████╗ ███╗   ██╗██╗ ██████╗██╗     ███████╗[/#0ea5e9]
[#0ea5e9]██╔════╝ ██║  ██║██╔══██╗██╔═══██╗████╗  ██║██║██╔════╝██║     ██╔════╝[/#0ea5e9]
[#0ea5e9]██║      ███████║██████╔╝██║   ██║██╔██╗ ██║██║██║     ██║     █████╗  [/#0ea5e9]
[#0ea5e9]██║      ██╔══██║██╔══██╗██║   ██║██║╚██╗██║██║██║     ██║     ██╔══╝  [/#0ea5e9]
[#0ea5e9]╚██████╗ ██║  ██║██║  ██║╚██████╔╝██║ ╚████║██║╚██████╗███████╗███████╗[/#0ea5e9]
[#0ea5e9] ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝ ╚═════╝╚══════╝╚══════╝[/#0ea5e9]
"""

@app.callback()
def main(ctx: typer.Context):
    """
    Chronicle CLI routing. Shows the premium landing screen if no command is passed.
    """
    if ctx.invoked_subcommand is None:
        time.sleep(0.15)
        
        welcome_text = Text.from_markup(" ✺ Welcome to the [bold white]Chronicle[/bold white] execution environment! ")
        console.print()
        console.print(Panel(
            welcome_text, 
            border_style="#6366f1", 
            box=box.ROUNDED, 
            expand=False
        ))
        
        console.print(BLOCK_LOGO)
        console.print("  [#6b7280]Operationalizing prompts. Version • Promote • Execute • Evaluate[/#6b7280]\n")
        
        console.print("  [bold white]Commands[/bold white]")
        console.print("  [bold #0ea5e9]init[/bold #0ea5e9]        Configure backend connection")
        console.print("  [bold #0ea5e9]use[/bold #0ea5e9]         Switch environments")
        console.print("  [bold #0ea5e9]list[/bold #0ea5e9]        List all prompts")
        console.print("  [bold #0ea5e9]versions[/bold #0ea5e9]    Show version history")
        console.print("  [bold #0ea5e9]execute[/bold #0ea5e9]     Run a prompt with variables")
        console.print("  [bold #0ea5e9]eval[/bold #0ea5e9]        Manage evaluations, status, and reporting")
        console.print("  [bold #0ea5e9]metrics[/bold #0ea5e9]     Display system metrics and telemetry\n")
        
        context = get_current_context()
        if not context:
            console.print("  [#ef4444]⚠️  System unconfigured. Run 'chronicle init' to get started.[/#ef4444]\n")
        else:
            url = context.get("backend_url", "unknown")
            console.print(f"  🚀 [white]System ready.[/white] [#6b7280]Connected to {url}[/#6b7280]\n")

if __name__ == "__main__":
    app()
