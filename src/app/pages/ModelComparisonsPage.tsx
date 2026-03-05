import { useState, useEffect } from "react";
import { Topbar } from "../components/layout/Topbar";
import { ChartCard } from "../components/shared/ChartCard";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Loader2 } from "lucide-react";
import { api, type DatasetResponse } from "../../lib/api";

export function ModelComparisonsPage() {
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
      <Topbar title="Model Comparisons" subtitle="Evaluate foundational models across your datasets" />
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
            No completed evaluation jobs found for this dataset.
          </div>
        ) : (
          <div className="space-y-6">
            <ChartCard title="Accuracy & Cost by Prompt Model" subtitle="Aggregated scores across evaluations">
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.jobs.map((j: any) => ({ name: `${j.model} (v${j.version_id})`, Accuracy: j.accuracy * 100, CostScore: 100 - (j.cost_per_correct * 100) }))} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: '#1e293b' }} contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }} />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
                    <Bar dataKey="Accuracy" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="CostScore" name="Cost Efficiency Indicator" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>
        )}
      </div>
    </div>
  );
}