import httpx
import typer
from rich.console import Console
from chronicle_cli.config import get_current_context

console = Console()

async def api_request(method: str, path: str, **kwargs) -> httpx.Response:
    """Wrapper for httpx that handles auth and standardized error states."""
    context = get_current_context()
    if not context:
        console.print("[#ef4444]✗[/#ef4444] Not configured. Run 'chronicle init' first.")
        raise typer.Exit(code=1)
        
    url = f"{context['backend_url']}{path}"
    
    headers = kwargs.pop("headers", {})
    headers["X-API-Key"] = context["api_key"]
    headers["Content-Type"] = "application/json"
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.request(method, url, headers=headers, **kwargs)
            response.raise_for_status()
            return response
            
    except httpx.ConnectError:
        console.print(f"[#ef4444]✗[/#ef4444] Could not connect to {context['backend_url']}. Is the server running?")
        raise typer.Exit(code=1)
    except httpx.HTTPStatusError as e:
        status = e.response.status_code
        if status == 401:
            console.print("[#ef4444]✗[/#ef4444] Authentication failed. Check your API key in ~/.chronicle/config.json")
            raise typer.Exit(code=1)
        elif status >= 500:
            console.print("[#ef4444]✗[/#ef4444] Chronicle backend error. Check server logs.")
            raise typer.Exit(code=1)
        
        # 400, 404, 422 errors are passed up so specific commands can parse the detail
        # If unhandled by the caller, it will raise standard Exception
        raise e
    except Exception as e:
        console.print(f"[#ef4444]✗[/#ef4444] Unexpected error: {str(e)}")
        raise typer.Exit(code=1)
