# Project Map: Chronicle - Prompt Version Control System

## 1. Overview
**Chronicle** is a prompt version control system built with **FastAPI**, **PostgreSQL** (Async), and **Docker**. It allows you to create prompts, manage versions (with history tracking), and store metadata like model settings and change notes.

## 2. File Map

### Root Directory
- **`main.py`** (Major): Entry point. Initializes the FastAPI app, logging, CORS, and registers routes.
- **`config.py`** (Minor): Loads environment variables using Pydantic Settings.
- **`db.py`** (Major): Handles async database connection (`asyncpg`) and session management.
- **`Dockerfile`** & **`docker-compose.yml`** (Major): Infrastructure definition for running the app and database in containers.
- **`alembic/`** (Major): Database migration scripts.

### Core Logic: `version_control/`
- **`routes.py`** (Major): API endpoints defining the interface:
    - `POST /prompts`: Create a prompt.
    - `GET /prompts`: List prompts (with latest version).
    - `POST /versions`: Create a new version for a prompt.
    - `GET /versions/{prompt_id}/history`: Get version history.
- **`models.py`** (Major): SQLAlchemy ORM models:
    - `Prompt`: The parent entity (key, title, owner).
    - `PromptVersion`: The child entity (text, settings, ordinal).
- **`schemas.py`** (Minor): Pydantic models for request/response validation.

## 3. How It Works
1.  **Prompts**: You create a `Prompt` entity to act as a container.
2.  **Versioning**: When you add a `PromptVersion`, the system automatically calculates the next `ordinal` number and updates the `is_latest` flag, keeping the history linear.
3.  **Storage**: Data is stored in Postgres. `JSONB` is used for flexible model settings (e.g., temperature, max_tokens).

## 4. How to Run

### Option A: Running with Docker (Recommended)
This is the simplest way to get started as it handles the database and dependencies for you.

**Prerequisites**:
- Docker & Docker Compose

**Steps**:
1.  **Configure Environment**: Ensure your `.env` file points to the docker container for the database (default in `docker-compose.yml`):
    ```ini
    DATABASE_URL=postgresql+asyncpg://postgres:password@db:5432/chronicle
    ALEMBIC_DATABASE_URL=postgresql://postgres:password@db:5432/chronicle
    ```
2.  **Start Services**:
    ```bash
    docker-compose up --build
    ```
    This starts the API (port `8000`) and Postgres (port `5432`).
3.  **Access**: Visit `http://localhost:8000/docs`.

---

### Option B: Local Setup (Manual)
Use this if you want to run the app directly on your machine or for debugging.

**Prerequisites**:
- **Python 3.9+**
- **PostgreSQL** (installed and running locally)
- **Git**

#### Step 1: Environment Setup
1.  **Create a virtual environment**:
    ```bash
    python -m venv .venv
    ```
2.  **Activate the environment**:
    -   Windows (PowerShell): `.venv\Scripts\Activate.ps1`
    -   Linux/Mac: `source .venv/bin/activate`
3.  **Install dependencies**:
    ```bash
    pip install -r requirements.txt
    ```

#### Step 2: Database Configuration
1.  **Ensure PostgreSQL is running** and you have a user (default: `postgres`).
2.  **Create the database**:
    ```sql
    CREATE DATABASE chronicle;
    ```
3.  **Configure `.env`**:
    -   Create/Edit `.env` in the root directory.
    -   Set `DATABASE_URL` to point to your local Postgres instance:
        ```ini
        DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/chronicle
        ALEMBIC_DATABASE_URL=postgresql://postgres:password@localhost:5432/chronicle
        ```
    -   *Note: Replace `password` with your actual Postgres password.*

#### Step 3: Database Migrations
Initialize the database schema using Alembic:
```bash
alembic upgrade head
```

#### Step 4: Start the Application
Run the FastAPI server with hot-reload enabled:
```bash
uvicorn main:app --reload
```

#### Step 5: Access the Interface
Once the server is running (default port `8000`):
-   **GUI**: [http://localhost:8000/gui/](http://localhost:8000/gui/) - Visual interface for managing prompts
-   **API Playground (Swagger UI)**: [http://localhost:8000/docs](http://localhost:8000/docs)
-   **Alternative Docs (ReDoc)**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
