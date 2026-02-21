# Chronicle Architecture Overview

![Chronicle Architecture Overview](../img/architecture_detailed.png)

Below are architectural and entity-relationship (ER) diagrams built using Mermaid.js to help developers understand the Chronicle project's structure, components, and data flow.

## 1. Separate Component Diagrams

### 1.1 Fast API Backend & Frontend Architecture
This diagram outlines how the React dashboard communicates with the FastAPI layer, and subsequently how the backend routes traffic between the database and external LLM services.

```mermaid
graph TD
    subgraph Frontend [Chronicle Frontend React]
        UI[Dashboard / History / Trash Bin]
        Client[API Client lib/api.js]
    end
    
    subgraph Backend [Chronicle Backend FastAPI]
        Router[REST Routers version_control & execution]
        Engine[Prompt Variable Injection Engine]
        DBClient[SQLAlchemy AsyncSession]
    end
    
    subgraph External [External Services]
        OpenAI[OpenAI / Ext LLM APIs]
        PG[(PostgreSQL Database)]
    end

    UI -->|Displays Data| Client
    Client -->|HTTP REST JSON| Router
    Router -->|Constructs Query| DBClient
    Router -->|Sends Prompt & Variables| Engine
    Engine -->|Templated Prompts| OpenAI
    DBClient -->|Asyncpg Session| PG
```

### 1.2 Database Schema (Entity Relationship Diagram)
This captures the core normalized data structures enabling safe branching, aliasing, and historical auditing. Notice the soft-delete (`deleted_at`) pillars introduced to maintain data safety without throwing ORM cascading errors.

```mermaid
erDiagram
    prompts ||--o{ prompt_versions : "owns"
    prompts {
        UUID prompt_id PK
        Text key UK "e.g., login_prompt"
        Text title
        Text description
        UUID created_by
        BigInt production_version_id FK "Active alias pointer"
        DateTime created_at
        DateTime updated_at
        DateTime deleted_at "Soft delete flag"
    }
    prompt_versions ||--o{ alias_history : "referenced by"
    prompt_versions ||--o{ runs : "used in"
    prompt_versions {
        BigInt version_id PK
        UUID prompt_id FK
        Int ordinal "1, 2, 3..."
        Text prompt_text
        JSONB model_settings "temperature, tokens"
        Text change_note
        UUID created_by
        Boolean is_latest
        DateTime deleted_at
    }
    alias_history {
        Int id PK
        UUID prompt_id FK
        BigInt from_version_id FK
        BigInt to_version_id FK
        UUID changed_by
        DateTime changed_at "Audit trail for aliases"
    }
    runs {
        Int run_id PK
        UUID prompt_id FK
        BigInt version_id FK
        Text variables "Injected values"
        JSONB raw_llm_response
        Float cost "Penny cost tracking"
        Float duration_ms
        Boolean success
        String error_message
    }
```

### 1.3 Chronicle CLI Architecture
The CLI is designed to wrap the raw HTTP REST requests into convenient local terminal strings. It relies on environment variables (`API_KEY`) to authenticate to the backend without hardcoding secrets.

```mermaid
graph LR
    User([Developer / CI Server])
        
    subgraph Chronicle CLI
        Parser[Argument Parser: main.py]
        Auth[Header Config & Auth]
        HTTP[Requests Client]
    end
    
    subgraph Remote Server
        FastAPI[Chronicle Backend]
    end

    User -->|python -m chronicle_cli execute| Parser
    Parser -->|Builds Payload| Auth
    Auth -->|Injects API Key| HTTP
    HTTP -->|REST POST /execute| FastAPI
```

---

## 2. Combined Architecture (The Big Picture)

This diagram shows how all clients (the human UI browser, and programmatic CI/CD pipelines using the CLI) converge onto the unified API gateway, interacting safely with the underlying databases and language models while enforcing immutability and tracking spend.

```mermaid
graph TD
    %% Actors
    Admin([Product Manager / Dev])
    System([CI/CD Auto-Runner])
    
    %% Client Layer
    subgraph Client Layer
        React[React Vite Dashboard]
        CLI[Python CLI Tool]
    end
    
    %% Application Layer
    subgraph API Layer FastAPI
        AuthMid[Auth & Telemetry Middleware]
        VC_API[/version_control/ Router]
        Exec_API[/execute/ Router]
        
        Engine[Variable Injection Engine]
        CostCalc[Token/Cost Calculator]
    end
    
    %% Data Layer
    subgraph Data Layer
        ORM[SQLAlchemy Core / ORM]
        Postgres[(PostgreSQL \n Prompts & Runs)]
    end
    
    %% External Integration
    subgraph External
        LLMProvider[OpenAI HTTP API]
    end

    %% Connections
    Admin -->|Manages UI| React
    System -->|Runs cronjobs| CLI
    Admin -->|Tests Prompts| CLI
    
    React -->|HTTP Auth Header| AuthMid
    CLI -->|HTTP Auth Header| AuthMid
    
    AuthMid --> VC_API
    AuthMid --> Exec_API
    
    VC_API --> ORM
    
    Exec_API --> Engine
    Engine -->|Builds pure string| LLMProvider
    LLMProvider -->|Raw Response| Engine
    Engine --> CostCalc
    CostCalc --> ORM
    
    ORM -->|Safe CRUD, Soft Deletes| Postgres
```
