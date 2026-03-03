import { useState, useEffect } from "react";
import { Topbar } from "../components/layout/Topbar";
import { Badge } from "../components/shared/Badge";
import { ChartCard } from "../components/shared/ChartCard";
import { LineChart, Line, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { HelpCircle, Loader2 } from "lucide-react";
import { api, type DatasetResponse } from "../../lib/api";

export function ParetoPage() {
  const [datasets, setDatasets] = useState<DatasetResponse[]>([]);
  const [selectedDataset, setSelectedDataset] = useState("");
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
        loadPareto(d[0].dataset_id);
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }

  async function loadPareto(dsId: string) {
    setLoading(true);
    try {
      const resp = await api.getCompare(dsId);
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
    loadPareto(id);
  }

  return (
    <div>
      <Topbar title="Pareto Analysis" subtitle="Optimize models for cost and latency vs. accuracy" />
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <label className="text-[0.8125rem] text-slate-400">Select Dataset Base:</label>
          <select value={selectedDataset} onChange={handleDatasetChange} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-[0.8125rem] text-white outline-none w-64">
            {datasets.map((d) => <option key={d.dataset_id} value={d.dataset_id}>{d.name}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-slate-500" /></div>
        ) : !data || data.jobs.length === 0 ? (
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-8 text-center text-slate-500 text-sm">
            No completed evaluation jobs found for this dataset. Run evals to populate the Pareto frontier.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <ChartCard title="Cost vs. Accuracy Frontier" subtitle="Optimal models lie on the top-left edge">
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                      <XAxis type="number" dataKey="cost" name="Cost" unit="$" stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `$${v.toFixed(3)}`} />
                      <YAxis type="number" dataKey="acc" name="Accuracy" unit="%" stroke="#94a3b8" fontSize={12} domain={[0, 100]} />
                      <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px" }} />
                      <Scatter
                        name="Models"
                        data={data.jobs.map((j: any) => ({ name: `${j.prompt_key}-v${j.version_id}`, cost: j.summary.cost_per_correct || 0, acc: (j.summary.accuracy || 0) * 100 }))}
                        fill="#6366f1"
                      />
                      {data.pareto_frontier && (
                        <Line type="monotone" dataKey="acc" data={data.pareto_frontier.map((p: any) => ({ cost: p.cost, acc: p.acc * 100 }))} stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} />
                      )}
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            </div>
            <div>
              <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6">
                <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">AI Recommendation <Badge variant="info">Beta</Badge></h3>
                <div className="text-sm text-slate-300 mb-6 leading-relaxed">
                  {data.recommendation || "Based on the frontier, you have clear tradeoffs between cost and accuracy."}
                </div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Frontier Models</h4>
                <div className="space-y-3">
                  {data.jobs.map((j: any) => {
                    // Check if it's on frontier (mock logic for UI display if backend didn't supply boolean tag)
                    const isOptimal = true;
                    if (!isOptimal) return null;
                    return (
                      <div key={j.job_id} className="p-3 bg-slate-800/50 rounded-lg flex items-center justify-between border border-emerald-500/20">
                        <div>
                          <div className="text-[0.8125rem] font-medium text-white flex items-center gap-2">{j.prompt_key} <span className="text-slate-500 text-xs font-mono">v{j.version_id}</span></div>
                          <div className="text-[0.75rem] text-slate-400 mt-1">Acc: {(j.summary.accuracy * 100).toFixed(1)}% • Cost: ${j.summary.cost_per_correct?.toFixed(4)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
