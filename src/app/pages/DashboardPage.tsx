import { useState, useEffect } from "react";
import { Topbar } from "../components/layout/Topbar";
import { StatCard } from "../components/shared/StatCard";
import { ChartCard } from "../components/shared/ChartCard";
import { Badge } from "../components/shared/Badge";
import { 
  FileText, Play, FlaskConical, DollarSign, Activity, 
  ArrowUpRight, Plus, ExternalLink, Zap
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { api, type DashboardResponse } from "../../lib/api";

const MOCK_TREND = [
  { day: "Mon", cost: 12.5, runs: 120 },
  { day: "Tue", cost: 15.2, runs: 145 },
  { day: "Wed", cost: 10.8, runs: 110 },
  { day: "Thu", cost: 18.4, runs: 180 },
  { day: "Fri", cost: 22.1, runs: 210 },
  { day: "Sat", cost: 14.3, runs: 135 },
  { day: "Sun", cost: 11.2, runs: 105 },
];

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

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
      grid: isLight ? "#e2e8f0" : "#1c2130",
      axis: isLight ? "#64748b" : "#475569",
      tooltipBg: isLight ? "#ffffff" : "#09090f",
      tooltipBorder: isLight ? "#e2e8f0" : "#1c2130"
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
              valueColor="text-amber-400"
            />
            <StatCard
              title="Avg Performance"
              value="88.2%"
              subtitle="Across all eval jobs"
              icon={<Activity size={20} />}
              valueColor="text-emerald-400"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Chart Area */}
            <div className="lg:col-span-2">
              <ChartCard 
                title="Project ROI & Usage" 
                subtitle="Daily execution volume and cost distribution"
              >
                <div className="h-[340px] mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={MOCK_TREND}>
                      <defs>
                        <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                      <XAxis 
                        dataKey="day" 
                        stroke={chartColors.axis} 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false} 
                      />
                      <YAxis 
                        stroke={chartColors.axis} 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false} 
                        tickFormatter={(v) => `$${v}`}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: chartColors.tooltipBg, 
                          border: `1px solid ${chartColors.tooltipBorder}`, 
                          borderRadius: "8px",
                          color: isLight ? "#1e293b" : "#ffffff",
                          boxShadow: isLight ? "0 4px 6px -1px rgb(0 0 0 / 0.1)" : "none"
                        }}
                        itemStyle={{ fontSize: "12px", fontWeight: "600" }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="cost" 
                        stroke="#6366f1" 
                        fillOpacity={1} 
                        fill="url(#colorCost)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            </div>

          {/* Quick Actions & Recent Activity */}
            <div className="space-y-6">
              <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wider text-[0.6875rem]">Quick Actions</h3>
                <div className="space-y-2">
                  <button className="w-full flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all text-sm group">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-primary rounded-md text-primary-foreground group-hover:scale-110 transition-transform">
                        <Plus size={16} />
                      </div>
                      Create Prompt
                    </div>
                    <ArrowUpRight size={14} className="opacity-50" />
                  </button>
                  <button className="w-full flex items-center justify-between p-3 rounded-lg bg-muted border border-border text-foreground hover:bg-accent transition-all text-sm group">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-background border border-border rounded-md text-foreground">
                        <FlaskConical size={16} />
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
