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
  ArrowUpDown, Crown, Star
} from "lucide-react";
import { api, type DatasetResponse, type CompareResponse, type EvalJobResponse } from "../../lib/api";

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
    return comparedJobs.map((j, idx) => ({
      name: `${j.model || "?"}\n(v${j.version_id})`,
      shortName: j.model || "?",
      accuracy: ((j.accuracy || 0) * 100),
      latency: j.p50_latency_ms || 0,
      cost: (j.cost_per_correct || 0) * 1000, // Scale to show more detail
      color: MODEL_COLORS[idx % MODEL_COLORS.length],
      isKnee: j.is_knee_point,
      isPareto: j.is_pareto_optimal,
    }));
  }, [comparedJobs]);

  const hasSelection = selectedJobIds.size >= 2;

  return (
    <div>
      <Topbar title="Model Comparisons" subtitle="Evaluate and rank models across your datasets" />
      <div className="p-6 space-y-6">
        {/* Dataset Selector */}
        <div className="flex items-center gap-4">
          <label className="text-[0.8125rem] text-slate-400">Dataset:</label>
          <select
            value={selectedDataset}
            onChange={handleDatasetChange}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-[0.8125rem] text-white outline-none w-64"
          >
            {datasets.map((d) => (
              <option key={d.dataset_id} value={d.dataset_id}>{d.name}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-slate-500" /></div>
        ) : allJobs.length === 0 ? (
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-8 text-center text-slate-500 text-sm">
            No completed evaluation jobs found for this dataset. Run evaluations first.
          </div>
        ) : (
          <>
            {/* Model Selection Checklist */}
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-white flex items-center gap-2">
                  Select Models to Compare
                  <Badge variant="neutral">{selectedJobIds.size} / {allJobs.length}</Badge>
                </h3>
                <div className="flex items-center gap-2">
                  <button onClick={selectAll} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                    Select All
                  </button>
                  <span className="text-slate-600">|</span>
                  <button onClick={deselectAll} className="text-xs text-slate-400 hover:text-slate-300 transition-colors">
                    Clear
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {allJobs.map((j, idx) => {
                  const selected = selectedJobIds.has(j.job_id);
                  return (
                    <button
                      key={j.job_id}
                      onClick={() => toggleJob(j.job_id)}
                      className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                        selected
                          ? "border-indigo-500/40 bg-indigo-500/10"
                          : "border-slate-700/30 bg-slate-800/20 hover:border-slate-600"
                      }`}
                    >
                      {selected
                        ? <CheckSquare size={16} className="text-indigo-400 shrink-0" />
                        : <Square size={16} className="text-slate-600 shrink-0" />
                      }
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: MODEL_COLORS[idx % MODEL_COLORS.length] }} />
                          <span className="text-[0.8125rem] text-white truncate font-medium">
                            {j.model || "Unknown Model"}
                          </span>
                        </div>
                        <div className="text-[0.6875rem] text-slate-500 mt-0.5 flex gap-2">
                          <span>v{j.version_id}</span>
                          <span>·</span>
                          <span>Acc: {((j.accuracy || 0) * 100).toFixed(1)}%</span>
                          {j.is_pareto_optimal && <Badge variant="success">Pareto</Badge>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={runComparison}
                  disabled={!hasSelection || comparing}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[0.8125rem] rounded-lg transition-colors"
                >
                  {comparing ? <Loader2 size={14} className="animate-spin" /> : <ArrowUpDown size={14} />}
                  {comparing ? "Comparing..." : `Compare ${selectedJobIds.size} Models`}
                </button>
                {!hasSelection && (
                  <span className="text-[0.75rem] text-amber-400/70">Select at least 2 models to compare</span>
                )}
              </div>
            </div>

            {/* Results Section */}
            {compareResult && comparedJobs.length > 0 && (
              <>
                {/* Executive Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <StatCard
                    title="Most Accurate"
                    value={bestAccuracy ? `${((bestAccuracy.accuracy || 0) * 100).toFixed(1)}%` : "—"}
                    subtitle={bestAccuracy ? `${bestAccuracy.model} (v${bestAccuracy.version_id})` : undefined}
                    icon={<Trophy size={18} />}
                    valueColor="text-emerald-400"
                  />
                  <StatCard
                    title="Most Cost-Efficient"
                    value={bestCost ? `$${(bestCost.cost_per_correct || 0).toFixed(4)}` : "—"}
                    subtitle={bestCost ? `${bestCost.model} (v${bestCost.version_id})` : undefined}
                    icon={<DollarSign size={18} />}
                    valueColor="text-amber-400"
                  />
                  <StatCard
                    title="Lowest Latency"
                    value={bestLatency ? `${bestLatency.p50_latency_ms}ms` : "—"}
                    subtitle={bestLatency ? `${bestLatency.model} (v${bestLatency.version_id})` : undefined}
                    icon={<Zap size={18} />}
                    valueColor="text-indigo-400"
                  />
                </div>

                {/* Multi-Axis Chart */}
                <ChartCard title="Multi-Dimensional Model Performance" subtitle="Accuracy (bars), Latency (blue line), Cost/1000 (amber line) — dual Y-axes">
                  <div className="h-[420px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1c2130" vertical={false} />
                        <XAxis
                          dataKey="shortName"
                          stroke="#94a3b8"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          yAxisId="left"
                          stroke="#94a3b8"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                          domain={[0, 100]}
                          tickFormatter={(v) => `${v}%`}
                          label={{ value: "Accuracy %", angle: -90, position: "insideLeft", style: { fill: "#94a3b8", fontSize: 11 } }}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          stroke="#94a3b8"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                          label={{ value: "Latency (ms) / Cost (×1000)", angle: 90, position: "insideRight", style: { fill: "#94a3b8", fontSize: 11 } }}
                        />
                        <Tooltip
                          cursor={{ fill: "#1e293b" }}
                          contentStyle={{ backgroundColor: "#09090f", border: "1px solid #1c2130", borderRadius: "8px", fontSize: "12px" }}
                          formatter={(value: any, name: string) => {
                            if (name === "Accuracy") return [`${Number(value).toFixed(1)}%`, name];
                            if (name === "Latency") return [`${Number(value).toFixed(0)} ms`, name];
                            if (name === "Cost ×1000") return [`$${(Number(value) / 1000).toFixed(4)}`, "Cost/Correct"];
                            return [value, name];
                          }}
                        />
                        <Legend iconType="circle" wrapperStyle={{ paddingTop: "16px", fontSize: "12px" }} />
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
                <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
                    <h3 className="text-sm font-medium text-white">Leaderboard</h3>
                    <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-0.5 border border-slate-700/50">
                      {(["accuracy", "cost", "latency"] as const).map((key) => (
                        <button
                          key={key}
                          onClick={() => setSortKey(key)}
                          className={`px-3 py-1 rounded-md text-[0.75rem] transition-all ${
                            sortKey === key
                              ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30"
                              : "text-slate-400 hover:text-white border border-transparent"
                          }`}
                        >
                          {key === "accuracy" ? "By Accuracy" : key === "cost" ? "By Cost" : "By Latency"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700/50">
                        {["Rank", "Model", "Version", "Accuracy", "Cost/Correct", "P50 Latency", "Status"].map((h) => (
                          <th key={h} className="text-left text-[0.75rem] text-slate-500 px-5 py-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedJobs.map((j, idx) => (
                        <tr
                          key={j.job_id}
                          className={`border-b border-slate-700/30 transition-colors ${
                            j.is_knee_point
                              ? "bg-emerald-500/5 hover:bg-emerald-500/10"
                              : "hover:bg-slate-800/50"
                          }`}
                        >
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              {idx === 0 && sortKey === "accuracy" ? (
                                <Crown size={14} className="text-amber-400" />
                              ) : (
                                <span className="text-[0.8125rem] text-slate-400 w-4 text-center">{idx + 1}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full" style={{
                                backgroundColor: MODEL_COLORS[
                                  allJobs.findIndex((aj) => aj.job_id === j.job_id) % MODEL_COLORS.length
                                ]
                              }} />
                              <span className="text-[0.8125rem] text-white font-medium">{j.model || "Unknown"}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <span className="text-[0.75rem] bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-slate-300">
                              v{j.version_id}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <span className={`text-[0.8125rem] font-semibold ${
                              (j.accuracy || 0) >= 0.9 ? "text-emerald-400" :
                              (j.accuracy || 0) >= 0.7 ? "text-amber-400" : "text-rose-400"
                            }`}>
                              {((j.accuracy || 0) * 100).toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-5 py-3 text-[0.8125rem] text-amber-400/80">
                            {j.cost_per_correct != null ? `$${j.cost_per_correct.toFixed(4)}` : "—"}
                          </td>
                          <td className="px-5 py-3 text-[0.8125rem] text-slate-300">
                            {j.p50_latency_ms != null ? `${j.p50_latency_ms}ms` : "—"}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-1.5">
                              {j.is_pareto_optimal && <Badge variant="success">Pareto</Badge>}
                              {j.is_knee_point && (
                                <Badge variant="info">
                                  <Star size={10} className="inline mr-0.5" />Knee
                                </Badge>
                              )}
                              {!j.is_pareto_optimal && !j.is_knee_point && (
                                <span className="text-[0.6875rem] text-slate-600">Dominated</span>
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
                  <div className="bg-slate-800/20 border border-slate-700/30 rounded-xl p-5">
                    <h3 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                      AI Recommendation <Badge variant="info">Beta</Badge>
                    </h3>
                    <p className="text-[0.8125rem] text-slate-300 leading-relaxed">
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