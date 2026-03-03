import { useState, useEffect } from "react";
import { Topbar } from "../components/layout/Topbar";
import { Badge } from "../components/shared/Badge";
import { Play, Loader2, ArrowRight } from "lucide-react";
import { api, type RunResponse } from "../../lib/api";

const statusVariant: Record<string, "success" | "error" | "pulse"> = {
  success: "success",
  error: "error",
  pending: "pulse",
};

export function RunsPage() {
  const [runs, setRuns] = useState<RunResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRuns();
    const interval = setInterval(loadRuns, 5000); // Auto-refresh for live execution updates
    return () => clearInterval(interval);
  }, []);

  async function loadRuns() {
    try {
      // Assuming a GET /api/v1/runs endpoint is added to execution/routes.py
      // For now we will fetch from execution module (or mock if not strictly available)
      const data = await api.getRuns().catch(() => []);
      setRuns(data);
    } finally {
      setLoading(false);
    }
  }

  const successCount = runs.filter((r) => r.status === "success").length;
  const errorRate = runs.length > 0 ? ((runs.length - successCount) / runs.length) * 100 : 0;
  const totalCost = runs.reduce((acc, r) => acc + (r.cost_usd || 0), 0);
  const avgLatency = runs.length > 0 ? runs.reduce((acc, r) => acc + (r.latency_ms || 0), 0) / runs.length : 0;

  return (
    <div>
      <Topbar title="Runs" subtitle="Real-time execution logs from your applications" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-800/30 border border-slate-700/50 p-4 rounded-xl">
            <div className="text-slate-500 mb-1 text-sm font-medium flex items-center gap-2"><Play size={14} /> Total Runs</div>
            <div className="text-2xl font-semibold text-white">{runs.length}</div>
          </div>
          <div className="bg-slate-800/30 border border-slate-700/50 p-4 rounded-xl">
            <div className="text-slate-500 mb-1 text-sm font-medium">Avg Latency</div>
            <div className="text-2xl font-semibold text-white">{avgLatency.toFixed(0)} ms</div>
          </div>
          <div className="bg-slate-800/30 border border-slate-700/50 p-4 rounded-xl">
            <div className="text-slate-500 mb-1 text-sm font-medium">Total Cost</div>
            <div className="text-2xl font-semibold text-amber-400">${totalCost.toFixed(4)}</div>
          </div>
          <div className="bg-slate-800/30 border border-slate-700/50 p-4 rounded-xl">
            <div className="text-slate-500 mb-1 text-sm font-medium">Error Rate</div>
            <div className="text-2xl font-semibold text-rose-400">{errorRate.toFixed(1)}%</div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-slate-500" /></div>
        ) : (
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700/50">
                  {["Timestamp", "Prompt", "Version", "Model", "Latency", "Cost", "Status"].map((h) => (
                    <th key={h} className="text-left text-[0.75rem] text-slate-500 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {runs.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500 text-sm">No executions recorded yet. Trigger a prompt via the API to see runs here.</td></tr>
                ) : runs.map((run) => (
                  <tr key={run.run_id} className="border-b border-slate-700/30 hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 text-[0.8125rem] text-slate-500">{new Date(run.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-[0.8125rem] text-indigo-400">{run.prompt_key}</td>
                    <td className="px-4 py-3 text-[0.8125rem] text-slate-300">v{run.version_id}</td>
                    <td className="px-4 py-3">
                      <span className="text-[0.6875rem] bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-slate-300">{run.model || "unknown"}</span>
                    </td>
                    <td className="px-4 py-3 text-[0.8125rem] text-slate-300">{run.latency_ms}ms</td>
                    <td className="px-4 py-3 text-[0.8125rem] text-amber-400/80">{run.cost_usd ? `$${run.cost_usd.toFixed(4)}` : "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant[run.status] || "neutral"}>{run.status}</Badge>
                      {run.error_detail && <div className="text-[0.6875rem] text-rose-500/70 mt-1 max-w-xs truncate" title={run.error_detail}>{run.error_detail}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
