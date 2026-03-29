import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Topbar } from "../components/layout/Topbar";
import { Badge } from "../components/shared/Badge";
import { Modal } from "../components/shared/Modal";
import { Plus, Loader2, FlaskConical } from "lucide-react";
import { api, type EvalJobResponse, type PromptResponse, type DatasetResponse, type VersionResponse } from "../../lib/api";
import { EmptyState } from "../components/shared/EmptyState";

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
          <button 
            onClick={openCreateModal} 
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-[0.8125rem] font-bold rounded-xl transition-all shadow-lg shadow-primary/20 active:scale-95"
          >
            <Plus size={14} /> Create Eval Job
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground font-medium animate-pulse">
            <Loader2 size={20} className="animate-spin text-primary" /> Loading jobs...
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            <table className="w-full">
              <thead className="sticky top-0 z-10 bg-muted/50">
                <tr className="border-b border-border text-muted-foreground uppercase text-[0.6875rem] font-bold tracking-wider">
                  {["Job ID", "Prompt", "Version", "Dataset", "Status", "Accuracy", "Created"].map((h) => (
                    <th key={h} className="text-left px-4 py-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                      No evaluation jobs found.
                    </td>
                  </tr>
                ) : jobs.map((job) => (
                  <tr key={job.job_id} className="border-b border-border/10 table-row-hover transition-colors" onClick={() => job.status === "completed" && navigate(`/eval-analytics/${job.job_id}`)}>
                    <td className="px-4 py-3 text-[0.8125rem] text-muted-foreground font-mono">{job.job_id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-[0.8125rem] text-primary font-bold">{job.prompt_key || job.prompt_id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-[0.8125rem] text-foreground font-medium">{job.dataset_name || job.dataset_id.slice(0, 8)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {job.evaluators?.map((e) => <Badge key={e} variant="info">{e}</Badge>)}
                      </div>
                    </td>
                    <td className="px-4 py-3"><Badge variant={statusVariant[job.status] || "neutral"}>{job.status}</Badge></td>
                    <td className="px-4 py-3 text-[0.8125rem] text-foreground font-semibold">{job.summary?.accuracy != null ? `${(job.summary.accuracy * 100).toFixed(1)}%` : "—"}</td>
                    <td className="px-4 py-3 text-[0.8125rem] text-amber-500 font-medium font-mono">{job.summary?.total_cost != null ? `$${job.summary.total_cost.toFixed(4)}` : "—"}</td>
                    <td className="px-4 py-3 text-[0.8125rem] text-muted-foreground">{new Date(job.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Eval Job"
        footer={<>
          <button onClick={() => setCreateOpen(false)} className="px-4 py-2 text-[0.8125rem] text-muted-foreground bg-muted border border-border rounded-xl hover:bg-muted-hover transition-all font-bold">Cancel</button>
          <button onClick={handleCreate} className="px-6 py-2 text-[0.8125rem] bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all font-bold">Create Job</button>
        </>}>
        <div className="space-y-5">
          <div className="space-y-1.5">
            <label className="block text-[0.7rem] text-muted-foreground uppercase font-bold tracking-wider">Prompt</label>
            <select value={selectedPrompt} onChange={(e) => handlePromptChange(e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-3 text-[0.8125rem] text-foreground outline-none focus:ring-2 focus:ring-primary/10 transition-all shadow-sm">
              {prompts.map((p) => <option key={p.prompt_id} value={p.prompt_id}>{p.key} — {p.title}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-[0.7rem] text-muted-foreground uppercase font-bold tracking-wider">Version</label>
            <select value={selectedVersion} onChange={(e) => setSelectedVersion(e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-3 text-[0.8125rem] text-foreground outline-none focus:ring-2 focus:ring-primary/10 transition-all shadow-sm">
              {versions.map((v) => <option key={v.version_id} value={String(v.version_id)}>#{v.ordinal} (ID: {v.version_id})</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-[0.7rem] text-muted-foreground uppercase font-bold tracking-wider">Dataset</label>
            <select value={selectedDataset} onChange={(e) => setSelectedDataset(e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-3 text-[0.8125rem] text-foreground outline-none focus:ring-2 focus:ring-primary/10 transition-all shadow-sm">
              {datasets.map((d) => <option key={d.dataset_id} value={d.dataset_id}>{d.name}</option>)}
            </select>
          </div>
          <div className="space-y-2.5">
            <label className="block text-[0.7rem] text-muted-foreground uppercase font-bold tracking-wider">Evaluators</label>
            <div className="grid grid-cols-1 gap-2.5">
              {["exact_match", "llm_judge", "confidence_calibration"].map((e) => (
                <label key={e} className="flex items-center gap-3 p-3 bg-muted/30 border border-border rounded-xl cursor-pointer hover:bg-muted/50 transition-all group">
                  <input type="checkbox" checked={selectedEvaluators.includes(e)} onChange={() => toggleEvaluator(e)} className="w-4 h-4 rounded border-border bg-background text-primary focus:ring-primary/20 transition-all" />
                  <span className="text-[0.8125rem] text-foreground font-medium group-hover:text-primary transition-colors">{e.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
