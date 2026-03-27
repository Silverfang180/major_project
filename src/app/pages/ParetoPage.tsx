import { useState, useEffect } from "react";
import { Topbar } from "../components/layout/Topbar";
import { Badge } from "../components/shared/Badge";
import { ChartCard } from "../components/shared/ChartCard";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceDot } from "recharts";
import { Loader2, Target, TrendingUp, Zap } from "lucide-react";
import { api, type DatasetResponse } from "../../lib/api";

type PivotMode = "model" | "prompt";
type DimensionMode = "cost" | "latency";

const COLORS = ["#008cff", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

export function ParetoPage() {
  const [datasets, setDatasets] = useState<DatasetResponse[]>([]);
  const [selectedDataset, setSelectedDataset] = useState("");
  const [pivot, setPivot] = useState<PivotMode>("model");
  const [dimension, setDimension] = useState<DimensionMode>("cost");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDatasets();
  }, []);

  async function loadDatasets() {
    try {
      const d = await api.getDatasets();
      setDatasets(d);
      if (d.length > 0) {
        setSelectedDataset(d[0].dataset_id);
        loadPareto(d[0].dataset_id, dimension);
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }

  async function loadPareto(dsId: string, dim: DimensionMode) {
    setLoading(true);
    try {
      const resp = await api.getCompare(dsId, dim);
      setData(resp);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  function handleDatasetChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    setSelectedDataset(id);
    loadPareto(id, dimension);
  }

  function handleDimensionChange(dim: DimensionMode) {
    setDimension(dim);
    if (selectedDataset) {
      loadPareto(selectedDataset, dim);
    }
  }

  // Build scatter data with labels based on pivot
  function getScatterData(): any[] {
    if (!data || !data.jobs) return [];
    return data.jobs.map((j: any, idx: number) => ({
      name: pivot === "model"
        ? `${j.model} (v${j.version_id})`
        : `v${j.version_id} (${j.model})`,
      xValue: dimension === "cost" ? (j.cost_per_correct || 0) : (j.p50_latency_ms || 0),
      acc: (j.accuracy || 0) * 100,
      isPareto: j.is_pareto_optimal,
      isKnee: j.is_knee_point,
      model: j.model,
      version_id: j.version_id,
      job_id: j.job_id,
      color: j.is_pareto_optimal ? (j.is_knee_point ? "#10b981" : "#008cff") : "#64748b",
    }));
  }

  // Identify unique groups based on pivot
  function getGroups(): { label: string; count: number; color: string }[] {
    if (!data || !data.jobs) return [];
    const seen = new Map<string, number>();
    data.jobs.forEach((j: any) => {
      const key = pivot === "model" ? j.model : `v${j.version_id}`;
      seen.set(key, (seen.get(key) || 0) + 1);
    });
    return Array.from(seen.entries()).map(([label, count], i) => ({
      label,
      count,
      color: COLORS[i % COLORS.length],
    }));
  }

  const scatterData = getScatterData();
  const kneePoint = scatterData.find((d) => d.isKnee);
  const paretoPoints = scatterData.filter((d) => d.isPareto);
  const groups = getGroups();

  return (
    <div>
      <Topbar title="Pareto Frontier" subtitle="Find the optimal balance between performance and constraints" />
      <div className="p-6">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <label className="text-[0.8125rem] text-slate-400">Dataset:</label>
            <select value={selectedDataset} onChange={handleDatasetChange} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-[0.8125rem] text-white outline-none w-56">
              {datasets.map((d) => <option key={d.dataset_id} value={d.dataset_id}>{d.name}</option>)}
            </select>
          </div>
          <div className="h-6 w-px bg-slate-700" />
          
          <div className="flex items-center gap-2">
            <label className="text-[0.8125rem] text-slate-400">Optimize for:</label>
            <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-0.5 border border-slate-700/50">
              <button
                onClick={() => handleDimensionChange("cost")}
                className={`px-3 py-1.5 rounded-md text-[0.8125rem] transition-all ${dimension === "cost"
                  ? "bg-amber-600/20 text-amber-400 border border-amber-500/30"
                  : "text-slate-400 hover:text-white border border-transparent"
                  }`}
              >
                Cost
              </button>
              <button
                onClick={() => handleDimensionChange("latency")}
                className={`px-3 py-1.5 rounded-md text-[0.8125rem] transition-all ${dimension === "latency"
                  ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                  : "text-slate-400 hover:text-white border border-transparent"
                  }`}
              >
                Latency
              </button>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-700" />

          <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-0.5 border border-slate-700/50">
            <button
              onClick={() => setPivot("model")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[0.8125rem] transition-all ${pivot === "model"
                ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30"
                : "text-slate-400 hover:text-white border border-transparent"
                }`}
            >
              <Target size={14} />
              By Model
            </button>
            <button
              onClick={() => setPivot("prompt")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[0.8125rem] transition-all ${pivot === "prompt"
                ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30"
                : "text-slate-400 hover:text-white border border-transparent"
                }`}
            >
              <TrendingUp size={14} />
              By Prompt Version
            </button>
          </div>
        </div>

        {/* Pivot Description */}
        <div className="mb-6 bg-slate-800/20 border border-slate-700/30 rounded-lg px-4 py-3">
          {pivot === "model" ? (
            <p className="text-[0.8125rem] text-slate-400">
              <span className="text-indigo-400 font-medium">Model View:</span> Each point represents a unique <span className="text-white font-medium">model + prompt version</span> combination. Find which model delivers the best cost/accuracy tradeoff.
            </p>
          ) : (
            <p className="text-[0.8125rem] text-slate-400">
              <span className="text-indigo-400 font-medium">Prompt View:</span> Each point represents a unique <span className="text-white font-medium">prompt version</span> evaluated across models. Find which prompt wording yields the best ROI.
            </p>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-slate-500" /></div>
        ) : !data || data.jobs.length === 0 ? (
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-8 text-center text-slate-500 text-sm">
            No completed evaluation jobs found for this dataset. Run evals to populate the Pareto frontier.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Scatter Chart */}
            <div className="lg:col-span-2 space-y-6">
             <ChartCard 
               title={dimension === "cost" ? "Cost-Accuracy Frontier" : "Latency-Accuracy Frontier"} 
               subtitle={`Points on the edge represent the absolute best ${dimension} tradeoffs available.`}
             >
                <div className="h-[420px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1c2130" opacity={0.8} />
                      <XAxis
                        type="number"
                        dataKey="xValue"
                        name={dimension === "cost" ? "Cost/Correct" : "P50 Latency"}
                        unit={dimension === "cost" ? "$" : "ms"}
                        stroke="#94a3b8"
                        fontSize={12}
                        tickFormatter={(v) => dimension === "cost" ? `$${v.toFixed(3)}` : `${v}ms`}
                      />
                      <YAxis
                        type="number"
                        dataKey="acc"
                        name="Accuracy"
                        unit="%"
                        stroke="#94a3b8"
                        fontSize={12}
                        domain={[0, 100]}
                      />
                      <Tooltip
                        cursor={{ strokeDasharray: "3 3" }}
                        contentStyle={{ backgroundColor: "#09090f", border: "1px solid #1c2130", borderRadius: "8px", fontSize: "12px" }}
                        formatter={(value: any, name: string) => {
                          if (name === "Cost/Correct") return [`$${Number(value).toFixed(4)}`, name];
                          if (name === "P50 Latency") return [`${Number(value).toFixed(1)} ms`, name];
                          return [`${Number(value).toFixed(1)}%`, name];
                        }}
                        labelFormatter={(_, payload) => {
                          if (payload && payload.length > 0) {
                            const item = payload[0].payload;
                            return `${item.name}${item.isKnee ? " ★ KNEE POINT" : ""}${item.isPareto ? " (Pareto)" : ""}`;
                          }
                          return "";
                        }}
                      />
                      <Scatter name="Configurations" data={scatterData}>
                        {scatterData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.color}
                            r={entry.isKnee ? 10 : entry.isPareto ? 7 : 5}
                            stroke={entry.isKnee ? "#10b981" : "transparent"}
                            strokeWidth={entry.isKnee ? 3 : 0}
                          />
                        ))}
                      </Scatter>
                      {/* Knee point glow effect via a larger reference dot */}
                      {kneePoint && (
                        <ReferenceDot
                          x={kneePoint.xValue}
                          y={kneePoint.acc}
                          r={16}
                          fill="transparent"
                          stroke="#10b981"
                          strokeWidth={2}
                          strokeDasharray="4 2"
                        />
                      )}
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              {/* Legend by group */}
              <div className="flex flex-wrap gap-4 px-2">
                {groups.map((g) => (
                  <div key={g.label} className="flex items-center gap-2 text-[0.75rem] text-slate-400">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: g.color }} />
                    {g.label} <span className="text-slate-600">({g.count})</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 text-[0.75rem] text-emerald-400">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-emerald-500/30" />
                  Knee Point
                </div>
              </div>
            </div>

            {/* Right Panel */}
            <div className="space-y-6">
              {/* Knee Point Card */}
              {kneePoint && (
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap size={16} className="text-emerald-400" />
                    <h3 className="text-sm font-medium text-emerald-400">Knee Point — Best Balance</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[0.8125rem]">
                      <span className="text-slate-400">{pivot === "model" ? "Model" : "Version"}</span>
                      <span className="text-white font-medium">{pivot === "model" ? kneePoint.model : `v${kneePoint.version_id}`}</span>
                    </div>
                    <div className="flex justify-between text-[0.8125rem]">
                      <span className="text-slate-400">{pivot === "model" ? "Version" : "Model"}</span>
                      <span className="text-white font-medium">{pivot === "model" ? `v${kneePoint.version_id}` : kneePoint.model}</span>
                    </div>
                    <div className="flex justify-between text-[0.8125rem]">
                      <span className="text-slate-400">Accuracy</span>
                      <span className="text-emerald-400 font-semibold">{kneePoint.acc.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between text-[0.8125rem]">
                      <span className="text-slate-400">{dimension === "cost" ? "Cost/Correct" : "P50 Latency"}</span>
                      <span className={`${dimension === "cost" ? "text-amber-400" : "text-blue-400"} font-semibold`}>
                        {dimension === "cost" ? `$${kneePoint.xValue.toFixed(4)}` : `${kneePoint.xValue.toFixed(1)}ms`}
                      </span>
                    </div>
                  </div>
                  <p className="text-[0.75rem] text-slate-500 mt-3 leading-relaxed">
                    This is the point of diminishing returns. Spending more {dimension} than this yields marginal accuracy gains relative to the increase in complexity.
                  </p>
                </div>
              )}

              {/* AI Recommendation */}
              <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6">
                <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">AI Recommendation <Badge variant="info">Beta</Badge></h3>
                <div className="text-sm text-slate-300 mb-6 leading-relaxed">
                  {data.recommendation || "Based on the frontier, you have clear tradeoffs between cost and accuracy."}
                </div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Frontier {pivot === "model" ? "Models" : "Versions"}</h4>
                <div className="space-y-3">
                  {paretoPoints.map((j: any) => (
                    <div key={j.job_id} className={`p-3 rounded-lg flex items-center justify-between border ${j.isKnee ? "bg-emerald-500/10 border-emerald-500/20" : "bg-slate-800/50 border-slate-700/30"}`}>
                      <div>
                        <div className="text-[0.8125rem] font-medium text-white flex items-center gap-2">
                          {pivot === "model" ? j.model : `Version ${j.version_id}`}
                          <span className="text-slate-500 text-xs font-mono">{pivot === "model" ? `v${j.version_id}` : j.model}</span>
                          {j.isKnee && <Badge variant="success">Knee</Badge>}
                        </div>
                        <div className="text-[0.75rem] text-slate-400 mt-1">
                          Acc: {j.acc.toFixed(1)}% · {dimension === "cost" ? "Cost" : "Lat"}: {dimension === "cost" ? `$${j.xValue.toFixed(4)}` : `${j.xValue.toFixed(1)}ms`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Logic Explained */}
              <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-6">
                <h3 className="text-sm font-medium text-indigo-400 mb-4 flex items-center gap-2">
                  <Loader2 size={16} /> Understanding the Frontier
                </h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-[0.8125rem] font-medium text-white mb-1">Pareto Optimality</h4>
                    <p className="text-[0.75rem] text-slate-400 leading-relaxed">
                      A configuration is "Pareto Optimal" if you cannot improve its accuracy without also increasing its {dimension}. These points form the "Frontier" line.
                    </p>
                  </div>
                  <div>
                    <h4 className="text-[0.8125rem] font-medium text-white mb-1">Diminishing Returns</h4>
                    <p className="text-[0.75rem] text-slate-400 leading-relaxed">
                      Points to the right of the Knee Point offer very small accuracy gains for massive increases in {dimension}. The Knee Point suggests where you get the most "bang for your buck."
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
