import { useState, useEffect } from "react";
import { Topbar } from "../components/layout/Topbar";
import { Badge } from "../components/shared/Badge";
import { Play, Loader2, AlertTriangle, ChevronLeft, ChevronRight, Activity, ChevronDown } from "lucide-react";
import React from "react";
import { api, type RunResponse } from "../../lib/api";
import { EmptyState } from "../components/shared/EmptyState";

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
  const [expandedId, setExpandedId] = useState<number | null>(null);

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
  const filteredRuns = showOnlyErrors ? runs.filter((r: RunResponse) => r.status === "error") : runs;
  const totalPages = Math.max(1, Math.ceil(filteredRuns.length / PAGE_SIZE));
  const pagedRuns = filteredRuns.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const successCount = runs.filter((r: RunResponse) => r.status === "success").length;
  const errorCount = runs.filter((r: RunResponse) => r.status === "error").length;
  const errorRate = runs.length > 0 ? (errorCount / runs.length) * 100 : 0;
  const totalCost = runs.reduce((acc: number, r: RunResponse) => acc + (r.cost_usd || 0), 0);
  const avgLatency = runs.length > 0 ? runs.reduce((acc: number, r: RunResponse) => acc + (r.latency_ms || 0), 0) / runs.length : 0;

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
                <thead className="sticky top-0 z-10 bg-slate-900 shadow-sm shadow-slate-950/50">
                  <tr className="border-b border-slate-700/50 text-slate-500 uppercase text-[0.6875rem] font-semibold tracking-wider">
                    <th className="px-4 py-3 w-8"></th>
                    {["Timestamp", "Prompt", "Version", "Model", "Latency", "Cost", "Status"].map((h) => (
                      <th key={h} className="text-left px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedRuns.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12">
                        <EmptyState
                          icon={Activity}
                          heading={showOnlyErrors ? "No Errors Found" : "No Execution Logs"}
                          subtext={
                            showOnlyErrors
                              ? "Your prompts are performing well! No errors were found with the current filters."
                              : "No executions recorded yet. Trigger a prompt via the API or CLI to see real-time logs here."
                          }
                          ctaLabel={showOnlyErrors ? "Show All Runs" : undefined}
                          ctaAction={showOnlyErrors ? () => setShowOnlyErrors(false) : undefined}
                        />
                      </td>
                    </tr>
                  ) : pagedRuns.map((run) => (
                    <React.Fragment key={run.run_id}>
                      <tr 
                        className={`border-b border-slate-700/30 table-row-hover transition-colors ${expandedId === run.run_id ? 'bg-indigo-600/5' : ''}`}
                        onClick={() => setExpandedId(expandedId === run.run_id ? null : run.run_id)}
                      >
                        <td className="px-4 py-3 text-center">
                          <ChevronRight size={14} className={`text-slate-500 transition-transform ${expandedId === run.run_id ? 'rotate-90 text-indigo-400' : ''}`} />
                        </td>
                        <td className="px-4 py-3 text-[0.8125rem] text-slate-500">{new Date(run.created_at).toLocaleString()}</td>
                        <td className="px-4 py-3 text-[0.8125rem] text-indigo-400 font-medium">{run.prompt_key}</td>
                        <td className="px-4 py-3 text-[0.8125rem] text-slate-300">v{run.version_id}</td>
                        <td className="px-4 py-3">
                          <span className="text-[0.6875rem] bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-slate-300 font-mono">{run.model || "unknown"}</span>
                        </td>
                        <td className="px-4 py-3 text-[0.8125rem] text-slate-300">{run.latency_ms ? `${run.latency_ms}ms` : '—'}</td>
                        <td className="px-4 py-3 text-[0.8125rem] text-amber-400/80">{run.cost_usd ? `$${run.cost_usd.toFixed(4)}` : "—"}</td>
                        <td className="px-4 py-3">
                          <Badge variant={statusVariant[run.status] || "neutral"}>{run.status}</Badge>
                        </td>
                      </tr>
                      {expandedId === run.run_id && (
                        <tr className="bg-slate-900/40 border-b border-slate-700/30">
                          <td colSpan={8} className="px-4 py-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-top-2 duration-200">
                              <div>
                                <h4 className="text-[0.6875rem] text-slate-500 uppercase font-bold tracking-widest mb-3">Input Variables</h4>
                                <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-3 font-mono text-[0.75rem] text-emerald-400 overflow-x-auto max-h-64">
                                  {JSON.stringify(run.input_vars || {}, null, 2)}
                                </div>
                              </div>
                              <div>
                                <h4 className="text-[0.6875rem] text-slate-500 uppercase font-bold tracking-widest mb-3 flex items-center justify-between">
                                  Raw Response
                                  {run.status === 'error' && <span className="text-rose-400 normal-case font-medium">Error Occurred</span>}
                                </h4>
                                <div className={`bg-slate-950/50 border border-slate-800 rounded-lg p-3 font-mono text-[0.75rem] overflow-x-auto max-h-64 ${run.status === 'error' ? 'text-rose-300' : 'text-slate-300'}`}>
                                  {run.error_detail || JSON.stringify(run.raw_response || {}, null, 2)}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
