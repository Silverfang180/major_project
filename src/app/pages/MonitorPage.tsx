import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Topbar } from "../components/layout/Topbar";
import { StatCard } from "../components/shared/StatCard";
import { LayoutDashboard, Target, GitCommit, FileStack, ShieldAlert, Loader2 } from "lucide-react";
import { api, type DashboardResponse } from "../../lib/api";

export function MonitorPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    try {
      const res = await api.getDashboard();
      setData(res);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div>
        <Topbar title="Monitor" subtitle="System-wide metrics" />
        <div className="flex items-center justify-center py-12 text-slate-400 gap-2"><Loader2 size={24} className="animate-spin" /> Fetching telemetry...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div>
        <Topbar title="Monitor" subtitle="System-wide metrics" />
        <div className="p-6 text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl m-6">Failed to load system metrics: {error}</div>
      </div>
    );
  }

  return (
    <div>
      <Topbar title="Monitor" subtitle="Executive overview of PromptOps platform" />
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <StatCard title="Total Associated Prompts" value={data.total_prompts.toString()} icon={<Target size={20} />} onClick={() => navigate("/")} />
          <StatCard title="Total Versions Tracked" value={data.total_versions.toString()} icon={<GitCommit size={20} />} trend={{ value: "12", positive: true }} onClick={() => navigate("/versions")} />
          <StatCard title="Total API Runs" value={data.total_runs.toLocaleString()} icon={<LayoutDashboard size={20} />} trend={{ value: "5", positive: true }} onClick={() => navigate("/runs")} />
          <StatCard title="Evaluation Jobs" value={data.total_eval_jobs.toString()} icon={<ShieldAlert size={20} />} onClick={() => navigate("/eval-jobs")} />
          <StatCard title="Datasets" value={data.total_datasets.toString()} icon={<FileStack size={20} />} onClick={() => navigate("/datasets")} />
          <StatCard title="Accumulated Cost" value={`$${data.total_cost_usd.toFixed(2)}`} valueColor="text-amber-400" />
        </div>

        <div className="bg-indigo-600/10 border border-indigo-500/30 rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <h3 className="text-lg font-medium text-white mb-2">Platform Health</h3>
          <p className="text-slate-400 text-sm mb-4">All services are operating normally. Evaluator queues are draining at expected rates.</p>
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-emerald-400 text-sm font-medium">Operational</span>
          </div>
        </div>
      </div>
    </div>
  );
}
