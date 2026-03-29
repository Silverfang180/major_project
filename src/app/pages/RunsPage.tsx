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
          <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
            <div className="text-muted-foreground mb-1 text-[0.8125rem] font-semibold flex items-center gap-2 uppercase tracking-wider"><Play size={14} className="text-primary" /> Total Runs</div>
            <div className="text-2xl font-bold text-foreground tracking-tight">{runs.length}</div>
          </div>
          <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
            <div className="text-muted-foreground mb-1 text-[0.8125rem] font-semibold uppercase tracking-wider">Avg Latency</div>
            <div className="text-2xl font-bold text-foreground tracking-tight">{avgLatency.toFixed(0)} <span className="text-xs font-normal text-muted-foreground">ms</span></div>
          </div>
          <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
            <div className="text-muted-foreground mb-1 text-[0.8125rem] font-semibold uppercase tracking-wider">Total Cost</div>
            <div className="text-2xl font-bold text-amber-500 tracking-tight">${totalCost.toFixed(4)}</div>
          </div>
          <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
            <div className="text-muted-foreground mb-1 text-[0.8125rem] font-semibold uppercase tracking-wider">Error Rate</div>
            <div className="text-2xl font-bold text-rose-500 tracking-tight">{errorRate.toFixed(1)}%</div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowOnlyErrors(!showOnlyErrors)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[0.8125rem] font-bold border transition-all shadow-sm ${
                showOnlyErrors
                  ? "bg-rose-500 text-white border-rose-600 scale-[1.02]"
                  : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
              }`}
            >
              <AlertTriangle size={14} />
              {showOnlyErrors ? `Showing ${errorCount} Errors` : "Filter Errors Only"}
            </button>
          </div>
          <div className="text-[0.7rem] text-muted-foreground font-black uppercase tracking-widest bg-muted/30 px-3 py-1.5 rounded-lg border border-border/50">
            Showing {pagedRuns.length} <span className="opacity-40 whitespace-pre"> of </span> {filteredRuns.length} <span className="opacity-40 whitespace-pre"> runs · Page </span> {page} <span className="opacity-40 whitespace-pre"> of </span> {totalPages}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
              <table className="w-full">
                <thead className="sticky top-0 z-10 bg-muted/30">
                  <tr className="border-b border-border text-muted-foreground uppercase text-[0.6875rem] font-bold tracking-wider">
                    <th className="px-4 py-4 w-8"></th>
                    {["Timestamp", "Prompt", "Version", "Model", "Latency", "Cost", "Status"].map((h) => (
                      <th key={h} className="text-left px-4 py-4">{h}</th>
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
                        className={`border-b border-border/10 table-row-hover transition-colors ${expandedId === run.run_id ? 'bg-primary/5' : ''}`}
                        onClick={() => setExpandedId(expandedId === run.run_id ? null : run.run_id)}
                      >
                        <td className="px-4 py-3 text-center">
                          <ChevronRight size={14} className={`text-muted-foreground transition-transform ${expandedId === run.run_id ? 'rotate-90 text-primary' : ''}`} />
                        </td>
                        <td className="px-4 py-3 text-[0.8125rem] text-muted-foreground">{new Date(run.created_at).toLocaleString()}</td>
                        <td className="px-4 py-3 text-[0.8125rem] text-primary font-bold">{run.prompt_key}</td>
                        <td className="px-4 py-3 text-[0.8125rem] text-muted-foreground font-mono">v{run.version_id}</td>
                        <td className="px-4 py-3">
                          <span className="text-[0.6875rem] bg-muted border border-border rounded px-1.5 py-0.5 text-foreground font-mono">{run.model || "unknown"}</span>
                        </td>
                        <td className="px-4 py-3 text-[0.8125rem] text-muted-foreground">{run.latency_ms ? `${run.latency_ms}ms` : '—'}</td>
                        <td className="px-4 py-3 text-[0.8125rem] text-amber-500 font-medium">{run.cost_usd ? `$${run.cost_usd.toFixed(4)}` : "—"}</td>
                        <td className="px-4 py-3">
                          <Badge variant={statusVariant[run.status] || "neutral"}>{run.status}</Badge>
                        </td>
                      </tr>
                      {expandedId === run.run_id && (
                        <tr className="bg-muted/10 border-b border-border/10">
                          <td colSpan={8} className="px-4 py-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-top-2 duration-200">
                              <div>
                                <h4 className="text-[0.6875rem] text-muted-foreground uppercase font-bold tracking-widest mb-3">Input Variables</h4>
                                <div className="bg-background border border-border rounded-lg p-3 font-mono text-[0.75rem] text-emerald-500 overflow-x-auto max-h-64 shadow-inner">
                                  {JSON.stringify(run.input_vars || {}, null, 2)}
                                </div>
                              </div>
                              <div>
                                <h4 className="text-[0.6875rem] text-muted-foreground uppercase font-bold tracking-widest mb-3 flex items-center justify-between">
                                  Raw Response
                                  {run.status === 'error' && <span className="text-rose-500 normal-case font-bold">Error Occurred</span>}
                                </h4>
                                <div className={`bg-background border border-border rounded-lg p-3 font-mono text-[0.75rem] overflow-x-auto max-h-64 shadow-inner ${run.status === 'error' ? 'text-rose-500' : 'text-foreground/80'}`}>
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
              <div className="flex items-center justify-center gap-3 pt-4">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-[0.8125rem] font-bold border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40 disabled:opacity-20 disabled:grayscale transition-all shadow-sm active:scale-95"
                >
                  <ChevronLeft size={16} /> Previous
                </button>
                <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-xl border border-border shadow-inner">
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
                        className={`w-9 h-9 rounded-lg text-[0.8125rem] font-bold transition-all ${
                          page === pageNum
                            ? "bg-primary text-primary-foreground shadow-md scale-110"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-[0.8125rem] font-bold border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40 disabled:opacity-20 disabled:grayscale transition-all shadow-sm active:scale-95"
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
