import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { Topbar } from "../components/layout/Topbar";
import { Badge } from "../components/shared/Badge";
import { StatCard } from "../components/shared/StatCard";
import { ArrowLeft, Loader2, CheckCircle, XCircle } from "lucide-react";
import { api, type EvalJobReportResponse } from "../../lib/api";

export function EvalAnalyticsPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<EvalJobReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (jobId) loadReport();
  }, [jobId]);

  async function loadReport() {
    setLoading(true);
    try {
      const data = await api.getEvalJobReport(jobId!);
      setReport(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Topbar title="Eval Analytics" subtitle="Synthesizing evaluation report..." />
        <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)] text-muted-foreground gap-4 animate-pulse">
          <Loader2 size={32} className="animate-spin text-primary" />
          <span className="text-[0.8125rem] font-black uppercase tracking-widest">Generating Insights...</span>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Topbar title="Eval Analytics" subtitle="System Error" />
        <div className="p-8 max-w-2xl mx-auto text-center space-y-6">
          <button onClick={() => navigate("/eval-jobs")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mx-auto text-[0.8125rem] font-bold transition-all"><ArrowLeft size={16} /> Back to Evaluation Jobs</button>
          <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-8 text-rose-600 shadow-sm">
            <h3 className="text-sm font-black uppercase tracking-wider mb-2">Report Compilation Failed</h3>
            <p className="text-[0.8125rem] opacity-80 leading-relaxed font-medium">{error || "The requested evaluation report could not be located in our traces."}</p>
          </div>
        </div>
      </div>
    );
  }

  const { job, summary, results } = report;

  return (
    <div>
      <Topbar title={`Eval Job: ${job.job_id.slice(0, 8)}`} subtitle={`Prompt: ${job.prompt_key || job.prompt_id} (Version ${job.version_id})`} />
      <div className="p-6 space-y-6">
        <button onClick={() => navigate("/eval-jobs")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-[0.8125rem] font-black uppercase tracking-widest transition-all bg-card border border-border px-4 py-2 rounded-xl shadow-sm w-fit active:scale-95"><ArrowLeft size={16} className="text-primary" /> Back to Evaluation Registry</button>

        <div className="flex flex-wrap items-center gap-6 bg-card p-6 rounded-2xl border border-border shadow-sm">
          <div className="flex flex-col gap-2">
            <span className="text-muted-foreground text-[0.65rem] font-black uppercase tracking-[0.2em] opacity-60">Job Status</span>
            <Badge variant={job.status === "completed" ? "success" : "error"} className="w-fit scale-110 origin-left">{job.status}</Badge>
          </div>
          <div className="w-px h-12 bg-border/50 hidden md:block"></div>
          <div className="flex flex-col gap-1.5 min-w-[200px]">
            <span className="text-muted-foreground text-[0.65rem] font-black uppercase tracking-[0.2em] opacity-60">Dataset Source</span>
            <span className="text-[0.9375rem] font-bold text-foreground font-mono">{job.dataset_name || job.dataset_id}</span>
          </div>
          <div className="w-px h-12 bg-border/50 hidden md:block"></div>
          <div className="flex flex-col gap-2">
            <span className="text-muted-foreground text-[0.65rem] font-black uppercase tracking-[0.2em] opacity-60">Active Evaluators</span>
            <div className="flex flex-wrap gap-1.5">{job.evaluators.map((e) => <Badge key={e} variant="info" className="font-black uppercase tracking-tighter shadow-sm">{e}</Badge>)}</div>
          </div>
        </div>

        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Accuracy" value={summary.accuracy != null ? `${(summary.accuracy * 100).toFixed(1)}%` : "N/A"} icon={<CheckCircle size={20} />} valueColor="text-emerald-400" />
            <StatCard title="Avg Latency (p50)" value={summary.p50_latency_ms ? `${summary.p50_latency_ms} ms` : "N/A"} />
            <StatCard title="Total Cost" value={summary.total_cost != null ? `$${summary.total_cost.toFixed(4)}` : "N/A"} valueColor="text-amber-400" />
            <StatCard title="Cost / Correct" value={summary.cost_per_correct != null ? `$${summary.cost_per_correct.toFixed(4)}` : "N/A"} />
          </div>
        )}

        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-5 border-b border-border bg-muted/20">
            <h3 className="text-sm font-black text-foreground uppercase tracking-widest">Execution Evidence ({results.length})</h3>
          </div>
          <div className="max-h-[600px] overflow-y-auto w-full">
            <table className="w-full">
              <thead className="sticky top-0 bg-card/95 backdrop-blur-md border-b border-border/50 z-10 shadow-sm">
                <tr>
                  {["Trace ID", "Output Artifact", "Validation", "Metric Breakdown"].map((h) => (
                    <th key={h} className="text-left text-[0.6875rem] text-muted-foreground uppercase font-black tracking-widest px-6 py-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((res) => (
                  <tr key={res.result_id} className="border-b border-border/5 table-row-hover transition-colors">
                    <td className="px-6 py-4 text-[0.8125rem] text-muted-foreground font-mono font-bold align-top">{res.result_id.slice(0, 8)}</td>
                    <td className="px-6 py-4 align-top">
                      <div className="max-h-32 overflow-y-auto text-[0.8125rem] text-foreground font-medium leading-relaxed max-w-xl">{res.actual_output || "—"}</div>
                    </td>
                    <td className="px-6 py-4 align-top">
                      {res.is_correct ? (
                        <div className="flex items-center gap-2 text-emerald-600 text-[0.7rem] font-black uppercase tracking-widest bg-emerald-500/5 border border-emerald-500/20 px-3 py-1.5 rounded-xl w-fit shadow-sm"><CheckCircle size={14} className="text-emerald-500" /> PASS</div>
                      ) : (
                        <div className="flex items-center gap-2 text-rose-600 text-[0.7rem] font-black uppercase tracking-widest bg-rose-500/5 border border-rose-500/20 px-3 py-1.5 rounded-xl w-fit shadow-sm"><XCircle size={14} className="text-rose-500" /> FAIL</div>
                      )}
                    </td>
                    <td className="px-6 py-4 align-top">
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(res.evaluator_scores || {}).map(([metric, score]) => (
                          <div key={metric} className="text-[0.6875rem] bg-muted/30 border border-border/50 rounded-lg px-2.5 py-1 text-foreground font-bold shadow-sm">
                            <span className="text-muted-foreground mr-1.5 font-medium">{metric}:</span>{Number(score).toFixed(2)}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
