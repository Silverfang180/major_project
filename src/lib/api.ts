import type { Version } from './mockData';

const API_BASE = '/api/v1/version-control';

// Backend types
interface PromptResponse {
    prompt_id: string;
    key: string;
    title: string;
    created_by: string;
    created_at: string;
    latest_version?: VersionResponse;
}

interface VersionResponse {
    version_id: number;
    prompt_id: string;
    ordinal: number;
    prompt_text: string;
    change_note?: string;
    created_at: string;
    created_by: string;
    is_latest: boolean;
    model_settings: Record<string, any>;
}

interface SimulationResponse {
    response: string;
    usage: {
        input_tokens: number;
        output_tokens: number;
        total_cost: number;
    };
}

// Frontend types (mapping to what UI expects)
export const api = {
    async getPrompts() {
        const res = await fetch(`${API_BASE}/prompts`);
        if (!res.ok) throw new Error('Failed to fetch prompts');
        return res.json() as Promise<PromptResponse[]>;
    },

    async createPrompt(key: string, title: string, createdBy: string) {
        const res = await fetch(`${API_BASE}/prompts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, title, created_by: createdBy })
        });
        if (!res.ok) throw new Error('Failed to create prompt');
        return res.json() as Promise<PromptResponse>;
    },

    async getVersions(promptId: string) {
        const res = await fetch(`${API_BASE}/versions/${promptId}/history`);
        if (!res.ok) throw new Error('Failed to fetch history');
        const data = await res.json() as VersionResponse[];

        // Adapt to frontend Version interface
        return data.map(v => ({
            id: `v${v.ordinal}.0`,
            db_id: v.version_id, // Store real ID
            date: new Date(v.created_at).toISOString().split('T')[0],
            author: 'You', // TODO: Map user ID to name
            status: v.is_latest ? 'Production' : 'Draft',
            cost: v.model_settings?.usage?.total_cost ? `$${v.model_settings.usage.total_cost.toFixed(6)}` : 'N/A',
            accuracy: 'N/A',
            // Ensure text is string (handle nulls if DB had bad constraint before)
            text: v.prompt_text || "",
        })) as Version[];
    },

    async createVersion(promptId: string, text: string, createdBy: string, usage?: any) {
        const res = await fetch(`${API_BASE}/versions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt_id: promptId,
                prompt_text: text,
                created_by: createdBy,
                model_settings: usage ? { usage } : {}
            })
        });
        if (!res.ok) throw new Error('Failed to create version');
        return res.json();
    },

    async runSimulation(text: string, provider: string = 'gemini', model: string = 'gemini-flash-latest') {
        const res = await fetch(`${API_BASE}/simulate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt_text: text,
                provider,
                model
            })
        });
        if (!res.ok) throw new Error("Simulation failed");
        return res.json() as Promise<SimulationResponse>;
    },

    async deleteVersion(versionId: number) {
        const res = await fetch(`${API_BASE}/versions/${versionId}`, {
            method: 'DELETE'
        });
        if (!res.ok) throw new Error("Failed to delete version");
    },

    async deletePrompt(promptId: string) {
        const res = await fetch(`${API_BASE}/prompts/${promptId}`, {
            method: 'DELETE'
        });
        if (!res.ok) throw new Error("Failed to delete prompt");
    },

    async updatePrompt(promptId: string, title: string) {
        // We reuse PromptCreate schema structure (key, title, created_by)
        // Ideally should have a specific PATCH schema, but this works if we pass dummy data for others
        const res = await fetch(`${API_BASE}/prompts/${promptId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title,
                key: "ignored",
                created_by: "00000000-0000-0000-0000-000000000000"
            })
        });
        if (!res.ok) throw new Error("Failed to update prompt");
        return res.json();
    }
};
