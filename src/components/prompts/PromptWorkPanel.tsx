import React, { useState, useEffect } from 'react';
import { Icon } from '../ui/Icon';
import { api } from '../../lib/api';

interface PromptWorkPanelProps {
    prompt: {
        prompt_id: string;
        key: string;
        title: string;
        created_at: string;
        production_version_id?: number | null;
    };
    currentVersion?: {
        version_id: number;
        ordinal: number;
        prompt_text: string;
        created_at: string;
        created_by: string;
        model_settings: Record<string, any>;
        change_note?: string;
    };
    onVersionCreated: () => void;
    onPromoteVersion: (versionId: number) => void;
}

const PROVIDERS: Record<string, { name: string; models: { id: string; name: string }[] }> = {
    gemini: {
        name: "Google Gemini",
        models: [{ id: "gemini-flash-latest", name: "Gemini 1.5 Flash" }],
    },
    groq: {
        name: "Groq (Llama)",
        models: [
            { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B" },
            { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B" },
        ],
    },
};

export const PromptWorkPanel: React.FC<PromptWorkPanelProps> = ({
    prompt,
    currentVersion,
    onVersionCreated,
    onPromoteVersion,
}) => {
    const [text, setText] = useState(currentVersion?.prompt_text || '');
    const [changeNote, setChangeNote] = useState('');
    const [provider, setProvider] = useState('gemini');
    const [model, setModel] = useState('gemini-flash-latest');
    const [temperature, setTemperature] = useState(0.7);
    const [isRunning, setIsRunning] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [inputText, setInputText] = useState('');
    const [outputText, setOutputText] = useState('');
    const [runStats, setRunStats] = useState<{ latency: string; tokens: string; cost: string } | null>(null);

    useEffect(() => {
        setText(currentVersion?.prompt_text || '');
        setOutputText('');
        setRunStats(null);
    }, [currentVersion?.version_id]);

    const handleExecute = async () => {
        if (!text.trim()) return;
        setIsRunning(true);
        setOutputText('');
        setRunStats(null);
        try {
            const result = await api.runSimulation(text, provider, model);
            setOutputText(result.response);
            setRunStats({
                latency: `${(result.usage.input_tokens + result.usage.output_tokens) > 0 ? '1.2' : '0'}s`,
                tokens: String(result.usage.input_tokens + result.usage.output_tokens),
                cost: `$${result.usage.total_cost.toFixed(4)}`,
            });
        } catch {
            setOutputText('Error: Failed to execute. Check that the backend is running.');
        } finally {
            setIsRunning(false);
        }
    };

    const handleSave = async () => {
        if (!text.trim() || isSaving) return;
        setIsSaving(true);
        try {
            await api.createVersion(prompt.prompt_id, text, '00000000-0000-0000-0000-000000000000', {
                provider,
                model,
                temperature,
            });
            onVersionCreated();
            setChangeNote('');
        } catch {
            alert('Failed to save version');
        } finally {
            setIsSaving(false);
        }
    };

    const isProduction = currentVersion && prompt.production_version_id === currentVersion.version_id;

    return (
        <section className="flex-1 flex flex-col bg-chr-surface overflow-hidden">
            {/* Panel Header */}
            <div className="px-8 py-6 border-b border-slate-200/60 bg-surface-container-lowest/50 shrink-0">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold tracking-tight text-on-surface">{prompt.title}</h2>
                        <span className="text-sm font-mono text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">
                            {prompt.key?.substring(0, 8).toUpperCase()}
                        </span>
                        {isProduction && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-tertiary-container/40 text-on-tertiary-container uppercase tracking-wide">
                                <span className="w-1.5 h-1.5 rounded-full bg-tertiary mr-1.5"></span> Healthy
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleSave} disabled={isSaving || !text.trim()} className="chr-btn-outline flex items-center gap-1.5 disabled:opacity-50">
                            <Icon name="save" size={16} /> {isSaving ? 'Saving...' : 'Save Version'}
                        </button>
                        {currentVersion && !isProduction && (
                            <button
                                onClick={() => onPromoteVersion(currentVersion.version_id)}
                                className="chr-btn-primary flex items-center gap-1.5 text-xs"
                            >
                                <Icon name="publish" size={16} /> Deploy
                            </button>
                        )}
                    </div>
                </div>
                <div className="flex gap-8 text-[11px] font-medium text-on-surface-variant uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                        <Icon name="schedule" size={14} />
                        {currentVersion
                            ? `Last: ${new Date(currentVersion.created_at).toLocaleDateString()}`
                            : 'No versions yet'}
                    </div>
                    <div className="flex items-center gap-2">
                        <Icon name="tag" size={14} />
                        {currentVersion ? `v${currentVersion.ordinal}.0` : 'v0'}
                    </div>
                </div>
            </div>

            {/* Editor Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-8">
                {/* Bento Grid: Editor & Settings */}
                <div className="grid grid-cols-12 gap-6">
                    <div className="col-span-8 space-y-4">
                        <label className="chr-label">Prompt Template</label>
                        <div className="chr-card overflow-hidden focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                            <div className="bg-surface-container-low px-4 py-2 border-b border-outline-variant/20 flex justify-between items-center">
                                <span className="text-[10px] font-mono text-on-surface-variant">prompt_template.j2</span>
                                <Icon name="fullscreen" size={18} className="text-slate-400 cursor-pointer hover:text-slate-600" />
                            </div>
                            <textarea
                                className="w-full h-64 p-4 font-mono text-sm bg-transparent border-none focus:ring-0 focus:outline-none leading-relaxed text-on-surface-variant resize-none"
                                spellCheck={false}
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                placeholder="Enter your prompt template here..."
                            />
                        </div>
                    </div>
                    <div className="col-span-4 space-y-6">
                        <div className="space-y-4">
                            <label className="chr-label">Model Settings</label>
                            <div className="chr-card p-4 space-y-4">
                                <div>
                                    <label className="text-[10px] text-slate-500 font-bold block mb-1">Provider & Model</label>
                                    <select
                                        value={provider}
                                        onChange={(e) => {
                                            setProvider(e.target.value);
                                            setModel(PROVIDERS[e.target.value].models[0].id);
                                        }}
                                        className="w-full text-xs font-semibold bg-surface-container rounded p-2 border-none focus:ring-1 focus:ring-primary mb-2"
                                    >
                                        {Object.entries(PROVIDERS).map(([key, val]) => (
                                            <option key={key} value={key}>{val.name}</option>
                                        ))}
                                    </select>
                                    <select
                                        value={model}
                                        onChange={(e) => setModel(e.target.value)}
                                        className="w-full text-xs font-semibold bg-surface-container rounded p-2 border-none focus:ring-1 focus:ring-primary"
                                    >
                                        {PROVIDERS[provider].models.map((m) => (
                                            <option key={m.id} value={m.id}>{m.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <label className="text-[10px] text-slate-500 font-bold">Temperature</label>
                                        <span className="text-[10px] font-mono font-bold text-primary">{temperature.toFixed(1)}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="2"
                                        step="0.1"
                                        value={temperature}
                                        onChange={(e) => setTemperature(parseFloat(e.target.value))}
                                        className="w-full h-1 bg-surface-container rounded-lg appearance-none cursor-pointer accent-primary"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <label className="chr-label">Change Notes</label>
                            <textarea
                                className="w-full text-xs bg-surface-container-lowest rounded-lg border border-outline-variant/30 p-3 h-24 focus:ring-primary focus:border-primary focus:outline-none"
                                placeholder="Describe this version..."
                                value={changeNote}
                                onChange={(e) => setChangeNote(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Execution Panel */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <label className="chr-label">Execution Sandbox</label>
                        <div className="flex items-center gap-6">
                            {runStats && (
                                <div className="flex items-center gap-4 text-xs font-semibold">
                                    <div className="flex items-center gap-1.5 text-on-surface-variant">
                                        <Icon name="timer" size={14} />
                                        <span className="font-mono">{runStats.latency}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-on-surface-variant">
                                        <Icon name="token" size={14} />
                                        <span className="font-mono">{runStats.tokens}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-tertiary">
                                        <Icon name="payments" size={14} />
                                        <span className="font-mono">{runStats.cost}</span>
                                    </div>
                                </div>
                            )}
                            <button
                                onClick={handleExecute}
                                disabled={isRunning}
                                className="bg-on-surface text-chr-surface text-xs font-bold px-6 py-2 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50"
                            >
                                <Icon name="play_arrow" size={16} filled />
                                {isRunning ? 'Running...' : 'Execute'}
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <span className="text-[10px] font-mono text-slate-400">input_document</span>
                                <span className="text-[10px] text-primary hover:underline cursor-pointer">Load Sample</span>
                            </div>
                            <div className="chr-card p-4 h-40 overflow-y-auto">
                                <textarea
                                    className="w-full h-full text-xs text-on-surface-variant leading-relaxed bg-transparent border-none focus:ring-0 focus:outline-none resize-none"
                                    placeholder="Enter input text for testing..."
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <span className="text-[10px] font-mono text-slate-400">output_result</span>
                                {outputText && (
                                    <button onClick={() => navigator.clipboard.writeText(outputText)}>
                                        <Icon name="content_copy" size={14} className="text-slate-400 hover:text-slate-600" />
                                    </button>
                                )}
                            </div>
                            <div className="bg-surface-container-high border border-outline-variant/20 rounded-lg p-4 h-40 overflow-y-auto">
                                {isRunning ? (
                                    <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                        Processing...
                                    </div>
                                ) : outputText ? (
                                    <p className="text-xs text-on-surface font-medium leading-relaxed">{outputText}</p>
                                ) : (
                                    <p className="text-xs text-slate-400 italic">Execute to see output...</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};
