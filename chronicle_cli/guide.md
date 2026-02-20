# Chronicle CLI Usage Guide

Welcome to the Chronicle CLI! This tool is designed to help you operationalize your prompts directly from your terminal. Follow this step-by-step guide to get started.

## 0. Installation

Make sure you are in the `chronicle_cli` directory, then install the package in editable mode:
```bash
pip install -e .
```
This will make the `chronicle` command globally available in your active Python environment.

---

## 1. Initial Setup

Before you can interact with your prompts, you need to connect the CLI to your Chronicle backend.


Run the initialization command:
```bash
chronicle init
```
You will be prompted to enter:
- **Environment name**: A name for this connection (e.g., `local`, `staging`, `prod`).
- **Backend URL**: The URL where your Chronicle backend is running (e.g., `http://localhost:8000`).
- **API Key**: Your API key for authentication (use `chronicle-dev-key` for local development).

The CLI will verify the connection and safely store your configuration in `~/.chronicle/config.json`.

---

## 2. Managing Environments

The CLI supports multiple environments. If you later configure a `prod` environment, you can easily switch contexts.

To switch to a different environment, use:
```bash
chronicle use <env_name>
```
*Example:* `chronicle use prod`

---

## 3. Listing Prompts

To see all the prompts available in the registry, along with their current production status and version counts:

```bash
chronicle list
```

*Pro-tip:* If you want the output in structured JSON format (useful for piping into `jq` or other tools), use the `--json` flag:
```bash
chronicle list --json
```

---

## 4. Viewing Version History

If you want to look at the history of a specific prompt, including who updated it, what model it uses, and which version is currently marked for production:

```bash
chronicle versions <prompt_key>
```
*Example:* `chronicle versions customer_greeting`

---

## 5. Executing Prompts

The core feature of the CLI is executing the *production version* of a prompt directly from the terminal. 

If your prompt contains `{{variables}}` (e.g., `{{customer_name}}`), you have two ways to provide them:

**Method A: Interactive Prompt**
If you just run the execute command, the CLI will automatically detect the missing variables and prompt you for them interactively:
```bash
chronicle execute <prompt_key>
```

**Method B: Inline Variables**
You can pass variables directly via the `--var` flag using the `key=value` format. You can use this flag multiple times for multiple variables.
```bash
chronicle execute <prompt_key> --var user_name=Alice --var language=Spanish
```

### Execution Options
- **Strict output:** If you only want the raw response text to be outputted (useful for scripting), use the `--quiet` flag:
  ```bash
  chronicle execute <prompt_key> --quiet
  ```
- **JSON output:** To export the full execution trace including token usage, latency, and cost metadata, use the `--json` flag:
  ```bash
  chronicle execute <prompt_key> --json
  ```

---

## 6. Help Menu

If you ever forget a command or want to see all available options, simply run:
```bash
chronicle
```
or 
```bash
chronicle --help
```
