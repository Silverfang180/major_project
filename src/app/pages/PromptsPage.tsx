import { useState, useEffect, useCallback } from "react";
import { Topbar } from "../components/layout/Topbar";
import { Badge } from "../components/shared/Badge";
import { Modal } from "../components/shared/Modal";
import {
  Plus, Search, ChevronRight, Copy, Loader2, Trash2,
  ArrowLeft, GitBranch, Zap, Clock, DollarSign, Play
} from "lucide-react";
import { toast } from "sonner";
import { api, getIdentity, type PromptResponse, type VersionResponse, type RunResponse } from "../../lib/api";
import { EmptyState } from "../components/shared/EmptyState";

// ── Model pricing (mirrors the GUI) ──────────────────────────────────────────
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "llama-3.3-70b-versatile": { input: 0.00059, output: 0.00079 },
  "llama-3.1-8b-instant":    { input: 0.00005, output: 0.00008 },
  "llama3-70b-8192":         { input: 0.00059, output: 0.00079 },
  "mixtral-8x7b-32768":      { input: 0.00024, output: 0.00024 },
  "gemma2-9b-it":            { input: 0.00020, output: 0.00020 },
  "gpt-4o":                  { input: 0.005,   output: 0.015   },
  "gpt-4o-mini":             { input: 0.00015, output: 0.0006  },
};
const MODEL_CONTEXT: Record<string, number> = {
  "llama-3.3-70b-versatile": 128000, "llama-3.1-8b-instant": 128000,
  "llama3-70b-8192": 8192, "mixtral-8x7b-32768": 32768,
  "gemma2-9b-it": 8192, "gpt-4o": 128000, "gpt-4o-mini": 128000,
};

function estimateTokens(text: string) { return Math.ceil(text.length / 4); }

function TokenBar({ text, modelJson }: { text: string; modelJson: string }) {
  if (!text) return null;
  const tokens = estimateTokens(text);
  let model: string | null = null;
  let cost: number | null = null;
  try {
    const parsed = JSON.parse(modelJson);
    model = parsed.model || null;
  } catch { /* ignore */ }
  if (model && MODEL_PRICING[model]) {
    cost = (tokens / 1000) * MODEL_PRICING[model].input;
  }
  const maxCtx = model ? (MODEL_CONTEXT[model] || 8192) : 8192;
  const pct = Math.min((tokens / maxCtx) * 100, 100);
  const barColor = pct > 80 ? "bg-rose-500" : pct > 50 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="mt-2 space-y-1.5">
      <p className="text-[0.75rem] font-mono text-muted-foreground">
        ~{tokens} tokens
        {cost !== null && <> · Est. <span className="text-amber-500 font-medium">${cost.toFixed(6)}</span></>}
        {model && <> · <span className="text-primary font-medium">{model}</span></>}
        {!model && " · Model not set"}
      </p>
      {model && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden shadow-inner">
            <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[0.6875rem] font-mono text-muted-foreground/60">
            {tokens.toLocaleString()} / {maxCtx.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Version Timeline Card ─────────────────────────────────────────────────────
function VersionCard({
  version, isProduction, isLatest, onPromote, onSelect, promptId, promoting
}: {
  version: VersionResponse;
  isProduction: boolean;
  isLatest: boolean;
  onPromote: (promptId: string, versionId: number) => void;
  onSelect: (v: VersionResponse) => void;
  promptId: string;
  promoting: boolean;
}) {
  let model: string | null = null;
  try { model = version.model_settings?.model || null; } catch { /* */ }

  return (
    <div className={`relative pl-8 pb-6 ${isProduction ? "opacity-100" : "opacity-80"}`}>
      {/* Timeline line */}
      <div className="absolute left-[11px] top-5 bottom-0 w-px bg-border/50" />
      {/* Timeline dot */}
      <div className={`absolute left-0 top-[18px] w-5 h-5 rounded-full border-2 flex items-center justify-center
        ${isProduction ? "border-emerald-500 bg-emerald-500/10 shadow-[0_0_8px_rgba(16,185,129,0.3)]" : "border-muted-foreground/30 bg-muted"}`}>
        {isProduction && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
      </div>

      <div 
        onClick={() => onSelect(version)}
        className={`bg-card border rounded-xl p-4 shadow-sm transition-all hover:shadow-md cursor-pointer hover:border-primary/50 group
        ${isProduction ? "border-emerald-500/30" : "border-border"}`}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-foreground font-bold text-lg font-mono">v{version.ordinal}</span>
            {isProduction && <Badge variant="success">PRODUCTION</Badge>}
            {isLatest && !isProduction && <Badge variant="info">latest</Badge>}
          </div>
          <span className="text-[0.6875rem] text-slate-600 font-mono whitespace-nowrap">
            {new Date(version.created_at).toLocaleString()}
          </span>
        </div>

        {version.change_note && (
          <p className="text-[0.8125rem] text-muted-foreground italic mb-2">"{version.change_note}"</p>
        )}

        {model && (
          <span className="inline-block text-[0.6875rem] font-mono bg-primary/10 text-primary border border-indigo-500/20 px-2 py-0.5 rounded-full mb-3">
            {model}
          </span>
        )}

        <div className="flex justify-end">
          {isProduction ? (
            <span className="text-[0.75rem] text-emerald-400 font-medium">Active</span>
          ) : (
            <button
              onClick={() => onPromote(promptId, version.version_id)}
              disabled={promoting}
              className="px-3 py-1 text-[0.75rem] border border-border text-primary rounded-full hover:bg-primary/10 transition-colors disabled:opacity-40"
            >
              {promoting ? "Promoting…" : "Promote →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function PromptsPage() {
  const [prompts, setPrompts] = useState<PromptResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Selected prompt (editor view)
  const [selectedPrompt, setSelectedPrompt] = useState<PromptResponse | null>(null);
  const [versions, setVersions] = useState<VersionResponse[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [aliasHistory, setAliasHistory] = useState<any[]>([]);
  const [promoting, setPromoting] = useState(false);

  // New version form
  const [vPromptText, setVPromptText] = useState("");
  const [vModelJson, setVModelJson] = useState('{"model":"llama-3.3-70b-versatile","temperature":0.7}');
  const [vChangeNote, setVChangeNote] = useState("");
  const [vSaving, setVSaving] = useState(false);
  const [vError, setVError] = useState<string | null>(null);

  const [execInputs, setExecInputs] = useState<Record<string, string>>({});
  const [executing, setExecuting] = useState(false);
  const [runResult, setRunResult] = useState<RunResponse | null>(null);

  // Model Settings Visual State
  const [showAdvancedModel, setShowAdvancedModel] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Create prompt modal
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [keyManuallyEdited, setKeyManuallyEdited] = useState(false);
  const [creating, setCreating] = useState(false);
  const [keySuffix, setKeySuffix] = useState("");

  // ── helpers ───────────────────────────────────────────────────────────────
  function handleTitleChange(v: string) {
    setNewTitle(v);
    if (!keyManuallyEdited) {
      const slug = v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
      const sfx = keySuffix || Math.random().toString(36).slice(2, 8);
      if (!keySuffix) setKeySuffix(sfx);
      setNewKey(slug ? `${slug}-${sfx}` : sfx);
    }
  }

  function resetCreateModal() {
    setNewTitle(""); setNewKey(""); setNewDesc("");
    setKeyManuallyEdited(false); setCreating(false); setKeySuffix("");
  }

  // ── data loaders ──────────────────────────────────────────────────────────
  const loadPrompts = useCallback(async () => {
    setLoading(true); setError(null);
    try { setPrompts(await api.getPrompts()); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadPrompts(); }, [loadPrompts]);

  async function openPrompt(prompt: PromptResponse) {
    setSelectedPrompt(prompt);
    setVPromptText("");
    setVChangeNote("");
    setVError(null);
    setVersionsLoading(true);
    try {
      const [vers, hist] = await Promise.all([
        api.getVersions(prompt.prompt_id),
        api.getAliasHistory(prompt.prompt_id).catch(() => []),
      ]);
      setVersions(vers);
      setAliasHistory(hist);
      // Pre-fill editor with latest version text
      const latest = vers.find(v => v.is_latest);
      if (latest) {
        setVPromptText(latest.prompt_text || "");
        if (latest.model_settings && Object.keys(latest.model_settings).length > 0) {
          setVModelJson(JSON.stringify(latest.model_settings, null, 2));
        }
      }
    } catch (e: any) { console.error(e); }
    finally { setVersionsLoading(false); }
  }

  async function handleCreate() {
    if (!newTitle.trim()) return;
    const finalKey = newKey.trim();
    if (!finalKey) return;
    setCreating(true);
    try {
      const identity = await getIdentity();
      const prompt = await api.createPrompt(finalKey, newTitle.trim(), identity, newDesc.trim());
      await loadPrompts();
      setCreateOpen(false);
      resetCreateModal();
      // Auto-navigate into the new prompt's editor
      setSelectedPrompt(prompt);
      setVersions([]);
      setAliasHistory([]);
      setVersionsLoading(false);
      setVPromptText("");
      setVChangeNote("");
      toast.success("Prompt created successfully");
    } catch (e: any) {
      toast.error("Failed to create prompt: " + e.message);
    } finally { setCreating(false); }
  }

  async function handleCreateVersion() {
    if (!selectedPrompt || !vPromptText.trim()) return;
    setVSaving(true); setVError(null);
    try {
      let modelSettings: Record<string, any> = {};
      if (vModelJson.trim()) {
        try { modelSettings = JSON.parse(vModelJson); }
        catch { setVError("Invalid JSON in model settings"); setVSaving(false); return; }
      }
      const identity = await getIdentity();
      await api.createVersion(selectedPrompt.prompt_id, vPromptText.trim(), identity, modelSettings);
      // Refresh versions & prompt list
      const [vers, , freshPrompts] = await Promise.all([
        api.getVersions(selectedPrompt.prompt_id),
        api.getAliasHistory(selectedPrompt.prompt_id).catch(() => []),
        api.getPrompts(),
      ]);
      setVersions(vers);
      setPrompts(freshPrompts);
      setVChangeNote("");
      // Update selected prompt reference
      const updated = freshPrompts.find(p => p.prompt_id === selectedPrompt.prompt_id);
      if (updated) setSelectedPrompt(updated);
      toast.success("New version saved");
    } catch (e: any) { setVError(e.message); }
    finally { setVSaving(false); }
  }

  async function handlePromote(promptId: string, versionId: number) {
    setPromoting(true);
    try {
      await api.promoteVersion(promptId, versionId);
      const [vers, freshPrompts] = await Promise.all([
        api.getVersions(promptId),
        api.getPrompts(),
      ]);
      setVersions(vers);
      setPrompts(freshPrompts);
      const updated = freshPrompts.find(p => p.prompt_id === promptId);
      if (updated) setSelectedPrompt(updated);
      toast.success("Version promoted to production");
    } catch (e: any) { toast.error("Failed to promote: " + e.message); }
    finally { setPromoting(false); }
  }

  async function handleDeletePrompt(promptId: string) {
    if (!confirm("Are you sure you want to move this prompt to trash?")) return;
    setIsDeleting(true);
    try {
      await api.deletePrompt(promptId);
      toast.success("Prompt moved to trash");
      setSelectedPrompt(null);
      await loadPrompts();
    } catch (e: any) {
      toast.error("Failed to delete: " + e.message);
    } finally {
      setIsDeleting(false);
    }
  }

  function selectVersion(v: VersionResponse) {
    setVPromptText(v.prompt_text);
    if (v.model_settings) {
      setVModelJson(JSON.stringify(v.model_settings, null, 2));
    }
    toast.info(`Loaded version v${v.ordinal} into editor`);
  }

  async function handleExecute() {
    if (!selectedPrompt || !selectedPrompt.production_version_id) {
      toast.error("Run failed: You must promote a version to production first.");
      return;
    }
    setExecuting(true); setRunResult(null);
    try {
      const res = await api.executePrompt(selectedPrompt.key, execInputs);
      setRunResult(res);
      toast.success("Prompt executed");
    } catch (e: any) {
      toast.error(e.message || "Execution failed");
    } finally {
      setExecuting(false);
    }
  }

  // Visual model editor config extract
  let currentModel = "llama-3.3-70b-versatile";
  let currentTemp = 0.7;
  try {
    if (vModelJson.trim()) {
      const pb = JSON.parse(vModelJson);
      if (pb.model) currentModel = pb.model;
      if (typeof pb.temperature === 'number') currentTemp = pb.temperature;
    }
  } catch (e) {}

  function handleVisualModelChange(modelName: string) {
    try {
      const pb = vModelJson.trim() ? JSON.parse(vModelJson) : {};
      setVModelJson(JSON.stringify({ ...pb, model: modelName }, null, 2));
    } catch(e) {
      setVModelJson(JSON.stringify({ model: modelName, temperature: currentTemp }, null, 2));
    }
  }

  function handleVisualTempChange(temp: number) {
    try {
      const pb = vModelJson.trim() ? JSON.parse(vModelJson) : {};
      setVModelJson(JSON.stringify({ ...pb, temperature: temp }, null, 2));
    } catch(e) {
      setVModelJson(JSON.stringify({ model: currentModel, temperature: temp }, null, 2));
    }
  }

  // ── Editor View (GUI-style) ───────────────────────────────────────────────
  if (selectedPrompt) {
    const prodVersionId = selectedPrompt.production_version_id;
    const detectedVars = Array.from(new Set([...vPromptText.matchAll(/\{\{([^}]+)\}\}/g)].map(m => m[1])));

    return (
      <div className="flex flex-col h-full">
        <Topbar
          title={selectedPrompt.title}
          subtitle={
            <div className="flex items-center gap-2">
              <code className="text-primary text-[0.7rem] font-mono bg-primary/10 px-2 py-0.5 rounded opacity-60">
                {selectedPrompt.key.slice(0, 6)}...{selectedPrompt.key.slice(-4)}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(selectedPrompt.key);
                  toast.success("Key copied to clipboard");
                }}
                className="p-1 hover:bg-muted rounded transition-colors text-muted-foreground hover:text-primary"
                title="Copy full prompt key"
              >
                <Copy size={12} />
              </button>
            </div>
          }
        />

        {/* 2-column layout: Editor left, Timeline right */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── Left: Editor ── */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <button
              onClick={() => setSelectedPrompt(null)}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-[0.8125rem] transition-colors"
            >
              <ArrowLeft size={14} /> Back to Prompts
            </button>

            {/* Prompt meta */}
            <div className="bg-card border border-border shadow-sm rounded-xl p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-foreground font-bold text-xl mb-1">{selectedPrompt.title}</h2>
                  <div className="flex items-center gap-2">
                    <code className="text-[0.7rem] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      {selectedPrompt.key}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(selectedPrompt.key);
                        toast.success("Key copied to clipboard");
                      }}
                      className="text-muted-foreground hover:text-primary"
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-3 text-[0.75rem] text-muted-foreground border-r pr-3">
                    <span className="flex items-center gap-1"><GitBranch size={12} /> {versions.length} versions</span>
                    {prodVersionId && <Badge variant="success">has production</Badge>}
                  </div>
                  <button
                    onClick={() => handleDeletePrompt(selectedPrompt.prompt_id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors border border-transparent hover:border-rose-500/20"
                  >
                    <Trash2 size={13} />
                    Delete
                  </button>
                </div>
              </div>
            </div>

            {/* ── New Version Editor ── */}
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="px-5 py-3 border-b border-border bg-muted/20">
                <h3 className="text-foreground font-bold text-sm uppercase tracking-wider">New Version</h3>
              </div>
              <div className="p-5 space-y-4">

                {/* Prompt text */}
                <div>
                  <label className="block text-[0.8125rem] font-medium text-muted-foreground mb-1.5 uppercase tracking-wide text-xs">
                    Prompt Text
                  </label>
                  <textarea
                    value={vPromptText}
                    onChange={e => setVPromptText(e.target.value)}
                    rows={8}
                    className="w-full bg-background border border-border focus:border-primary rounded-lg px-4 py-3 text-[0.8125rem] text-foreground font-mono outline-none resize-y transition-colors placeholder:text-muted-foreground/30"
                    placeholder="Enter your prompt text… Use {{variable}} for injected values"
                  />
                  <TokenBar text={vPromptText} modelJson={vModelJson} />
                </div>

                {/* Model settings */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[0.8125rem] font-medium text-muted-foreground uppercase tracking-wide text-xs">
                      Model Settings
                    </label>
                    <button 
                      onClick={() => setShowAdvancedModel(!showAdvancedModel)}
                      className="text-[0.6875rem] text-primary hover:opacity-80 uppercase tracking-wider font-semibold"
                    >
                      {showAdvancedModel ? "Simple View" : "Advanced JSON"}
                    </button>
                  </div>
                  
                  {showAdvancedModel ? (
                    <textarea
                      value={vModelJson}
                      onChange={e => setVModelJson(e.target.value)}
                      rows={3}
                      className="w-full bg-background border border-border focus:border-primary rounded-lg px-4 py-3 text-[0.8125rem] text-foreground font-mono outline-none resize-y transition-colors"
                      placeholder='{"model":"llama-3.3-70b-versatile","temperature":0.7}'
                    />
                  ) : (
                    <div className="bg-background border border-slate-700 rounded-lg p-4 space-y-4">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1.5 font-medium">Model</label>
                        <select 
                          value={currentModel}
                          onChange={e => handleVisualModelChange(e.target.value)}
                          className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-[0.8125rem] text-foreground outline-none focus:ring-2 focus:ring-primary/10 transition-all shadow-sm font-semibold"
                        >
                          {Object.keys(MODEL_PRICING).map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs text-slate-500 font-medium">Temperature</label>
                          <span className="text-xs text-primary font-mono">{currentTemp.toFixed(2)}</span>
                        </div>
                        <input 
                          type="range" 
                          min="0" max="2" step="0.05"
                          value={currentTemp}
                          onChange={e => handleVisualTempChange(parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary transition-all"
                        />
                        <div className="flex items-center justify-between mt-1 px-1">
                          <span className="text-[0.65rem] text-muted-foreground/60 font-medium">Focused</span>
                          <span className="text-[0.65rem] text-muted-foreground/60 font-medium">Creative</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Change note */}
                <div>
                  <label className="block text-[0.8125rem] font-medium text-muted-foreground mb-1.5 uppercase tracking-wide text-xs">
                    Change Note
                  </label>
                  <input
                    value={vChangeNote}
                    onChange={e => setVChangeNote(e.target.value)}
                    className="w-full bg-background border border-border focus:border-primary rounded-lg px-4 py-2.5 text-[0.8125rem] text-foreground outline-none transition-colors placeholder:text-muted-foreground/30"
                    placeholder="Describe what changed in this version…"
                  />
                </div>

                {vError && (
                  <p className="text-rose-400 text-[0.8125rem] bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                    {vError}
                  </p>
                )}

                <button
                  onClick={handleCreateVersion}
                  disabled={vSaving || !vPromptText.trim()}
                  className="w-full py-3 bg-primary hover:opacity-90 disabled:opacity-40 text-primary-foreground font-semibold text-[0.8125rem] uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2"
                >
                  {vSaving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : "Create New Version"}
                </button>
              </div>
            </div>

            {/* ── Execute Section ── */}
            <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden mt-6">
              <div className="px-5 py-3 border-b border-border bg-muted/20 flex items-center gap-3">
                <Play size={14} className="text-emerald-500" />
                <h3 className="text-foreground font-bold text-sm uppercase tracking-wider">Execute</h3>
                {prodVersionId ? (
                  <span className="text-[0.6875rem] font-mono text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-semibold">
                    Active: v{prodVersionId}
                  </span>
                ) : (
                  <span className="text-[0.6875rem] font-mono text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-semibold">
                    No active version
                  </span>
                )}
              </div>
              
              <div className="p-5 space-y-4">
                {detectedVars.length > 0 && (
                  <div className="space-y-3">
                    {detectedVars.map(variable => (
                      <div key={variable} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                        <label className="text-[0.8125rem] font-mono text-muted-foreground w-32 shrink-0">
                          {`{{${variable}}}`}
                        </label>
                        <input
                          value={execInputs[variable] || ""}
                          onChange={e => setExecInputs({ ...execInputs, [variable]: e.target.value })}
                          className="flex-1 bg-background border border-slate-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-[0.8125rem] text-foreground outline-none transition-colors"
                          placeholder={`Value for ${variable}...`}
                        />
                      </div>
                    ))}
                  </div>
                )}
                
                {detectedVars.length === 0 && (
                  <p className="text-[0.8125rem] text-slate-500 italic">No variables detected in prompt text.</p>
                )}

                <div className="pt-2">
                  <button
                    onClick={handleExecute}
                    disabled={executing || !prodVersionId}
                    className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:opacity-90 disabled:opacity-40 text-primary-foreground font-semibold text-[0.8125rem] uppercase tracking-wider rounded-lg transition-all"
                  >
                    {executing ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                    {executing ? "Sending…" : "Execute"}
                  </button>
                  {!prodVersionId && (
                    <p className="text-xs text-amber-500 mt-2">Promote a version to production before executing.</p>
                  )}
                </div>

                {/* Run Result */}
                {runResult && (
                  <div className={`mt-4 border rounded-xl overflow-hidden ${runResult.status === 'success' ? 'border-emerald-500/30' : 'border-rose-500/30'}`}>
                    <div className={`flex flex-wrap items-center gap-6 px-4 py-2 text-[0.75rem] ${runResult.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                      <span className="font-mono">Run ID: {runResult.run_id}</span>
                      {runResult.latency_ms && <span className="flex items-center gap-1"><Clock size={12} /> {runResult.latency_ms}ms</span>}
                      {runResult.cost_usd && <span className="flex items-center gap-1"><DollarSign size={12} /> ${runResult.cost_usd.toFixed(6)}</span>}
                    </div>
                    <div className="p-4 bg-background/50">
                      <pre className="text-[0.8125rem] text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
                        {runResult.error_detail || (runResult as any).response || runResult.raw_response?.choices?.[0]?.message?.content || "No output"}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Right: Timeline ── */}
          <aside className="w-80 shrink-0 border-l border-border/50 overflow-y-auto p-5 bg-background/30">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-foreground font-semibold text-sm">Timeline</h3>
              <span className="text-[0.75rem] font-mono text-slate-500">
                {versionsLoading ? "…" : `${versions.length} version${versions.length !== 1 ? "s" : ""}`}
              </span>
            </div>

            {versionsLoading ? (
              <div className="flex items-center gap-2 text-slate-500 text-sm">
                <Loader2 size={14} className="animate-spin" /> Loading…
              </div>
            ) : versions.length === 0 ? (
              <div className="text-center py-8 text-slate-600">
                <GitBranch size={28} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">No versions yet</p>
                <p className="text-xs mt-1">Create the first version</p>
              </div>
            ) : (
              <div className="space-y-0">
                {versions.map((v, i) => (
                  <VersionCard
                    key={v.version_id}
                    version={v}
                    isProduction={prodVersionId === v.version_id}
                    isLatest={i === 0}
                    onPromote={handlePromote}
                    onSelect={selectVersion}
                    promptId={selectedPrompt.prompt_id}
                    promoting={promoting}
                  />
                ))}
              </div>
            )}

            {/* Promotion history */}
            {aliasHistory.length > 0 && (
              <div className="mt-6 pt-6 border-t border-border/50">
                <h4 className="text-[0.75rem] uppercase tracking-wider text-slate-500 font-semibold mb-3">
                  Promotion History
                </h4>
                <div className="space-y-2">
                  {aliasHistory.map((a: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-[0.75rem] font-mono text-slate-500">
                      <span className="text-slate-600">{a.from_version_id != null ? `v${a.from_version_id}` : "none"}</span>
                      <span className="text-slate-600">→</span>
                      <span className="text-primary">v{a.to_version_id}</span>
                      <span className="ml-auto text-slate-600 text-[0.6875rem]">
                        {new Date(a.changed_at || a.promoted_at).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    );
  }

  // ── Prompts List ──────────────────────────────────────────────────────────
  const filtered = prompts.filter(
    p => p.key.includes(search.toLowerCase()) || p.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <Topbar title="Prompts" subtitle="Version control for your LLM prompts" />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center bg-background border border-border shadow-sm rounded-lg px-3 py-1.5 gap-2 group focus-within:ring-2 focus-within:ring-primary/10 transition-all">
            <Search size={14} className="text-muted-foreground group-focus-within:text-primary" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search prompts…"
              className="bg-transparent text-[0.8125rem] text-foreground placeholder:text-muted-foreground/50 outline-none w-56 font-medium"
            />
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-[0.8125rem] font-bold rounded-lg transition-all shadow-sm active:scale-95"
          >
            <Plus size={14} /> New Prompt
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 size={20} className="animate-spin" /> Loading prompts…
          </div>
        ) : error ? (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-6 text-rose-400 text-sm">
            <p className="font-medium mb-1">Failed to load prompts</p>
            <p className="text-rose-400/70">{error}</p>
            <button onClick={loadPrompts} className="mt-3 px-4 py-1.5 bg-rose-500/20 rounded-lg text-rose-300 text-xs hover:bg-rose-500/30">Retry</button>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            <table className="w-full">
              <thead className="sticky top-0 z-10 bg-muted/30">
                <tr className="border-b border-border text-muted-foreground uppercase text-[0.6875rem] font-bold tracking-wider">
                  <th className="text-left px-4 py-4">Title</th>
                  <th className="text-left px-4 py-4">Status</th>
                  <th className="text-left px-4 py-4">Updated</th>
                  <th className="text-right px-4 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-16">
                      <EmptyState
                        icon={Zap}
                        heading={search ? "No Matches Found" : "No Prompts Yet"}
                        subtext={
                          search
                            ? `We couldn't find any prompts matching "${search}". Try a different keyword.`
                            : "Chronicle helps you version and evaluate prompts. Create your first prompt to get started."
                        }
                        ctaLabel={search ? "Clear Search" : "Create Prompt"}
                        ctaAction={search ? () => setSearch("") : () => setCreateOpen(true)}
                      />
                    </td>
                  </tr>
                ) : filtered.map(p => (
                  <tr
                    key={p.prompt_id}
                    className="border-b border-slate-700/30 table-row-hover group/row"
                    onClick={() => openPrompt(p)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.production_version_id && (
                          <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(74,222,128,0.6)] shrink-0" />
                        )}
                        <span className="text-[0.8125rem] text-foreground font-semibold">{p.title}</span>
                        <div className="flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                          <button
                            onClick={e => { 
                              e.stopPropagation(); 
                              navigator.clipboard.writeText(p.key);
                              toast.success("Key copied");
                            }}
                            className="p-1 hover:bg-primary/10 rounded transition-colors text-muted-foreground hover:text-primary"
                            title="Copy Key"
                          >
                            <Copy size={11} />
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {p.production_version_id
                        ? <Badge variant="success">production</Badge>
                        : p.latest_version
                          ? <Badge variant="info">draft</Badge>
                          : <Badge variant="neutral">empty</Badge>
                      }
                    </td>
                    <td className="px-4 py-3 text-[0.8125rem] text-slate-500 font-mono">
                      {new Date(p.updated_at || p.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={e => { e.stopPropagation(); handleDeletePrompt(p.prompt_id); }}
                          className="p-2 hover:bg-rose-500/10 rounded-lg text-muted-foreground hover:text-rose-500 opacity-0 group-hover/row:opacity-100 transition-all"
                          title="Move to Trash"
                        >
                          <Trash2 size={14} />
                        </button>
                        <ChevronRight size={14} className="text-muted-foreground" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Create Prompt Modal ── */}
      <Modal
        open={createOpen}
        onClose={() => { setCreateOpen(false); resetCreateModal(); }}
        title="Create Prompt"
        footer={
          <>
            <button
              onClick={() => { setCreateOpen(false); resetCreateModal(); }}
              className="px-6 py-2.5 text-[0.8125rem] text-muted-foreground font-bold border border-border rounded-xl hover:bg-muted/50 hover:text-foreground transition-all shadow-sm active:scale-95"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !newTitle.trim()}
              className="px-6 py-2.5 text-[0.8125rem] bg-primary hover:opacity-90 disabled:opacity-40 text-primary-foreground font-bold rounded-xl flex items-center gap-2 transition-all shadow-sm active:scale-95"
            >
              {creating ? <><Loader2 size={13} className="animate-spin" /> Creating…</> : "Create"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Title first */}
          <div>
            <label className="block text-[0.8125rem] text-muted-foreground mb-1.5 uppercase tracking-wide text-xs font-bold">
              Title
            </label>
            <input
              value={newTitle}
              onChange={e => handleTitleChange(e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-[0.8125rem] text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all shadow-sm"
              placeholder="e.g. Customer Support Bot"
              autoFocus
            />
          </div>

          {/* Key (auto-generated, editable) */}
          <div>
            <label className="block text-[0.8125rem] text-muted-foreground mb-1 uppercase tracking-wide text-xs font-bold">
              Key <span className="text-muted-foreground/60 normal-case font-normal">(auto-generated from title)</span>
            </label>
            <input
              value={keyManuallyEdited ? newKey : (newTitle
                ? newTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) + "-······"
                : "")}
              onChange={e => { setNewKey(e.target.value); setKeyManuallyEdited(true); }}
              className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-[0.8125rem] text-muted-foreground font-mono outline-none focus:border-primary focus:text-foreground transition-all shadow-sm"
              placeholder="unique-identifier-slug"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[0.8125rem] text-muted-foreground mb-1.5 uppercase tracking-wide text-xs font-bold">
              Description <span className="text-muted-foreground/60 normal-case font-normal">(optional)</span>
            </label>
            <textarea
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              rows={3}
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-[0.8125rem] text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all resize-none shadow-sm placeholder:text-muted-foreground/40"
              placeholder="Describe the purpose of this prompt…"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
