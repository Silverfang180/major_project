import { useState, useEffect, useMemo } from "react";
import { Topbar } from "../components/layout/Topbar";
import { StatCard } from "../components/shared/StatCard";
import { Badge } from "../components/shared/Badge";
import { ChartCard } from "../components/shared/ChartCard";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell
} from "recharts";
import {
  Loader2, Trophy, DollarSign, Zap, CheckSquare, Square,
  ArrowUpDown, Crown, Star, Layers, X, Medal
} from "lucide-react";
import { api, type DatasetResponse, type CompareResponse, type EvalJobResponse } from "../../lib/api";
import { EmptyState } from "../components/shared/EmptyState";

const MODEL_COLORS = [
  "#008cff", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#a78bfa"
];

export function ModelComparisonsPage() {
  const [datasets, setDatasets] = useState<DatasetResponse[]>([]);
  const [selectedDataset, setSelectedDataset] = useState("");
  const [allJobs, setAllJobs] = useState<EvalJobResponse[]>([]);
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [compareResult, setCompareResult] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [sortKey, setSortKey] = useState<"accuracy" | "cost" | "latency">("accuracy");

  useEffect(() => {
    loadDatasets();
  }, []);

  async function loadDatasets() {
    try {
      const d = await api.getDatasets();
      setDatasets(d);
      if (d.length > 0) {
        setSelectedDataset(d[0].dataset_id);
        loadAllJobs(d[0].dataset_id);
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }

  async function loadAllJobs(dsId: string) {
    setLoading(true);
    setCompareResult(null);
    setSelectedJobIds(new Set());
    try {
      // Fetch all jobs for this dataset via the auto-compare endpoint
      const resp = await api.getCompare(dsId);
      setAllJobs(resp.jobs || []);
      // Auto-select all jobs
      const allIds = new Set((resp.jobs || []).map((j: any) => j.job_id));
      setSelectedJobIds(allIds);
      // Show full comparison by default
      setCompareResult(resp);
    } catch {
      setAllJobs([]);
      setCompareResult(null);
    } finally {
      setLoading(false);
    }
  }

  function handleDatasetChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    setSelectedDataset(id);
    loadAllJobs(id);
  }

  function toggleJob(jobId: string) {
    setSelectedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  }

  function selectAll() {
    setSelectedJobIds(new Set(allJobs.map((j) => j.job_id)));
  }

  function deselectAll() {
    setSelectedJobIds(new Set());
  }

  async function runComparison() {
    const ids = Array.from(selectedJobIds);
    if (ids.length < 2) return;
    setComparing(true);
    try {
      const resp = await api.compareJobs(ids);
      setCompareResult(resp);
    } catch (e: any) {
      setCompareResult(null);
      alert("Comparison failed: " + e.message);
    } finally {
      setComparing(false);
    }
  }

  // Derived data from compareResult
  const comparedJobs = useMemo(() => {
    if (!compareResult) return [];
    return compareResult.jobs || [];
  }, [compareResult]);

  const sortedJobs = useMemo(() => {
    const jobs = [...comparedJobs];
    if (sortKey === "accuracy") {
      jobs.sort((a, b) => (b.accuracy || 0) - (a.accuracy || 0));
    } else if (sortKey === "cost") {
      jobs.sort((a, b) => (a.cost_per_correct || Infinity) - (b.cost_per_correct || Infinity));
    } else {
      jobs.sort((a, b) => (a.p50_latency_ms || Infinity) - (b.p50_latency_ms || Infinity));
    }
    return jobs;
  }, [comparedJobs, sortKey]);

  // Executive summary
  const bestAccuracy = useMemo(() => {
    if (!comparedJobs.length) return null;
    return comparedJobs.reduce((best, j) =>
      (j.accuracy || 0) > (best.accuracy || 0) ? j : best, comparedJobs[0]);
  }, [comparedJobs]);

  const bestCost = useMemo(() => {
    if (!comparedJobs.length) return null;
    const withCost = comparedJobs.filter((j) => j.cost_per_correct != null && j.cost_per_correct > 0);
    if (!withCost.length) return null;
    return withCost.reduce((best, j) =>
      (j.cost_per_correct || Infinity) < (best.cost_per_correct || Infinity) ? j : best, withCost[0]);
  }, [comparedJobs]);

  const bestLatency = useMemo(() => {
    if (!comparedJobs.length) return null;
    const withLat = comparedJobs.filter((j) => j.p50_latency_ms != null);
    if (!withLat.length) return null;
    return withLat.reduce((best, j) =>
      (j.p50_latency_ms || Infinity) < (best.p50_latency_ms || Infinity) ? j : best, withLat[0]);
  }, [comparedJobs]);

  // Chart data
  const chartData = useMemo(() => {
    return comparedJobs.map((j, idx) => {
      const modelName = j.model && j.model !== "unknown" ? j.model : `v${j.version_id}`;
      return {
        name: `${modelName}\n(v${j.version_id})`,
        shortName: modelName,
        accuracy: ((j.accuracy || 0) * 100),
        latency: j.p50_latency_ms || 0,
        cost: (j.cost_per_correct || 0) * 1000, // Scale to show more detail
        color: MODEL_COLORS[idx % MODEL_COLORS.length],
        isKnee: j.is_knee_point,
        isPareto: j.is_pareto_optimal,
      };
    });
  }, [comparedJobs]);

  const hasSelection = selectedJobIds.size >= 2;

  return (
    <div>
      <Topbar title="Model Comparisons" subtitle="Evaluate and rank models across your datasets" />
      <div className="p-6 space-y-6">
        {/* Dataset Selector */}
        <div className="flex items-center gap-4 bg-card border border-border p-4 rounded-2xl shadow-sm">
          <label className="text-[0.8125rem] text-muted-foreground font-bold uppercase tracking-wider">Dataset:</label>
          <select
            value={selectedDataset}
            onChange={handleDatasetChange}
            className="bg-background border border-border rounded-xl px-4 py-2 text-[0.8125rem] text-foreground outline-none w-72 focus:ring-2 focus:ring-primary/10 transition-all shadow-sm font-semibold"
          >
            {datasets.map((d) => (
              <option key={d.dataset_id} value={d.dataset_id}>{d.name}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-slate-500" /></div>
        ) : allJobs.length === 0 ? (
          <div className="py-12">
            <EmptyState
              icon={Layers}
              heading="No Evaluation Data"
              subtext="No completed evaluation jobs were found for this dataset. Run some evaluation jobs first to see comparative analytics here."
              ctaLabel="Go to Eval Jobs"
              ctaAction={() => (window.location.href = "/eval-jobs")}
            />
          </div>
        ) : (
          <>
            {/* Selection Overview Chips */}
            {selectedJobIds.size > 0 && (
              <div className="flex flex-wrap items-center gap-2 pb-2">
                <span className="text-[0.7rem] text-muted-foreground mr-3 uppercase tracking-[0.15em] font-black">Comparing:</span>
                {Array.from(selectedJobIds).map((id) => {
                  const job = allJobs.find((j) => j.job_id === id);
                  if (!job) return null;
                  const idx = allJobs.findIndex((aj) => aj.job_id === id);
                  const modelName = job.model && job.model !== "unknown" ? job.model : `v${job.version_id}`;
                  return (
                    <div 
                      key={id} 
                      className="flex items-center gap-2 pl-3 pr-1 py-1.5 bg-primary/5 border border-primary/10 rounded-xl text-primary text-[0.75rem] group animate-in zoom-in-95 duration-200 shadow-sm"
                    >
                      <div className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: MODEL_COLORS[idx % MODEL_COLORS.length] }} />
                      <span className="font-bold">{modelName} <span className="opacity-60 font-medium">v{job.version_id}</span></span>
                      <button 
                        onClick={() => toggleJob(id)}
                        className="p-1 hover:bg-primary/10 rounded-lg transition-colors text-muted-foreground hover:text-rose-500"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Model Selection Checklist */}
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-black text-foreground uppercase tracking-widest flex items-center gap-2">
                  Select Models to Compare
                  <Badge variant="neutral" className="opacity-60">{selectedJobIds.size} / {allJobs.length}</Badge>
                </h3>
                <div className="flex items-center gap-3">
                  <button onClick={selectAll} className="text-xs font-bold text-primary hover:underline transition-all">
                    Select All
                  </button>
                  <span className="text-border">|</span>
                  <button onClick={deselectAll} className="text-xs font-bold text-muted-foreground hover:text-foreground transition-all">
                    Clear
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {allJobs.map((j, idx) => {
                  const selected = selectedJobIds.has(j.job_id);
                  return (
                    <button
                      key={j.job_id}
                      onClick={() => toggleJob(j.job_id)}
                      className={`flex items-center gap-3 p-4 rounded-2xl border text-left transition-all group ${
                        selected
                          ? "border-primary/50 bg-primary/5 shadow-md shadow-primary/5"
                          : "border-border bg-muted/20 hover:border-primary/30 hover:bg-muted/40"
                      }`}
                    >
                      {selected
                        ? <CheckSquare size={18} className="text-primary shrink-0" />
                        : <Square size={18} className="text-muted-foreground/40 shrink-0 group-hover:text-primary/40" />
                      }
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: MODEL_COLORS[idx % MODEL_COLORS.length] }} />
                          <span className={`${selected ? "text-foreground font-bold" : "text-muted-foreground font-medium"} text-[0.8125rem] truncate transition-all`}>
                            {j.model && j.model !== "unknown" ? j.model : `Version ${j.version_id}`}
                          </span>
                        </div>
                        <div className="text-[0.7rem] text-muted-foreground mt-1 flex items-center gap-2 font-medium">
                          <span>v{j.version_id}</span>
                          <span className="h-0.5 w-0.5 rounded-full bg-muted-foreground/30" />
                          <span>Acc: <span className="text-foreground">{((j.accuracy || 0) * 100).toFixed(1)}%</span></span>
                          {j.is_pareto_optimal && <Badge variant="success" className="scale-75 origin-left">Pareto</Badge>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-6 flex items-center gap-4 border-t border-border pt-6">
                <button
                  onClick={runComparison}
                  disabled={!hasSelection || comparing}
                  className="flex items-center gap-2.5 px-6 py-3 bg-primary hover:bg-primary/90 disabled:opacity-30 disabled:grayscale text-primary-foreground text-[0.8125rem] font-bold rounded-2xl transition-all shadow-lg shadow-primary/20 active:scale-[0.98]"
                >
                  {comparing ? <Loader2 size={16} className="animate-spin" /> : <ArrowUpDown size={16} />}
                  {comparing ? "Syncing Metrics..." : `Generate Comparison Report (${selectedJobIds.size} Models)`}
                </button>
                {!hasSelection && (
                  <span className="text-[0.75rem] text-amber-600 font-bold bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20">Select at least 2 models for deep analysis</span>
                )}
              </div>
            </div>

            {/* Results Section */}
            {compareResult && comparedJobs.length > 0 && (
              <>
                {/* Executive Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <StatCard
                    title="Highest Accuracy"
                    value={bestAccuracy ? `${((bestAccuracy.accuracy || 0) * 100).toFixed(1)}%` : "—"}
                    subtitle={bestAccuracy ? `${bestAccuracy.model || `v${bestAccuracy.version_id}`} (v${bestAccuracy.version_id})` : undefined}
                    icon={<Trophy size={18} />}
                    valueColor="text-emerald-500 font-black"
                  />
                  <StatCard
                    title="Best Cost Efficiency"
                    value={bestCost ? `$${(bestCost.cost_per_correct || 0).toFixed(4)}` : "—"}
                    subtitle={bestCost ? `${bestCost.model || `v${bestCost.version_id}`} (v${bestCost.version_id})` : undefined}
                    icon={<DollarSign size={18} />}
                    valueColor="text-amber-600 font-black"
                  />
                  <StatCard
                    title="Lowest P50 Latency"
                    value={bestLatency ? `${bestLatency.p50_latency_ms}ms` : "—"}
                    subtitle={bestLatency ? `${bestLatency.model || `v${bestLatency.version_id}`} (v${bestLatency.version_id})` : undefined}
                    icon={<Zap size={18} />}
                    valueColor="text-primary font-black"
                  />
                </div>

                {/* Multi-Axis Chart */}
                <ChartCard title="Multi-Dimensional Model Performance" subtitle="Accuracy (bars), Latency (blue line), Cost/1000 (amber line) — dual Y-axes">
                  <div className="h-[420px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/50" vertical={false} />
                        <XAxis
                          dataKey="shortName"
                          stroke="currentColor"
                          className="text-muted-foreground font-medium"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          tick={{ dy: 10 }}
                        />
                        <YAxis
                          yAxisId="left"
                          stroke="currentColor"
                          className="text-muted-foreground font-medium"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          domain={[0, 100]}
                          tickFormatter={(v) => `${v}%`}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          stroke="currentColor"
                          className="text-muted-foreground font-medium"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          cursor={{ fill: "currentColor", className: "text-muted/20" }}
                          contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "12px", fontSize: "12px", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
                          itemStyle={{ fontWeight: 600 }}
                          formatter={(value: any, name: string) => {
                            if (name === "Accuracy") return [`${Number(value).toFixed(1)}%`, name];
                            if (name === "Latency") return [`${Number(value).toFixed(0)} ms`, name];
                            if (name === "Cost ×1000") return [`$${(Number(value) / 1000).toFixed(4)}`, "Cost/Correct"];
                            return [value, name];
                          }}
                        />
                        <Legend iconType="circle" wrapperStyle={{ paddingTop: "24px", fontSize: "11px", fontWeight: 700 }} />
                        <Bar yAxisId="left" dataKey="accuracy" name="Accuracy" radius={[6, 6, 0, 0]} maxBarSize={48}>
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.85} />
                          ))}
                        </Bar>
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="latency"
                          name="Latency"
                          stroke="#008cff"
                          strokeWidth={2}
                          dot={{ fill: "#008cff", r: 4 }}
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="cost"
                          name="Cost ×1000"
                          stroke="#f59e0b"
                          strokeWidth={2}
                          strokeDasharray="5 3"
                          dot={{ fill: "#f59e0b", r: 4 }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </ChartCard>

                {/* Leaderboard Table */}
                <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                  <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-muted/20">
                    <h3 className="text-sm font-black text-foreground uppercase tracking-widest">Model Leaderboard</h3>
                    <div className="flex items-center gap-1.5 bg-muted rounded-xl p-1 border border-border/50 shadow-inner">
                      {(["accuracy", "cost", "latency"] as const).map((key) => (
                        <button
                          key={key}
                          onClick={() => setSortKey(key)}
                          className={`px-4 py-1.5 rounded-lg text-[0.7rem] font-black uppercase tracking-wider transition-all ${
                            sortKey === key
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {key === "accuracy" ? "Accuracy" : key === "cost" ? "Cost" : "Latency"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <table className="w-full">
                    <thead className="bg-muted/30">
                      <tr className="border-b border-border">
                        {["Rank", "Model", "Version", "Accuracy", "Cost/Correct", "P50 Latency", "Status"].map((h) => (
                          <th key={h} className="text-left text-[0.6875rem] text-muted-foreground uppercase font-black tracking-widest px-6 py-4">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedJobs.map((j, idx) => (
                        <tr
                          key={j.job_id}
                          className={`border-b border-border/10 table-row-hover transition-colors ${
                            j.is_knee_point
                              ? "bg-primary/5 hover:bg-primary/10"
                              : ""
                          }`}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {idx === 0 ? (
                                <Medal size={20} className="text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.3)]" />
                              ) : idx === 1 ? (
                                <Medal size={20} className="text-slate-400 drop-shadow-[0_0_8px_rgba(148,163,184,0.3)]" />
                              ) : idx === 2 ? (
                                <Medal size={20} className="text-amber-700 drop-shadow-[0_0_8px_rgba(180,83,9,0.3)]" />
                              ) : (
                                <span className="text-[0.8125rem] text-muted-foreground w-5 text-center font-bold">{idx + 1}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-3 h-3 rounded-full shadow-sm" style={{
                                backgroundColor: MODEL_COLORS[
                                  allJobs.findIndex((aj) => aj.job_id === j.job_id) % MODEL_COLORS.length
                                ]
                              }} />
                              <span className="text-[0.8125rem] text-foreground font-bold font-mono">
                                {j.model && j.model !== "unknown" ? j.model : `Version ${j.version_id}`}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-[0.7rem] bg-muted border border-border rounded-lg px-2 py-1 text-muted-foreground font-bold font-mono">
                              v{j.version_id}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-mono font-bold">
                            <span className={`text-[0.9375rem] ${
                               (j.accuracy || 0) >= 0.9 ? "text-emerald-600" :
                               (j.accuracy || 0) >= 0.7 ? "text-amber-600" : "text-rose-600"
                            }`}>
                              {((j.accuracy || 0) * 100).toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-6 py-4 text-[0.8125rem] text-amber-600 font-bold font-mono">
                            {j.cost_per_correct != null ? `$${j.cost_per_correct.toFixed(4)}` : "—"}
                          </td>
                          <td className="px-6 py-4 text-[0.8125rem] text-muted-foreground font-bold font-mono">
                            {j.p50_latency_ms != null ? `${j.p50_latency_ms}ms` : "—"}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {j.is_pareto_optimal && <Badge variant="success" className="font-black uppercase tracking-tighter scale-90">Pareto</Badge>}
                              {j.is_knee_point && (
                                <Badge variant="info" className="font-black uppercase tracking-tighter scale-90">
                                  <Star size={10} className="inline mr-1" />Knee
                                </Badge>
                              )}
                              {!j.is_pareto_optimal && !j.is_knee_point && (
                                <span className="text-[0.65rem] text-muted-foreground font-black uppercase tracking-widest opacity-40">Dominated</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* AI Recommendation */}
                {compareResult.recommendation && (
                  <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 shadow-sm">
                    <h3 className="text-sm font-black text-primary mb-3 flex items-center gap-2 uppercase tracking-widest">
                      AI Performance Insight <Badge variant="info">Beta</Badge>
                    </h3>
                    <p className="text-[0.8125rem] text-muted-foreground leading-relaxed font-medium">
                      {compareResult.recommendation}
                    </p>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}