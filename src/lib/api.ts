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

export async function getIdentity(): Promise<string> {
    const storedUser = localStorage.getItem('chronicle-user');
    if (storedUser) {
        try {
            const user = JSON.parse(storedUser);
            if (user.id) return user.id;
        } catch (e) {
            console.error("Failed to parse stored user", e);
        }
    }
    
    // Fallback for unauthenticated access (e.g., before login is complete)
    return 'anonymous-session';
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
    prompt_title?: string;
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
    // compare/leaderboard response shape (from EvalSummary)
    model?: string;
    accuracy?: number;
    cost_per_correct?: number | null;
    p50_latency_ms?: number;
    p95_latency_ms?: number;
    total_cost?: number;
    total_examples?: number;
    is_pareto_optimal?: boolean;
    is_knee_point?: boolean;
    rank?: number;
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
    summary: EvalJobSummary | null;
    // Backend returns meta object (calibration data), not a flat array
    meta?: {
        meta_id: string;
        job_id: string;
        calibration_metrics: any;
        created_at: string;
        updated_at: string;
    } | null;
    results: EvalResultResponse[];
    result_count: number;
    correct_count: number;
    incorrect_count: number;
    unscored_count: number;
}

export interface CompareResponse {
    dataset_id: string;
    compared_jobs: number;
    pareto_optimal_count: number;
    knee_point_job_id: string | null;
    recommendation: string;
    jobs: EvalJobResponse[];   // frontier_results from backend (EvalSummary-based)
    computed_at: string;
}

export interface AliasHistoryEntry {
    id: number;
    prompt_id: string;
    from_version_id: number | null;
    to_version_id: number;
    changed_by?: string;
    changed_at: string;
}

export interface DashboardResponse {
    total_prompts: number;
    total_versions: number;
    total_runs: number;
    total_eval_jobs: number;
    total_datasets: number;
    total_cost_usd: number;
    avg_performance?: number;
    trend?: { day: string, cost: number, runs: number }[];
}

// ---------- Helpers ----------

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
    const token = localStorage.getItem('chronicle-token');
    const geminiKey = localStorage.getItem('chronicle-key-Google Gemini');
    const groqKey = localStorage.getItem('chronicle-key-Groq');
    
    const res = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            'X-Chronicle-Env': localStorage.getItem('chronicle-env') || 'production',
            'X-Chronicle-User': await getIdentity(),
            ...(geminiKey ? { 'X-Gemini-Key': geminiKey } : {}),
            ...(groqKey ? { 'X-Groq-Key': groqKey } : {}),
            ...(options?.headers || {}),
        },
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        let errorMsg = text;
        try {
            const parsed = JSON.parse(text);
            errorMsg = parsed.detail || text;
        } catch { /* use status text */ }
        throw new Error(errorMsg || res.statusText);
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

    async createPrompt(key: string, title: string, createdBy?: string, description?: string): Promise<PromptResponse> {
        const identity = createdBy || await getIdentity();
        return apiFetch(`${VC_BASE}/prompts`, {
            method: 'POST',
            body: JSON.stringify({ key, title, created_by: identity, description }),
        });
    },

    async deletePrompt(promptId: string, permanent = false): Promise<void> {
        const url = `${VC_BASE}/prompts/${promptId}${permanent ? '?permanent=true' : ''}`;
        await apiFetch(url, { method: 'DELETE' });
    },

    async deleteVersion(versionId: number, permanent = false): Promise<void> {
        const url = `${VC_BASE}/versions/${versionId}${permanent ? '?permanent=true' : ''}`;
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

    async getTrashedVersions(): Promise<VersionResponse[]> {
        return apiFetch(`${VC_BASE}/versions/trash/all`);
    },

    async restoreVersion(versionId: number): Promise<any> {
        return apiFetch(`${VC_BASE}/versions/${versionId}/restore`, { method: 'POST' });
    },

    async getTrashedDatasets(): Promise<DatasetResponse[]> {
        return apiFetch(`${EVAL_BASE}/datasets/trash/all`);
    },

    async restoreDataset(datasetId: string): Promise<any> {
        return apiFetch(`${EVAL_BASE}/datasets/${datasetId}/restore`, { method: 'POST' });
    },

    // Execution
    async executePrompt(promptKey: string, variables: Record<string, any> = {}): Promise<RunResponse> {
        return apiFetch(`${EXEC_BASE}/execute/${promptKey}`, {
            method: 'POST',
            body: JSON.stringify({ variables }),
        });
    },

    async runSimulation(promptText: string, provider: string, model: string, variables: Record<string, any> = {}): Promise<any> {
        return apiFetch(`${EXEC_BASE}/simulate`, {
            method: 'POST',
            body: JSON.stringify({
                prompt_text: promptText,
                provider,
                model,
                input_vars: variables
            }),
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

    async deleteDataset(datasetId: string, permanent = false): Promise<void> {
        const url = `${EVAL_BASE}/datasets/${datasetId}${permanent ? '?permanent=true' : ''}`;
        await apiFetch(url, { method: 'DELETE' });
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
    async getCompare(datasetId: string, dimension: string = "cost"): Promise<CompareResponse> {
        return apiFetch(`${EVAL_BASE}/compare/dataset/${datasetId}?dimension=${dimension}`);
    },

    async compareJobs(jobIds: string[]): Promise<CompareResponse> {
        return apiFetch(`${EVAL_BASE}/compare`, {
            method: 'POST',
            body: JSON.stringify({ job_ids: jobIds }),
        });
    },

    async getDashboard(): Promise<DashboardResponse> {
        return apiFetch(`${EVAL_BASE}/dashboard`);
    },

    async getLeaderboard(datasetId: string): Promise<any[]> {
        return apiFetch(`${EVAL_BASE}/datasets/${datasetId}/leaderboard`);
    },

    // Auth
    async login(email: string, password: string): Promise<any> {
        const data: any = await apiFetch(`${EXEC_BASE}/auth/login`, {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        if (data?.access_token) {
            localStorage.setItem('chronicle-token', data.access_token);
        }
        return data;
    },

    async register(email: string, password: string, name: string): Promise<any> {
        const data: any = await apiFetch(`${EXEC_BASE}/auth/register`, {
            method: 'POST',
            body: JSON.stringify({ email, password, name }),
        });
        if (data?.access_token) {
            localStorage.setItem('chronicle-token', data.access_token);
        }
        return data;
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
    
    async getPricing(): Promise<any[]> {
        return apiFetch(`${EXEC_BASE}/pricing`);
    },

    async getApiKeys(): Promise<any[]> {
        return apiFetch(`${EXEC_BASE}/config/keys`);
    },

    // updateApiKey removed for security - config managed via .env

    async uploadExamplesCsv(dataset_id: string, file: File): Promise<any> {
        const formData = new FormData();
        formData.append('file', file);
        
        const token = localStorage.getItem('chronicle-token');
        const res = await fetch(`${EVAL_BASE}/datasets/${dataset_id}/examples/upload-csv`, {
            method: 'POST',
            headers: {
                ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                'X-Chronicle-User': await getIdentity(),
            },
            body: formData,
        });
        
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Upload failed: ${text}`);
        }
        return res.json();
    },

    async getMetricsSummary(): Promise<any> {
        return apiFetch(`${EXEC_BASE}/metrics/summary`);
    },

    // Health
    async getHealth(): Promise<{ status: string }> {
        return apiFetch('/health');
    },
};
