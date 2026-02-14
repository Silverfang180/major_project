// -------------------------------------------------------------------
// Chronicle — app.js
// -------------------------------------------------------------------
const VC = 'http://localhost:8000/api/v1/version-control';
const EXEC = 'http://localhost:8000/api/v1';
const API_HEADERS = { 'X-API-Key': 'chronicle-dev-key' };

// Client-side pricing mirror for "Est. Cost" display
const MODEL_PRICING = {
    "llama-3.3-70b-versatile": { input_cost_per_1k: 0.00059, output_cost_per_1k: 0.00079 },
    "llama-3.1-8b-instant": { input_cost_per_1k: 0.00005, output_cost_per_1k: 0.00008 },
    "llama3-70b-8192": { input_cost_per_1k: 0.00059, output_cost_per_1k: 0.00079 },
    "mixtral-8x7b-32768": { input_cost_per_1k: 0.00024, output_cost_per_1k: 0.00024 },
    "gemma2-9b-it": { input_cost_per_1k: 0.00020, output_cost_per_1k: 0.00020 },
};

const state = {
    prompts: [],
    selectedPromptId: null,
    selectedPrompt: null,
    versionHistory: [],
    aliasHistory: [],
    runHistory: [],       // client-side session runs
    confirmCallback: null,
    userEditedKey: false
};

// -------------------------------------------------------------------
// DOM elements
// -------------------------------------------------------------------
const elements = {
    healthDot: document.getElementById('healthDot'),
    healthText: document.getElementById('healthText'),
    promptList: document.getElementById('promptList'),
    welcomeScreen: document.getElementById('welcomeScreen'),
    loadingState: document.getElementById('loadingState'),
    promptView: document.getElementById('promptView'),
    timelinePanel: document.getElementById('timelinePanel'),
    promptKey: document.getElementById('promptKey'),
    promptTitle: document.getElementById('promptTitle'),
    promptDescription: document.getElementById('promptDescription'),
    promptText: document.getElementById('promptText'),
    modelSettings: document.getElementById('modelSettings'),
    changeNote: document.getElementById('changeNote'),
    versionCount: document.getElementById('versionCount'),
    versionList: document.getElementById('versionList'),
    btnCreatePrompt: document.getElementById('btnCreatePrompt'),
    btnSaveVersion: document.getElementById('btnSaveVersion'),
    btnDeletePrompt: document.getElementById('btnDeletePrompt'),
    createPromptModal: document.getElementById('createPromptModal'),
    confirmModal: document.getElementById('confirmModal'),
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toastMessage'),
    themeToggle: document.getElementById('themeToggle'),
    // Execution
    executionSection: document.getElementById('executionSection'),
    variableInputs: document.getElementById('variableInputs'),
    btnExecute: document.getElementById('btnExecute'),
    execModel: document.getElementById('execModel'),
    runResult: document.getElementById('runResult'),
    runIdValue: document.getElementById('runIdValue'),
    runStatusValue: document.getElementById('runStatusValue'),
    runLatencyValue: document.getElementById('runLatencyValue'),
    runCostValue: document.getElementById('runCostValue'),
    runTokensValue: document.getElementById('runTokensValue'),
    runResponseValue: document.getElementById('runResponseValue'),
    runResponseBlock: document.getElementById('runResponseBlock'),
    runErrorBlock: document.getElementById('runErrorBlock'),
    runErrorValue: document.getElementById('runErrorValue'),
    runStatus: document.getElementById('runStatus'),
    runHistorySection: document.getElementById('runHistorySection'),
    runHistoryList: document.getElementById('runHistoryList'),
    // Alias History
    aliasHistorySection: document.getElementById('aliasHistorySection'),
    aliasHistoryList: document.getElementById('aliasHistoryList'),
};

// -------------------------------------------------------------------
// Utilities
// -------------------------------------------------------------------
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message) {
    elements.toastMessage.textContent = message;
    elements.toast.classList.add('show');
    setTimeout(() => { elements.toast.classList.remove('show'); }, 3000);
}

function extractPlaceholders(text) {
    const matches = text.match(/\{\{(\w+)\}\}/g);
    if (!matches) return [];
    return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))];
}

function calculateCostClient(model, promptTokens, completionTokens) {
    const pricing = MODEL_PRICING[model];
    if (!pricing) return null;
    return (promptTokens / 1000 * pricing.input_cost_per_1k) +
        (completionTokens / 1000 * pricing.output_cost_per_1k);
}

function generateKey(title) {
    const slug = title.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 50);
    const suffix = Math.random().toString(36).substring(2, 8);
    return slug ? `${slug}-${suffix}` : suffix;
}

function formatCost(cost) {
    if (cost === null || cost === undefined) return 'N/A';
    return '$' + cost.toFixed(6);
}

// -------------------------------------------------------------------
// Health
// -------------------------------------------------------------------
async function checkHealth() {
    try {
        const response = await fetch(`${VC}/prompts`, { headers: API_HEADERS });
        if (response.ok) {
            elements.healthDot.classList.add('online');
            elements.healthDot.classList.remove('offline');
            elements.healthText.textContent = 'Online';
            return true;
        }
    } catch (error) {
        console.error('Health check failed:', error);
    }
    elements.healthDot.classList.add('offline');
    elements.healthDot.classList.remove('online');
    elements.healthText.textContent = 'Offline';
    return false;
}

// -------------------------------------------------------------------
// Prompts
// -------------------------------------------------------------------
async function fetchPrompts() {
    try {
        const response = await fetch(`${VC}/prompts`, { headers: API_HEADERS });
        if (!response.ok) throw new Error(`Failed to fetch prompts: ${response.status}`);
        state.prompts = await response.json();
        renderPromptList();
    } catch (error) {
        console.error('Error fetching prompts:', error);
        showToast('Failed to load prompts');
    }
}

function renderPromptList() {
    if (state.prompts.length === 0) {
        elements.promptList.innerHTML = '<div class="empty-state">No prompts yet</div>';
        return;
    }

    elements.promptList.innerHTML = state.prompts.map(prompt => `
        <div class="prompt-item ${state.selectedPromptId === prompt.prompt_id ? 'active' : ''}" data-id="${prompt.prompt_id}">
            <div class="prompt-item-key">${escapeHtml(prompt.key)}</div>
            <div class="prompt-item-title">${escapeHtml(prompt.title)}</div>
            <div class="prompt-item-description">${escapeHtml(prompt.description || '')}</div>
        </div>
    `).join('');

    document.querySelectorAll('.prompt-item').forEach(item => {
        item.addEventListener('click', () => selectPrompt(item.dataset.id));
    });
}

async function selectPrompt(promptId) {
    state.selectedPromptId = promptId;
    state.runHistory = [];
    renderPromptList();

    try {
        await fetchPromptDetails(promptId);
        await fetchVersionHistory(promptId);
        await fetchAliasHistory(promptId);
        showPromptView();
        renderExecutionPanel();
        renderRunHistory();
    } catch (error) {
        console.error('Error selecting prompt:', error);
        showToast('Failed to load prompt details');
    }
}

async function fetchPromptDetails(promptId) {
    const response = await fetch(`${VC}/prompts/${promptId}`, { headers: API_HEADERS });
    if (!response.ok) throw new Error(`Failed to fetch prompt details: ${response.status}`);
    state.selectedPrompt = await response.json();
    renderPromptDetails();
}

function renderPromptDetails() {
    if (!state.selectedPrompt) return;

    elements.promptKey.textContent = state.selectedPrompt.key;
    elements.promptTitle.textContent = state.selectedPrompt.title;
    elements.promptDescription.textContent = state.selectedPrompt.description || '';

    const latestVersion = state.selectedPrompt.latest_version;
    if (latestVersion) {
        elements.promptText.value = latestVersion.prompt_text || '';
        elements.modelSettings.value = latestVersion.model_settings
            ? JSON.stringify(latestVersion.model_settings, null, 2) : '';
    } else {
        elements.promptText.value = '';
        elements.modelSettings.value = '';
    }
    elements.changeNote.value = '';
}

async function createPrompt(key, title, description) {
    try {
        const createdBy = crypto.randomUUID();
        const body = key
            ? { key, title, description, created_by: createdBy }
            : { title, description, created_by: createdBy };
        const response = await fetch(`${VC}/prompts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...API_HEADERS },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || `Failed: ${response.status}`);
        }

        const newPrompt = await response.json();
        showToast('Prompt created successfully');
        await fetchPrompts();
        selectPrompt(newPrompt.prompt_id);
    } catch (error) {
        console.error('Error creating prompt:', error);
        showToast(`Failed to create prompt: ${error.message}`);
        throw error;
    }
}

async function deletePrompt(promptId) {
    try {
        const response = await fetch(`${VC}/prompts/${promptId}`, { method: 'DELETE', headers: API_HEADERS });
        if (!response.ok) throw new Error(`Failed: ${response.status}`);
        showToast('Prompt deleted');
        state.selectedPromptId = null;
        state.selectedPrompt = null;
        await fetchPrompts();
        showWelcomeScreen();
    } catch (error) {
        console.error('Error deleting prompt:', error);
        showToast('Failed to delete prompt');
        throw error;
    }
}

// -------------------------------------------------------------------
// Versions
// -------------------------------------------------------------------
async function createVersion(promptId, promptText, modelSettings, changeNote) {
    try {
        let parsedSettings;
        try {
            parsedSettings = modelSettings.trim() ? JSON.parse(modelSettings) : {};
        } catch (e) {
            throw new Error('Invalid JSON in model settings');
        }

        const createdBy = crypto.randomUUID();
        const response = await fetch(`${VC}/versions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...API_HEADERS },
            body: JSON.stringify({
                prompt_id: promptId,
                prompt_text: promptText,
                model_settings: parsedSettings,
                change_note: changeNote,
                created_by: createdBy
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || `Failed: ${response.status}`);
        }

        showToast('New version created');
        await fetchPromptDetails(promptId);
        await fetchVersionHistory(promptId);
        renderExecutionPanel();
        elements.changeNote.value = '';
    } catch (error) {
        console.error('Error creating version:', error);
        showToast(`Failed to create version: ${error.message}`);
        throw error;
    }
}

async function fetchVersionHistory(promptId) {
    const response = await fetch(`${VC}/versions/${promptId}/history`, { headers: API_HEADERS });
    if (!response.ok) throw new Error(`Failed to fetch version history: ${response.status}`);
    state.versionHistory = await response.json();
    renderVersionHistory();
}

function getVersionAgeClass(createdAt) {
    const diffMs = new Date() - new Date(createdAt);
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffHours < 24) return 'recent-24h';
    if (diffHours / 24 < 7) return 'recent-week';
    if (diffHours / 24 < 30) return 'recent-month';
    return '';
}

function renderVersionHistory() {
    const count = state.versionHistory.length;
    elements.versionCount.textContent = `${count} version${count !== 1 ? 's' : ''}`;

    if (count === 0) {
        elements.versionList.innerHTML = '<div class="empty-state">No versions yet</div>';
        return;
    }

    const productionVersionId = state.selectedPrompt ? state.selectedPrompt.production_version_id : null;

    elements.versionList.innerHTML = state.versionHistory.map((version, index) => {
        const versionNumber = count - index;
        const timestamp = new Date(version.created_at).toLocaleString();
        const isLatest = index === 0;
        const isProduction = productionVersionId !== null && version.version_id === productionVersionId;
        const ageClass = isLatest ? 'latest' : getVersionAgeClass(version.created_at);

        return `
            <div class="version-item ${ageClass} ${isProduction ? 'production' : ''}" style="animation-delay: ${index * 50}ms">
                <div class="version-header">
                    <span class="version-number">
                        v${version.ordinal}
                        ${isProduction ? '<span class="production-badge">PRODUCTION</span>' : ''}
                    </span>
                    <span class="version-timestamp">${timestamp}</span>
                </div>
                ${version.change_note ? `<div class="version-change-note">"${escapeHtml(version.change_note)}"</div>` : ''}
                <div class="version-details">
                    <div class="version-detail-label">Prompt Text</div>
                    <div class="version-text">${escapeHtml(version.prompt_text || '')}</div>
                </div>
                <div class="version-details">
                    <div class="version-detail-label">Model Settings</div>
                    <div class="version-settings">${escapeHtml(JSON.stringify(version.model_settings, null, 2))}</div>
                </div>
                <div class="version-actions">
                    ${!isProduction ? `<button class="btn-promote btn-small" onclick="promoteVersion('${state.selectedPromptId}', ${version.version_id})">Promote to Production</button>` : '<span class="production-active-label">Active</span>'}
                </div>
            </div>
        `;
    }).join('');

    setupScrollShadows();
}

// -------------------------------------------------------------------
// Promotion
// -------------------------------------------------------------------
async function promoteVersion(promptId, versionId) {
    try {
        const response = await fetch(`${VC}/prompts/${promptId}/promote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...API_HEADERS },
            body: JSON.stringify({ version_id: versionId })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || `Failed: ${response.status}`);
        }

        showToast('Version promoted to production');
        await fetchPromptDetails(promptId);
        await fetchVersionHistory(promptId);
        await fetchAliasHistory(promptId);
        renderExecutionPanel();
    } catch (error) {
        console.error('Error promoting version:', error);
        showToast(`Failed to promote: ${error.message}`);
    }
}

// -------------------------------------------------------------------
// Alias History
// -------------------------------------------------------------------
async function fetchAliasHistory(promptId) {
    try {
        const response = await fetch(`${VC}/prompts/${promptId}/alias-history`, { headers: API_HEADERS });
        if (!response.ok) throw new Error(`Failed: ${response.status}`);
        state.aliasHistory = await response.json();
        renderAliasHistory();
    } catch (error) {
        console.error('Error fetching alias history:', error);
        state.aliasHistory = [];
        renderAliasHistory();
    }
}

function renderAliasHistory() {
    if (state.aliasHistory.length === 0) {
        elements.aliasHistorySection.style.display = 'none';
        return;
    }

    elements.aliasHistorySection.style.display = 'block';
    elements.aliasHistoryList.innerHTML = state.aliasHistory.map(entry => {
        const timestamp = entry.changed_at ? new Date(entry.changed_at).toLocaleString() : 'Unknown';
        const from = entry.from_version_id !== null ? `v${entry.from_version_id}` : 'none';
        const to = `v${entry.to_version_id}`;
        return `
            <div class="alias-history-item">
                <div class="alias-arrow">
                    <span class="alias-from">${escapeHtml(from)}</span>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 8h10M10 4l4 4-4 4"/>
                    </svg>
                    <span class="alias-to">${escapeHtml(to)}</span>
                </div>
                <span class="alias-timestamp">${timestamp}</span>
            </div>
        `;
    }).join('');
}

// -------------------------------------------------------------------
// Execution
// -------------------------------------------------------------------
function renderExecutionPanel() {
    if (!state.selectedPrompt || !state.selectedPrompt.production_version_id) {
        elements.executionSection.style.display = 'none';
        return;
    }

    elements.executionSection.style.display = 'block';

    // Find the production version for its prompt_text
    const prodVersion = state.versionHistory.find(
        v => v.version_id === state.selectedPrompt.production_version_id
    );

    if (!prodVersion) {
        elements.executionSection.style.display = 'none';
        return;
    }

    // Show model badge
    const model = prodVersion.model_settings ? prodVersion.model_settings.model : null;
    elements.execModel.textContent = model || 'default (llama-3.3-70b-versatile)';

    // Generate variable inputs from production version's prompt text
    console.log('[Exec Panel] production_version_id:', state.selectedPrompt.production_version_id);
    console.log('[Exec Panel] prodVersion.version_id:', prodVersion.version_id);
    console.log('[Exec Panel] prodVersion.prompt_text:', prodVersion.prompt_text);
    const placeholders = extractPlaceholders(prodVersion.prompt_text);
    console.log('[Exec Panel] extracted placeholders:', placeholders);
    if (placeholders.length === 0) {
        elements.variableInputs.innerHTML = '<div class="no-vars-note">No variables required</div>';
    } else {
        elements.variableInputs.innerHTML = placeholders.map(name => `
            <div class="var-input-group">
                <label for="var-${name}" class="var-label">{{${name}}}</label>
                <input type="text" id="var-${name}" class="var-input" data-var="${name}" placeholder="Enter value for ${name}...">
            </div>
        `).join('');
    }
}

async function executePrompt() {
    if (!state.selectedPrompt || !state.selectedPrompt.production_version_id) return;

    const prodVersion = state.versionHistory.find(
        v => v.version_id === state.selectedPrompt.production_version_id
    );
    if (!prodVersion) return;

    const placeholders = extractPlaceholders(prodVersion.prompt_text);
    const variables = {};

    // Collect and validate variables
    for (const name of placeholders) {
        const input = document.getElementById(`var-${name}`);
        if (!input || !input.value.trim()) {
            showToast(`Variable "${name}" is required`);
            if (input) input.focus();
            return;
        }
        variables[name] = input.value.trim();
    }

    // Disable button during execution
    elements.btnExecute.disabled = true;
    elements.btnExecute.textContent = 'Executing...';
    elements.runResult.style.display = 'none';

    const model = prodVersion.model_settings ? prodVersion.model_settings.model : null;

    try {
        const response = await fetch(`${EXEC}/execute/${state.selectedPrompt.key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...API_HEADERS },
            body: JSON.stringify({ variables })
        });

        const runId = response.headers.get('X-PromptOps-Run-ID') || response.headers.get('x-promptops-run-id');

        if (response.ok) {
            const data = await response.json();
            displayRunResult({
                runId: runId || data.run_id,
                status: data.status,
                latencyMs: data.latency_ms,
                response: data.response,
                model: data.model_used || model,
                renderedPrompt: data.rendered_prompt,
                promptTokens: data.prompt_tokens,
                completionTokens: data.completion_tokens,
                costUsd: data.cost_usd,
                error: null
            });
        } else {
            const errorData = await response.json();
            displayRunResult({
                runId: runId || 'N/A',
                status: 'error',
                latencyMs: null,
                response: null,
                model: model,
                renderedPrompt: null,
                error: errorData.detail || `HTTP ${response.status}`
            });
        }
    } catch (error) {
        displayRunResult({
            runId: 'N/A',
            status: 'error',
            latencyMs: null,
            response: null,
            model: model,
            renderedPrompt: null,
            error: error.message
        });
    } finally {
        elements.btnExecute.disabled = false;
        elements.btnExecute.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2l10 6-10 6V2z"/></svg> Execute';
    }
}

function displayRunResult(result) {
    elements.runResult.style.display = 'block';

    elements.runIdValue.textContent = result.runId || 'N/A';

    // Status badge
    const isSuccess = result.status === 'success';
    elements.runStatus.textContent = result.status;
    elements.runStatus.className = `run-status ${isSuccess ? 'status-success' : 'status-error'}`;
    elements.runStatusValue.textContent = result.status;

    // Latency
    elements.runLatencyValue.textContent = result.latencyMs !== null ? `${result.latencyMs}ms` : 'N/A';

    // Est. Cost
    elements.runCostValue.textContent = result.costUsd != null ? formatCost(result.costUsd) : 'N/A';

    // Tokens
    if (result.promptTokens != null && result.completionTokens != null) {
        elements.runTokensValue.textContent = `${result.promptTokens} in / ${result.completionTokens} out`;
    } else {
        elements.runTokensValue.textContent = 'N/A';
    }

    // Response
    if (result.response) {
        elements.runResponseBlock.style.display = 'block';
        elements.runResponseValue.textContent = result.response;
    } else {
        elements.runResponseBlock.style.display = 'none';
    }

    // Error
    if (result.error) {
        elements.runErrorBlock.style.display = 'block';
        elements.runErrorValue.textContent = result.error;
    } else {
        elements.runErrorBlock.style.display = 'none';
    }

    // Add to session run history
    state.runHistory.unshift({
        runId: result.runId,
        status: result.status,
        latencyMs: result.latencyMs,
        model: result.model,
        costUsd: result.costUsd,
        error: result.error,
        timestamp: new Date().toLocaleString()
    });
    renderRunHistory();
}

function renderRunHistory() {
    if (state.runHistory.length === 0) {
        elements.runHistorySection.style.display = 'none';
        return;
    }

    elements.runHistorySection.style.display = 'block';
    elements.runHistoryList.innerHTML = `
        <table class="run-history-table">
            <thead>
                <tr>
                    <th>Run ID</th>
                    <th>Status</th>
                    <th>Latency</th>
                    <th>Time</th>
                </tr>
            </thead>
            <tbody>
                ${state.runHistory.map(run => `
                    <tr class="${run.status === 'success' ? 'row-success' : 'row-error'}">
                        <td class="run-id-cell">${escapeHtml(String(run.runId))}</td>
                        <td><span class="status-pill ${run.status === 'success' ? 'status-success' : 'status-error'}">${escapeHtml(run.status)}</span></td>
                        <td>${run.latencyMs !== null ? run.latencyMs + 'ms' : '—'}</td>
                        <td>${escapeHtml(run.timestamp)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// -------------------------------------------------------------------
// View states
// -------------------------------------------------------------------
function showPromptView() {
    elements.welcomeScreen.style.display = 'none';
    elements.promptView.style.display = 'flex';
    elements.timelinePanel.style.display = 'flex';
}

function showWelcomeScreen() {
    elements.welcomeScreen.style.display = 'flex';
    elements.promptView.style.display = 'none';
    elements.timelinePanel.style.display = 'none';
}

// -------------------------------------------------------------------
// Modals
// -------------------------------------------------------------------
function showCreatePromptModal() {
    elements.createPromptModal.classList.add('active');
    document.getElementById('newPromptKey').value = '';
    document.getElementById('newPromptTitle').value = '';
    document.getElementById('newPromptDescription').value = '';
    state.userEditedKey = false;
}

function closeCreatePromptModal() {
    elements.createPromptModal.classList.remove('active');
    state.userEditedKey = false;
}

function showConfirmModal(title, message, callback) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    state.confirmCallback = callback;
    elements.confirmModal.classList.add('active');
}

function closeConfirmModal() {
    elements.confirmModal.classList.remove('active');
    state.confirmCallback = null;
}

function confirmDeletePrompt() {
    if (!state.selectedPromptId) return;
    showConfirmModal(
        'Delete Prompt',
        'Are you sure you want to delete this prompt? This will delete all versions and cannot be undone.',
        () => deletePrompt(state.selectedPromptId)
    );
}

// -------------------------------------------------------------------
// Theme
// -------------------------------------------------------------------
function initTheme() {
    const savedTheme = localStorage.getItem('chronicle-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = savedTheme || (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('chronicle-theme', next);
}

// -------------------------------------------------------------------
// Scroll shadows
// -------------------------------------------------------------------
function setupScrollShadows() {
    const list = elements.versionList;
    if (!list) return;

    function updateShadows() {
        const { scrollTop, scrollHeight, clientHeight } = list;
        list.classList.toggle('scrolled-top', scrollTop > 10);
        list.classList.toggle('scrolled-bottom', scrollTop < scrollHeight - clientHeight - 10);
    }

    list.addEventListener('scroll', updateShadows);
    updateShadows();
}

// -------------------------------------------------------------------
// Event listeners
// -------------------------------------------------------------------
elements.btnCreatePrompt.addEventListener('click', showCreatePromptModal);

document.getElementById('btnCloseCreateModal').addEventListener('click', closeCreatePromptModal);
document.getElementById('btnCancelCreate').addEventListener('click', closeCreatePromptModal);

document.getElementById('btnConfirmCreate').addEventListener('click', async () => {
    const key = document.getElementById('newPromptKey').value.trim();
    const title = document.getElementById('newPromptTitle').value.trim();
    const description = document.getElementById('newPromptDescription').value.trim();

    if (!title) {
        showToast('Title is required');
        return;
    }

    try {
        await createPrompt(key, title, description);
        closeCreatePromptModal();
    } catch (error) { }
});

elements.btnSaveVersion.addEventListener('click', async () => {
    if (!state.selectedPromptId) return;

    const promptText = elements.promptText.value.trim();
    const modelSettings = elements.modelSettings.value.trim();
    const changeNote = elements.changeNote.value.trim();

    if (!promptText) { showToast('Prompt text is required'); return; }
    if (!changeNote) { showToast('Change note is required'); return; }

    try {
        await createVersion(state.selectedPromptId, promptText, modelSettings, changeNote);
    } catch (error) { }
});

elements.btnDeletePrompt.addEventListener('click', confirmDeletePrompt);

document.getElementById('btnCloseConfirmModal').addEventListener('click', closeConfirmModal);
document.getElementById('btnCancelConfirm').addEventListener('click', closeConfirmModal);

document.getElementById('btnConfirmAction').addEventListener('click', async () => {
    if (state.confirmCallback) {
        try {
            await state.confirmCallback();
            closeConfirmModal();
        } catch (error) { }
    }
});

elements.createPromptModal.addEventListener('click', (e) => {
    if (e.target === elements.createPromptModal) closeCreatePromptModal();
});

elements.confirmModal.addEventListener('click', (e) => {
    if (e.target === elements.confirmModal) closeConfirmModal();
});

elements.themeToggle.addEventListener('click', toggleTheme);
elements.btnExecute.addEventListener('click', executePrompt);

// Auto-populate key from title
document.getElementById('newPromptTitle').addEventListener('keyup', () => {
    if (!state.userEditedKey) {
        const title = document.getElementById('newPromptTitle').value;
        document.getElementById('newPromptKey').value = title ? generateKey(title) : '';
    }
});

// Track manual key edits
document.getElementById('newPromptKey').addEventListener('keyup', () => {
    state.userEditedKey = true;
});

// -------------------------------------------------------------------
// Init
// -------------------------------------------------------------------
async function init() {
    console.log('Initializing Chronicle GUI...');
    initTheme();
    const isHealthy = await checkHealth();
    if (isHealthy) {
        await fetchPrompts();
    }
}

init();
