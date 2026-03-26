import { useState, useEffect } from "react";
import { Topbar } from "../components/layout/Topbar";
import { Badge } from "../components/shared/Badge";
import { Play, Loader2, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { api, type RunResponse } from "../../lib/api";

const PAGE_SIZE = 25;

const statusVariant: Record<string, "success" | "error" | "pulse"> = {
  success: "success",
  error: "error",
  pending: "pulse",
};

export function RunsPage() {
  const [runs, setRuns] = useState<RunResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOnlyErrors, setShowOnlyErrors] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadRuns();
    const interval = setInterval(loadRuns, 5000);
    return () => clearInterval(interval);
  }, []);

  async function loadRuns() {
    try {
      const data = await api.getRuns().catch(() => []);
      setRuns(data);
    } finally {
      setLoading(false);
    }
  }

  // Derived data
  const filteredRuns = showOnlyErrors ? runs.filter((r) => r.status === "error") : runs;
  const totalPages = Math.max(1, Math.ceil(filteredRuns.length / PAGE_SIZE));
  const pagedRuns = filteredRuns.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const successCount = runs.filter((r) => r.status === "success").length;
  const errorCount = runs.filter((r) => r.status === "error").length;
  const errorRate = runs.length > 0 ? (errorCount / runs.length) * 100 : 0;
  const totalCost = runs.reduce((acc, r) => acc + (r.cost_usd || 0), 0);
  const avgLatency = runs.length > 0 ? runs.reduce((acc, r) => acc + (r.latency_ms || 0), 0) / runs.length : 0;

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [showOnlyErrors]);

  return (
    <div>
      <Topbar title="Runs" subtitle="Real-time execution logs from your applications" />
      <div className="p-6 space-y-6">
        {/* Stat Cards */}
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

        {/* Filter Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowOnlyErrors(!showOnlyErrors)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[0.8125rem] border transition-all ${
                showOnlyErrors
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                  : "border-slate-700 text-slate-400 hover:border-slate-600 hover:text-white"
              }`}
            >
              <AlertTriangle size={14} />
              {showOnlyErrors ? `Showing ${errorCount} Errors` : "Show Only Errors"}
            </button>
          </div>
          <div className="text-[0.75rem] text-slate-500">
            Showing {pagedRuns.length} of {filteredRuns.length} runs · Page {page} of {totalPages}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-slate-500" /></div>
        ) : (
          <>
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
                  {pagedRuns.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500 text-sm">
                      {showOnlyErrors ? "No errors found. Your prompts are performing well!" : "No executions recorded yet. Trigger a prompt via the API to see runs here."}
                    </td></tr>
                  ) : pagedRuns.map((run) => (
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

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[0.8125rem] border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft size={14} /> Previous
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 7) {
                    pageNum = i + 1;
                  } else if (page <= 4) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 3) {
                    pageNum = totalPages - 6 + i;
                  } else {
                    pageNum = page - 3 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-[0.8125rem] transition-all ${
                        page === pageNum
                          ? "bg-indigo-600 text-white"
                          : "text-slate-400 hover:bg-slate-800 hover:text-white"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[0.8125rem] border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
