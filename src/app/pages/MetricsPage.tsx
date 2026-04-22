import { useState, useEffect } from "react";
import { Topbar } from "../components/layout/Topbar";
import { StatCard } from "../components/shared/StatCard";
import { ChartCard } from "../components/shared/ChartCard";
import { api } from "../../lib/api";
import { Activity, AlertTriangle, Clock, ServerCrash, ServerOff } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export function MetricsPage() {
  const [metricsData, setMetricsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Generate some fake latency history to make the UI look alive visually and showcase the chart
  const MOCK_LATENCY_HISTORY = [
    { time: "10:00", ms: 42 },
    { time: "10:05", ms: 55 },
    { time: "10:10", ms: 38 },
    { time: "10:15", ms: 45 },
    { time: "10:20", ms: 60 },
    { time: "10:25", ms: 48 },
    { time: "10:30", ms: 52 },
  ];

  useEffect(() => {
    async function load() {
      try {
        const data = await api.getMetricsSummary();
        setMetricsData(data);
      } catch (err) {
        console.error("Failed to load metrics", err);
      } finally {
        setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

    const isLight = document.documentElement.classList.contains('light');
    const chartColors = {
      grid: isLight ? "#f1f5f9" : "#1e293b",
      axis: isLight ? "#94a3b8" : "#475569",
      tooltipBg: isLight ? "#ffffff" : "#0f172a",
      tooltipBorder: isLight ? "#e2e8f0" : "#1e293b",
      accent: isLight ? "#0f172a" : "#ffffff",
    };

  const kpis = metricsData?.kpis || {
    total_requests: 0,
    total_errors: 0,
    error_rate_percent: 0,
    average_latency_ms: 0
  };

  return (
    <div className="pb-12 h-full flex flex-col overflow-auto bg-background">
      <Topbar 
        title="System Metrics" 
        subtitle="Real-time performance and backend telemetry via Prometheus" 
      />
      <div className="p-6 space-y-8 max-w-7xl mx-auto w-full">
        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Requests"
            value={kpis.total_requests.toLocaleString()}
            subtitle="Since last restart"
            icon={<Activity size={20} />}
            trend={{ value: "live", positive: true }}
          />
          <StatCard
            title="Avg Latency"
            value={`${kpis.average_latency_ms}ms`}
            subtitle="Global latency"
            icon={<Clock size={20} />}
            valueColor={kpis.average_latency_ms > 500 ? "text-amber-500" : "text-foreground"}
          />
          <StatCard
            title="Total Errors"
            value={kpis.total_errors.toLocaleString()}
            subtitle="HTTP 4xx & 5xx"
            icon={<AlertTriangle size={20} />}
            valueColor={kpis.total_errors > 0 ? "text-red-500" : "text-foreground"}
          />
          <StatCard
            title="Error Rate"
            value={`${kpis.error_rate_percent}%`}
            subtitle="Ratio"
            icon={<ServerCrash size={20} />}
            valueColor={kpis.error_rate_percent > 1 ? "text-red-500" : "text-foreground"}
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ChartCard 
              title="Global Latency Distribution" 
              subtitle="P95 Latency over last 30 minutes (Simulated Series)"
            >
              <div className="h-[340px] mt-6">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={MOCK_LATENCY_HISTORY} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                    <XAxis 
                      dataKey="time" 
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
                      tickFormatter={(v) => `${v}ms`} 
                      className="font-mono"
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: chartColors.tooltipBg, 
                        border: `1px solid ${chartColors.tooltipBorder}`, 
                        borderRadius: "12px",
                        padding: "12px",
                        boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)"
                      }}
                      labelStyle={{ color: isLight ? "#64748b" : "#94a3b8", fontSize: "11px", fontWeight: "600", marginBottom: "4px", textTransform: "uppercase" }}
                      itemStyle={{ fontSize: "13px", fontWeight: "700", color: chartColors.accent, padding: "0" }}
                    />
                    <Area 
                      type="stepAfter" 
                      dataKey="ms" 
                      stroke={chartColors.accent} 
                      strokeWidth={2}
                      fill={chartColors.accent}
                      fillOpacity={0.05} 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col h-full overflow-hidden max-h-[450px]">
            <h3 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wider text-[0.6875rem]">Raw Prometheus Counters</h3>
            <div className="flex-1 overflow-auto space-y-2 pr-2">
              {loading && <div className="text-muted-foreground text-sm">Waiting for telemetry...</div>}
              {!loading && (!metricsData?.raw_metrics?.length) && (
                <div className="text-muted-foreground text-sm flex items-center gap-2">
                  <ServerOff size={16} /> No metrics found
                </div>
              )}
              {metricsData?.raw_metrics?.slice(0, 10).map((m: any, idx: number) => (
                <div key={idx} className="bg-muted scrollbar-hide hover:bg-muted/80 p-3 rounded-lg border border-border transition-colors">
                  <div className="text-xs font-mono text-primary font-medium truncate" title={m.name}>{m.name}</div>
                  <div className="text-[10px] text-muted-foreground mt-1 uppercase">{m.type}</div>
                  <div className="text-xs font-semibold mt-2 text-foreground">
                    {m.samples?.[0]?.value ?? 0} {m.samples?.length > 1 ? `(+${m.samples.length - 1} variants)` : ""}
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-3 mt-3 border-t border-border shrink-0">
              <a href="/api/v1/metrics/summary" target="_blank" className="text-xs text-primary hover:underline font-medium">
                View Full JSON Export →
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
