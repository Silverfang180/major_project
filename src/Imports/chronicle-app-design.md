Design a production-grade AI PromptOps web application called Chronicle built with React + TypeScript + TailwindCSS.

The product is a LangSmith/Humanloop-style LLM engineering platform with:

Prompt version control

Production alias promotion

Execution tracking (latency + cost)

Dataset management

Evaluation jobs (background processing)

A/B testing

Model comparisons

Pareto frontier analysis

The design must be component-driven and suitable for React implementation.

The UI should feel:

Enterprise-grade

Technical and minimal

Data-dense but readable

Built for AI engineers and ML teams

Default theme: Dark
Built using Tailwind utility-first spacing system (8px grid).
Rounded corners: rounded-xl style.
Soft shadows (shadow-lg, shadow-indigo-500/10).
Typography: Inter.
Accent color: Indigo / Electric Blue.

🧱 React Component Architecture (Design Must Reflect This)

Design UI structured around reusable components:

<AppLayout />

<Sidebar />

<Topbar />

<PageContainer />

<DataTable />

<StatCard />

<Modal />

<Badge />

<Tabs />

<ChartCard />

<InspectorDrawer />

Each page must look like it is built from reusable Tailwind components.

🖥️ Main Layout
Structure
Sidebar (fixed, 260px)
Topbar (sticky)
Main Content (scrollable)
Right Inspector Drawer (optional, collapsible)
Sidebar Navigation

Sections:

PromptOps

Prompts

Versions

Runs

Evaluation

Datasets

Eval Jobs

A/B Tests

Model Comparisons

Pareto Analysis

System

Monitor

Settings

Active item:

Indigo background

Left accent border

Subtle glow

📄 PAGE 1 — PROMPTS (Version Control UI)

Based on your /version-control/ backend 

ARCHITECTURE

Layout

Top Actions Row:

Create Prompt (Primary Button)

Search input

Filter dropdown

Main Table (React <DataTable /> style):

Columns:

Prompt Key

Title

Production Version

Total Versions

Updated At

Actions

Row hover:

hover:bg-slate-800

Prompt Detail Page

Tabs:

Versions

Alias History

Runs

Versions Tab

Table:

Version ID

Ordinal

Model Settings (JSON badge)

is_latest badge

Promote button

Promote button:

Small indigo outline button

⚡ PAGE 2 — RUNS (Execution Logs)

Reflecting your Run model (latency_ms, cost_usd, status) 

ARCHITECTURE

Top Section:
4 StatCards:

Total Runs

Avg Latency

Total Cost

Error Rate

Below:
Line chart → Latency over time
Bar chart → Cost per run
Donut chart → Success vs Failed

Main Table:

Timestamp

Prompt

Version

Model

Latency

Cost

Status badge

Click row → open <InspectorDrawer />

Drawer shows:

Rendered Prompt

Variables JSON

Full Model Response

Token usage

Retry attempts

📊 PAGE 3 — DATASETS

Based on Dataset and DatasetExample models 

ARCHITECTURE

Left Sidebar Panel:

Dataset list

“+ New Dataset” button

Main Area:
Dataset Header:

Name

Task Type

Example Count

Delete button

Examples Table:

Example ID

input_vars (code preview)

expected_output

Actions

Add Example Modal:

JSON editor style UI

Save + Cancel

🧪 PAGE 4 — EVAL JOBS

Reflecting background orchestrator flow 

ARCHITECTURE

Top:
“Create Eval Job” button

Create Job Modal:

Select Prompt (dropdown)

Select Version

Select Dataset

Select Evaluators (checkboxes)

Main Table:

Job ID

Prompt

Dataset

Status

Accuracy

Total Cost

Created At

Status badge variants:

Pending → Gray

Running → Blue pulse

Completed → Green

Failed → Red

Click job → navigate to detailed analytics page.

📈 PAGE 5 — EVAL ANALYTICS

Top KPI Cards:

Accuracy %

Avg LLM Judge Score

Calibration Error

Total Cost

Charts:

Accuracy vs Example Index

Cost per Example

Confidence Calibration Curve

LLM Judge Score Distribution

Below:
Results DataTable:

Example ID

Actual Output

Exact Match (✔ / ✖)

LLM Judge Score

Confidence Score

⚖️ PAGE 6 — A/B TESTS

Comparison Layout:

Header:

Test Name

Prompt

Dataset

Charts:

Accuracy comparison bar chart

Cost comparison bar chart

Calibration comparison

Winner badge:

“Best Accuracy”

“Best Cost Efficient”

Use side-by-side comparison cards.

🧠 PAGE 7 — MODEL COMPARISONS

Compare models (Groq, Gemini, OpenAI).

Design:

Model selector pills

Multi-line accuracy chart

Latency comparison chart

Cost comparison chart

Each model displayed as color-coded legend item.

🔺 PAGE 8 — PARETO ANALYSIS

Research-style layout.

Main Scatter Plot:

X-axis → Cost

Y-axis → Accuracy

Points → Eval Jobs

Highlight Pareto frontier

Right Panel:
Recommendation cards:

Best Accuracy

Best Cost

Best Calibration

Pareto Optimal

Make this page feel analytical and intelligent.

📡 PAGE 9 — MONITOR

System-level observability dashboard.

Charts:

Runs per day

Provider usage breakdown

Total spend over time

Error rate trend

Provider breakdown:

Groq

Gemini

OpenAI

⚙️ SETTINGS PAGE

Theme selector (Dark / Light / Matte)

API Key status

Model pricing table

Environment badge (Dev / Prod)

🎨 Tailwind Design Guidelines

Use Tailwind-style spacing and layout logic:

bg-slate-900

text-slate-200

border-slate-700

rounded-xl

shadow-lg

hover:bg-slate-800

px-6 py-4

space-y-6

grid grid-cols-4 gap-6

Buttons:

Primary → bg-indigo-600 hover:bg-indigo-500

Secondary → border border-slate-600

Badges:

Success → bg-emerald-500/10 text-emerald-400

Error → bg-rose-500/10 text-rose-400

🧠 Final Instruction to Figma AI

This design must be directly implementable in React + Tailwind.
Avoid absolute positioning-heavy layouts.
Use component-based sections that map cleanly to reusable React components.
The UI should communicate experimentation, observability, and AI engineering maturity.