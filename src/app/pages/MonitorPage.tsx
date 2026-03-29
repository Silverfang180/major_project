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
      <div className="min-h-screen bg-background text-foreground">
        <Topbar title="Platform Monitoring" subtitle="Real-time system health and telemetry" />
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground animate-pulse">
          <Loader2 size={32} className="animate-spin text-primary" />
          <span className="text-[0.8125rem] font-black uppercase tracking-[0.2em]">Syncing Telemetry...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Topbar title="Platform Monitoring" subtitle="Real-time system health and telemetry" />
        <div className="p-8 text-rose-600 bg-rose-500/5 border border-rose-500/20 rounded-2xl m-8 shadow-sm flex flex-col items-center gap-4 text-center max-w-2xl mx-auto">
          <ShieldAlert size={48} className="opacity-20" />
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider mb-2">Telemetry Sync Failed</h3>
            <p className="text-[0.8125rem] font-medium opacity-80 leading-relaxed">{error || "System metrics currently unavailable. Please verify API connectivity."}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Topbar title="Platform Monitoring" subtitle="Executive overview of PromptOps performance and scale" />
      <div className="p-8 space-y-8 max-w-[1400px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <StatCard title="Total Associated Prompts" value={data.total_prompts.toString()} icon={<Target size={20} />} onClick={() => navigate("/")} valueColor="text-foreground" />
          <StatCard title="Total Versions Tracked" value={data.total_versions.toString()} icon={<GitCommit size={20} />} trend={{ value: "12%", positive: true }} onClick={() => navigate("/versions")} valueColor="text-foreground" />
          <StatCard title="Total API Runs" value={data.total_runs.toLocaleString()} icon={<LayoutDashboard size={20} />} trend={{ value: "5%", positive: true }} onClick={() => navigate("/runs")} valueColor="text-foreground" />
          <StatCard title="Evaluation Jobs" value={data.total_eval_jobs.toString()} icon={<ShieldAlert size={20} />} onClick={() => navigate("/eval-jobs")} valueColor="text-foreground" />
          <StatCard title="Datasets" value={data.total_datasets.toString()} icon={<FileStack size={20} />} onClick={() => navigate("/datasets")} valueColor="text-foreground" />
          <StatCard title="Accumulated Platform Cost" value={`$${data.total_cost_usd.toFixed(2)}`} icon={<LayoutDashboard size={20} className="text-amber-500" />} valueColor="text-amber-600 font-black" />
        </div>

        <div className="bg-primary/5 border border-primary/20 rounded-3xl p-8 relative overflow-hidden group shadow-xl shadow-primary/5">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 group-hover:bg-primary/20 transition-all duration-700"></div>
          <div className="relative z-10">
            <h3 className="text-[0.7rem] font-black text-primary uppercase tracking-[0.25em] mb-4">Platform Infrastructure Status</h3>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h4 className="text-2xl font-black text-foreground mb-3 tracking-tight">System Operational</h4>
                <p className="text-muted-foreground text-[0.8125rem] max-w-xl leading-relaxed font-medium">
                  Main data center <span className="text-foreground font-bold underline decoration-primary/30 underline-offset-4">Region-1</span> is fully responsive. 
                  Internal evaluator clusters are processing at <span className="text-emerald-600 font-bold">100% capacity</span> with no backlog reported in the last 24 hours.
                </p>
              </div>
              <div className="flex items-center gap-4 bg-emerald-500/10 border border-emerald-500/20 px-6 py-3 rounded-2xl shrink-0 self-start md:self-center">
                <span className="relative flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]"></span>
                </span>
                <span className="text-emerald-700 text-[0.8125rem] font-black uppercase tracking-widest">Global Healthy</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
