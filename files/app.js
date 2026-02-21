// Chronicle â€” app_new.js â€” Production UI Redesign
const html = htm.bind(React.createElement);
const { useState, useEffect, useRef, useCallback, useMemo } = React;
const { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, AreaChart, Area, ReferenceLine } = Recharts;

// Constants
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
    "llama-3.3-70b-versatile": 128000, "llama3-70b-8192": 8192,
    "llama-3.1-8b-instant": 128000, "mixtral-8x7b-32768": 32768, "gemma2-9b-it": 8192
};
const CHART_THEME = {
    grid: 'rgba(255,220,180,0.06)', axis: '#6b5d4f', primary: '#d97706',
    secondary: '#92400e', tooltip_bg: '#252117', tooltip_border: 'rgba(255,220,180,0.12)', text: '#a89880'
};

// Utilities
function extractPlaceholders(text) {
    const m = text.match(/\{\{(\w+)\}\}/g);
    return m ? [...new Set(m.map(x => x.replace(/\{\{|\}\}/g, '')))] : [];
}
function generateKey(title) {
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 50);
    const sfx = Math.random().toString(36).substring(2, 8);
    return slug ? slug + '-' + sfx : sfx;
}
function formatCost(c) { return c == null ? 'N/A' : '$' + parseFloat(c).toFixed(6); }
function estimateTokens(t) { return Math.ceil(t.length / 4); }
function estimateCost(promptText, msJson) {
    const tokens = estimateTokens(promptText);
    let model = null;
    try { model = JSON.parse(msJson).model || null; } catch (e) { }
    const p = MODEL_PRICING[model];
    if (!p) return { tokens, cost: null, model };
    return { tokens, cost: (tokens / 1000) * p.input_cost_per_1k, model };
}
function getVersionOpacity(index) {
    if (index === 0) return 1;
    if (index === 1) return 0.85;
    if (index === 2) return 0.7;
    return 0.55;
}
function extractModelName(settings) {
    if (!settings) return null;
    return settings.model || null;
}

// --- Reusable UI Components ---

function AnimatedNumber({ value, prefix, suffix, decimals }) {
    prefix = prefix || ''; suffix = suffix || ''; decimals = decimals || 0;
    const [display, setDisplay] = useState(0);
    useEffect(() => {
        const start = Date.now(), dur = 600, end = parseFloat(value) || 0;
        function tick() {
            const p = Math.min((Date.now() - start) / dur, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            setDisplay(end * eased);
            if (p < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }, [value]);
    return html`<span class="animated-number">${prefix}${display.toFixed(decimals)}${suffix}</span>`;
}

function Skeleton({ width, height, style }) {
    return html`<div class="skeleton" style=${{ width: width || '100%', height: height || '14px', ...style }}></div>`;
}

function EmptyState({ icon, title, sub }) {
    return html`<div class="empty-state">
        <div class="empty-state-icon">${icon}</div>
        <div class="empty-state-title">${title}</div>
        <div class="empty-state-sub">${sub}</div>
    </div>`;
}

function Toast({ message, visible }) {
    return html`<div class="toast ${visible ? 'show' : ''}" id="toast"><span>${message}</span></div>`;
}

function ThemeSelector() {
    const [active, setActive] = useState(localStorage.getItem('chronicle-theme') || 'matte');
    function set(t) { document.documentElement.setAttribute('data-theme', t); localStorage.setItem('chronicle-theme', t); setActive(t); }
    return html`<div class="theme-selector">
        <button class="theme-option ${active === 'dark' ? 'active' : ''}" onClick=${() => set('dark')}>Dark</button>
        <button class="theme-option ${active === 'light' ? 'active' : ''}" onClick=${() => set('light')}>Light</button>
        <button class="theme-option ${active === 'matte' ? 'active' : ''}" onClick=${() => set('matte')}>Matte</button>
    </div>`;
}

function ContextWindowBar({ tokens, model }) {
    const max = MODEL_CONTEXT_WINDOWS[model] || 8192;
    const pct = Math.min((tokens / max) * 100, 100);
    const color = pct > 80 ? '#dc2626' : pct > 50 ? '#d97706' : '#16a34a';
    return html`<div class="context-bar-wrapper">
        <div class="context-bar-track">
            <div class="context-bar-fill" style=${{ width: pct + '%', background: color }}></div>
        </div>
        <span class="context-bar-label">${tokens} / ${max.toLocaleString()} tokens</span>
    </div>`;
}

function TokenEstimateBar({ promptText, modelSettingsJson }) {
    if (!promptText) return null;
    const est = estimateCost(promptText, modelSettingsJson);
    return html`<div class="token-estimate-bar" style=${{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
        <div>${est.cost !== null ? '~' + est.tokens + ' tokens \u00b7 Est. $' + est.cost.toFixed(6) + ' \u00b7 ' + est.model : '~' + est.tokens + ' tokens \u00b7 Model not set'}</div>
        ${est.model && html`<${ContextWindowBar} tokens=${est.tokens} model=${est.model} />`}
    </div>`;
}

// --- Modals ---

function CreatePromptModal({ visible, onClose, onCreate }) {
    const [title, setTitle] = useState(''); const [key, setKey] = useState('');
    const [desc, setDesc] = useState(''); const [edited, setEdited] = useState(false);
    useEffect(() => { if (visible) { setTitle(''); setKey(''); setDesc(''); setEdited(false); } }, [visible]);
    if (!visible) return null;
    function onTitle(e) { const v = e.target.value; setTitle(v); if (!edited) setKey(v ? generateKey(v) : ''); }
    async function go() { if (!title.trim()) return; await onCreate(key.trim(), title.trim(), desc.trim()); onClose(); }
    return html`<div class="modal active" onClick=${e => e.target === e.currentTarget && onClose()}>
        <div class="modal-content" style=${{ borderRadius: 'var(--radius-lg)' }}>
            <div class="modal-header"><h3 style=${{ fontFamily: "'Syne',sans-serif" }}>Create Prompt</h3><button class="btn-close" onClick=${onClose}>\u00d7</button></div>
            <div class="modal-body">
                <div class="form-group"><label style=${{ fontFamily: "'Inter',sans-serif", fontSize: '13px' }}>Key</label>
                    <input type="text" class="modal-input" value=${key} onInput=${e => { setKey(e.target.value); setEdited(true); }} placeholder="Auto-generated from title" style=${{ fontFamily: "'JetBrains Mono',monospace", fontSize: '13px' }} /></div>
                <div class="form-group"><label style=${{ fontFamily: "'Inter',sans-serif", fontSize: '13px' }}>Title</label>
                    <input type="text" class="modal-input" value=${title} onInput=${onTitle} placeholder="My Prompt Title" /></div>
                <div class="form-group"><label style=${{ fontFamily: "'Inter',sans-serif", fontSize: '13px' }}>Description</label>
                    <textarea class="modal-textarea" rows="3" value=${desc} onInput=${e => setDesc(e.target.value)} placeholder="Describe the purpose..."></textarea></div>
            </div>
            <div class="modal-footer"><button class="btn-secondary" onClick=${onClose}>Cancel</button><button class="btn-primary" onClick=${go}>Create</button></div>
        </div>
    </div>`;
}

function ConfirmModal({ visible, title, message, onConfirm, onClose }) {
    if (!visible) return null;
    return html`<div class="modal active" onClick=${e => e.target === e.currentTarget && onClose()}>
        <div class="modal-content modal-small" style=${{ borderRadius: 'var(--radius-lg)' }}>
            <div class="modal-header danger"><h3 style=${{ fontFamily: "'Syne',sans-serif" }}>${title}</h3><button class="btn-close" onClick=${onClose}>\u00d7</button></div>
            <div class="modal-body"><p>${message}</p></div>
            <div class="modal-footer"><button class="btn-secondary" onClick=${onClose}>Cancel</button><button class="btn-danger" onClick=${onConfirm}>Delete Forever</button></div>
        </div>
    </div>`;
}

// --- Charts ---

function CostChart({ runHistory }) {
    const data = runHistory.filter(r => r.status === 'success').map(r => ({ run: '#' + r.run_id, cost: parseFloat(r.cost_usd) || 0 }));
    if (!data.length) return html`<${EmptyState} icon="\u25C8" title="No cost data" sub="Execute a prompt to see cost trend" />`;
    return html`<${ResponsiveContainer} width="100%" height=${200}>
        <${LineChart} data=${data} margin=${{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <${CartesianGrid} strokeDasharray="3 3" stroke=${CHART_THEME.grid} />
            <${XAxis} dataKey="run" tick=${{ fill: CHART_THEME.text, fontSize: 11, fontFamily: 'JetBrains Mono' }} />
            <${YAxis} tick=${{ fill: CHART_THEME.text, fontSize: 11, fontFamily: 'JetBrains Mono' }} tickFormatter=${v => '$' + v.toFixed(6)} />
            <${Tooltip} contentStyle=${{ background: CHART_THEME.tooltip_bg, border: '1px solid ' + CHART_THEME.tooltip_border, borderRadius: '8px', fontFamily: 'JetBrains Mono', fontSize: '12px' }} labelStyle=${{ color: '#f5f0e8' }} />
            <${Line} type="monotone" dataKey="cost" stroke=${CHART_THEME.primary} strokeWidth=${2} dot=${{ fill: CHART_THEME.primary, r: 3 }} activeDot=${{ r: 5 }} />
        </${LineChart}>
    </${ResponsiveContainer}>`;
}

function TokenChart({ runHistory }) {
    const data = runHistory.filter(r => r.tokens_prompt && r.tokens_completion).map(r => ({ run: '#' + r.run_id, prompt: r.tokens_prompt, completion: r.tokens_completion }));
    if (!data.length) return html`<${EmptyState} icon="\u25C8" title="No token data" sub="Token breakdown appears after runs" />`;
    return html`<${ResponsiveContainer} width="100%" height=${200}>
        <${BarChart} data=${data} margin=${{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <${CartesianGrid} strokeDasharray="3 3" stroke=${CHART_THEME.grid} />
            <${XAxis} dataKey="run" tick=${{ fill: CHART_THEME.text, fontSize: 11, fontFamily: 'JetBrains Mono' }} />
            <${YAxis} tick=${{ fill: CHART_THEME.text, fontSize: 11, fontFamily: 'JetBrains Mono' }} />
            <${Tooltip} contentStyle=${{ background: CHART_THEME.tooltip_bg, border: '1px solid ' + CHART_THEME.tooltip_border, borderRadius: '8px' }} labelStyle=${{ color: '#f5f0e8' }} />
            <${Legend} />
            <${Bar} dataKey="prompt" name="Prompt Tokens" fill=${CHART_THEME.primary} />
            <${Bar} dataKey="completion" name="Completion Tokens" fill=${CHART_THEME.secondary} />
        </${BarChart}>
    </${ResponsiveContainer}>`;
}

function LatencyChart({ runHistory }) {
    const data = runHistory.filter(r => r.latency_ms != null).map(r => ({ run: '#' + r.run_id, latency: r.latency_ms }));
    if (!data.length) return html`<${EmptyState} icon="\u25C8" title="No latency data" sub="Latency trend appears after runs" />`;
    const mean = Math.round(data.reduce((s, r) => s + r.latency, 0) / data.length);
    return html`<${ResponsiveContainer} width="100%" height=${200}>
        <${AreaChart} data=${data} margin=${{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <defs><linearGradient id="latGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#d97706" stopOpacity="0.3"/><stop offset="95%" stopColor="#d97706" stopOpacity="0"/>
            </linearGradient></defs>
            <${CartesianGrid} strokeDasharray="3 3" stroke=${CHART_THEME.grid} />
            <${XAxis} dataKey="run" tick=${{ fill: CHART_THEME.text, fontSize: 11, fontFamily: 'JetBrains Mono' }} />
            <${YAxis} tick=${{ fill: CHART_THEME.text, fontSize: 11, fontFamily: 'JetBrains Mono' }} tickFormatter=${v => v + 'ms'} />
            <${Tooltip} contentStyle=${{ background: CHART_THEME.tooltip_bg, border: '1px solid ' + CHART_THEME.tooltip_border, borderRadius: '8px' }} labelStyle=${{ color: '#f5f0e8' }} />
            <${ReferenceLine} y=${mean} stroke="#a89880" strokeDasharray="5 5" label=${{ value: 'avg ' + mean + 'ms', fill: '#a89880', fontSize: 11 }} />
            <${Area} type="monotone" dataKey="latency" stroke="#d97706" strokeWidth=${2} fill="url(#latGrad)" />
        </${AreaChart}>
    </${ResponsiveContainer}>`;
}

function RunCharts({ runHistory }) {
    if (!runHistory.length) return null;
    return html`<div class="charts-section">
        <div class="chart-card"><div class="chart-card-title">Cost Per Run</div><${CostChart} runHistory=${runHistory} /></div>
        <div class="chart-card"><div class="chart-card-title">Token Breakdown</div><${TokenChart} runHistory=${runHistory} /></div>
        <div class="chart-card"><div class="chart-card-title">Latency Trend</div><${LatencyChart} runHistory=${runHistory} /></div>
    </div>`;
}

function MiniSparkline({ data }) {
    if (!data || data.length < 2) return null;
    return html`<div class="sparkline-container"><${ResponsiveContainer} width="100%" height=${50}>
        <${LineChart} data=${data}><${Line} type="monotone" dataKey="cost" stroke="#d97706" strokeWidth=${1.5} dot=${false} isAnimationActive=${false} /></${LineChart}>
    </${ResponsiveContainer}></div>`;
}

// --- Version Editor ---

function VersionEditor({ selectedPrompt, onCreateVersion }) {
    const [promptText, setPromptText] = useState('');
    const [modelSettings, setModelSettings] = useState('');
    const [changeNote, setChangeNote] = useState('');
    useEffect(() => {
        if (selectedPrompt && selectedPrompt.latest_version) {
            setPromptText(selectedPrompt.latest_version.prompt_text || '');
            setModelSettings(selectedPrompt.latest_version.model_settings ? JSON.stringify(selectedPrompt.latest_version.model_settings, null, 2) : '');
        } else { setPromptText(''); setModelSettings(''); }
        setChangeNote('');
    }, [selectedPrompt]);
    async function save() { if (!promptText.trim() || !changeNote.trim()) return; await onCreateVersion(promptText.trim(), modelSettings.trim(), changeNote.trim()); setChangeNote(''); }
    return html`<div class="editor-section">
        <div class="section-header"><h3 style=${{ fontFamily: "'Syne',sans-serif", fontSize: '16px', fontWeight: 700 }}>New Version</h3></div>
        <div class="form-group"><label style=${{ fontFamily: "'Inter',sans-serif", fontSize: '13px', fontWeight: 500 }}>Prompt Text</label>
            <textarea class="editor-textarea" rows="8" value=${promptText} onInput=${e => setPromptText(e.target.value)} placeholder="Enter your prompt text... Use {{variable}} for injected values"></textarea>
            <${TokenEstimateBar} promptText=${promptText} modelSettingsJson=${modelSettings} />
        </div>
        <div class="form-group"><label style=${{ fontFamily: "'Inter',sans-serif", fontSize: '13px', fontWeight: 500 }}>Model Settings (JSON)</label>
            <textarea class="editor-textarea code" rows="4" value=${modelSettings} onInput=${e => setModelSettings(e.target.value)} placeholder='{"model":"llama-3.3-70b-versatile","temperature":0.7}' style=${{ fontFamily: "'JetBrains Mono',monospace", fontSize: '13px' }}></textarea>
        </div>
        <div class="form-group"><label style=${{ fontFamily: "'Inter',sans-serif", fontSize: '13px', fontWeight: 500 }}>Change Note</label>
            <input type="text" class="editor-input" value=${changeNote} onInput=${e => setChangeNote(e.target.value)} placeholder="Describe what changed..." />
        </div>
        <button class="btn-primary" onClick=${save} style=${{ fontFamily: "'Syne',sans-serif", fontWeight: 600 }}>Create New Version</button>
    </div>`;
}

// --- Run Result ---

function RunResult({ result }) {
    if (!result) return null;
    const ok = result.status === 'success';
    const statusStyle = ok ? { background: '#065F46', color: '#D1FAE5' } : { background: '#7F1D1D', color: '#FEE2E2' };
    return html`<div class="run-result" style=${{ borderRadius: 'var(--radius-md)', overflow: 'hidden', marginTop: '16px' }}>
        <div class="run-result-header" style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px' }}>
            <span style=${{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '14px' }}>Run Result</span>
            <span style=${{ ...statusStyle, padding: '4px 12px', borderRadius: 'var(--radius-full)', fontFamily: "'Syne',sans-serif", fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>${result.status}</span>
        </div>
        <div class="run-result-body" style=${{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            <div><div style=${{ fontFamily: "'Inter',sans-serif", fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>Run ID</div>
                <div style=${{ fontFamily: "'JetBrains Mono',monospace", fontSize: '14px' }}>${result.run_id || 'N/A'}</div></div>
            <div><div style=${{ fontFamily: "'Inter',sans-serif", fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>Latency</div>
                <div>${result.latency_ms != null ? html`<${AnimatedNumber} value=${result.latency_ms} suffix="ms" />` : 'N/A'}</div></div>
            <div><div style=${{ fontFamily: "'Inter',sans-serif", fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>Cost</div>
                <div>${result.cost_usd != null ? html`<${AnimatedNumber} value=${result.cost_usd} prefix="$" decimals=${6} />` : 'N/A'}</div></div>
            <div><div style=${{ fontFamily: "'Inter',sans-serif", fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>Tokens</div>
                <div>${result.tokens_prompt != null ? html`<${AnimatedNumber} value=${result.tokens_prompt} /> / <${AnimatedNumber} value=${result.tokens_completion} />` : 'N/A'}</div></div>
        </div>
        ${result.response && html`<div style=${{ padding: '0 16px 16px' }}>
            <div style=${{ fontFamily: "'Inter',sans-serif", fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '8px' }}>Response</div>
            <div style=${{ background: 'var(--bg-primary)', padding: '16px', borderRadius: 'var(--radius-md)', fontFamily: "'JetBrains Mono',monospace", fontSize: '13px', lineHeight: '1.7', border: '1px solid var(--surface-border)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>${result.response}</div>
        </div>`}
        ${result.error && html`<div style=${{ padding: '0 16px 16px' }}>
            <div style=${{ fontFamily: "'Inter',sans-serif", fontSize: '11px', color: '#dc2626', marginBottom: '8px' }}>Error</div>
            <div style=${{ background: '#7F1D1D', padding: '16px', borderRadius: 'var(--radius-md)', fontFamily: "'JetBrains Mono',monospace", fontSize: '13px', lineHeight: '1.7', color: '#FEE2E2' }}>${result.error}</div>
        </div>`}
    </div>`;
}

// --- Execution Panel ---

function ExecutionPanel({ selectedPrompt, versionHistory, runHistory, runResult, onExecute, showToast }) {
    if (!selectedPrompt || !selectedPrompt.production_version_id)
        return html`<${EmptyState} icon="\u26A1" title="No production version" sub="Promote a version to enable execution" />`;
    const prodVersion = versionHistory.find(v => v.version_id === selectedPrompt.production_version_id);
    if (!prodVersion) return null;
    const model = extractModelName(prodVersion.model_settings);
    const placeholders = extractPlaceholders(prodVersion.prompt_text);
    function exec() {
        const vars = {};
        for (const n of placeholders) {
            const el = document.getElementById('var-' + n);
            if (!el || !el.value.trim()) { showToast('Variable "' + n + '" is required'); if (el) el.focus(); return; }
            vars[n] = el.value.trim();
        }
        onExecute(vars);
    }
    return html`<div class="execution-section" style=${{ marginTop: '32px' }}>
        <div style=${{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <h3 style=${{ fontFamily: "'Syne',sans-serif", fontSize: '16px', fontWeight: 700, margin: 0 }}>Execute</h3>
            ${model && html`<span style=${{ fontFamily: "'JetBrains Mono',monospace", fontSize: '11px', padding: '3px 10px', borderRadius: 'var(--radius-full)', background: 'var(--accent-bg)', color: 'var(--accent-primary)', border: '1px solid var(--accent-bg)' }}>${model}</span>`}
        </div>
        <div class="variable-inputs" style=${{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
            ${placeholders.length === 0
            ? html`<div style=${{ fontFamily: "'Inter',sans-serif", fontSize: '13px', color: 'var(--text-tertiary)' }}>No variables required</div>`
            : placeholders.map(n => html`<div key=${n} style=${{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <label style=${{ fontFamily: "'JetBrains Mono',monospace", fontSize: '12px', color: 'var(--text-secondary)', minWidth: '120px' }}>${'{{' + n + '}}'}</label>
                    <input type="text" id=${'var-' + n} class="var-input" placeholder=${'Enter ' + n + '...'} style=${{ flex: 1 }} />
                </div>`)}
        </div>
        <button class="btn-primary btn-execute" onClick=${exec} style=${{ fontFamily: "'Syne',sans-serif", fontWeight: 600 }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2l10 6-10 6V2z"/></svg> Execute
        </button>
        <${RunResult} result=${runResult} />
        <${RunCharts} runHistory=${runHistory} />
    </div>`;
}

// --- Version Card ---

function VersionCard({ version, index, isProduction, onPromote, promptId, sparklineData }) {
    const model = extractModelName(version.model_settings);
    const ts = new Date(version.created_at).toLocaleString();
    return html`<div class="version-card" style=${{ position: 'relative', paddingLeft: '40px', marginBottom: '0', opacity: getVersionOpacity(index) }}>
        <div class="timeline-dot ${isProduction ? 'is-production' : ''}"></div>
        <div style=${{ background: 'var(--bg-secondary)', border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-md)', padding: '16px', boxShadow: 'var(--shadow-card)' }}>
            <div style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <span style=${{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '24px', color: 'var(--text-primary)' }}>v${version.ordinal}</span>
                    ${isProduction && html`<span class="production-badge" style=${{ marginLeft: '10px', display: 'inline-block', background: '#d97706', color: '#1a1612', fontFamily: "'Syne',sans-serif", fontWeight: 600, fontSize: '10px', padding: '3px 10px', borderRadius: 'var(--radius-full)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>PRODUCTION</span>`}
                </div>
                <span style=${{ fontFamily: "'JetBrains Mono',monospace", fontSize: '11px', color: 'var(--text-tertiary)' }}>${ts}</span>
            </div>
            ${version.change_note && html`<div style=${{ fontFamily: "'Inter',sans-serif", fontStyle: 'italic', fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px' }}>"${version.change_note}"</div>`}
            ${model && html`<span style=${{ display: 'inline-block', marginTop: '8px', fontFamily: "'JetBrains Mono',monospace", fontSize: '11px', padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--accent-bg)', color: 'var(--accent-primary)', border: '1px solid rgba(217,119,6,0.15)' }}>${model}</span>`}
            <${MiniSparkline} data=${sparklineData} />
            <div style=${{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                ${!isProduction && html`<button class="promote-btn btn-small" onClick=${() => onPromote(promptId, version.version_id)} style=${{ fontFamily: "'Syne',sans-serif", fontWeight: 600, fontSize: '12px', background: 'none', border: '1px solid rgba(217,119,6,0.3)', color: '#d97706', padding: '4px 14px', borderRadius: 'var(--radius-full)', cursor: 'pointer' }}>Promote</button>`}
                ${isProduction && html`<span style=${{ fontFamily: "'Syne',sans-serif", fontSize: '12px', color: '#d97706', fontWeight: 600 }}>Active</span>`}
            </div>
        </div>
    </div>`;
}

// --- Promotion History ---

function PromotionHistory({ aliasHistory }) {
    if (!aliasHistory || !aliasHistory.length) return null;
    return html`<div style=${{ marginTop: '24px' }}>
        <h3 style=${{ fontFamily: "'Syne',sans-serif", fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', marginBottom: '12px' }}>Promotion History</h3>
        ${aliasHistory.map((e, i) => html`<div key=${i} style=${{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', borderBottom: '1px solid var(--surface-divider)', fontFamily: "'JetBrains Mono',monospace", fontSize: '12px', color: 'var(--text-secondary)' }}>
            <span>${e.from_version_id != null ? 'v' + e.from_version_id : 'none'}</span>
            <span style=${{ color: 'var(--text-tertiary)' }}>\u2192</span>
            <span style=${{ color: '#d97706' }}>v${e.to_version_id}</span>
            <span style=${{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-tertiary)' }}>${e.changed_at ? new Date(e.changed_at).toLocaleString() : 'â€”'}</span>
        </div>`)}
    </div>`;
}

// --- Timeline Panel ---

function TimelinePanel({ visible, versionHistory, selectedPrompt, aliasHistory, onPromote, runHistory, loading }) {
    if (!visible) return null;
    const prodId = selectedPrompt ? selectedPrompt.production_version_id : null;
    function sparkData(vid) { return runHistory.filter(r => r.version_id === vid && r.status === 'success').map(r => ({ cost: parseFloat(r.cost_usd) || 0 })); }
    return html`<aside class="timeline-panel" style=${{ display: 'flex' }}>
        <div style=${{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h3 style=${{ fontFamily: "'Syne',sans-serif", fontSize: '16px', fontWeight: 700, margin: 0 }}>Timeline</h3>
            <span style=${{ fontFamily: "'JetBrains Mono',monospace", fontSize: '11px', color: 'var(--text-tertiary)' }}>${versionHistory.length} version${versionHistory.length !== 1 ? 's' : ''}</span>
        </div>
        ${loading ? html`<div style=${{ display: 'flex', flexDirection: 'column', gap: '16px', paddingLeft: '40px' }}>
            <${Skeleton} height="120px" /><${Skeleton} height="120px" /><${Skeleton} height="80px" />
        </div>` :
            versionHistory.length === 0
                ? html`<${EmptyState} icon="\u2295" title="No versions" sub="Create the first version of this prompt" />`
                : html`<div class="version-list" style=${{ position: 'relative', paddingBottom: '16px' }}>
                <div class="timeline-line"></div>
                ${versionHistory.map((v, i) => html`<${VersionCard} key=${v.version_id} version=${v} index=${i} isProduction=${prodId != null && v.version_id === prodId} onPromote=${onPromote} promptId=${selectedPrompt ? selectedPrompt.prompt_id : null} sparklineData=${sparkData(v.version_id)} />`)}
            </div>`
        }
        <${PromotionHistory} aliasHistory=${aliasHistory} />
    </aside>`;
}

// --- Prompt Item ---

function PromptItem({ prompt, isActive, onSelect }) {
    const hasProduction = !!prompt.production_version_id;
    return html`<div onClick=${() => onSelect(prompt)} class="prompt-item ${isActive ? 'active' : ''}" style=${{ cursor: 'pointer', position: 'relative' }}>
        <div style=${{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            ${hasProduction && html`<span style=${{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success-primary)', flexShrink: 0, boxShadow: '0 0 6px var(--success-glow)' }}></span>`}
            <span style=${{ fontFamily: "'Inter',sans-serif", fontWeight: 600, fontSize: '14px', color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}>${prompt.title}</span>
        </div>
        <div style=${{ fontFamily: "'JetBrains Mono',monospace", fontSize: '11px', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>${prompt.key}</div>
    </div>`;
}

// --- Sidebar ---

function Sidebar({ prompts, selectedPromptId, onSelectPrompt, onCreatePrompt, healthOnline, loading }) {
    return html`<aside class="sidebar">
        <div style=${{ padding: '20px 16px 16px' }}>
            <div style=${{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style=${{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: '18px', letterSpacing: '0.15em', color: '#d97706', margin: 0 }}>CHRONICLE</h1>
                <span style=${{ width: '6px', height: '6px', borderRadius: '50%', background: healthOnline ? '#16a34a' : '#dc2626', animation: healthOnline ? 'pulse-amber 2s ease infinite' : 'none' }}></span>
            </div>
            <div style=${{ fontFamily: "'Inter',sans-serif", fontWeight: 300, fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>Prompt Control Plane</div>
        </div>
        <div style=${{ padding: '0 12px 12px' }}>
            <button class="btn-primary" onClick=${onCreatePrompt} style=${{ width: '100%', fontFamily: "'Syne',sans-serif", fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px' }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/></svg> New Prompt
            </button>
        </div>
        <div class="prompt-list" style=${{ flex: 1, overflow: 'auto' }}>
            ${loading ? html`<div style=${{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <${Skeleton} height="48px" /><${Skeleton} height="48px" /><${Skeleton} height="48px" />
            </div>` :
            prompts.length === 0
                ? html`<${EmptyState} icon="\u2325" title="No prompts yet" sub="Create your first prompt to get started" />`
                : prompts.map(p => html`<${PromptItem} key=${p.prompt_id} prompt=${p} isActive=${selectedPromptId === p.prompt_id} onSelect=${onSelectPrompt} />`)}
        </div>
    </aside>`;
}

// --- Main Panel ---

function MainPanel({ selectedPrompt, versionHistory, runHistory, runResult, onCreateVersion, onDeletePrompt, onExecute, showToast, loading }) {
    if (!selectedPrompt) return html`<main class="main-panel">
        <div class="welcome-screen" style=${{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '16px' }}>
            <h2 style=${{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '28px', color: 'var(--text-primary)' }}>Chronicle</h2>
            <p style=${{ fontFamily: "'Inter',sans-serif", fontSize: '15px', color: 'var(--text-secondary)', maxWidth: '360px', textAlign: 'center', lineHeight: '1.6' }}>Select a prompt from the sidebar or create a new one to get started.</p>
        </div>
    </main>`;
    if (loading) return html`<main class="main-panel"><div style=${{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <${Skeleton} height="28px" width="40%" /><${Skeleton} height="16px" width="60%" /><${Skeleton} height="200px" style=${{ marginTop: '16px' }} /><${Skeleton} height="120px" />
    </div></main>`;
    return html`<main class="main-panel">
        <div class="prompt-view" style=${{ display: 'flex', flexDirection: 'column', padding: '32px', overflow: 'auto', height: '100%' }}>
            <div style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div>
                    <div style=${{ fontFamily: "'JetBrains Mono',monospace", fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>${selectedPrompt.key}</div>
                    <h2 style=${{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '24px', color: 'var(--text-primary)', margin: 0 }}>${selectedPrompt.title}</h2>
                    ${selectedPrompt.description && html`<p style=${{ fontFamily: "'Inter',sans-serif", fontSize: '14px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: '1.5' }}>${selectedPrompt.description}</p>`}
                </div>
                <button class="btn-danger-icon" onClick=${onDeletePrompt} title="Delete Prompt" style=${{ opacity: 0.6, transition: 'opacity 150ms' }} onMouseEnter=${e => e.currentTarget.style.opacity = '1'} onMouseLeave=${e => e.currentTarget.style.opacity = '0.6'}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 4h10M5 4V3a1 1 0 011-1h4a1 1 0 011 1v1M6 7v5M10 7v5M4 4l1 9a1 1 0 001 1h4a1 1 0 001-1l1-9"/></svg>
                </button>
            </div>
            <${VersionEditor} selectedPrompt=${selectedPrompt} onCreateVersion=${onCreateVersion} />
            <${ExecutionPanel} selectedPrompt=${selectedPrompt} versionHistory=${versionHistory} runHistory=${runHistory} runResult=${runResult} onExecute=${onExecute} showToast=${showToast} />
        </div>
    </main>`;
}
// --- App Component ---

function App() {
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
    const [loading, setLoading] = useState(true);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const toastTimer = useRef(null);

    function showToast(msg) {
        setToastMessage(msg); setToastVisible(true);
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToastVisible(false), 3000);
    }

    // --- 10 API Functions ---

    // 1. checkHealth
    async function checkHealth() {
        try { const r = await fetch(VC + '/prompts', { headers: API_HEADERS }); if (r.ok) { setHealthOnline(true); return true; } }
        catch (e) { console.error('Health check failed:', e); }
        setHealthOnline(false); return false;
    }

    // 2. fetchPrompts
    async function fetchPrompts() {
        try {
            const r = await fetch(VC + '/prompts', { headers: API_HEADERS });
            if (!r.ok) throw new Error('Failed: ' + r.status);
            const d = await r.json(); setPrompts(d); return d;
        } catch (e) { console.error('Error fetching prompts:', e); showToast('Failed to load prompts'); return []; }
    }

    // 3. fetchPromptDetails
    async function fetchPromptDetails(pid) {
        const r = await fetch(VC + '/prompts/' + pid, { headers: API_HEADERS });
        if (!r.ok) throw new Error('Failed: ' + r.status);
        return await r.json();
    }

    // 4. createPrompt
    async function createPrompt(key, title, description) {
        try {
            const body = key ? { key, title, description, created_by: crypto.randomUUID() } : { title, description, created_by: crypto.randomUUID() };
            const r = await fetch(VC + '/prompts', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) });
            if (!r.ok) { const e = await r.json(); throw new Error(e.detail || 'Failed: ' + r.status); }
            const np = await r.json(); showToast('Prompt created'); await fetchPrompts(); await handleSelectPrompt(np);
        } catch (e) { console.error('Error creating prompt:', e); showToast('Failed: ' + e.message); }
    }

    // 5. deletePrompt
    async function deletePrompt(pid) {
        try {
            const r = await fetch(VC + '/prompts/' + pid, { method: 'DELETE', headers: API_HEADERS });
            if (!r.ok) throw new Error('Failed: ' + r.status);
            showToast('Prompt deleted'); setSelectedPrompt(null); setVersionHistory([]); setAliasHistory([]); setRunHistory([]); setRunResult(null);
            await fetchPrompts();
        } catch (e) { console.error('Error deleting:', e); showToast('Failed to delete'); }
    }

    // 6. createVersion
    async function createVersion(promptText, modelSettings, changeNote) {
        if (!selectedPrompt) return;
        try {
            let parsed; try { parsed = modelSettings.trim() ? JSON.parse(modelSettings) : {}; } catch (e) { throw new Error('Invalid JSON in model settings'); }
            const r = await fetch(VC + '/versions', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ prompt_id: selectedPrompt.prompt_id, prompt_text: promptText, model_settings: parsed, change_note: changeNote, created_by: crypto.randomUUID() }) });
            if (!r.ok) { const e = await r.json(); throw new Error(e.detail || 'Failed: ' + r.status); }
            showToast('Version created');
            const up = await fetchPromptDetails(selectedPrompt.prompt_id); setSelectedPrompt(up);
            const vh = await fetchVersionHistoryData(selectedPrompt.prompt_id); setVersionHistory(vh);
        } catch (e) { console.error('Error creating version:', e); showToast('Failed: ' + e.message); }
    }

    // 7. fetchVersionHistory
    async function fetchVersionHistoryData(pid) {
        const r = await fetch(VC + '/versions/' + pid + '/history', { headers: API_HEADERS });
        if (!r.ok) throw new Error('Failed: ' + r.status);
        return await r.json();
    }

    // 8. promoteVersion
    async function promoteVersion(pid, vid) {
        try {
            const r = await fetch(VC + '/prompts/' + pid + '/promote', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ version_id: vid }) });
            if (!r.ok) { const e = await r.json(); throw new Error(e.detail || 'Failed: ' + r.status); }
            showToast('Version promoted to production');
            const up = await fetchPromptDetails(pid); setSelectedPrompt(up);
            const vh = await fetchVersionHistoryData(pid); setVersionHistory(vh);
            const ah = await fetchAliasHistoryData(pid); setAliasHistory(ah);
        } catch (e) { console.error('Error promoting:', e); showToast('Failed: ' + e.message); }
    }

    // 9. fetchAliasHistory
    async function fetchAliasHistoryData(pid) {
        try {
            const r = await fetch(VC + '/prompts/' + pid + '/alias-history', { headers: API_HEADERS });
            if (!r.ok) throw new Error('Failed: ' + r.status);
            return await r.json();
        } catch (e) { console.error('Error fetching alias history:', e); return []; }
    }

    // 10. executePrompt
    async function executePrompt(variables) {
        if (!selectedPrompt || !selectedPrompt.production_version_id) return;
        const pv = versionHistory.find(v => v.version_id === selectedPrompt.production_version_id);
        if (!pv) return;
        const model = pv.model_settings ? pv.model_settings.model : null;
        setRunResult(null);
        try {
            const r = await fetch(EXEC + '/execute/' + selectedPrompt.key, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ variables }) });
            const rid = r.headers.get('X-PromptOps-Run-ID') || r.headers.get('x-promptops-run-id');
            if (r.ok) {
                const d = await r.json();
                const res = { run_id: rid || d.run_id, status: d.status, latency_ms: d.latency_ms, response: d.response, model: d.model_used || model, tokens_prompt: d.prompt_tokens, tokens_completion: d.completion_tokens, cost_usd: d.cost_usd, error: null, version_id: selectedPrompt.production_version_id, timestamp: new Date().toLocaleString() };
                setRunResult(res); setRunHistory(prev => [res, ...prev]);
            } else {
                const ed = await r.json();
                const res = { run_id: rid || 'N/A', status: 'error', latency_ms: null, response: null, model, tokens_prompt: null, tokens_completion: null, cost_usd: null, error: ed.detail || 'HTTP ' + r.status, version_id: selectedPrompt.production_version_id, timestamp: new Date().toLocaleString() };
                setRunResult(res); setRunHistory(prev => [res, ...prev]);
            }
        } catch (e) {
            const res = { run_id: 'N/A', status: 'error', latency_ms: null, response: null, model, tokens_prompt: null, tokens_completion: null, cost_usd: null, error: e.message, version_id: selectedPrompt.production_version_id, timestamp: new Date().toLocaleString() };
            setRunResult(res); setRunHistory(prev => [res, ...prev]);
        }
    }

    // --- Selection / Delete ---
    async function handleSelectPrompt(prompt) {
        setRunHistory([]); setRunResult(null); setVersionHistory([]); setAliasHistory([]);
        setLoadingDetails(true);
        try {
            const d = await fetchPromptDetails(prompt.prompt_id); setSelectedPrompt(d);
            const vh = await fetchVersionHistoryData(prompt.prompt_id); setVersionHistory(vh);
            const ah = await fetchAliasHistoryData(prompt.prompt_id); setAliasHistory(ah);
        } catch (e) { console.error('Error selecting:', e); showToast('Failed to load'); }
        setLoadingDetails(false);
    }

    function handleDeletePrompt() {
        if (!selectedPrompt) return;
        setConfirmModal({
            visible: true, title: 'Delete Prompt', message: 'Delete this prompt and all versions? This cannot be undone.',
            callback: () => { deletePrompt(selectedPrompt.prompt_id); setConfirmModal({ visible: false, title: '', message: '', callback: null }); }
        });
    }

    // --- Init ---
    useEffect(() => {
        (async () => {
            const ok = await checkHealth();
            if (ok) await fetchPrompts();
            setLoading(false);
        })();
    }, []);

    // --- Render ---
    return html`<div class="app-container">
        <header class="app-header">
            <div class="header-content" style=${{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '0 24px', height: '100%' }}>
                <${ThemeSelector} />
            </div>
        </header>
        <${Sidebar} prompts=${prompts} selectedPromptId=${selectedPrompt ? selectedPrompt.prompt_id : null} onSelectPrompt=${handleSelectPrompt} onCreatePrompt=${() => setCreateModalVisible(true)} healthOnline=${healthOnline} loading=${loading} />
        <${MainPanel} selectedPrompt=${selectedPrompt} versionHistory=${versionHistory} runHistory=${runHistory} runResult=${runResult} onCreateVersion=${createVersion} onDeletePrompt=${handleDeletePrompt} onExecute=${executePrompt} showToast=${showToast} loading=${loadingDetails} />
        <${TimelinePanel} visible=${selectedPrompt !== null} versionHistory=${versionHistory} selectedPrompt=${selectedPrompt} aliasHistory=${aliasHistory} onPromote=${promoteVersion} runHistory=${runHistory} loading=${loadingDetails} />
        <${CreatePromptModal} visible=${createModalVisible} onClose=${() => setCreateModalVisible(false)} onCreate=${createPrompt} />
        <${ConfirmModal} visible=${confirmModal.visible} title=${confirmModal.title} message=${confirmModal.message} onConfirm=${confirmModal.callback} onClose=${() => setConfirmModal({ visible: false, title: '', message: '', callback: null })} />
        <${Toast} message=${toastMessage} visible=${toastVisible} />
    </div>`;
}

// --- Mount ---
const root = ReactDOM.createRoot(document.getElementById('app'));
root.render(html`<${App} />`);
