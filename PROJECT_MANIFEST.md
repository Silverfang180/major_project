# 📜 Chronicle: The Definitive Project Manifest

**Chronicle** (formerly *PromptPilot*) is an infrastructure-grade LLMOps control plane designed to bring stability, immutability, and rigorous evaluation to LLM application development. 

---

## 🏗️ 1. Core Architecture: The Three-Plane System

To ensure professional-grade reliability, Chronicle is architected around three distinct planes:

1.  **Control Plane (The Brain)**: 
    - **Frontend**: A high-performance React SPA (Vite, Tailwind, Radix UI) with a focus on "Vercel-style" minimalism.
    - **CLI**: A Python-based terminal tool for deep automation and developer workflows.
    - **API**: FastAPI (Python) serving as the orchestrator for all system components.

2.  **Data Plane (The Ledger)**: 
    - **Database**: PostgreSQL (managed via SQLAlchemy and Alembic).
    - **Immutability Principle**: Prompt versions are *immutable*. Every "edit" creates a new hash-linked version.
    - **Audit Trail**: Full history of "Promotions" (moving a version to Production) is tracked via `AliasHistory`.

3.  **Inference Plane (The Engine)**:
    - **Execution Engine**: Handles real-time inference with Groq and OpenRouter. It includes crash-safe run tracking and token/cost estimation.
    - **Evaluation Engine**: A background-job system that runs bulk evaluations against datasets using metrics like *Exact Match*, *LLM Judge*, and *MCE (Mean Calibration Error)*.

---

## 📂 2. Directory Structure & Module Mapping

| Directory | Responsibility | Key Files |
| :--- | :--- | :--- |
| `src/` | **Frontend (React)** | `src/app/pages/`, `src/styles/index.css`, `src/app/components/` |
| `chronicle/` | **Backend Core** | Core logic for the LLMOps platform. |
| `chronicle_cli/` | **Command Line Tool** | `main.py` entry point for CLI commands. |
| `version_control/` | **Prompt Management** | `models.py` (Prompts, Versions), `routes.py` (VCS logic) |
| `evaluation/` | **Testing & Analytics** | `evaluators.py` (Grading logic), `orchestrator.py` (Job manager) |
| `execution/` | **Inference Engine** | `tracking.py`, `routes.py` (Prompt execution) |
| `synthetic/` | **Data Generation** | `generator.py` (Synthetic dataset creation) |
| `alembic/` | **Migrations** | Database schema versioning control. |

---

## 🧬 3. Technical Core Concepts

### 1. Immutable Prompt Versioning
Instead of overwriting rows, Chronicle uses a "Git-like" approach for prompts.
- **Prompt**: The top-level collection (e.g., "Customer Service Bot").
- **Version**: A specific iteration of the prompt content and parameters.
- **Alias**: A named pointer (e.g., `prod`, `staging`) that points to a specific version. Use the **Promotion Workflow** to swap these pointers.

### 2. Evaluation & Pareto Optimization
Chronicle doesn't just measure accuracy; it measures **Efficiency**.
- **Pareto Logic**: Calculates the trade-off between *Accuracy* and *Cost/Latency*.
- **Knee Point Detection**: Identifies the "golden" model version that provides the best value for money.

### 3. Synthetic Data & Jaccard Similarity
To solve the "cold start" problem for testing, Chronicle can generate synthetic datasets. It uses **Jaccard similarity** to ensure high diversity and prevent redundant test cases.

---

## 🛠️ 4. Tech Stack Breakdown

- **Backend**: FastAPI, Pydantic, SQLAlchemy (Async), Alembic, Uvicorn.
- **Frontend**: React 18, Vite, Tailwind CSS 4, Radix UI, Lucide Icons, Recharts (Analytics).
- **AI/LLM**: Groq SDK, OpenRouter, Prometheus (Telemetry).
- **Deployment**: Docker, Docker Compose, PostgreSQL.

---

## 📋 5. How to Interact with this Project (AI Guidelines)

When helping with this project, follow these principles:
1.  **Minimalist Aesthetics**: Every UI component should feel premium, dark-themed (by default), and fast.
2.  **Schema First**: Check `models.py` in the respective module before suggesting API changes.
3.  **Async Everything**: Use `async/await` for all database and network operations.
4.  **No Placeholders**: If a feature is requested, build the working logic, not just the UI shell.
