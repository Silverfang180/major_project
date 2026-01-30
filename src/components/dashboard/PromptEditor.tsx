import React, { useState, useEffect } from 'react';
import type { Version } from '../../lib/mockData';
import { Play, Save, Copy, Loader2, Sparkles, Split, Settings2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { api } from '../../lib/api';

interface PromptEditorProps {
    version: Version;
    isReadOnly?: boolean;
    onSave: (text: string, usage?: any) => void;
    onToggleDiff: () => void;
    showDiff: boolean;
}

const PROVIDERS = {
    gemini: {
        name: "Google Gemini",
        models: [
            { id: "gemini-flash-latest", name: "Gemini 1.5 Flash (Free)" }
        ]
    },
    groq: {
        name: "Groq (Llama)",
        models: [
            { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B (New)" },
            { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B (Fast)" }
        ]
    }
};

export const PromptEditor: React.FC<PromptEditorProps> = ({ version, isReadOnly = false, onSave, onToggleDiff, showDiff }) => {
    const [text, setText] = useState(version.text);
    const [isRunning, setIsRunning] = useState(false);
    const [output, setOutput] = useState<string | null>(null);
    const [lastUsage, setLastUsage] = useState<any>(null);

    // Model Selection State
    const [provider, setProvider] = useState<string>("gemini");
    const [model, setModel] = useState<string>("gemini-flash-latest");

    // Reset text when version changes
    useEffect(() => {
        setText(version.text);
        // If saving a run, we keep the output visible, but if switching versions, clear it?
        // Actually, if we switch versions, we should probably clear.
        if (version.id !== "Draft" && !version.id.startsWith("v")) {
            // Special case for initial load maybe?
        } else {
            setOutput(null);
            setLastUsage(null);
        }
    }, [version.id]);

    // Update text if version text changes (external update)
    useEffect(() => {
        setText(version.text);
    }, [version.text]);


    const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newProvider = e.target.value;
        setProvider(newProvider);
        // Default to first model of new provider
        setModel(PROVIDERS[newProvider as keyof typeof PROVIDERS].models[0].id);
    };

    const handleRun = async () => {
        if (!text.trim()) return;

        setIsRunning(true);
        setOutput(null);
        setLastUsage(null);
        try {
            const result = await api.runSimulation(text, provider, model);

            // Save usage AND metadata for saving later
            // We pack everything into 'usage' object or a separate custom object?
            // The API expects 'usage' to be the model_settings object.
            const fullUsageData = {
                ...result.usage,
                ai_response: result.response,
                provider: provider,
                model: model
            };

            setLastUsage(fullUsageData);

            // Display response + calculated cost
            const costInfo = `\n\n-------------------\n[System Analysis]\nModel: ${model}\nInput Tokens: ${result.usage.input_tokens}\nOutput Tokens: ${result.usage.output_tokens}\nEst. Cost: $${result.usage.total_cost.toFixed(6)}`;

            setOutput(result.response + costInfo);
        } catch (e) {
            console.error("Simulation error", e);
            setOutput("Error: Failed to run simulation. Ensure backend is running and API keys (Gemini/Groq) are set.");
        } finally {
            setIsRunning(false);
        }
    };

    // Allow save if text changed OR if we have new run data (usage)
    // AND text is not empty/whitespace
    const canSave = text.trim().length > 0 && (text !== version.text || lastUsage !== null);

    return (
        <div className="flex-1 flex flex-col h-full bg-background relative overflow-hidden">
            {/* Editor Toolbar */}
            <div className="h-14 border-b border-border flex items-center justify-between px-6 bg-card shrink-0">
                <div className="flex items-center gap-4">
                    <h1 className="font-semibold text-lg">Prompt Editor</h1>

                    {/* Model Selector */}
                    <div className="flex items-center gap-2 border-l border-border pl-4">
                        <Settings2 className="w-4 h-4 text-muted-foreground" />

                        <select
                            value={provider}
                            onChange={handleProviderChange}
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium"
                        >
                            {Object.entries(PROVIDERS).map(([key, val]) => (
                                <option key={key} value={key}>{val.name}</option>
                            ))}
                        </select>

                        <select
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium max-w-[150px]"
                        >
                            {PROVIDERS[provider as keyof typeof PROVIDERS].models.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                    </div>

                    {text !== version.text && (
                        <span className="text-xs text-yellow-500 font-medium animate-pulse ml-2">Unsaved Changes</span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onToggleDiff}
                        className={cn(
                            "flex items-center gap-2 px-3 py-1.5 text-sm font-medium transition-colors rounded-md border",
                            showDiff
                                ? "bg-secondary text-secondary-foreground border-border"
                                : "text-muted-foreground hover:text-foreground hover:bg-accent border-transparent"
                        )}
                        title="Toggle Diff View"
                    >
                        <Split className="w-4 h-4" />
                        {showDiff ? "Hide Changes" : "Compare"}
                    </button>
                    <button
                        onClick={() => navigator.clipboard.writeText(text)}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hover:bg-accent rounded-md"
                    >
                        <Copy className="w-4 h-4" />
                        Copy
                    </button>
                    <button
                        onClick={() => onSave(text, lastUsage)}
                        disabled={!canSave}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hover:bg-accent rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Save className="w-4 h-4" />
                        Save as New
                    </button>
                    <div className="h-4 w-px bg-border mx-2" />
                    <button
                        onClick={handleRun}
                        disabled={isRunning}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md shadow-sm transition-all font-medium text-sm disabled:opacity-70"
                    >
                        {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                        Run Prompt
                    </button>
                </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0">
                {/* Main Editor Area */}
                <div className={`relative transition-all duration-300 ${output ? 'h-1/2 border-b border-border' : 'h-full'}`}>
                    <textarea
                        readOnly={isReadOnly}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        className={cn(
                            "w-full h-full p-8 resize-none bg-transparent font-mono text-base leading-relaxed focus:outline-none",
                            "text-foreground placeholder:text-muted-foreground"
                        )}
                        placeholder="Enter your prompt here..."
                        spellCheck={false}
                    />
                    {/* Floating Stats */}
                    <div className="absolute bottom-4 right-4 flex gap-4 text-xs font-mono text-muted-foreground pointer-events-none">
                        <span>Tokens: ~{Math.ceil(text.length / 4)}</span>
                        <span>Chars: {text.length}</span>
                    </div>
                </div>

                {/* Output Panel */}
                {output && (
                    <div className="flex-1 bg-secondary/10 p-6 overflow-y-auto animate-in slide-in-from-bottom duration-300">
                        <div className="flex items-center gap-2 mb-4 text-sm font-semibold text-primary">
                            <Sparkles className="w-4 h-4" />
                            AI Output ({provider})
                        </div>
                        <div className="font-mono text-sm text-foreground/90 whitespace-pre-wrap leading-loose">
                            {output}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
