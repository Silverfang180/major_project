import { useState, useEffect } from "react";
import { Topbar } from "../components/layout/Topbar";
import { Badge } from "../components/shared/Badge";
import { Modal } from "../components/shared/Modal";
import { Plus, Search, Filter, ChevronRight, Copy, Loader2 } from "lucide-react";
import { api, type PromptResponse, type VersionResponse } from "../../lib/api";

export function PromptsPage() {
  const [prompts, setPrompts] = useState<PromptResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [versions, setVersions] = useState<VersionResponse[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [aliasHistory, setAliasHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"versions" | "aliases" | "runs">("versions");
  const [search, setSearch] = useState("");

  // Create prompt form state
  const [newKey, setNewKey] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newPromptText, setNewPromptText] = useState("");

  useEffect(() => {
    loadPrompts();
  }, []);

  async function loadPrompts() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getPrompts();
      setPrompts(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectPrompt(promptId: string) {
    setSelectedPromptId(promptId);
    setActiveTab("versions");
    setVersionsLoading(true);
    try {
      const [vers, history] = await Promise.all([
        api.getVersions(promptId),
        api.getAliasHistory(promptId).catch(() => []),
      ]);
      setVersions(vers);
      setAliasHistory(history);
    } catch (e: any) {
      console.error("Failed to load versions:", e);
    } finally {
      setVersionsLoading(false);
    }
  }

  async function handleCreatePrompt() {
    if (!newKey.trim() || !newTitle.trim()) return;
    try {
      const prompt = await api.createPrompt(newKey.trim(), newTitle.trim());
      if (newPromptText.trim()) {
        await api.createVersion(prompt.prompt_id, newPromptText.trim());
      }
      setCreateOpen(false);
      setNewKey("");
      setNewTitle("");
      setNewPromptText("");
      loadPrompts();
    } catch (e: any) {
      alert("Failed to create prompt: " + e.message);
    }
  }

  async function handlePromote(promptId: string, versionId: number) {
    try {
      await api.promoteVersion(promptId, versionId);
      // Refresh
      loadPrompts();
      handleSelectPrompt(promptId);
    } catch (e: any) {
      alert("Failed to promote: " + e.message);
    }
  }

  const filtered = prompts.filter(
    (p) => p.key.includes(search.toLowerCase()) || p.title.toLowerCase().includes(search.toLowerCase())
  );

  const selectedPrompt = prompts.find((p) => p.prompt_id === selectedPromptId);

  if (selectedPromptId && selectedPrompt) {
    return (
      <div>
        <Topbar title={selectedPrompt.title} subtitle={`Prompt Key: ${selectedPrompt.key}`} />
        <div className="p-6">
          <button onClick={() => setSelectedPromptId(null)} className="text-slate-400 hover:text-white text-[0.8125rem] mb-4 flex items-center gap-1">
            ← Back to Prompts
          </button>
          <div className="flex gap-1 mb-6 bg-slate-800/30 p-1 rounded-lg w-fit">
            {(["versions", "aliases", "runs"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-md text-[0.8125rem] transition-colors ${activeTab === tab ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"}`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          {activeTab === "versions" && (
            versionsLoading ? (
              <div className="flex items-center gap-2 text-slate-400 text-sm"><Loader2 size={16} className="animate-spin" /> Loading versions...</div>
            ) : (
              <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700/50">
                      <th className="text-left text-[0.75rem] text-slate-500 px-4 py-3">Version ID</th>
                      <th className="text-left text-[0.75rem] text-slate-500 px-4 py-3">Ordinal</th>
                      <th className="text-left text-[0.75rem] text-slate-500 px-4 py-3">Author</th>
                      <th className="text-left text-[0.75rem] text-slate-500 px-4 py-3">Status</th>
                      <th className="text-left text-[0.75rem] text-slate-500 px-4 py-3">Created</th>
                      <th className="text-right text-[0.75rem] text-slate-500 px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {versions.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500 text-sm">No versions found</td></tr>
                    ) : versions.map((v) => (
                      <tr key={v.version_id} className="border-b border-slate-700/30 hover:bg-slate-800/50 transition-colors">
                        <td className="px-4 py-3 text-[0.8125rem] text-slate-300 font-mono">{v.version_id}</td>
                        <td className="px-4 py-3 text-[0.8125rem] text-slate-300">#{v.ordinal}</td>
                        <td className="px-4 py-3 text-[0.8125rem] text-slate-400">{v.created_by || "—"}</td>
                        <td className="px-4 py-3">
                          {selectedPrompt.production_version_id === v.version_id
                            ? <Badge variant="success">production</Badge>
                            : v.is_latest
                              ? <Badge variant="info">latest</Badge>
                              : <Badge variant="neutral">archived</Badge>}
                        </td>
                        <td className="px-4 py-3 text-[0.8125rem] text-slate-500">{new Date(v.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            disabled={selectedPrompt.production_version_id === v.version_id}
                            onClick={() => handlePromote(selectedPrompt.prompt_id, v.version_id)}
                            className="px-3 py-1 text-[0.75rem] border border-indigo-500/50 text-indigo-400 rounded-lg hover:bg-indigo-500/10 transition-colors disabled:opacity-30"
                          >
                            {selectedPrompt.production_version_id === v.version_id ? "Live" : "Promote"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
          {activeTab === "aliases" && (
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6">
              {aliasHistory.length === 0 ? (
                <p className="text-slate-500 text-sm">No promotion history yet.</p>
              ) : (
                <div className="space-y-3">
                  {aliasHistory.map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge variant="success">production</Badge>
                        <span className="text-[0.8125rem] text-slate-300 font-mono">→ version #{a.ordinal || a.version_id}</span>
                      </div>
                      <span className="text-[0.75rem] text-slate-500">{new Date(a.promoted_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {activeTab === "runs" && (
            <p className="text-slate-500 text-[0.8125rem]">View runs for this prompt on the Runs page.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <Topbar title="Prompts" subtitle="Version control for your LLM prompts" />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-1.5 gap-2">
              <Search size={14} className="text-slate-500" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search prompts..." className="bg-transparent text-[0.8125rem] text-slate-300 placeholder:text-slate-600 outline-none w-56" />
            </div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-[0.8125rem] text-slate-400 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors">
              <Filter size={14} /> Filter
            </button>
          </div>
          <button onClick={() => setCreateOpen(true)} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[0.8125rem] rounded-lg transition-colors shadow-lg shadow-indigo-500/20">
            <Plus size={14} /> Create Prompt
          </button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-slate-400"><Loader2 size={20} className="animate-spin" /> Loading prompts...</div>
        ) : error ? (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-6 text-rose-400 text-sm">
            <p className="font-medium mb-1">Failed to load prompts</p>
            <p className="text-rose-400/70">{error}</p>
            <button onClick={loadPrompts} className="mt-3 px-4 py-1.5 bg-rose-500/20 rounded-lg text-rose-300 text-xs hover:bg-rose-500/30">Retry</button>
          </div>
        ) : (
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="text-left text-[0.75rem] text-slate-500 px-4 py-3">Prompt Key</th>
                  <th className="text-left text-[0.75rem] text-slate-500 px-4 py-3">Title</th>
                  <th className="text-left text-[0.75rem] text-slate-500 px-4 py-3">Production</th>
                  <th className="text-left text-[0.75rem] text-slate-500 px-4 py-3">Updated</th>
                  <th className="text-right text-[0.75rem] text-slate-500 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500 text-sm">No prompts found. Create your first prompt to get started.</td></tr>
                ) : filtered.map((p) => (
                  <tr key={p.prompt_id} className="border-b border-slate-700/30 hover:bg-slate-800/50 cursor-pointer transition-colors" onClick={() => handleSelectPrompt(p.prompt_id)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <code className="text-[0.8125rem] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">{p.key}</code>
                        <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(p.key); }} className="text-slate-600 hover:text-slate-400">
                          <Copy size={12} />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[0.8125rem] text-slate-300">{p.title}</td>
                    <td className="px-4 py-3">
                      {p.latest_version ? (
                        <Badge variant="success">v{p.latest_version.ordinal}</Badge>
                      ) : (
                        <Badge variant="neutral">none</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[0.8125rem] text-slate-500">{new Date(p.updated_at || p.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right"><ChevronRight size={14} className="text-slate-600 inline" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Prompt"
        footer={<>
          <button onClick={() => setCreateOpen(false)} className="px-4 py-2 text-[0.8125rem] text-slate-400 border border-slate-600 rounded-lg hover:bg-slate-800">Cancel</button>
          <button onClick={handleCreatePrompt} className="px-4 py-2 text-[0.8125rem] bg-indigo-600 text-white rounded-lg hover:bg-indigo-500">Create</button>
        </>}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-[0.8125rem] text-slate-400 mb-1.5">Prompt Key</label>
            <input value={newKey} onChange={(e) => setNewKey(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-[0.8125rem] text-white outline-none focus:border-indigo-500" placeholder="e.g. chat-completion" />
          </div>
          <div>
            <label className="block text-[0.8125rem] text-slate-400 mb-1.5">Title</label>
            <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-[0.8125rem] text-white outline-none focus:border-indigo-500" placeholder="Human readable name" />
          </div>
          <div>
            <label className="block text-[0.8125rem] text-slate-400 mb-1.5">System Prompt (optional, creates first version)</label>
            <textarea value={newPromptText} onChange={(e) => setNewPromptText(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-[0.8125rem] text-white outline-none focus:border-indigo-500 h-32 font-mono resize-none" placeholder="You are a helpful assistant..." />
          </div>
        </div>
      </Modal>
    </div>
  );
}
