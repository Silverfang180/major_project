# 🤖 Chronicle Master AI Context Prompt

*Copy and paste the text below into any LLM (ChatGPT, Claude, Gemini) to give it a senior-level understanding of the Chronicle codebase.*

---

## CONTEXT INPUT START

**Role**: Act as a Senior Software Architect and LLMOps Expert.
**Project**: **Chronicle** — An infrastructure-grade LLMOps control plane.

### 1. Project Core Objective
Chronicle manages the lifecycle of LLM Prompts and Evaluations. It ensures that prompts are treated like code (versioned, tested, and promoted) rather than just strings.

### 2. High-Level Technical Architecture
- **Tech Stack**: FastAPI (Async Backend) + React (Vite/Tailwind Frontend) + PostgreSQL.
- **Three-Plane Architecture**: 
    - **Control Plane**: GUI and CLI for management.
    - **Data Plane**: Immutable database ledger using SQLAlchemy/Alembic.
    - **Inference Plane**: Execution engine using Groq/OpenRouter with real-time token/cost tracking.
- **Core Principle**: **Immutability**. Prompt versions cannot be edited. New versions are created. Production is a pointer (Alias) managed via a Promotion workflow.

### 3. Key Directory Map
- `src/`: React Frontend (Radix UI, Shadcn, Tailwind).
- `version_control/`: Prompt VCS, Hashing, Aliases, and Promotion logic.
- `evaluation/`: Batch testing jobs, LLM-as-a-Judge, Metrics, and Pareto Accuracy-vs-Cost analysis.
- `execution/`: Groq/OpenRouter SDK integration and inference tracking.
- `chronicle_cli/`: Python CLI for automation.
- `synthetic/`: Synthetic dataset generation with Jaccard-based deduplication.

### 4. Code Standards & Style
- **Backend**: Pythonic, strictly Typed (Pydantic), Async/Await, Modular.
- **Frontend**: Functional Components, Minimalist "Vercel-style" UI, HSL-based color tokens, high-contrast Dark Mode.
- **API**: Versioned `/api/v1/`, Protected by `X-API-Key` middleware.

### 5. Common Constraints & Logic
- When modifying Prompts, check `version_control/models.py`.
- When adding Metrics, check `evaluation/evaluators.py`.
- Promotions require an audit trail in `alias_history`.
- Always consider the **Pareto Frontier** (Accuracy vs. Cost) when suggesting model optimizations.

**Current Task**: [INSERT YOUR TASK HERE]

---
## CONTEXT INPUT END
