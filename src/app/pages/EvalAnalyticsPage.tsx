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
      <div>
        <Topbar title="Eval Analytics" subtitle="Loading job details..." />
        <div className="flex items-center justify-center h-[calc(100vh-100px)] text-slate-400 gap-2"><Loader2 size={24} className="animate-spin" /> Loading report...</div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div>
        <Topbar title="Eval Analytics" subtitle="Error" />
        <div className="p-6">
          <button onClick={() => navigate("/eval-jobs")} className="flex items-center gap-1 text-slate-400 hover:text-white mb-6 text-sm"><ArrowLeft size={16} /> Back to Jobs</button>
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-6 text-rose-400">{error || "Report not found"}</div>
        </div>
      </div>
    );
  }

  const { job, summary, results } = report;

  return (
    <div>
      <Topbar title={`Eval Job: ${job.job_id.slice(0, 8)}`} subtitle={`Prompt: ${job.prompt_key || job.prompt_id} (Version ${job.version_id})`} />
      <div className="p-6 space-y-6">
        <button onClick={() => navigate("/eval-jobs")} className="flex items-center gap-1 text-slate-400 hover:text-white text-sm"><ArrowLeft size={16} /> Back to Jobs</button>

        <div className="flex items-center gap-4 bg-slate-800/30 p-4 rounded-xl border border-slate-700/50">
          <div><span className="text-slate-500 text-xs block mb-1">Status</span><Badge variant={job.status === "completed" ? "success" : "error"}>{job.status}</Badge></div>
          <div className="w-px h-8 bg-slate-700/50"></div>
          <div><span className="text-slate-500 text-xs block mb-1">Dataset</span><span className="text-sm font-medium text-slate-300">{job.dataset_name || job.dataset_id}</span></div>
          <div className="w-px h-8 bg-slate-700/50"></div>
          <div><span className="text-slate-500 text-xs block mb-1">Evaluators</span><div className="flex gap-1">{job.evaluators.map((e) => <Badge key={e} variant="info">{e}</Badge>)}</div></div>
        </div>

        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Accuracy" value={summary.accuracy != null ? `${(summary.accuracy * 100).toFixed(1)}%` : "N/A"} icon={<CheckCircle size={20} />} valueColor="text-emerald-400" />
            <StatCard title="Avg Latency (p50)" value={summary.p50_latency_ms ? `${summary.p50_latency_ms} ms` : "N/A"} />
            <StatCard title="Total Cost" value={summary.total_cost != null ? `$${summary.total_cost.toFixed(4)}` : "N/A"} valueColor="text-amber-400" />
            <StatCard title="Cost / Correct" value={summary.cost_per_correct != null ? `$${summary.cost_per_correct.toFixed(4)}` : "N/A"} />
          </div>
        )}

        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700/50 bg-slate-800/50">
            <h3 className="text-sm font-medium text-white">Execution Results ({results.length})</h3>
          </div>
          <div className="max-h-[600px] overflow-y-auto w-full">
            <table className="w-full">
              <thead className="sticky top-0 bg-slate-900 shadow-[0_1px_0_theme(colors.slate.700/50)] z-10">
                <tr>
                  <th className="text-left text-[0.75rem] text-slate-500 px-4 py-3">Result ID</th>
                  <th className="text-left text-[0.75rem] text-slate-500 px-4 py-3">Actual Output</th>
                  <th className="text-left text-[0.75rem] text-slate-500 px-4 py-3 w-32">Match</th>
                  <th className="text-left text-[0.75rem] text-slate-500 px-4 py-3">Detailed Scores</th>
                </tr>
              </thead>
              <tbody>
                {results.map((res) => (
                  <tr key={res.result_id} className="border-b border-slate-700/30 hover:bg-slate-800/50">
                    <td className="px-4 py-3 text-[0.8125rem] text-slate-300 font-mono align-top">{res.result_id.slice(0, 8)}</td>
                    <td className="px-4 py-3 align-top">
                      <div className="max-h-24 overflow-y-auto text-[0.8125rem] text-slate-300 whitespace-pre-wrap">{res.actual_output || "—"}</div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      {res.is_correct ? (
                        <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium bg-emerald-400/10 px-2 py-1 rounded w-fit"><CheckCircle size={14} /> Correct</div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-rose-400 text-xs font-medium bg-rose-400/10 px-2 py-1 rounded w-fit"><XCircle size={14} /> Incorrect</div>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(res.evaluator_scores || {}).map(([metric, score]) => (
                          <div key={metric} className="text-[0.6875rem] bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-300">
                            <span className="text-slate-500 mr-1">{metric}:</span>{Number(score).toFixed(2)}
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
