// -------------------------------------------------------------------
// Chronicle — app_new.js (React + Recharts via CDN)
// -------------------------------------------------------------------
const html = htm.bind(React.createElement);
const { useState, useEffect, useRef, useCallback } = React;

// Recharts components
const { LineChart, Line, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, AreaChart, Area, ReferenceLine } = Recharts;

// -------------------------------------------------------------------
// Constants
// -------------------------------------------------------------------
const VC = '/api/v1/version-control';
const EXEC = '/api/v1';
const API_HEADERS = { 'X-API-Key': 'chronicle-dev-key' };
const JSON_HEADERS = { 'X-API-Key': 'chronicle-dev-key', 'Content-Type': 'application/json' };

const MODEL_PRICING = {
    "llama-3.3-70b-versatile": { input_cost_per_1k: 0.00059, output_cost_per_1k: 0.00079 },
    "llama-3.1-8b-instant": { input_cost_per_1k: 0.00005, output_cost_per_1k: 0.00008 },
    "llama3-70b-8192": { input_cost_per_1k: 0.00059, output_cost_per_1k: 0.00079 },
    "mixtral-8x7b-32768": { input_cost_per_1k: 0.00024, output_cost_per_1k: 0.00024 },
    "gemma2-9b-it": { input_cost_per_1k: 0.00020, output_cost_per_1k: 0.00020 },
};

const MODEL_CONTEXT_WINDOWS = {
    "llama-3.3-70b-versatile": 128000,
    "llama3-70b-8192": 8192,
    "llama-3.1-8b-instant": 128000,
    "mixtral-8x7b-32768": 32768,
    "gemma2-9b-it": 8192
};

// -------------------------------------------------------------------
// Utility functions (preserved from original)
// -------------------------------------------------------------------
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function extractPlaceholders(text) {
    const matches = text.match(/\{\{(\w+)\}\}/g);
    if (!matches) return [];
    return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))];
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
    return '$' + parseFloat(cost).toFixed(6);
}

function estimateTokens(text) {
    return Math.ceil(text.length / 4);
}

function estimateCost(promptText, modelSettingsJson) {
    const tokens = estimateTokens(promptText);
    let model = null;
    try {
        const settings = JSON.parse(modelSettingsJson);
        model = settings.model || null;
    } catch (e) {
        model = null;
    }
    const pricing = MODEL_PRICING[model];
    if (!pricing) return { tokens, cost: null, model };
    const cost = (tokens / 1000) * pricing.input_cost_per_1k;
    return { tokens, cost, model };
}

function getVersionAgeClass(createdAt) {
    const diffMs = new Date() - new Date(createdAt);
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffHours < 24) return 'recent-24h';
    if (diffHours / 24 < 7) return 'recent-week';
    if (diffHours / 24 < 30) return 'recent-month';
    return '';
}

// -------------------------------------------------------------------
// Toast Component
// -------------------------------------------------------------------
function Toast({ message, visible }) {
    return html`
        <div class="toast ${visible ? 'show' : ''}" id="toast">
            <span>${message}</span>
        </div>
    `;
}

// -------------------------------------------------------------------
// ThemeSelector Component
// -------------------------------------------------------------------
function ThemeSelector() {
    const [active, setActive] = useState(
        localStorage.getItem('chronicle-theme') || 'matte'
    );

    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('chronicle-theme', theme);
        setActive(theme);
    }

    return html`
        <div class="theme-selector">
            <button class="theme-option ${active === 'dark' ? 'active' : ''}"
                    onClick=${() => setTheme('dark')}>Dark</button>
            <button class="theme-option ${active === 'light' ? 'active' : ''}"
                    onClick=${() => setTheme('light')}>Light</button>
            <button class="theme-option ${active === 'matte' ? 'active' : ''}"
                    onClick=${() => setTheme('matte')}>Matte</button>
        </div>
    `;
}

// -------------------------------------------------------------------
// PromptItem Component
// -------------------------------------------------------------------
function PromptItem({ prompt, isActive, onSelect }) {
    return html`
        <div class="prompt-item ${isActive ? 'active' : ''}"
             onClick=${() => onSelect(prompt)}>
            <div class="prompt-item-key">${prompt.key}</div>
            <div class="prompt-item-title">${prompt.title}</div>
            <div class="prompt-item-description">${prompt.description || ''}</div>
        </div>
    `;
}

// -------------------------------------------------------------------
// Sidebar Component
// -------------------------------------------------------------------
function Sidebar({ prompts, selectedPromptId, onSelectPrompt, onCreatePrompt }) {
    return html`
        <aside class="sidebar">
            <div class="sidebar-header">
                <h2>Prompts</h2>
                <button class="btn-icon" onClick=${onCreatePrompt} title="Create Prompt">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="8" y1="3" x2="8" y2="13"></line>
                        <line x1="3" y1="8" x2="13" y2="8"></line>
                    </svg>
                </button>
            </div>
            <div class="prompt-list">
                ${prompts.length === 0
            ? html`<div class="empty-state">No prompts yet</div>`
            : prompts.map(p => html`
                        <${PromptItem}
                            key=${p.prompt_id}
                            prompt=${p}
                            isActive=${selectedPromptId === p.prompt_id}
                            onSelect=${onSelectPrompt}
                        />
                    `)
        }
            </div>
        </aside>
    `;
}

// -------------------------------------------------------------------
// CreatePromptModal Component
// -------------------------------------------------------------------
function CreatePromptModal({ visible, onClose, onCreate }) {
    const [title, setTitle] = useState('');
    const [key, setKey] = useState('');
    const [description, setDescription] = useState('');
    const [userEditedKey, setUserEditedKey] = useState(false);

    useEffect(() => {
        if (visible) {
            setTitle('');
            setKey('');
            setDescription('');
            setUserEditedKey(false);
        }
    }, [visible]);

    function handleTitleChange(e) {
        const newTitle = e.target.value;
        setTitle(newTitle);
        if (!userEditedKey) {
            setKey(newTitle ? generateKey(newTitle) : '');
        }
    }

    function handleKeyChange(e) {
        setKey(e.target.value);
        setUserEditedKey(true);
    }

    async function handleCreate() {
        if (!title.trim()) return;
        await onCreate(key.trim(), title.trim(), description.trim());
        onClose();
    }

    if (!visible) return null;

    return html`
        <div class="modal active" onClick=${(e) => e.target === e.currentTarget && onClose()}>
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Create New Prompt</h3>
                    <button class="btn-close" onClick=${onClose}>\u00d7</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>Key</label>
                        <input type="text" class="modal-input" value=${key}
                               onInput=${handleKeyChange}
                               placeholder="Auto-generated from title" />
                    </div>
                    <div class="form-group">
                        <label>Title</label>
                        <input type="text" class="modal-input" value=${title}
                               onInput=${handleTitleChange}
                               placeholder="My Prompt Title" />
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <textarea class="modal-textarea" rows="3"
                                  value=${description}
                                  onInput=${(e) => setDescription(e.target.value)}
                                  placeholder="Describe the purpose of this prompt..."></textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onClick=${onClose}>Cancel</button>
                    <button class="btn-primary" onClick=${handleCreate}>Create</button>
                </div>
            </div>
        </div>
    `;
}

// -------------------------------------------------------------------
// ConfirmModal Component
// -------------------------------------------------------------------
function ConfirmModal({ visible, title, message, onConfirm, onClose }) {
    if (!visible) return null;

    return html`
        <div class="modal active" onClick=${(e) => e.target === e.currentTarget && onClose()}>
            <div class="modal-content modal-small">
                <div class="modal-header danger">
                    <h3>${title}</h3>
                    <button class="btn-close" onClick=${onClose}>\u00d7</button>
                </div>
                <div class="modal-body">
                    <p>${message}</p>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onClick=${onClose}>Cancel</button>
                    <button class="btn-danger" onClick=${onConfirm}>Delete Forever</button>
                </div>
            </div>
        </div>
    `;
}

// -------------------------------------------------------------------
// ContextWindowBar Component
// -------------------------------------------------------------------
function ContextWindowBar({ tokens, model }) {
    const max = MODEL_CONTEXT_WINDOWS[model] || 8192;
    const pct = Math.min((tokens / max) * 100, 100);
    const color = pct > 80 ? '#dc2626' : pct > 50 ? '#d97706' : '#16a34a';
    return html`
        <div class="context-bar-wrapper">
            <div class="context-bar-track">
                <div class="context-bar-fill"
                     style=${{ width: pct + '%', background: color, transition: 'width 0.2s ease' }}></div>
            </div>
            <span class="context-bar-label">${tokens} / ${max} tokens</span>
        </div>
    `;
}

// -------------------------------------------------------------------
// TokenEstimateBar Component
// -------------------------------------------------------------------
function TokenEstimateBar({ promptText, modelSettingsJson }) {
    if (!promptText) return html`<div class="token-estimate-bar"></div>`;

    const estimate = estimateCost(promptText, modelSettingsJson);
    const tokens = estimate.tokens;
    const model = estimate.model;

    return html`
        <div class="token-estimate-bar">
            <div>
                ${estimate.cost !== null
            ? `~${tokens} tokens \u00b7 Est. $${estimate.cost.toFixed(6)} per call \u00b7 ${model}`
            : `~${tokens} tokens \u00b7 Model not set`
        }
            </div>
            ${model && html`<${ContextWindowBar} tokens=${tokens} model=${model} />`}
        </div>
    `;
}

// -------------------------------------------------------------------
// VersionEditor Component
// -------------------------------------------------------------------
function VersionEditor({ selectedPrompt, versionHistory, onCreateVersion }) {
    const [promptText, setPromptText] = useState('');
    const [modelSettings, setModelSettings] = useState('');
    const [changeNote, setChangeNote] = useState('');

    useEffect(() => {
        if (selectedPrompt && selectedPrompt.latest_version) {
            setPromptText(selectedPrompt.latest_version.prompt_text || '');
            setModelSettings(selectedPrompt.latest_version.model_settings
                ? JSON.stringify(selectedPrompt.latest_version.model_settings, null, 2)
                : '');
        } else {
            setPromptText('');
            setModelSettings('');
        }
        setChangeNote('');
    }, [selectedPrompt]);

    async function handleSave() {
        if (!promptText.trim()) return;
        if (!changeNote.trim()) return;
        await onCreateVersion(promptText.trim(), modelSettings.trim(), changeNote.trim());
        setChangeNote('');
    }

    return html`
        <div class="editor-section">
            <div class="section-header">
                <h3>New Version</h3>
            </div>
            <div class="form-group">
                <label>Prompt Text</label>
                <textarea class="editor-textarea" rows="8"
                          value=${promptText}
                          onInput=${(e) => setPromptText(e.target.value)}
                          placeholder="Enter your prompt text... Use {{variable}} for injected values"></textarea>
                <${TokenEstimateBar} promptText=${promptText} modelSettingsJson=${modelSettings} />
            </div>
            <div class="form-group">
                <label>Model Settings (JSON)</label>
                <textarea class="editor-textarea code" rows="4"
                          value=${modelSettings}
                          onInput=${(e) => setModelSettings(e.target.value)}
                          placeholder='{"model": "llama-3.3-70b-versatile", "temperature": 0.7}'></textarea>
            </div>
            <div class="form-group">
                <label>Change Note</label>
                <input type="text" class="editor-input"
                       value=${changeNote}
                       onInput=${(e) => setChangeNote(e.target.value)}
                       placeholder="Describe what changed in this version..." />
            </div>
            <button class="btn-primary" onClick=${handleSave}>Create New Version</button>
        </div>
    `;
}

// -------------------------------------------------------------------
// Chart Components
// -------------------------------------------------------------------
function CostChart({ runHistory }) {
    if (!runHistory.length) return html`<div class="chart-empty-state">Run a prompt to see cost trend</div>`;
    const data = runHistory.filter(r => r.status === 'success').map(r => ({
        run: '#' + r.run_id,
        cost: parseFloat(r.cost_usd) || 0
    }));
    if (!data.length) return html`<div class="chart-empty-state">No successful runs yet</div>`;
    return html`
        <${ResponsiveContainer} width="100%" height=${200}>
            <${LineChart} data=${data} margin=${{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <${CartesianGrid} strokeDasharray="3 3" stroke="rgba(255,220,180,0.06)" />
                <${XAxis} dataKey="run" tick=${{ fill: '#a89880', fontSize: 11 }} />
                <${YAxis} tick=${{ fill: '#a89880', fontSize: 11 }} tickFormatter=${v => '$' + v.toFixed(6)} />
                <${Tooltip}
                    contentStyle=${{ background: '#252117', border: '1px solid rgba(255,220,180,0.12)', borderRadius: '6px' }}
                    labelStyle=${{ color: '#f5f0e8' }} />
                <${Line} type="monotone" dataKey="cost" stroke="#d97706" strokeWidth=${2}
                         dot=${{ fill: '#d97706', r: 3 }} activeDot=${{ r: 5 }} />
            </${LineChart}>
        </${ResponsiveContainer}>
    `;
}

function TokenChart({ runHistory }) {
    const data = runHistory
        .filter(r => r.tokens_prompt && r.tokens_completion)
        .map(r => ({
            run: '#' + r.run_id,
            prompt: r.tokens_prompt,
            completion: r.tokens_completion
        }));
    if (!data.length) return html`<div class="chart-empty-state">No token data available</div>`;
    return html`
        <${ResponsiveContainer} width="100%" height=${200}>
            <${BarChart} data=${data} margin=${{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <${CartesianGrid} strokeDasharray="3 3" stroke="rgba(255,220,180,0.06)" />
                <${XAxis} dataKey="run" tick=${{ fill: '#a89880', fontSize: 11 }} />
                <${YAxis} tick=${{ fill: '#a89880', fontSize: 11 }} />
                <${Tooltip}
                    contentStyle=${{ background: '#252117', border: '1px solid rgba(255,220,180,0.12)', borderRadius: '6px' }}
                    labelStyle=${{ color: '#f5f0e8' }} />
                <${Legend} />
                <${Bar} dataKey="prompt" name="Prompt Tokens" fill="#d97706" />
                <${Bar} dataKey="completion" name="Completion Tokens" fill="#92400e" />
            </${BarChart}>
        </${ResponsiveContainer}>
    `;
}

function LatencyChart({ runHistory }) {
    const data = runHistory
        .filter(r => r.latency_ms !== null && r.latency_ms !== undefined)
        .map(r => ({
            run: '#' + r.run_id,
            latency: r.latency_ms
        }));
    if (!data.length) return html`<div class="chart-empty-state">No latency data available</div>`;
    const meanLatency = Math.round(data.reduce((s, r) => s + r.latency, 0) / data.length);
    return html`
        <${ResponsiveContainer} width="100%" height=${200}>
            <${AreaChart} data=${data} margin=${{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                    <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(217,119,6,0.3)" />
                        <stop offset="100%" stopColor="rgba(217,119,6,0.0)" />
                    </linearGradient>
                </defs>
                <${CartesianGrid} strokeDasharray="3 3" stroke="rgba(255,220,180,0.06)" />
                <${XAxis} dataKey="run" tick=${{ fill: '#a89880', fontSize: 11 }} />
                <${YAxis} tick=${{ fill: '#a89880', fontSize: 11 }} tickFormatter=${v => v + 'ms'} />
                <${Tooltip}
                    contentStyle=${{ background: '#252117', border: '1px solid rgba(255,220,180,0.12)', borderRadius: '6px' }}
                    labelStyle=${{ color: '#f5f0e8' }} />
                <${ReferenceLine} y=${meanLatency} stroke="#a89880" strokeDasharray="5 5"
                                  label=${{ value: 'avg ' + meanLatency + 'ms', fill: '#a89880', fontSize: 11 }} />
                <${Area} type="monotone" dataKey="latency" stroke="#d97706" strokeWidth=${2}
                         fill="url(#latencyGradient)" />
            </${AreaChart}>
        </${ResponsiveContainer}>
    `;
}

function RunCharts({ runHistory }) {
    if (!runHistory.length) return null;
    return html`
        <div class="charts-section">
            <div class="chart-card">
                <div class="chart-card-title">Cost Per Run</div>
                <${CostChart} runHistory=${runHistory} />
            </div>
            <div class="chart-card">
                <div class="chart-card-title">Token Breakdown</div>
                <${TokenChart} runHistory=${runHistory} />
            </div>
            <div class="chart-card">
                <div class="chart-card-title">Latency Trend</div>
                <${LatencyChart} runHistory=${runHistory} />
            </div>
        </div>
    `;
}

function MiniSparkline({ data }) {
    if (!data || data.length < 2) return null;
    return html`
        <div class="sparkline-container">
            <${ResponsiveContainer} width="100%" height=${50}>
                <${LineChart} data=${data}>
                    <${Line} type="monotone" dataKey="cost" stroke="#d97706"
                             strokeWidth=${1.5} dot=${false} isAnimationActive=${false} />
                </${LineChart}>
            </${ResponsiveContainer}>
        </div>
    `;
}

// -------------------------------------------------------------------
// RunResult Component
// -------------------------------------------------------------------
function RunResult({ result }) {
    if (!result) return null;
    const isSuccess = result.status === 'success';

    return html`
        <div class="run-result">
            <div class="run-result-header">
                <span class="run-result-title">Run Result</span>
                <span class="run-status ${isSuccess ? 'status-success' : 'status-error'}">${result.status}</span>
            </div>
            <div class="run-result-body">
                <div class="run-result-field">
                    <span class="field-label">Run ID</span>
                    <span class="field-value">${result.run_id || 'N/A'}</span>
                </div>
                <div class="run-result-field">
                    <span class="field-label">Status</span>
                    <span class="field-value">${result.status}</span>
                </div>
                <div class="run-result-field">
                    <span class="field-label">Latency</span>
                    <span class="field-value">${result.latency_ms !== null ? result.latency_ms + 'ms' : 'N/A'}</span>
                </div>
                <div class="run-result-field">
                    <span class="field-label">Cost</span>
                    <span class="field-value">${result.cost_usd != null ? formatCost(result.cost_usd) : 'N/A'}</span>
                </div>
                <div class="run-result-field">
                    <span class="field-label">Tokens</span>
                    <span class="field-value">
                        ${result.tokens_prompt != null && result.tokens_completion != null
            ? result.tokens_prompt + ' in / ' + result.tokens_completion + ' out'
            : 'N/A'}
                    </span>
                </div>
                ${result.response && html`
                    <div class="run-result-response">
                        <span class="field-label">Response</span>
                        <div class="response-text">${result.response}</div>
                    </div>
                `}
                ${result.error && html`
                    <div class="run-result-error">
                        <span class="field-label">Error</span>
                        <div class="error-text">${result.error}</div>
                    </div>
                `}
            </div>
        </div>
    `;
}

// -------------------------------------------------------------------
// ExecutionPanel Component
// -------------------------------------------------------------------
function ExecutionPanel({ selectedPrompt, versionHistory, runHistory, runResult,
    onExecute, showToast }) {
    const [costEstimate, setCostEstimate] = useState(null);

    if (!selectedPrompt || !selectedPrompt.production_version_id) return null;

    const prodVersion = versionHistory.find(
        v => v.version_id === selectedPrompt.production_version_id
    );
    if (!prodVersion) return null;

    const model = prodVersion.model_settings ? prodVersion.model_settings.model : null;
    const placeholders = extractPlaceholders(prodVersion.prompt_text);

    function handleEstimateCost() {
        let promptText = prodVersion.prompt_text;
        let variablesNote = '';
        let allFilled = true;

        for (const name of placeholders) {
            const input = document.getElementById('var-' + name);
            if (input && input.value.trim()) {
                promptText = promptText.replaceAll('{{' + name + '}}', input.value.trim());
            } else {
                allFilled = false;
            }
        }

        if (placeholders.length > 0 && !allFilled) {
            variablesNote = 'Variables not filled \u2014 estimate based on template length.';
        }

        const modelSettingsJson = prodVersion.model_settings ? JSON.stringify(prodVersion.model_settings) : '';
        const estimate = estimateCost(promptText, modelSettingsJson);
        setCostEstimate({ estimate, variablesNote });
    }

    function handleExecute() {
        const variables = {};
        for (const name of placeholders) {
            const input = document.getElementById('var-' + name);
            if (!input || !input.value.trim()) {
                showToast('Variable "' + name + '" is required');
                if (input) input.focus();
                return;
            }
            variables[name] = input.value.trim();
        }
        setCostEstimate(null);
        onExecute(variables);
    }

    return html`
        <div class="execution-section">
            <div class="section-header">
                <h3>Execute Production Version</h3>
                <span class="exec-badge">${model || 'default (llama-3.3-70b-versatile)'}</span>
            </div>

            <div class="variable-inputs">
                ${placeholders.length === 0
            ? html`<div class="no-vars-note">No variables required</div>`
            : placeholders.map(name => html`
                        <div class="var-input-group" key=${name}>
                            <label class="var-label">${'{{' + name + '}}'}</label>
                            <input type="text" id=${'var-' + name} class="var-input"
                                   placeholder=${'Enter value for ' + name + '...'} />
                        </div>
                    `)
        }
            </div>

            <div class="execution-button-row">
                <button class="btn-primary btn-execute" onClick=${handleExecute}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M4 2l10 6-10 6V2z" />
                    </svg>
                    Execute
                </button>
                <button class="btn-secondary btn-estimate" onClick=${handleEstimateCost}>Estimate Cost</button>
            </div>

            ${costEstimate && html`
                <div class="cost-estimate-panel">
                    <div class="estimate-title">Cost Estimate</div>
                    ${costEstimate.estimate.model && costEstimate.estimate.cost !== null ? html`
                        <div class="estimate-field">
                            <span class="estimate-label">Prompt tokens</span>
                            <span class="estimate-value">~${costEstimate.estimate.tokens}</span>
                        </div>
                        <div class="estimate-field">
                            <span class="estimate-label">Input cost</span>
                            <span class="estimate-value">$${costEstimate.estimate.cost.toFixed(6)}</span>
                        </div>
                        <div class="estimate-field">
                            <span class="estimate-label">Model</span>
                            <span class="estimate-value">${costEstimate.estimate.model}</span>
                        </div>
                        <div class="estimate-note">Estimate only. Actual cost depends on completion tokens.${costEstimate.variablesNote ? ' ' + costEstimate.variablesNote : ''}</div>
                    ` : html`
                        <div class="estimate-field">
                            <span class="estimate-label">Prompt tokens</span>
                            <span class="estimate-value">~${costEstimate.estimate.tokens}</span>
                        </div>
                        <div class="estimate-note">Model not set \u2014 configure model settings on the version.${costEstimate.variablesNote ? ' ' + costEstimate.variablesNote : ''}</div>
                    `}
                </div>
            `}

            <${RunResult} result=${runResult} />

            <${RunCharts} runHistory=${runHistory} />

            ${runHistory.length > 0 && html`
                <div class="run-history">
                    <div class="section-header">
                        <h3>Run History (Session)</h3>
                    </div>
                    <div class="run-history-list">
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
                                ${runHistory.map(run => html`
                                    <tr key=${run.run_id} class=${run.status === 'success' ? 'row-success' : 'row-error'}>
                                        <td class="run-id-cell">${String(run.run_id)}</td>
                                        <td><span class="status-pill ${run.status === 'success' ? 'status-success' : 'status-error'}">${run.status}</span></td>
                                        <td>${run.latency_ms !== null ? run.latency_ms + 'ms' : '\u2014'}</td>
                                        <td>${run.timestamp}</td>
                                    </tr>
                                `)}
                            </tbody>
                        </table>
                    </div>
                </div>
            `}
        </div>
    `;
}

// -------------------------------------------------------------------
// MainPanel Component
// -------------------------------------------------------------------
function MainPanel({ selectedPrompt, versionHistory, runHistory, runResult,
    onCreateVersion, onDeletePrompt, onExecute, showToast }) {
    if (!selectedPrompt) {
        return html`
            <main class="main-panel">
                <div class="welcome-screen" style=${{ display: 'flex' }}>
                    <div class="welcome-content">
                        <h2>Welcome to Chronicle</h2>
                        <p>Select a prompt from the sidebar or create a new one to get started.</p>
                    </div>
                </div>
            </main>
        `;
    }

    return html`
        <main class="main-panel">
            <div class="prompt-view" style=${{ display: 'flex' }}>
                <div class="prompt-header">
                    <div class="prompt-meta">
                        <div class="prompt-key">${selectedPrompt.key}</div>
                        <h2 class="prompt-title">${selectedPrompt.title}</h2>
                        <p class="prompt-description">${selectedPrompt.description || ''}</p>
                    </div>
                    <button class="btn-danger-icon" onClick=${onDeletePrompt} title="Delete Prompt"
                            style=${{ opacity: 1 }}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 4h10M5 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1M6 7v5M10 7v5M4 4l1 9a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l1-9" />
                        </svg>
                    </button>
                </div>

                <${VersionEditor}
                    selectedPrompt=${selectedPrompt}
                    versionHistory=${versionHistory}
                    onCreateVersion=${onCreateVersion}
                />

                <${ExecutionPanel}
                    selectedPrompt=${selectedPrompt}
                    versionHistory=${versionHistory}
                    runHistory=${runHistory}
                    runResult=${runResult}
                    onExecute=${onExecute}
                    showToast=${showToast}
                />
            </div>
        </main>
    `;
}

// -------------------------------------------------------------------
// VersionCard Component
// -------------------------------------------------------------------
function VersionCard({ version, index, totalCount, isProduction, productionVersionId,
    onPromote, promptId, sparklineData }) {
    const versionNumber = totalCount - index;
    const timestamp = new Date(version.created_at).toLocaleString();
    const isLatest = index === 0;
    const ageClass = isLatest ? 'latest' : getVersionAgeClass(version.created_at);

    return html`
        <div class="version-item ${ageClass} ${isProduction ? 'production' : ''}"
             style=${{ animationDelay: (index * 50) + 'ms' }}>
            <div class="version-header">
                <span class="version-number">
                    v${version.ordinal}
                    ${isProduction && html`<span class="production-badge">PRODUCTION</span>`}
                </span>
                <span class="version-timestamp">${timestamp}</span>
            </div>
            ${version.change_note && html`
                <div class="version-change-note">"${version.change_note}"</div>
            `}
            <div class="version-details">
                <div class="version-detail-label">Prompt Text</div>
                <div class="version-text">${version.prompt_text || ''}</div>
            </div>
            <div class="version-details">
                <div class="version-detail-label">Model Settings</div>
                <div class="version-settings">${JSON.stringify(version.model_settings, null, 2)}</div>
            </div>
            <${MiniSparkline} data=${sparklineData} />
            <div class="version-actions">
                ${!isProduction
            ? html`<button class="btn-promote btn-small"
                                   onClick=${() => onPromote(promptId, version.version_id)}>
                                Promote to Production
                           </button>`
            : html`<span class="production-active-label">Active</span>`
        }
            </div>
        </div>
    `;
}

// -------------------------------------------------------------------
// PromotionHistory Component
// -------------------------------------------------------------------
function PromotionHistory({ aliasHistory }) {
    if (!aliasHistory || aliasHistory.length === 0) return null;

    return html`
        <div class="alias-history-section">
            <div class="alias-history-header">
                <h3>Promotion History</h3>
            </div>
            <div class="alias-history-list">
                ${aliasHistory.map((entry, i) => {
        const timestamp = entry.changed_at ? new Date(entry.changed_at).toLocaleString() : 'Unknown';
        const from = entry.from_version_id !== null ? 'v' + entry.from_version_id : 'none';
        const to = 'v' + entry.to_version_id;
        return html`
                        <div class="alias-history-item" key=${i}>
                            <div class="alias-arrow">
                                <span class="alias-from">${from}</span>
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M3 8h10M10 4l4 4-4 4" />
                                </svg>
                                <span class="alias-to">${to}</span>
                            </div>
                            <span class="alias-timestamp">${timestamp}</span>
                        </div>
                    `;
    })}
            </div>
        </div>
    `;
}

// -------------------------------------------------------------------
// TimelinePanel Component
// -------------------------------------------------------------------
function TimelinePanel({ visible, versionHistory, selectedPrompt, aliasHistory,
    onPromote, runHistory }) {
    if (!visible) return null;

    const count = versionHistory.length;
    const productionVersionId = selectedPrompt ? selectedPrompt.production_version_id : null;

    // Build sparkline data per version from run history
    function getSparklineData(versionId) {
        const versionRuns = runHistory
            .filter(r => r.version_id === versionId && r.status === 'success')
            .map(r => ({ cost: parseFloat(r.cost_usd) || 0 }));
        return versionRuns;
    }

    return html`
        <aside class="timeline-panel" style=${{ display: 'flex' }}>
            <div class="timeline-header">
                <h3>Version History</h3>
                <span class="version-count">${count} version${count !== 1 ? 's' : ''}</span>
            </div>
            <div class="version-list">
                ${count === 0
            ? html`<div class="empty-state">No versions yet</div>`
            : versionHistory.map((version, index) => html`
                        <${VersionCard}
                            key=${version.version_id}
                            version=${version}
                            index=${index}
                            totalCount=${count}
                            isProduction=${productionVersionId !== null && version.version_id === productionVersionId}
                            productionVersionId=${productionVersionId}
                            onPromote=${onPromote}
                            promptId=${selectedPrompt ? selectedPrompt.prompt_id : null}
                            sparklineData=${getSparklineData(version.version_id)}
                        />
                    `)
        }
            </div>
            <${PromotionHistory} aliasHistory=${aliasHistory} />
        </aside>
    `;
}

// -------------------------------------------------------------------
// App Component (root)
// -------------------------------------------------------------------
function App() {
    // State
    const [prompts, setPrompts] = useState([]);
    const [selectedPrompt, setSelectedPrompt] = useState(null);
    const [versionHistory, setVersionHistory] = useState([]);
    const [aliasHistory, setAliasHistory] = useState([]);
    const [runHistory, setRunHistory] = useState([]);
    const [runResult, setRunResult] = useState(null);
    const [healthOnline, setHealthOnline] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [toastVisible, setToastVisible] = useState(false);
    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [confirmModal, setConfirmModal] = useState({ visible: false, title: '', message: '', callback: null });

    const toastTimer = useRef(null);

    function showToast(message) {
        setToastMessage(message);
        setToastVisible(true);
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToastVisible(false), 3000);
    }

    // --- API Functions (10 fetch calls, same as original) ---

    // 1. checkHealth
    async function checkHealth() {
        try {
            const res = await fetch(VC + '/prompts', { headers: API_HEADERS });
            if (res.ok) {
                setHealthOnline(true);
                return true;
            }
        } catch (e) {
            console.error('Health check failed:', e);
        }
        setHealthOnline(false);
        return false;
    }

    // 2. fetchPrompts
    async function fetchPrompts() {
        try {
            const res = await fetch(VC + '/prompts', { headers: API_HEADERS });
            if (!res.ok) throw new Error('Failed to fetch prompts: ' + res.status);
            const data = await res.json();
            setPrompts(data);
            return data;
        } catch (e) {
            console.error('Error fetching prompts:', e);
            showToast('Failed to load prompts');
            return [];
        }
    }

    // 3. fetchPromptDetails
    async function fetchPromptDetails(promptId) {
        const res = await fetch(VC + '/prompts/' + promptId, { headers: API_HEADERS });
        if (!res.ok) throw new Error('Failed to fetch prompt details: ' + res.status);
        return await res.json();
    }

    // 4. createPrompt
    async function createPrompt(key, title, description) {
        try {
            const createdBy = crypto.randomUUID();
            const body = key
                ? { key, title, description, created_by: createdBy }
                : { title, description, created_by: createdBy };
            const res = await fetch(VC + '/prompts', {
                method: 'POST',
                headers: JSON_HEADERS,
                body: JSON.stringify(body)
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.detail || 'Failed: ' + res.status);
            }
            const newPrompt = await res.json();
            showToast('Prompt created successfully');
            await fetchPrompts();
            await handleSelectPrompt(newPrompt);
        } catch (e) {
            console.error('Error creating prompt:', e);
            showToast('Failed to create prompt: ' + e.message);
        }
    }

    // 5. deletePrompt
    async function deletePrompt(promptId) {
        try {
            const res = await fetch(VC + '/prompts/' + promptId, {
                method: 'DELETE',
                headers: API_HEADERS
            });
            if (!res.ok) throw new Error('Failed: ' + res.status);
            showToast('Prompt deleted');
            setSelectedPrompt(null);
            setVersionHistory([]);
            setAliasHistory([]);
            setRunHistory([]);
            setRunResult(null);
            await fetchPrompts();
        } catch (e) {
            console.error('Error deleting prompt:', e);
            showToast('Failed to delete prompt');
        }
    }

    // 6. createVersion
    async function createVersion(promptText, modelSettings, changeNote) {
        if (!selectedPrompt) return;
        try {
            let parsedSettings;
            try {
                parsedSettings = modelSettings.trim() ? JSON.parse(modelSettings) : {};
            } catch (e) {
                throw new Error('Invalid JSON in model settings');
            }
            const createdBy = crypto.randomUUID();
            const res = await fetch(VC + '/versions', {
                method: 'POST',
                headers: JSON_HEADERS,
                body: JSON.stringify({
                    prompt_id: selectedPrompt.prompt_id,
                    prompt_text: promptText,
                    model_settings: parsedSettings,
                    change_note: changeNote,
                    created_by: createdBy
                })
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.detail || 'Failed: ' + res.status);
            }
            showToast('New version created');
            // Refresh prompt details and version history
            const updatedPrompt = await fetchPromptDetails(selectedPrompt.prompt_id);
            setSelectedPrompt(updatedPrompt);
            const versions = await fetchVersionHistoryData(selectedPrompt.prompt_id);
            setVersionHistory(versions);
        } catch (e) {
            console.error('Error creating version:', e);
            showToast('Failed to create version: ' + e.message);
        }
    }

    // 7. fetchVersionHistory
    async function fetchVersionHistoryData(promptId) {
        const res = await fetch(VC + '/versions/' + promptId + '/history', { headers: API_HEADERS });
        if (!res.ok) throw new Error('Failed to fetch version history: ' + res.status);
        return await res.json();
    }

    // 8. promoteVersion
    async function promoteVersion(promptId, versionId) {
        try {
            const res = await fetch(VC + '/prompts/' + promptId + '/promote', {
                method: 'POST',
                headers: JSON_HEADERS,
                body: JSON.stringify({ version_id: versionId })
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.detail || 'Failed: ' + res.status);
            }
            showToast('Version promoted to production');
            // Refresh all data
            const updatedPrompt = await fetchPromptDetails(promptId);
            setSelectedPrompt(updatedPrompt);
            const versions = await fetchVersionHistoryData(promptId);
            setVersionHistory(versions);
            const aliases = await fetchAliasHistoryData(promptId);
            setAliasHistory(aliases);
        } catch (e) {
            console.error('Error promoting version:', e);
            showToast('Failed to promote: ' + e.message);
        }
    }

    // 9. fetchAliasHistory
    async function fetchAliasHistoryData(promptId) {
        try {
            const res = await fetch(VC + '/prompts/' + promptId + '/alias-history', { headers: API_HEADERS });
            if (!res.ok) throw new Error('Failed: ' + res.status);
            return await res.json();
        } catch (e) {
            console.error('Error fetching alias history:', e);
            return [];
        }
    }

    // 10. executePrompt
    async function executePrompt(variables) {
        if (!selectedPrompt || !selectedPrompt.production_version_id) return;

        const prodVersion = versionHistory.find(
            v => v.version_id === selectedPrompt.production_version_id
        );
        if (!prodVersion) return;

        const model = prodVersion.model_settings ? prodVersion.model_settings.model : null;
        setRunResult(null);

        try {
            const res = await fetch(EXEC + '/execute/' + selectedPrompt.key, {
                method: 'POST',
                headers: JSON_HEADERS,
                body: JSON.stringify({ variables })
            });

            const runId = res.headers.get('X-PromptOps-Run-ID') || res.headers.get('x-promptops-run-id');

            if (res.ok) {
                const data = await res.json();
                const result = {
                    run_id: runId || data.run_id,
                    status: data.status,
                    latency_ms: data.latency_ms,
                    response: data.response,
                    model: data.model_used || model,
                    tokens_prompt: data.prompt_tokens,
                    tokens_completion: data.completion_tokens,
                    cost_usd: data.cost_usd,
                    error: null,
                    version_id: selectedPrompt.production_version_id,
                    timestamp: new Date().toLocaleString()
                };
                setRunResult(result);
                setRunHistory(prev => [result, ...prev]);
            } else {
                const errorData = await res.json();
                const result = {
                    run_id: runId || 'N/A',
                    status: 'error',
                    latency_ms: null,
                    response: null,
                    model: model,
                    tokens_prompt: null,
                    tokens_completion: null,
                    cost_usd: null,
                    error: errorData.detail || 'HTTP ' + res.status,
                    version_id: selectedPrompt.production_version_id,
                    timestamp: new Date().toLocaleString()
                };
                setRunResult(result);
                setRunHistory(prev => [result, ...prev]);
            }
        } catch (e) {
            const result = {
                run_id: 'N/A',
                status: 'error',
                latency_ms: null,
                response: null,
                model: model,
                tokens_prompt: null,
                tokens_completion: null,
                cost_usd: null,
                error: e.message,
                version_id: selectedPrompt.production_version_id,
                timestamp: new Date().toLocaleString()
            };
            setRunResult(result);
            setRunHistory(prev => [result, ...prev]);
        }
    }

    // --- Prompt Selection ---
    async function handleSelectPrompt(prompt) {
        // Clear run state when switching prompts
        setRunHistory([]);
        setRunResult(null);

        try {
            const details = await fetchPromptDetails(prompt.prompt_id);
            setSelectedPrompt(details);
            const versions = await fetchVersionHistoryData(prompt.prompt_id);
            setVersionHistory(versions);
            const aliases = await fetchAliasHistoryData(prompt.prompt_id);
            setAliasHistory(aliases);
        } catch (e) {
            console.error('Error selecting prompt:', e);
            showToast('Failed to load prompt details');
        }
    }

    // --- Delete confirmation ---
    function handleDeletePrompt() {
        if (!selectedPrompt) return;
        setConfirmModal({
            visible: true,
            title: 'Delete Prompt',
            message: 'Are you sure you want to delete this prompt? This will delete all versions and cannot be undone.',
            callback: () => {
                deletePrompt(selectedPrompt.prompt_id);
                setConfirmModal({ visible: false, title: '', message: '', callback: null });
            }
        });
    }

    // --- Init on mount ---
    useEffect(() => {
        async function init() {
            console.log('Initializing Chronicle GUI...');
            const isHealthy = await checkHealth();
            if (isHealthy) {
                await fetchPrompts();
            }
        }
        init();
    }, []);

    // --- Render ---
    return html`
        <div class="app-container">
            <!-- HEADER -->
            <header class="app-header">
                <div class="header-content">
                    <div class="header-left">
                        <h1 class="app-title">Chronicle</h1>
                    </div>
                    <div class="header-right">
                        <${ThemeSelector} />
                        <div class="health-indicator">
                            <span class="health-dot ${healthOnline ? 'online' : 'offline'}"></span>
                            <span class="health-text">${healthOnline ? 'Online' : 'Offline'}</span>
                        </div>
                    </div>
                </div>
            </header>

            <!-- SIDEBAR -->
            <${Sidebar}
                prompts=${prompts}
                selectedPromptId=${selectedPrompt ? selectedPrompt.prompt_id : null}
                onSelectPrompt=${handleSelectPrompt}
                onCreatePrompt=${() => setCreateModalVisible(true)}
            />

            <!-- MAIN PANEL -->
            <${MainPanel}
                selectedPrompt=${selectedPrompt}
                versionHistory=${versionHistory}
                runHistory=${runHistory}
                runResult=${runResult}
                onCreateVersion=${createVersion}
                onDeletePrompt=${handleDeletePrompt}
                onExecute=${executePrompt}
                showToast=${showToast}
            />

            <!-- TIMELINE PANEL -->
            <${TimelinePanel}
                visible=${selectedPrompt !== null}
                versionHistory=${versionHistory}
                selectedPrompt=${selectedPrompt}
                aliasHistory=${aliasHistory}
                onPromote=${promoteVersion}
                runHistory=${runHistory}
            />

            <!-- MODALS -->
            <${CreatePromptModal}
                visible=${createModalVisible}
                onClose=${() => setCreateModalVisible(false)}
                onCreate=${createPrompt}
            />

            <${ConfirmModal}
                visible=${confirmModal.visible}
                title=${confirmModal.title}
                message=${confirmModal.message}
                onConfirm=${confirmModal.callback}
                onClose=${() => setConfirmModal({ visible: false, title: '', message: '', callback: null })}
            />

            <!-- TOAST -->
            <${Toast} message=${toastMessage} visible=${toastVisible} />
        </div>
    `;
}

// -------------------------------------------------------------------
// Mount React
// -------------------------------------------------------------------
const rootElement = document.getElementById('app');
const root = ReactDOM.createRoot(rootElement);
root.render(html`<${App} />`);
