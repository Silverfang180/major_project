import { useState, useEffect } from "react";
import { Topbar } from "../components/layout/Topbar";
import { Badge } from "../components/shared/Badge";
import { ChartCard } from "../components/shared/ChartCard";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend
} from "recharts";
import { SplitSquareHorizontal, CheckCircle2, ChevronRight, Loader2, ArrowRightLeft, Cpu } from "lucide-react";
import { api, type DatasetResponse, type PromptResponse, type VersionResponse, type EvalJobResponse } from "../../lib/api";

type CompareMode = "prompt" | "model";

export function ABTestsPage() {
  const [datasets, setDatasets] = useState<DatasetResponse[]>([]);
  const [selectedDataset, setSelectedDataset] = useState("");
  const [mode, setMode] = useState<CompareMode>("prompt");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // For filtered comparison
  const [prompts, setPrompts] = useState<PromptResponse[]>([]);
  const [allJobs, setAllJobs] = useState<any[]>([]);
  const [variantA, setVariantA] = useState<any>(null);
  const [variantB, setVariantB] = useState<any>(null);
  const [variantAId, setVariantAId] = useState("");
  const [variantBId, setVariantBId] = useState("");
  const [promoting, setPromoting] = useState(false);

  useEffect(() => {
    loadDatasets();
  }, []);

  async function loadDatasets() {
    try {
      const [d, p] = await Promise.all([api.getDatasets(), api.getPrompts()]);
      setDatasets(d);
      setPrompts(p);
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
      setAllJobs(resp.jobs || []);
      // Auto-select first two jobs matching the mode
      autoSelectVariants(resp.jobs || [], mode);
    } catch {
      setData(null);
      setAllJobs([]);
    } finally {
      setLoading(false);
    }
  }

  function autoSelectVariants(jobs: any[], currentMode: CompareMode) {
    if (jobs.length < 2) {
      setVariantA(null);
      setVariantB(null);
      return;
    }

    if (currentMode === "prompt") {
      // Find two jobs with same model but different version_id
      for (let i = 0; i < jobs.length; i++) {
        for (let j = i + 1; j < jobs.length; j++) {
          if (jobs[i].model === jobs[j].model && jobs[i].version_id !== jobs[j].version_id) {
            setVariantA(jobs[i]);
            setVariantB(jobs[j]);
            setVariantAId(jobs[i].job_id);
            setVariantBId(jobs[j].job_id);
            return;
          }
        }
      }
    } else {
      // Find two jobs with same version_id but different model
      for (let i = 0; i < jobs.length; i++) {
        for (let j = i + 1; j < jobs.length; j++) {
          if (jobs[i].version_id === jobs[j].version_id && jobs[i].model !== jobs[j].model) {
            setVariantA(jobs[i]);
            setVariantB(jobs[j]);
            setVariantAId(jobs[i].job_id);
            setVariantBId(jobs[j].job_id);
            return;
          }
        }
      }
    }
    // Fallback: just pick the first two
    setVariantA(jobs[0]);
    setVariantB(jobs[1]);
    setVariantAId(jobs[0].job_id);
    setVariantBId(jobs[1].job_id);
  }

  function handleDatasetChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    setSelectedDataset(id);
    loadComparison(id);
  }

  function handleModeChange(newMode: CompareMode) {
    setMode(newMode);
    autoSelectVariants(allJobs, newMode);
  }

  function handleVariantSelect(side: "A" | "B", jobId: string) {
    const job = allJobs.find((j) => j.job_id === jobId);
    if (!job) return;
    if (side === "A") {
      setVariantA(job);
      setVariantAId(jobId);
    } else {
      setVariantB(job);
      setVariantBId(jobId);
    }
  }

  function getWinner(): "A" | "B" | "tie" {
    if (!variantA || !variantB) return "tie";
    const accA = variantA.accuracy || 0;
    const accB = variantB.accuracy || 0;
    if (accA > accB) return "A";
    if (accB > accA) return "B";
    // Tiebreak on cost
    const costA = variantA.cost_per_correct || Infinity;
    const costB = variantB.cost_per_correct || Infinity;
    if (costA < costB) return "A";
    if (costB < costA) return "B";
    return "tie";
  }

  async function handlePromote() {
    const winner = getWinner();
    const winnerJob = winner === "A" ? variantA : variantB;
    if (!winnerJob) return;
    setPromoting(true);
    try {
      await api.promoteVersion(winnerJob.prompt_id, winnerJob.version_id);
      alert(`Version ${winnerJob.version_id} promoted to production!`);
    } catch (e: any) {
      alert("Promotion failed: " + e.message);
    } finally {
      setPromoting(false);
    }
  }

  // Build filtered dropdown options based on mode
  function getVariantOptions(otherJob: any | null): any[] {
    if (!allJobs.length) return allJobs;
    if (!otherJob) return allJobs;

    if (mode === "prompt") {
      // Same model, different versions
      return allJobs.filter(j => j.model === otherJob.model || j.job_id === otherJob.job_id);
    } else {
      // Same version, different models
      return allJobs.filter(j => j.version_id === otherJob.version_id || j.job_id === otherJob.job_id);
    }
  }

  const winner = getWinner();

  return (
    <div>
      <Topbar title="A/B Tests" subtitle="Compare prompt versions and models side-by-side" />
      <div className="p-6">
        {/* Controls Bar */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <label className="text-[0.8125rem] text-slate-400">Dataset:</label>
            <select value={selectedDataset} onChange={handleDatasetChange} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-[0.8125rem] text-white outline-none w-56">
              {datasets.map((d) => <option key={d.dataset_id} value={d.dataset_id}>{d.name}</option>)}
            </select>
          </div>
          <div className="h-6 w-px bg-slate-700" />
          <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-0.5 border border-slate-700/50">
            <button
              onClick={() => handleModeChange("prompt")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[0.8125rem] transition-all ${mode === "prompt"
                ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30"
                : "text-slate-400 hover:text-white border border-transparent"
                }`}
            >
              <ArrowRightLeft size={14} />
              Compare Prompts
            </button>
            <button
              onClick={() => handleModeChange("model")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[0.8125rem] transition-all ${mode === "model"
                ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30"
                : "text-slate-400 hover:text-white border border-transparent"
                }`}
            >
              <Cpu size={14} />
              Compare Models
            </button>
          </div>
        </div>

        {/* Mode Description */}
        <div className="mb-6 bg-slate-800/20 border border-slate-700/30 rounded-lg px-4 py-3">
          {mode === "prompt" ? (
            <p className="text-[0.8125rem] text-slate-400">
              <span className="text-indigo-400 font-medium">Prompt Optimization Mode:</span> Comparing different prompt versions on the <span className="text-white font-medium">same LLM</span>. Find out which prompt wording yields better accuracy.
            </p>
          ) : (
            <p className="text-[0.8125rem] text-slate-400">
              <span className="text-indigo-400 font-medium">Model Migration Mode:</span> Comparing different LLMs running the <span className="text-white font-medium">same prompt version</span>. Find out if a cheaper model can match a premium one.
            </p>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-slate-500" /></div>
        ) : !data || allJobs.length < 2 ? (
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-8 text-center text-slate-500 text-sm">
            Need at least two completed evaluation jobs on this dataset for A/B comparison.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Variant Selectors */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <Badge variant="neutral">A</Badge>
                <select
                  value={variantAId}
                  onChange={(e) => handleVariantSelect("A", e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-[0.8125rem] text-white outline-none"
                >
                  {getVariantOptions(variantB).map((j) => (
                    <option key={j.job_id} value={j.job_id}>
                      {j.model} — v{j.version_id} (Acc: {((j.accuracy || 0) * 100).toFixed(1)}%)
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="success">B</Badge>
                <select
                  value={variantBId}
                  onChange={(e) => handleVariantSelect("B", e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-[0.8125rem] text-white outline-none"
                >
                  {getVariantOptions(variantA).map((j) => (
                    <option key={j.job_id} value={j.job_id}>
                      {j.model} — v{j.version_id} (Acc: {((j.accuracy || 0) * 100).toFixed(1)}%)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {variantA && variantB && (
              <>
                {/* Side-by-side Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative">
                  <div className="hidden lg:flex absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-slate-800 border border-slate-700 rounded-full items-center justify-center z-10 text-slate-400 text-xs font-bold">
                    VS
                  </div>

                  {/* Variant A */}
                  <div className={`bg-slate-800/30 border rounded-xl p-6 ${winner === "A" ? "ring-1 ring-emerald-500/30 border-emerald-500/20" : "border-slate-700/50"}`}>
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="neutral">Variant A</Badge>
                          {winner === "A" && <Badge variant="success">Winner</Badge>}
                        </div>
                        <h3 className="text-white font-medium">{variantA.model}</h3>
                        <p className="text-slate-400 text-sm">Version {variantA.version_id}</p>
                      </div>
                      <div className="text-right">
                        <div className={`text-2xl font-semibold ${winner === "A" ? "text-emerald-400" : "text-white"}`}>{((variantA.accuracy || 0) * 100).toFixed(1)}%</div>
                        <div className="text-slate-500 text-xs mt-1">Accuracy</div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-slate-400">Cost Efficiency</span>
                          <span className="text-slate-300 font-medium">${variantA.cost_per_correct?.toFixed(4)}/correct</span>
                        </div>
                        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 transition-all" style={{ width: `${Math.min(((variantA.accuracy || 0) * 100), 100)}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-slate-400">P50 Latency</span>
                          <span className="text-slate-300 font-medium">{variantA.p50_latency_ms}ms</span>
                        </div>
                        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-400 transition-all" style={{ width: `${Math.max(100 - ((variantA.p50_latency_ms || 0) / 20), 10)}%` }} />
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 pt-2 border-t border-slate-700/30">
                        Total Cost: <span className="text-amber-400">${(variantA.total_cost || 0).toFixed(4)}</span> · Examples: {variantA.total_examples || "—"}
                      </div>
                    </div>
                  </div>

                  {/* Variant B */}
                  <div className={`bg-slate-800/30 border rounded-xl p-6 ${winner === "B" ? "ring-1 ring-emerald-500/30 border-emerald-500/20" : "border-slate-700/50"}`}>
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="success">Variant B</Badge>
                          {winner === "B" && <Badge variant="success">Winner</Badge>}
                        </div>
                        <h3 className="text-white font-medium">{variantB.model}</h3>
                        <p className="text-slate-400 text-sm">Version {variantB.version_id}</p>
                      </div>
                      <div className="text-right">
                        <div className={`text-2xl font-semibold ${winner === "B" ? "text-emerald-400" : "text-white"}`}>{((variantB.accuracy || 0) * 100).toFixed(1)}%</div>
                        <div className="text-slate-500 text-xs mt-1">Accuracy</div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-slate-400">Cost Efficiency</span>
                          <span className="text-slate-300 font-medium">${variantB.cost_per_correct?.toFixed(4)}/correct</span>
                        </div>
                        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${Math.min(((variantB.accuracy || 0) * 100), 100)}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-slate-400">P50 Latency</span>
                          <span className="text-slate-300 font-medium">{variantB.p50_latency_ms}ms</span>
                        </div>
                        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-400 transition-all" style={{ width: `${Math.max(100 - ((variantB.p50_latency_ms || 0) / 20), 10)}%` }} />
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 pt-2 border-t border-slate-700/30">
                        Total Cost: <span className="text-amber-400">${(variantB.total_cost || 0).toFixed(4)}</span> · Examples: {variantB.total_examples || "—"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Charts + Winner */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ChartCard title="Metric Comparison" subtitle="Radar view of multi-dimensional performance">
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={[
                          { metric: 'Accuracy', A: (variantA.accuracy || 0) * 100, B: (variantB.accuracy || 0) * 100 },
                          { metric: 'Cost Eff', A: 100 - ((variantA.cost_per_correct || 0) * 100), B: 100 - ((variantB.cost_per_correct || 0) * 100) },
                          { metric: 'Speed', A: Math.max(0, 1000 - (variantA.p50_latency_ms || 0)), B: Math.max(0, 1000 - (variantB.p50_latency_ms || 0)) }
                        ]}>
                          <PolarGrid stroke="#1c2130" />
                          <PolarAngleAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} stroke="#1c2130" />
                          <Radar name="Variant A" dataKey="A" stroke="#008cff" fill="#008cff" fillOpacity={0.25} />
                          <Radar name="Variant B" dataKey="B" stroke="#10b981" fill="#10b981" fillOpacity={0.25} />
                          <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </ChartCard>

                  <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6">
                    <h3 className="text-sm font-medium text-white mb-4">
                      {mode === "prompt" ? "Prompt Optimization Result" : "Model Migration Result"}
                    </h3>

                    {/* Mode context */}
                    <div className="text-xs text-slate-500 mb-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700/30">
                      {mode === "prompt" ? (
                        <>Fixed LLM: <span className="text-indigo-400 font-medium">{variantA.model}</span> · Comparing prompt v{variantA.version_id} vs v{variantB.version_id}</>
                      ) : (
                        <>Fixed Prompt: <span className="text-indigo-400 font-medium">Version {variantA.version_id}</span> · Comparing {variantA.model} vs {variantB.model}</>
                      )}
                    </div>

                    {winner !== "tie" ? (
                      <>
                        <div className="flex items-start gap-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg mb-6">
                          <div className="mt-0.5"><CheckCircle2 className="text-emerald-400" size={20} /></div>
                          <div>
                            <h4 className="text-emerald-400 font-medium text-sm mb-1">
                              Variant {winner} is recommended
                            </h4>
                            <p className="text-slate-400 text-[0.8125rem] leading-relaxed">
                              {mode === "prompt" ? (
                                <>Prompt version {winner === "A" ? variantA.version_id : variantB.version_id} achieved {(((winner === "A" ? variantA.accuracy : variantB.accuracy) || 0) * 100).toFixed(1)}% accuracy on {variantA.model}, outperforming the alternative at {(((winner === "A" ? variantB.accuracy : variantA.accuracy) || 0) * 100).toFixed(1)}%.</>
                              ) : (
                                <>{winner === "A" ? variantA.model : variantB.model} achieved {(((winner === "A" ? variantA.accuracy : variantB.accuracy) || 0) * 100).toFixed(1)}% accuracy with prompt v{variantA.version_id}, outperforming {winner === "A" ? variantB.model : variantA.model} at {(((winner === "A" ? variantB.accuracy : variantA.accuracy) || 0) * 100).toFixed(1)}%.</>
                              )}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={handlePromote}
                          disabled={promoting}
                          className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-[0.8125rem] rounded-lg transition-colors"
                        >
                          {promoting ? <Loader2 size={14} className="animate-spin" /> : null}
                          Promote Variant {winner} to Production <ChevronRight size={14} />
                        </button>
                      </>
                    ) : (
                      <div className="flex items-start gap-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                        <div className="mt-0.5"><SplitSquareHorizontal className="text-amber-400" size={20} /></div>
                        <div>
                          <h4 className="text-amber-400 font-medium text-sm mb-1">Statistical Tie</h4>
                          <p className="text-slate-400 text-[0.8125rem] leading-relaxed">
                            Both variants performed equally on accuracy and cost metrics. Consider running more examples to break the tie.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
