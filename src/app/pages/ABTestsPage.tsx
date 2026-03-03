import { useState, useEffect } from "react";
import { Topbar } from "../components/layout/Topbar";
import { Badge } from "../components/shared/Badge";
import { ChartCard } from "../components/shared/ChartCard";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from "recharts";
import { SplitSquareHorizontal, CheckCircle2, ChevronRight, Loader2 } from "lucide-react";
import { api, type DatasetResponse } from "../../lib/api";

export function ABTestsPage() {
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
        loadComparison(d[0].dataset_id);
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }

  async function loadComparison(dsId: string) {
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
    loadComparison(id);
  }

  return (
    <div>
      <Topbar title="A/B Tests" subtitle="Compare prompt versions side-by-side" />
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <label className="text-[0.8125rem] text-slate-400">Select Dataset Base:</label>
          <select value={selectedDataset} onChange={handleDatasetChange} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-[0.8125rem] text-white outline-none w-64">
            {datasets.map((d) => <option key={d.dataset_id} value={d.dataset_id}>{d.name}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-slate-500" /></div>
        ) : !data || data.jobs.length < 2 ? (
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-8 text-center text-slate-500 text-sm">
            Need at least two completed evaluation jobs on this dataset for A/B comparison.
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative">
              <div className="hidden lg:flex absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-slate-800 border border-slate-700 rounded-full items-center justify-center z-10 text-slate-400">
                VS
              </div>

              {/* Variant A (index 0) */}
              <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6 ring-1 ring-indigo-500/20">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="neutral">Variant A</Badge>
                      <h3 className="text-white font-medium">{data.jobs[0].prompt_key}</h3>
                    </div>
                    <p className="text-slate-400 text-sm">Version {data.jobs[0].version_id}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-semibold text-white">{(data.jobs[0].summary.accuracy * 100).toFixed(1)}%</div>
                    <div className="text-slate-500 text-xs mt-1">Accuracy</div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-slate-400">Cost Efficiency</span>
                      <span className="text-slate-300 font-medium">${data.jobs[0].summary.cost_per_correct?.toFixed(4)}/correct</span>
                    </div>
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 w-[65%]" />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-slate-400">P50 Latency</span>
                      <span className="text-slate-300 font-medium">{data.jobs[0].summary.p50_latency_ms}ms</span>
                    </div>
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-400 w-[80%]" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Variant B (index 1) */}
              <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6 ring-1 ring-emerald-500/20">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="success">Variant B</Badge>
                      <h3 className="text-white font-medium">{data.jobs[1].prompt_key}</h3>
                    </div>
                    <p className="text-slate-400 text-sm">Version {data.jobs[1].version_id}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-semibold text-emerald-400">{(data.jobs[1].summary.accuracy * 100).toFixed(1)}%</div>
                    <div className="text-emerald-500/70 text-xs mt-1">Accuracy</div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-slate-400">Cost Efficiency</span>
                      <span className="text-slate-300 font-medium">${data.jobs[1].summary.cost_per_correct?.toFixed(4)}/correct</span>
                    </div>
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 w-[85%]" />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-slate-400">P50 Latency</span>
                      <span className="text-slate-300 font-medium">{data.jobs[1].summary.p50_latency_ms}ms</span>
                    </div>
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-400 w-[60%]" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartCard title="Metric Comparison" subtitle="Radar view of multi-dimensional performance">
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={[
                      { metric: 'Accuracy', A: data.jobs[0].summary.accuracy * 100, B: data.jobs[1].summary.accuracy * 100 },
                      { metric: 'Cost Eff', A: 100 - (data.jobs[0].summary.cost_per_correct * 1000), B: 100 - (data.jobs[1].summary.cost_per_correct * 1000) },
                      { metric: 'Speed', A: 1000 - data.jobs[0].summary.p50_latency_ms, B: 1000 - data.jobs[1].summary.p50_latency_ms }
                    ]}>
                      <PolarGrid stroke="#334155" />
                      <PolarAngleAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} stroke="#334155" />
                      <Radar name="Variant A" dataKey="A" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
                      <Radar name="Variant B" dataKey="B" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6">
                <h3 className="text-sm font-medium text-white mb-6">Winner Analysis</h3>
                <div className="flex items-start gap-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg mb-6">
                  <div className="mt-0.5"><CheckCircle2 className="text-emerald-400" size={20} /></div>
                  <div>
                    <h4 className="text- emerald-400 font-medium text-sm mb-1">Variant B is recommended</h4>
                    <p className="text-slate-400 text-[0.8125rem] leading-relaxed">
                      {data.recommendation || `Variant B achieved ${(data.jobs[1].summary.accuracy * 100).toFixed(1)}% accuracy compared to Variant A's ${(data.jobs[0].summary.accuracy * 100).toFixed(1)}%, while maintaining a lower cost per correct answer.`}
                    </p>
                  </div>
                </div>
                <button className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-[0.8125rem] rounded-lg border border-slate-600 transition-colors">
                  Promote Variant B to Production <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
