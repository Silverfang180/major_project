import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Topbar } from "../components/layout/Topbar";
import { Badge } from "../components/shared/Badge";
import { Modal } from "../components/shared/Modal";
import { Plus, Loader2 } from "lucide-react";
import { api, type EvalJobResponse, type PromptResponse, type DatasetResponse, type VersionResponse } from "../../lib/api";

const statusVariant: Record<string, "neutral" | "pulse" | "success" | "error"> = {
  pending: "neutral",
  running: "pulse",
  completed: "success",
  failed: "error",
};

export function EvalJobsPage() {
  const [jobs, setJobs] = useState<EvalJobResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();

  // Form data
  const [prompts, setPrompts] = useState<PromptResponse[]>([]);
  const [datasets, setDatasets] = useState<DatasetResponse[]>([]);
  const [versions, setVersions] = useState<VersionResponse[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState("");
  const [selectedVersion, setSelectedVersion] = useState("");
  const [selectedDataset, setSelectedDataset] = useState("");
  const [selectedEvaluators, setSelectedEvaluators] = useState<string[]>(["exact_match"]);

  useEffect(() => {
    loadJobs();
  }, []);

  async function loadJobs() {
    setLoading(true);
    try {
      const data = await api.getEvalJobs();
      setJobs(data);
    } catch (e: any) {
      console.error("Failed to load eval jobs:", e);
    } finally {
      setLoading(false);
    }
  }

  async function openCreateModal() {
    setCreateOpen(true);
    try {
      const [p, d] = await Promise.all([api.getPrompts(), api.getDatasets()]);
      setPrompts(p);
      setDatasets(d);
      if (p.length > 0) {
        setSelectedPrompt(p[0].prompt_id);
        const vers = await api.getVersions(p[0].prompt_id);
        setVersions(vers);
        if (vers.length > 0) setSelectedVersion(String(vers[0].version_id));
      }
      if (d.length > 0) setSelectedDataset(d[0].dataset_id);
    } catch { }
  }

  async function handlePromptChange(promptId: string) {
    setSelectedPrompt(promptId);
    try {
      const vers = await api.getVersions(promptId);
      setVersions(vers);
      if (vers.length > 0) setSelectedVersion(String(vers[0].version_id));
    } catch {
      setVersions([]);
    }
  }

  async function handleCreate() {
    if (!selectedPrompt || !selectedVersion || !selectedDataset) return;
    try {
      await api.createEvalJob(selectedPrompt, Number(selectedVersion), selectedDataset, selectedEvaluators);
      setCreateOpen(false);
      loadJobs();
    } catch (e: any) {
      alert("Failed: " + e.message);
    }
  }

  function toggleEvaluator(e: string) {
    setSelectedEvaluators((prev) =>
      prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]
    );
  }

  // Auto-refresh running jobs
  useEffect(() => {
    const hasRunning = jobs.some((j) => j.status === "running" || j.status === "pending");
    if (!hasRunning) return;
    const interval = setInterval(loadJobs, 3000);
    return () => clearInterval(interval);
  }, [jobs]);

  return (
    <div>
      <Topbar title="Eval Jobs" subtitle="Background evaluation processing" />
      <div className="p-6 space-y-6">
        <div className="flex justify-end">
          <button onClick={openCreateModal} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[0.8125rem] rounded-lg transition-colors shadow-lg shadow-indigo-500/20">
            <Plus size={14} /> Create Eval Job
          </button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-slate-400"><Loader2 size={20} className="animate-spin" /> Loading jobs...</div>
        ) : (
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700/50">
                  {["Job ID", "Prompt", "Dataset", "Evaluators", "Status", "Accuracy", "Cost", "Created"].map((h) => (
                    <th key={h} className="text-left text-[0.75rem] text-slate-500 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500 text-sm">No eval jobs yet.</td></tr>
                ) : jobs.map((job) => (
                  <tr key={job.job_id} className="border-b border-slate-700/30 hover:bg-slate-800/50 cursor-pointer transition-colors" onClick={() => job.status === "completed" && navigate(`/eval-analytics/${job.job_id}`)}>
                    <td className="px-4 py-3 text-[0.8125rem] text-slate-300 font-mono">{job.job_id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-[0.8125rem] text-indigo-400">{job.prompt_key || job.prompt_id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-[0.8125rem] text-slate-300">{job.dataset_name || job.dataset_id.slice(0, 8)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {job.evaluators?.map((e) => <Badge key={e} variant="info">{e}</Badge>)}
                      </div>
                    </td>
                    <td className="px-4 py-3"><Badge variant={statusVariant[job.status] || "neutral"}>{job.status}</Badge></td>
                    <td className="px-4 py-3 text-[0.8125rem] text-slate-300">{job.summary?.accuracy != null ? `${(job.summary.accuracy * 100).toFixed(1)}%` : "—"}</td>
                    <td className="px-4 py-3 text-[0.8125rem] text-slate-300">{job.summary?.total_cost != null ? `$${job.summary.total_cost.toFixed(4)}` : "—"}</td>
                    <td className="px-4 py-3 text-[0.8125rem] text-slate-500">{new Date(job.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Eval Job"
        footer={<>
          <button onClick={() => setCreateOpen(false)} className="px-4 py-2 text-[0.8125rem] text-slate-400 border border-slate-600 rounded-lg hover:bg-slate-800">Cancel</button>
          <button onClick={handleCreate} className="px-4 py-2 text-[0.8125rem] bg-indigo-600 text-white rounded-lg hover:bg-indigo-500">Create</button>
        </>}>
        <div className="space-y-4">
          <div>
            <label className="block text-[0.8125rem] text-slate-400 mb-1.5">Prompt</label>
            <select value={selectedPrompt} onChange={(e) => handlePromptChange(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-[0.8125rem] text-white outline-none">
              {prompts.map((p) => <option key={p.prompt_id} value={p.prompt_id}>{p.key} — {p.title}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[0.8125rem] text-slate-400 mb-1.5">Version</label>
            <select value={selectedVersion} onChange={(e) => setSelectedVersion(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-[0.8125rem] text-white outline-none">
              {versions.map((v) => <option key={v.version_id} value={String(v.version_id)}>#{v.ordinal} (ID: {v.version_id})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[0.8125rem] text-slate-400 mb-1.5">Dataset</label>
            <select value={selectedDataset} onChange={(e) => setSelectedDataset(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-[0.8125rem] text-white outline-none">
              {datasets.map((d) => <option key={d.dataset_id} value={d.dataset_id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[0.8125rem] text-slate-400 mb-1.5">Evaluators</label>
            <div className="space-y-2">
              {["exact_match", "llm_judge", "confidence_calibration"].map((e) => (
                <label key={e} className="flex items-center gap-2 text-[0.8125rem] text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={selectedEvaluators.includes(e)} onChange={() => toggleEvaluator(e)} className="rounded border-slate-600 bg-slate-800 text-indigo-600" />
                  {e.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
