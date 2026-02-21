# Chronicle Frontend Audit & Handover

## 1. High-Level Product Context

**What Chronicle is:**
Chronicle is a specialized version control system designed for managing the lifecycle of LLM prompts. It treats prompts as code artifacts, offering immutable versioning, environment promotion (staging -> production), execution tracking, and performance observability (cost/latency). The system separates the "source code" (prompt text + model parameters) from the "deployment" (alias resolution), allowing safe iteration without breaking downstream consumers.

**Core User Persona:**
The primary user is a **Prompt Engineer** or **ML Engineer** who needs rigorous tooling to iterate on prompts. They are technical, comfortable with JSON configuration, and prioritize reproducibility over simplicity. Secondary users are developers integrating the API who need to inspect logs and debug variable injection issues.

**Primary Workflows:**
1.  **Create Prompt:** Define a unique key and description for a new prompt family.
2.  **Version:** Draft prompt text with `{{variables}}`, configure model parameters (JSON), and commit an immutable version with a change note.
3.  **Promote:** mark a specific version as "Production" to be served by the execution API.
4.  **Execute:** Test the production version directly in the UI by supplying variable values.
5.  **Observe:** Review execution logs, latency trends, and cost metrics to validate performance.

**Status:**
- **Implemented:** Core CRUD for prompts/versions, basic execution loop, charts (cost/latency/tokens), dark/light/matte theming.
- **Planned:** Advanced diffing, deep linking (routing), complex variable types, playground mode.

## 2. Frontend Tech Stack

-   **Framework:** **React 18** (loaded via CDN, *no* build step).
-   **Templating:** `htm` (Hyperscript Tagged Markup) binding for React (no JSX compilation).
-   **Routing System:** **None**. Single Page Application (SPA) using conditional rendering in `MainPanel`. State is reset on refresh.
-   **State Management:** Local React state (`useState`, `useEffect`) lifted to the `App` component. No global store (Redux/Zustand).
-   **API Integration Pattern:** Native `fetch` API. Centralized functions in `App` component (e.g., `fetchPrompts`, `executePrompt`).
-   **Build Tooling:** **None**. Raw ES modules served statically by FastAPI.
-   **Folder Structure:** Flat structure inside `files/`.
-   **Environment Configuration:** Hardcoded API base path (`/api/v1`) relative to origin.

**Note:** The frontend is currently tightly coupled to the serving backend (FastAPI mounts `files/` static directory).

## 3. Current Project Structure (Full Tree)

```text
chronicle/
├── alembic/                 # Database migrations (Python)
├── chronicle_backup/        # Backup artifacts
├── docs/                    # Documentation
├── execution/               # Backend logic for LLM execution
│   ├── llm_service.py
│   ├── models.py
│   ├── pricing.py
│   ├── routes.py
│   ├── schemas.py
│   └── variable_engine.py
├── files/                   # Frontend Source
│   ├── app.js               # Main application logic (React component tree)
│   ├── index.html           # Entry point
│   ├── index_prev.html      # Previous version backup
│   └── style.css            # Design system and styles
├── version_control/         # Backend logic for prompt management
│   ├── alias_history.py
│   ├── models.py
│   ├── routes.py
│   └── schemas.py
├── config.py                # App configuration
├── db.py                    # Database connection
├── main.py                  # FastAPI entry point
├── pyproject.toml           # Python dependencies
└── test_chronicle_full.py   # Integration tests
```

## 4. Current UI Surface Map

There is technically only one "route" (`/gui/index.html`). The UI is composed of three main panels:

**1. Root Layout (Grid)**
*   **Structure:** Header (Top), Sidebar (Left), Main Panel (Center), Timeline Panel (Right).

**2. Sidebar (`Sidebar`)**
*   **Purpose:** Navigation and selection of prompts.
*   **Components:** `PromptItem`, `Skeleton`, `EmptyState`.
*   **Data:** List of prompts (`fetchPrompts`).

**3. Main Panel (`MainPanel`)**
*   **Purpose:** The "Work Area". Shows selected prompt details, version creation, and execution.
*   **Sub-Views:**
    *   **Welcome Screen:** Empty state when no prompt selected.
    *   **Prompt Detail View:**
        *   **Header:** Title, Key, Description, Delete button.
        *   **Editor:** `VersionEditor` (Textarea for prompt, JSON for config, Note input).
        *   **Execution:** `ExecutionPanel` (Variable inputs, Run button, `RunResult`, `RunCharts`).
*   **Data:** Selected prompt metadata, execution history.

**4. Timeline Panel (`TimelinePanel`)**
*   **Purpose:** History and management of versions.
*   **Components:** `VersionCard`, `PromotionHistory`, `MiniSparkline`.
*   **Data:** `versionHistory`, `aliasHistory`, `runHistory` (for sparklines).

**API Endpoints Called:**
-   `GET /api/v1/version-control/prompts`
-   `GET /api/v1/version-control/prompts/{id}`
-   `POST /api/v1/version-control/prompts`
-   `DELETE /api/v1/version-control/prompts/{id}`
-   `POST /api/v1/version-control/versions`
-   `GET /api/v1/version-control/versions/{id}/history`
-   `POST /api/v1/version-control/prompts/{id}/promote`
-   `GET /api/v1/version-control/prompts/{id}/alias-history`
-   `POST /api/v1/execute/{key}`

## 5. Component Inventory

**Primitives:**
*   **`AnimatedNumber`**: Counter animation for metrics. Props: `value`, `prefix`, `suffix`.
*   **`Skeleton`**: Loading state placeholder. Props: `width`, `height`.
*   **`EmptyState`**: Placeholder for empty lists. Props: `icon`, `title`, `sub`.
*   **`Toast`**: Notification popup. Props: `message`, `visible`.
*   **`ThemeSelector`**: Header widget to switch themes. State: LocalStorage.

**Domain Components:**
*   **`ContextWindowBar`**: Visualizes token usage relative to model limit.
*   **`TokenEstimateBar`**: Real-time cost/token estimation under editor.
*   **`CostChart`, `TokenChart`, `LatencyChart`**: Recharts wrappers for run history.
*   **`MiniSparkline`**: Tiny cost trend line for version cards.
*   **`VersionEditor`**: Composite form for new versions (Prompt + Model Config + Notes).
*   **`RunResult`**: Card displaying execution status, metrics, response, and errors.
*   **`VersionCard`**: Complex card showing version info, production status, sparkline, and promote action.
*   **`PromotionHistory`**: List showing audit log of production pointer changes.
*   **`PromptItem`**: Sidebar list item with active state styling.

**Forms:**
*   **`CreatePromptModal`**: Modal with Key, Title, Description fields.
*   **`ConfirmModal`**: Generic destructive action confirmation.

*Most components are defined within `app.js` using `htm`.*

## 6. Design System

**Status:** IMPLEMENTED (CSS Variables in `style.css`).

**Details:**
-   **Themes:** Dark (Default), Light, Matte (Claude-inspired warm dark).
-   **Color Tokens:**
    -   `--accent-primary` (Blue/Amber), `--bg-primary/secondary/tertiary`, `--text-primary/secondary/tertiary`.
    -   Semantic colors: `success` (Green), `danger` (Red), `warning` (Orange).
-   **Typography:**
    -   Display: `Inter` (sans-serif), `Syne` (headers).
    -   Mono: `JetBrains Mono`.
-   **Spacing:** Base 4px scale (`xs`=4px to `2xl`=48px).
-   **Radius:** 6px / 8px.
-   **Motion:** Standard transition durations (150ms, 250ms) and easing curves (`cubic-bezier`).
-   **Shadows:** Layered shadow system (`sm` to `xl`) + colored glows.

## 7. Visual Hierarchy Analysis

-   **Strong Emphasis:**
    -   **Timeline Panel:** Occupies a massive 520px fixed width. Dominates the visual weight.
    -   **Version Cards:** Detailed, high-contrast cards.
    -   **Promotion Badges:** Bright orange/green indicators.
-   **Weak Emphasis:**
    -   **Execution Results:** The actual LLM output is buried in a generic card.
    -   **Variables Input:** Small, unstyled inputs that are critical for execution.
-   **Issues:**
    -   The "New Version" editor competes with the "Execution" panel for attention in the main view.
    -   It feels distinctly like a **DevTool** or database admin interface rather than a creative workbench.
    -   Hierarchy favors *meta-data* (versions, history) over the *content* (prompt text, response).

## 8. Version Control UI Representation

-   **Display:** Vertical list of `VersionCard` components in the right panel (`TimelinePanel`).
-   **Immutability:** Visualized by absence of "Edit" controls on cards. "New Version" form is distinct from the list.
-   **Alias/Promotion:**
    -   "PRODUCTION" badge on the active version.
    -   "Promote" button on non-active versions.
    -   `PromotionHistory` list at the bottom of the timeline.
-   **Diff Support:** **NOT IMPLEMENTED**.
-   **Change Notes:** Displayed as italicized text on the card.

## 9. Execution & Observability UI

-   **Run Display:** `RunResult` component shows the *most recent* run details immediately.
-   **History:** List of previous runs is **NOT IMPLEMENTED**, only aggregated charts are shown. (Correction: `RunResult` shows *latest*, charts show history trend).
-   **Metrics:**
    -   **Latency:** ms (Animated).
    -   **Cost:** USD (6 decimals).
    -   **Tokens:** Prompt / Completion split.
-   **Visibility:**
    -   Response: `pre-wrap` text block.
    -   Raw JSON: Hidden/Not explicitly broken out (though backend returns it).
-   **Filtering/Sorting:** **NOT IMPLEMENTED**.

## 10. Data Visualization

-   **Library:** **Recharts** (React Wrapper for D3).
-   **Charts:**
    -   `CostChart`: Line chart of cost per run.
    -   `TokenChart`: Stacked bar chart (Prompt vs Completion).
    -   `LatencyChart`: Area chart of response time with average line.
    -   `MiniSparkline`: Tiny trend line on version cards.
-   **Location:** `RunCharts` section in `MainPanel`, sparklines in `TimelinePanel`.

## 11. UX Friction Points

1.  **No URL Routing:** Refreshing the page returns to the "Welcome" screen. You lose your context.
2.  **JSON Config:** Model settings require valid JSON manual entry. Error-prone.
3.  **Variable Injection:** Friction in parsing variables. You have to type `{{var}}` in the prompt, then the input field appears.
4.  **Disconnect:** Execution happens in the main panel, but the "Version" it runs is defined by a pointer in the *Timeline* panel. This spatial separation is confusing.
5.  **Scrolling:** Long prompt histories make the timeline hard to manage without search/filter.

## 12. Constraints

-   **No Build Step:** The redesign must either stick to the ESM/CDN approach OR introduce a build step (Vite recommended). If adhering to current architecture: cannot use `.jsx`, must use `htm` or `React.createElement`.
-   **Backend Coupling:** The frontend files are served by FastAPI.
-   **Immutability:** The UI must never offer an "Edit" button for an existing version ID. Meaningful edits *must* create new `version_id`s.
-   **Promotion Logic:** Execution *always* runs the version pointed to by `production_version_id`. The UI must respect this indirection.

## 13. Intent of Chronicle (Core Philosophy)

-   **Feel:** **Infrastructure-grade**. Solid, reliable, precise. "Git for Prompts".
-   **NOT:** A playful chatbot or a consumer app.
-   **Philosophy:** "Prompts are Code." They have versions, they have deployments, they have performance characteristics. The UI should reinforce discipline (committing changes, promoting to prod) rather than casual tweaking.

## 14. Gaps Between Current UI and Premium DevTool UX

1.  **Polish:** Current UI uses basic CSS borders. Premium tools use subtle glassmorphism, noise textures, and refined depth.
2.  **Layout:** The 3-column layout is rigid. VSCode-style distinct panes (draggable/collapsible) creates better density.
3.  **Input UX:** JSON config should be a structured form or key-value editor, not a raw text area.
4.  **Feedback:** Loading states are skeletons (good), but transitions between runs/prompts feel abrupt.
5.  **Navigation:** Lack of tabs or breadcrumbs makes deep navigation impossible.

## 15. Wireframe Description

Current Spatial Layout:

```
[ Header (Theme Toggle)                                        ]
[ Sidebar (240px) ] [ Main Panel (Flex)      ] [ Timeline (520px) ]
[ List of Prompts ] [ Title / Delete Btn     ] [ Stats Header     ]
[                 ] [                        ] [ Version List...  ]
[                 ] [ New Version Editor     ] [   [Card v3]      ]
[                 ] [   [Textarea]           ] [   [Card v2]      ]
[                 ] [   [Settings JSON]      ] [                  ]
[                 ] [                        ] [ Promotion Hist.  ]
[                 ] [ Execution Panel        ] [                  ]
[                 ] [   [Vars] [Run Btn]     ] [                  ]
[                 ] [   [Result Card]        ] [                  ]
[                 ] [   [Charts Row]         ] [                  ]
```

## Summary of Architectural Invariants

1.  **Immutability:** Never allow modification of a `version_id`.
2.  **Production Indirection:** Execution calls via `key`, resolving to `production_version_id`. The UI must enforce that you can only "Execute" what is "Promoted" (or explicitly test a draft, but the mental model centers on the promoted version).
3.  **Variable Strictness:** Variables in `{{braces}}` must be parsed and supplied before execution.
4.  **State Isolation:** Prompt settings (model/temp) are bound to the *Version*, not the *Prompt*. The UI must reflect that changing the model creates a new version.
5.  **API Contract:** All calls must include `X-API-Key`.

## Opportunities Unlocked by Redesign

1.  **Real Routing:** Introduce `react-router` (hash or history mode) to enable deep linking to specific prompts (`/prompt/:id`).
2.  **Structured Config:** Replace raw JSON editing with a proper UI for Model/Temperature/StopSequences.
3.  **Comparison View:** Use the screen real estate to show side-by-side diffs of versions.
4.  **Playground Mode:** A dedicated "scratchpad" mode that allows testing without committing a version first.
5.  **Glassmorphism:** Leveraging the dark theme foundation to add premium vibrancy and depth.
