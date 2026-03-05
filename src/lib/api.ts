// Chronicle API Client
// All calls go through the Vite proxy (/api -> http://127.0.0.1:8000/api)

const VC_BASE = '/api/v1/version-control';
const EXEC_BASE = '/api/v1';
const EVAL_BASE = '/api/v1/eval';

// ---------- SHA-256 Identity ----------

async function sha256(message: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

let _cachedIdentity: string | null = null;

// Generate or retrieve a persistent identity hash based on browser fingerprint
export async function getIdentity(): Promise<string> {
    if (_cachedIdentity) return _cachedIdentity;

    // Check localStorage for a previously generated identity
    const stored = localStorage.getItem('chronicle-identity');
    if (stored && stored.length === 64) {
        _cachedIdentity = stored;
        return stored;
    }

    // Generate a fingerprint from browser environment
    const fingerprint = [
        navigator.userAgent,
        screen.width + 'x' + screen.height,
        Intl.DateTimeFormat().resolvedOptions().timeZone,
        new Date().getTimezoneOffset().toString(),
        crypto.randomUUID(),  // ensures uniqueness per device
    ].join('|');

    const hash = await sha256(fingerprint);
    localStorage.setItem('chronicle-identity', hash);
    _cachedIdentity = hash;
    return hash;
}

// ---------- Types ----------

export interface PromptResponse {
    prompt_id: string;
    key: string;
    title: string;
    created_by: string;
    created_at: string;
    updated_at?: string;
    deleted_at?: string | null;
    production_version_id?: number | null;
    latest_version?: VersionResponse;
}

export interface VersionResponse {
    version_id: number;
    prompt_id: string;
    ordinal: number;
    prompt_text: string;
    change_note?: string;
    created_at: string;
    created_by: string;
    is_latest: boolean;
    model_settings: Record<string, any>;
    deleted_at?: string | null;
}

export interface RunResponse {
    run_id: number;
    prompt_key: string;
    version_id: number;
    status: 'pending' | 'success' | 'error';
    model: string;
    input_vars?: Record<string, any>;
    rendered_prompt?: string;
    raw_response?: Record<string, any>;
    cost_usd?: number | null;
    latency_ms?: number;
    error_detail?: string;
    created_at: string;
}

export interface DatasetResponse {
    dataset_id: string;
    name: string;
    description?: string;
    task_type: string;
    created_at: string;
    deleted_at?: string | null;
    example_count?: number;
}

export interface ExampleResponse {
    example_id: number;
    dataset_id: string;
    input_vars: Record<string, any>;
    expected_output: string;
    source_tag?: string | null;
    created_at: string;
    deleted_at?: string | null;
}

export interface EvalJobResponse {
    job_id: string;
    prompt_id: string;
    prompt_key?: string;
    version_id: number;
    dataset_id: string;
    dataset_name?: string;
    evaluators: string[];
    status: 'pending' | 'running' | 'completed' | 'failed';
    created_at: string;
    completed_at?: string | null;
    summary?: EvalJobSummary | null;
}

export interface EvalJobSummary {
    accuracy?: number;
    mean_evaluator_score?: number;
    cost_per_correct?: number | null;
    p50_latency_ms?: number;
    p95_latency_ms?: number;
    mce?: number | null;
    total_cost?: number;
    total_examples?: number;
}

export interface EvalResultResponse {
    result_id: string;
    job_id: string;
    example_id: string;
    run_id: string;
    actual_output: string;
    is_correct: boolean;
    evaluator_scores: Record<string, number>;
    confidence?: number | null;
    created_at: string;
}

export interface EvalJobReportResponse {
    job: EvalJobResponse;
    summary: EvalJobSummary;
    results: EvalResultResponse[];
    calibration_data?: any[];
}

export interface CompareResponse {
    dataset_id: string;
    dataset_name: string;
    jobs: EvalJobResponse[];
    pareto_frontier: any[];
    knee_point: any | null;
    recommendation: string;
}

export interface AliasHistoryEntry {
    id: number;
    prompt_id: string;
    version_id: number;
    ordinal: number;
    promoted_at: string;
    promoted_by?: string;
}

export interface DashboardResponse {
    total_prompts: number;
    total_versions: number;
    total_runs: number;
    total_eval_jobs: number;
    total_datasets: number;
    total_cost_usd: number;
}

// ---------- Helpers ----------

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': 'chronicle-dev-key',
            ...(options?.headers || {}),
        },
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`API error ${res.status}: ${text || res.statusText}`);
    }
    // Handle 204 No Content
    if (res.status === 204) return undefined as unknown as T;
    return res.json() as Promise<T>;
}

// ---------- Version Control API ----------

export const api = {
    // Prompts
    async getPrompts(): Promise<PromptResponse[]> {
        return apiFetch(`${VC_BASE}/prompts`);
    },

    async getPrompt(promptId: string): Promise<PromptResponse> {
        return apiFetch(`${VC_BASE}/prompts/${promptId}`);
    },

    async createPrompt(key: string, title: string, createdBy?: string): Promise<PromptResponse> {
        const identity = createdBy || await getIdentity();
        return apiFetch(`${VC_BASE}/prompts`, {
            method: 'POST',
            body: JSON.stringify({ key, title, created_by: identity }),
        });
    },

    async deletePrompt(promptId: string, permanent = false): Promise<void> {
        const url = `${VC_BASE}/prompts/${promptId}${permanent ? '?permanent=true' : ''}`;
        await apiFetch(url, { method: 'DELETE' });
    },

    async promoteVersion(promptId: string, versionId: number): Promise<any> {
        return apiFetch(`${VC_BASE}/prompts/${promptId}/promote`, {
            method: 'POST',
            body: JSON.stringify({ version_id: versionId }),
        });
    },

    async getAliasHistory(promptId: string): Promise<AliasHistoryEntry[]> {
        return apiFetch(`${VC_BASE}/prompts/${promptId}/alias-history`);
    },

    // Versions
    async getVersions(promptId: string): Promise<VersionResponse[]> {
        return apiFetch(`${VC_BASE}/versions/${promptId}/history`);
    },

    async getLatestVersion(promptId: string): Promise<VersionResponse> {
        return apiFetch(`${VC_BASE}/versions/latest/${promptId}`);
    },

    async createVersion(
        promptId: string,
        promptText: string,
        createdBy?: string,
        modelSettings?: Record<string, any>
    ): Promise<VersionResponse> {
        const identity = createdBy || await getIdentity();
        return apiFetch(`${VC_BASE}/versions`, {
            method: 'POST',
            body: JSON.stringify({
                prompt_id: promptId,
                prompt_text: promptText,
                created_by: identity,
                model_settings: modelSettings || {},
            }),
        });
    },

    // Trash
    async getTrashedPrompts(): Promise<PromptResponse[]> {
        return apiFetch(`${VC_BASE}/prompts/trash/all`);
    },

    async restorePrompt(promptId: string): Promise<any> {
        return apiFetch(`${VC_BASE}/prompts/${promptId}/restore`, { method: 'POST' });
    },

    // Execution
    async executePrompt(promptKey: string, variables: Record<string, any> = {}): Promise<RunResponse> {
        return apiFetch(`${EXEC_BASE}/execute/${promptKey}`, {
            method: 'POST',
            body: JSON.stringify({ variables }),
        });
    },

    // ---------- Eval API ----------

    // Datasets
    async getDatasets(): Promise<DatasetResponse[]> {
        return apiFetch(`${EVAL_BASE}/datasets`);
    },

    async getDataset(datasetId: string): Promise<DatasetResponse> {
        return apiFetch(`${EVAL_BASE}/datasets/${datasetId}`);
    },

    async createDataset(name: string, description: string, taskType: string): Promise<DatasetResponse> {
        const identity = await getIdentity();
        return apiFetch(`${EVAL_BASE}/datasets`, {
            method: 'POST',
            body: JSON.stringify({ name, description, task_type: taskType, created_by: identity }),
        });
    },

    async deleteDataset(datasetId: string): Promise<void> {
        await apiFetch(`${EVAL_BASE}/datasets/${datasetId}`, { method: 'DELETE' });
    },

    async getExamples(datasetId: string): Promise<ExampleResponse[]> {
        return apiFetch(`${EVAL_BASE}/datasets/${datasetId}/examples`);
    },

    async addExample(datasetId: string, inputVars: Record<string, any>, expectedOutput: string): Promise<ExampleResponse> {
        return apiFetch(`${EVAL_BASE}/datasets/${datasetId}/examples`, {
            method: 'POST',
            body: JSON.stringify({ input_vars: inputVars, expected_output: expectedOutput }),
        });
    },

    async deleteExample(exampleId: string): Promise<void> {
        await apiFetch(`${EVAL_BASE}/examples/${exampleId}`, { method: 'DELETE' });
    },

    // Eval Jobs
    async getEvalJobs(): Promise<EvalJobResponse[]> {
        return apiFetch(`${EVAL_BASE}/jobs`);
    },

    async getEvalJob(jobId: string): Promise<EvalJobResponse> {
        return apiFetch(`${EVAL_BASE}/jobs/${jobId}`);
    },

    async createEvalJob(
        promptId: string,
        versionId: number,
        datasetId: string,
        evaluators: string[]
    ): Promise<EvalJobResponse> {
        const identity = await getIdentity();
        return apiFetch(`${EVAL_BASE}/jobs`, {
            method: 'POST',
            body: JSON.stringify({
                prompt_id: promptId,
                version_id: versionId,
                dataset_id: datasetId,
                evaluators,
                created_by: identity,
            }),
        });
    },

    async getEvalJobReport(jobId: string): Promise<EvalJobReportResponse> {
        return apiFetch(`${EVAL_BASE}/jobs/${jobId}/report`);
    },

    // Comparison & Dashboard
    async getCompare(datasetId: string): Promise<CompareResponse> {
        return apiFetch(`${EVAL_BASE}/compare/dataset/${datasetId}`);
    },

    async getDashboard(): Promise<DashboardResponse> {
        return apiFetch(`${EVAL_BASE}/dashboard`);
    },

    async getLeaderboard(datasetId: string): Promise<any[]> {
        return apiFetch(`${EVAL_BASE}/datasets/${datasetId}/leaderboard`);
    },

    // Runs (from execution module)
    async getRuns(): Promise<RunResponse[]> {
        const raw: any[] = await apiFetch(`${EXEC_BASE}/runs`);
        return raw.map(r => ({
            ...r,
            model: r.raw_response?.model || 'unknown',
            error_detail: r.error_message || undefined,
        }));
    },

    // Health
    async getHealth(): Promise<{ status: string }> {
        return apiFetch('/health');
    },
};
