import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Topbar } from "../components/layout/Topbar";
import { StatCard } from "../components/shared/StatCard";
import { ChartCard } from "../components/shared/ChartCard";
import { Badge } from "../components/shared/Badge";
import { 
  FileText, Play, FlaskConical, DollarSign, Activity, 
  ArrowUpRight, Plus, ExternalLink, Zap, BarChart3, Trash2
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { api, type DashboardResponse } from "../../lib/api";



export function DashboardPage() {
  const [stats, setStats] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const data = await api.getDashboard();
      setStats(data);
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
    }
  }

    const isLight = document.documentElement.classList.contains('light');
    const chartColors = {
      grid: isLight ? "#f1f5f9" : "#1e293b",
      axis: isLight ? "#94a3b8" : "#475569",
      tooltipBg: isLight ? "#ffffff" : "#0f172a",
      tooltipBorder: isLight ? "#e2e8f0" : "#1e293b",
      primary: isLight ? "#0f172a" : "#ffffff",
      secondary: isLight ? "#94a3b8" : "#475569"
    };

    return (
      <div className="pb-12">
        <Topbar 
          title="Command Center" 
          subtitle="Global project overview and performance metrics" 
        />
        
        <div className="p-6 space-y-8">
          {/* Metric Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Total Prompts"
              value={stats?.total_prompts || 0}
              subtitle={`${stats?.total_versions || 0} production versions`}
              icon={<FileText size={20} />}
              trend={{ value: "12%", positive: true }}
            />
            <StatCard
              title="Global Executions"
              value={stats?.total_runs || 0}
              subtitle="Last 30 days"
              icon={<Play size={20} />}
              trend={{ value: "24%", positive: true }}
            />
            <StatCard
              title="Total Project Cost"
              value={`$${(stats?.total_cost_usd || 0).toFixed(2)}`}
              subtitle="All deployments"
              icon={<DollarSign size={20} />}
              valueColor="text-foreground"
            />
            <StatCard
              title="Avg Performance"
              value={stats?.avg_performance ? `${(stats.avg_performance * 100).toFixed(1)}%` : "N/A"}
              subtitle="Across all eval jobs"
              icon={<Activity size={20} />}
              valueColor="text-foreground"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Chart Area */}
            <div className="lg:col-span-2">
              <ChartCard 
                title="Consumption History" 
                subtitle="Daily execution volume and aggregate cost across all environments"
              >
                <div className="h-[340px] mt-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats?.trend || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                      <XAxis 
                        dataKey="day" 
                        stroke={chartColors.axis} 
                        fontSize={11} 
                        tickLine={false} 
                        axisLine={false} 
                        dy={10}
                        className="font-mono"
                      />
                      <YAxis 
                        stroke={chartColors.axis} 
                        fontSize={11} 
                        tickLine={false} 
                        axisLine={false} 
                        tickFormatter={(v) => `$${v}`}
                        className="font-mono"
                      />
                      <Tooltip 
                        cursor={{ fill: isLight ? '#f8fafc' : '#1e293b', opacity: 0.4 }}
                        contentStyle={{ 
                          backgroundColor: chartColors.tooltipBg, 
                          border: `1px solid ${chartColors.tooltipBorder}`, 
                          borderRadius: "12px",
                          padding: "12px",
                          boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)"
                        }}
                        labelStyle={{ color: isLight ? "#64748b" : "#94a3b8", fontSize: "11px", fontWeight: "600", marginBottom: "4px", textTransform: "uppercase" }}
                        itemStyle={{ fontSize: "13px", fontWeight: "700", color: chartColors.primary, padding: "0" }}
                      />
                      <Bar 
                        dataKey="cost" 
                        fill={chartColors.primary} 
                        radius={[4, 4, 0, 0]} 
                        barSize={32}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            </div>

          {/* Quick Actions & Recent Activity */}
            <div className="space-y-6">
              <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wider text-[0.6875rem]">Quick Actions</h3>
                <div className="space-y-2">
                  <button 
                    onClick={() => navigate("/prompts")}
                    className="w-full flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all text-sm group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-primary rounded-md text-primary-foreground transition-transform">
                        <Plus size={16} />
                      </div>
                      Create Prompt
                    </div>
                    <ArrowUpRight size={14} className="opacity-50" />
                  </button>
                  <button 
                    onClick={() => navigate("/eval-jobs")}
                    className="w-full flex items-center justify-between p-3 rounded-lg bg-muted border border-border text-foreground hover:bg-accent transition-all text-sm group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-background border border-border rounded-md text-foreground">
                        <Play size={16} />
                      </div>
                      Run Evaluation
                    </div>
                    <ArrowUpRight size={14} className="opacity-50" />
                  </button>
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wider text-[0.6875rem]">Project Status</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex items-center gap-3">
                      <Badge variant="success">Active</Badge>
                      <span className="text-sm text-foreground font-medium">Production Alias</span>
                    </div>
                    <span className="text-xs text-muted-foreground">v42</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-sm text-foreground">API Health</span>
                    </div>
                    <span className="text-xs text-emerald-500 font-medium font-mono uppercase tracking-tighter">99.9%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Zap size={14} className="text-amber-500" />
                      <span className="text-sm text-foreground uppercase tracking-wide font-medium">Active Jobs</span>
                    </div>
                    <span className="text-xs text-muted-foreground">2 Running</span>
                  </div>
                </div>
              </div>
            
            <a 
              href="https://github.com/Abhishek/Chronicle" 
              target="_blank" 
              className="flex items-center justify-center gap-2 p-3 text-[0.7rem] text-muted-foreground hover:text-primary transition-all bg-muted/40 rounded-xl border border-dashed border-border group"
            >
              <ExternalLink size={12} className="group-hover:scale-110 transition-transform" />
              <span className="font-medium">View Documentation</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
