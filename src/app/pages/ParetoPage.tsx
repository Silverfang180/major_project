import { useState, useEffect } from "react";
import { Topbar } from "../components/layout/Topbar";
import { Badge } from "../components/shared/Badge";
import { ChartCard } from "../components/shared/ChartCard";
import { ComposedChart, Scatter, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceDot } from "recharts";
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
  const paretoPoints = scatterData
    .filter((d) => d.isPareto)
    .sort((a, b) => a.xValue - b.xValue);
  const groups = getGroups();

  return (
    <div>
      <Topbar title="Pareto Frontier" subtitle="Find the optimal balance between performance and constraints" />
      <div className="p-6">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-6 mb-8 bg-card border border-border p-5 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3">
            <label className="text-[0.8125rem] text-muted-foreground font-bold uppercase tracking-wider">Dataset:</label>
            <select value={selectedDataset} onChange={handleDatasetChange} className="bg-background border border-border rounded-xl px-4 py-2 text-[0.8125rem] text-foreground outline-none w-64 focus:ring-2 focus:ring-primary/10 transition-all shadow-sm font-semibold">
              {datasets.map((d) => <option key={d.dataset_id} value={d.dataset_id}>{d.name}</option>)}
            </select>
          </div>
          <div className="h-8 w-px bg-border/50 hidden sm:block" />
          
          <div className="flex items-center gap-3">
            <label className="text-[0.8125rem] text-muted-foreground font-bold uppercase tracking-wider">Metric:</label>
            <div className="flex items-center gap-1.5 bg-muted/40 rounded-xl p-1 border border-border shadow-inner">
              <button
                onClick={() => handleDimensionChange("cost")}
                className={`px-4 py-2 rounded-lg text-[0.8125rem] font-bold transition-all ${dimension === "cost"
                  ? "bg-amber-500 text-white shadow-sm scale-[1.02]"
                  : "text-muted-foreground hover:bg-muted"
                  }`}
              >
                Cost
              </button>
              <button
                onClick={() => handleDimensionChange("latency")}
                className={`px-4 py-2 rounded-lg text-[0.8125rem] font-bold transition-all ${dimension === "latency"
                  ? "bg-primary text-primary-foreground shadow-sm scale-[1.02]"
                  : "text-muted-foreground hover:bg-muted"
                  }`}
              >
                Latency
              </button>
            </div>
          </div>

          <div className="h-8 w-px bg-border/50 hidden lg:block" />

          <div className="flex items-center gap-1.5 bg-muted/40 rounded-xl p-1 border border-border shadow-inner">
            <button
              onClick={() => setPivot("model")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[0.8125rem] font-bold transition-all ${pivot === "model"
                ? "bg-primary text-primary-foreground shadow-sm scale-[1.02]"
                : "text-muted-foreground hover:bg-muted"
                }`}
            >
              <Target size={14} />
              By Model
            </button>
            <button
              onClick={() => setPivot("prompt")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[0.8125rem] font-bold transition-all ${pivot === "prompt"
                ? "bg-primary text-primary-foreground shadow-sm scale-[1.02]"
                : "text-muted-foreground hover:bg-muted"
                }`}
            >
              <TrendingUp size={14} />
              By Prompt Version
            </button>
          </div>
        </div>

        {/* Description Box */}
        <div className="mb-8 bg-primary/5 border border-primary/10 rounded-2xl px-5 py-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-500">
          {pivot === "model" ? (
            <p className="text-[0.8125rem] text-muted-foreground leading-relaxed">
              <span className="text-primary font-bold uppercase tracking-tight mr-2">Model Landscape View</span> Each point represents a unique <span className="text-foreground font-bold">model + prompt version</span> combination. Find which configuration delivers the best efficiency.
            </p>
          ) : (
            <p className="text-[0.8125rem] text-muted-foreground leading-relaxed">
              <span className="text-primary font-bold uppercase tracking-tight mr-2">Iterative Prompt View</span> Each point represents a unique <span className="text-foreground font-bold">prompt version</span> evaluated across multiple models. Track your engineering progress.
            </p>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-slate-500" /></div>
        ) : !data || data.jobs.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-12 text-center text-muted-foreground text-[0.8125rem] font-medium shadow-sm">
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
                    <ComposedChart margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/40" vertical={false} />
                      <XAxis
                        type="number"
                        dataKey="xValue"
                        name={dimension === "cost" ? "Cost" : "Latency"}
                        stroke="currentColor"
                        className="text-muted-foreground font-medium"
                        fontSize={11}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => dimension === "cost" ? `$${v.toFixed(3)}` : `${v}ms`}
                        tick={{ dy: 10 }}
                      />
                      <YAxis
                        type="number"
                        dataKey="acc"
                        name="Accuracy"
                        unit="%"
                        stroke="currentColor"
                        className="text-muted-foreground font-medium"
                        fontSize={11}
                        axisLine={false}
                        tickLine={false}
                        domain={[0, 100]}
                        tick={{ dx: -10 }}
                      />
                      <Tooltip
                        cursor={{ strokeDasharray: "3 3", stroke: "var(--primary)", strokeOpacity: 0.5 }}
                        contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "12px", fontSize: "12px", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
                        formatter={(value: any, name: string) => {
                          if (name === "Cost") return [`$${Number(value).toFixed(4)}`, name];
                          if (name === "Latency") return [`${Number(value).toFixed(1)} ms`, name];
                          return [`${Number(value).toFixed(1)}%`, "Accuracy"];
                        }}
                        labelFormatter={(_, payload) => {
                          if (payload && payload.length > 0) {
                            const item = payload[0].payload;
                            return `${item.name}${item.isKnee ? " ★ RECOMMENDED" : ""}`;
                          }
                          return "";
                        }}
                      />
                      {/* Dominated Zone Shading */}
                      <Area
                        type="stepAfter"
                        data={paretoPoints}
                        dataKey="acc"
                        stroke="none"
                        fill="url(#dominatedGradient)"
                        fillOpacity={0.15}
                        isAnimationActive={false}
                      />
                      
                      {/* Frontier Line */}
                      <Line
                        type="stepAfter"
                        data={paretoPoints}
                        dataKey="acc"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={false}
                        activeDot={false}
                        isAnimationActive={true}
                      />

                      <Scatter name="Configurations" data={scatterData}>
                        {scatterData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.color}
                            r={entry.isKnee ? 10 : entry.isPareto ? 7 : 5}
                            stroke={entry.isKnee ? "#10b981" : "transparent"}
                            strokeWidth={entry.isKnee ? 3 : 0}
                            className={entry.isKnee ? "animate-pulse-soft" : ""}
                          />
                        ))}
                      </Scatter>

                      <defs>
                        <linearGradient id="dominatedGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>

                      {/* Knee point pulse effect */}
                      {kneePoint && (
                        <ReferenceDot
                          x={kneePoint.xValue}
                          y={kneePoint.acc}
                          r={18}
                          fill="transparent"
                          stroke="#10b981"
                          strokeWidth={2}
                          className="animate-pulse-soft"
                          strokeDasharray="4 4"
                        />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              {/* Legend by group */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 bg-muted/20 border border-border rounded-xl">
                {groups.map((g) => (
                  <div key={g.label} className="flex items-center gap-2 text-[0.7rem] text-muted-foreground uppercase font-black tracking-widest">
                    <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: g.color }} />
                    {g.label} <span className="opacity-40">({g.count})</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 text-[0.7rem] text-emerald-600 uppercase font-black tracking-widest">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  Knee Point
                </div>
              </div>
            </div>

            {/* Right Panel */}
            <div className="space-y-6">
              {/* Knee Point Card */}
              {kneePoint && (
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6 shadow-sm ring-4 ring-emerald-500/5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-emerald-500/10 p-2 rounded-lg">
                      <Zap size={20} className="text-emerald-500" />
                    </div>
                    <h3 className="text-sm font-black text-emerald-700 uppercase tracking-wide">Optimal Knee Point</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-[0.8125rem] py-1 border-b border-emerald-500/10">
                      <span className="text-muted-foreground font-medium">{pivot === "model" ? "Model" : "Version"}</span>
                      <span className="text-foreground font-black">{pivot === "model" ? kneePoint.model : `v${kneePoint.version_id}`}</span>
                    </div>
                    <div className="flex justify-between text-[0.8125rem] py-1 border-b border-emerald-500/10">
                      <span className="text-muted-foreground font-medium">{pivot === "model" ? "Version" : "Model"}</span>
                      <span className="text-foreground font-black">{pivot === "model" ? `v${kneePoint.version_id}` : kneePoint.model}</span>
                    </div>
                    <div className="flex justify-between text-[1rem] py-2">
                      <span className="text-muted-foreground font-bold">Accuracy</span>
                      <span className="text-emerald-600 font-black">{kneePoint.acc.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between text-[0.8125rem] py-2 bg-emerald-500/10 px-3 rounded-xl">
                      <span className="text-emerald-700 font-bold">{dimension === "cost" ? "Cost Efficiency" : "P50 Latency"}</span>
                      <span className={`${dimension === "cost" ? "text-amber-700" : "text-primary"} font-black`}>
                        {dimension === "cost" ? `$${kneePoint.xValue.toFixed(4)}` : `${kneePoint.xValue.toFixed(1)}ms`}
                      </span>
                    </div>
                  </div>
                  <p className="text-[0.75rem] text-muted-foreground mt-4 leading-relaxed font-medium">
                    Critical efficiency point identified. Higher accuracy configurations exist but require disproportionately more resources.
                  </p>
                </div>
              )}

              {/* AI Recommendation */}
              <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                <h3 className="text-sm font-black text-foreground mb-4 flex items-center gap-2 uppercase tracking-widest">Frontier Insights <Badge variant="info">Beta</Badge></h3>
                <div className="text-[0.875rem] text-muted-foreground mb-6 leading-relaxed font-medium">
                  {data.recommendation || "System-generated analysis: The frontier exhibits a strong correlation between compute resources and reasoning accuracy."}
                </div>
                <h4 className="text-[0.7rem] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4">Pareto-Optimal Candidate List</h4>
                <div className="space-y-3">
                  {paretoPoints.map((j: any) => (
                    <div key={j.job_id} className={`p-4 rounded-2xl flex items-center justify-between border transition-all ${j.isKnee ? "bg-emerald-500/5 border-emerald-500/20 shadow-sm" : "bg-muted/30 border-border/50 hover:bg-muted/50"}`}>
                      <div>
                        <div className="text-[0.8125rem] font-bold text-foreground flex items-center gap-2">
                          {pivot === "model" ? j.model : `V${j.version_id}`}
                          <span className="text-muted-foreground text-[0.75rem] font-mono opacity-60">{pivot === "model" ? `v${j.version_id}` : j.model}</span>
                          {j.isKnee && <Badge variant="success" className="scale-75 origin-left">BEST</Badge>}
                        </div>
                        <div className="text-[0.7rem] text-muted-foreground mt-1 font-bold">
                          ACC: <span className="text-foreground">{j.acc.toFixed(1)}%</span> · {dimension === "cost" ? "COST" : "LAT"}: <span className="text-foreground">{dimension === "cost" ? `$${j.xValue.toFixed(4)}` : `${j.xValue.toFixed(1)}ms`}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Logic Explained */}
              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 shadow-sm">
                <h3 className="text-sm font-black text-primary mb-4 flex items-center gap-2 uppercase tracking-widest">
                  <TrendingUp size={16} /> Frontier Methodology
                </h3>
                <div className="space-y-5">
                  <div>
                    <h4 className="text-[0.8125rem] font-black text-foreground mb-1.5 uppercase tracking-wide">Pareto Optimality</h4>
                    <p className="text-[0.75rem] text-muted-foreground leading-relaxed font-medium">
                      Configurations where accuracy cannot be improved without increasing {dimension}. These form the theoretical "efficient boundary."
                    </p>
                  </div>
                  <div>
                    <h4 className="text-[0.8125rem] font-black text-foreground mb-1.5 uppercase tracking-wide">Law of Diminishing Returns</h4>
                    <p className="text-[0.75rem] text-muted-foreground leading-relaxed font-medium">
                      Points beyond the Knee offer marginal accuracy gains for exponentially higher {dimension}. The Knee Point represents maximum "accuracy-per-dollar."
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
