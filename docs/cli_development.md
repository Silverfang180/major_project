# Chronicle CLI Development Progress

This file tracks the iterations and updates made to the Chronicle CLI.

## Iteration 1: Initial Scaffolding & Config (Feb 20, 2026)
- **Directory Structure:** Created the foundational `chronicle_cli` directory structure.
- **Dependencies & Entry Point:** Created `pyproject.toml` with dependencies (`typer`, `rich`, `httpx`, `pyfiglet`) and defined the `chronicle` script entry point.
- **Configuration Management:** Implemented `chronicle_cli/config.py` to handle stateless CLI configuration (loading and saving connection details to `~/.chronicle/config.json`).
- **Initial Module Files:** Created empty files for `main.py`, `client.py`, and the initial command scripts (`init.py`, `list.py`, `execute.py`, `versions.py`). Created UI module structure (`theme.py`, `formatters.py`).
- **Installation:** Installed the package in editable mode (`pip install -e .`).

## Iteration 2: Multi-Environment Config Updates (Feb 20, 2026)
- **Multi-Environment Support:** Overwrote `chronicle_cli/config.py` to change the configuration schema. It now stores an `environments` dictionary and a `current_env` pointer, allowing for local, staging, and prod contexts.
- **Context Switching Command:** Created `chronicle_cli/commands/use.py` which implements the `chronicle use <env>` command to easily switch between the configured environments.

## Iteration 3: Client Wrapper & Init Command (Feb 20, 2026)
- **HTTP Client Wrapper:** Created `chronicle_cli/client.py` as a centralized API gateway that injects authentication headers and handles standard error responses across all commands.
- **Interactive Init Command:** Implemented `chronicle_cli/commands/init.py` which interactively prompts for environment credentials and performs a health check before saving.
- **Main App Entry Point:** Updated `chronicle_cli/main.py` to organize the subcommands (`init` and `use`) securely within the main Typer application.

## Iteration 4: List & Versions Commands (Feb 20, 2026)
- **Time Formatting Utility:** Added `chronicle_cli/ui/formatters.py` and introduced dependency `python-dateutil` to handle relative timestamp conversions.
- **List Command:** Implemented `chronicle_cli/commands/list.py` using `asyncio.run()` to interact asynchronously with `httpx` and print an aggregated list of prompts, visually flagging their status.
- **Versions Command:** Added `chronicle_cli/commands/versions.py` to fetch both prompt metadata and version history sequentially, visually flagging the production version.
- **Wiring Commands:** Wires the `list` and `versions` Typer apps to the primary CLI framework in `main.py`.

## Iteration 5: Execute Command & Landing Screen (Feb 20, 2026)
- **Execute Orchestration:** Implemented `chronicle_cli/commands/execute.py` which sequences fetching the prompt to identify the production version, identifying `{{vars}}` by regex, prompting interactively if not provided via CLI, and calling the `POST /api/v1/execute` endpoint.
- **ASCII Landing Screen:** Updated `chronicle_cli/main.py` utilizing `pyfiglet` to generate a stylized header menu if no subcommands are passed, matching the strict UI guidelines and incorporating a 200ms sleep for 'infrastructure weight'. We also wired in the `execute` command here.

## Iteration 6: Documentation Update (Feb 20, 2026)
- **Setup Instructions:** Updated `guide.md` to specify the default development API key (`chronicle-dev-key`).

## Iteration 7: UI/UX Polish (Feb 20, 2026)
- **Landing Screen Redesign:** Replaced the plain ASCII text with a highly polished terminal UI inspired by Claude Code. Introduced a chunky block logo, rounded panels using `rich.panel`, and a cleaner layout for the command menu in `chronicle_cli/main.py`.

## Iteration 8: Improved Execute Command Logic (Feb 20, 2026)
- **Robust Execution Path:** Fully rebuilt `chronicle_cli/commands/execute.py` to resolve prompt keys correctly, handle missing production versions safely, parse `{{variables}}` accurately, request them dynamically using `rich.prompt`, and render telemetry (latency, tokens, cost) elegantly within a styled `rich.Panel`.
