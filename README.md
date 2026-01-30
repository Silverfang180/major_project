# PromptPilot & Chronicle 🚀

This repository contains the full source code for the "PromptPilot" major project.

## Structure

It is organized into two main parts:

### 1. Frontend (Root)
Built with **React, Vite, TailwindCSS, and Shadcn/UI**.
- **`src/`**: Contains the UI logic, components (`PromptEditor`, `VersionHistory`), and API client.
- **`public/`**: Static assets.
- **Configuration**: `vite.config.ts`, `tailwind.config.js`, `tsconfig.json`, `package.json` (Required for building and running the web app).

### 2. Backend (`/chronicle`)
Built with **Python, FastAPI, Gemini, and Groq**.
- Located in the `chronicle/` folder.
- Handles database (PostgreSQL), AI simulations, and Version Control logic.

## How to Run

1.  **Start Backend**:
    ```bash
    cd chronicle
    docker-compose up -d
    ```

2.  **Start Frontend**:
    ```bash
    # (From root)
    npm run dev
    ```

Open [http://localhost:5173](http://localhost:5173) to view the app.
