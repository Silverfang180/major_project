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
        <div className="flex flex-wrap items-center gap-4 mb-8 bg-card border border-border p-4 rounded-2xl shadow-sm transition-all">
          <div className="flex items-center gap-3">
            <label className="text-[0.8125rem] text-muted-foreground font-bold uppercase tracking-wider">Dataset:</label>
            <select value={selectedDataset} onChange={handleDatasetChange} className="bg-background border border-border rounded-xl px-4 py-2 text-[0.8125rem] text-foreground outline-none w-64 focus:ring-2 focus:ring-primary/10 transition-all shadow-sm font-medium">
              {datasets.map((d) => <option key={d.dataset_id} value={d.dataset_id}>{d.name}</option>)}
            </select>
          </div>
          <div className="h-8 w-px bg-border/50 hidden sm:block" />
          <div className="flex items-center gap-1.5 bg-muted/40 rounded-xl p-1 border border-border shadow-inner">
            <button
              onClick={() => handleModeChange("prompt")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[0.8125rem] font-bold transition-all ${mode === "prompt"
                ? "bg-primary text-primary-foreground shadow-sm scale-[1.02]"
                : "text-muted-foreground hover:bg-muted"
                }`}
            >
              <ArrowRightLeft size={14} />
              Compare Prompts
            </button>
            <button
              onClick={() => handleModeChange("model")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[0.8125rem] font-bold transition-all ${mode === "model"
                ? "bg-primary text-primary-foreground shadow-sm scale-[1.02]"
                : "text-muted-foreground hover:bg-muted"
                }`}
            >
              <Cpu size={14} />
              Compare Models
            </button>
          </div>
        </div>

        {/* Mode Description */}
        <div className="mb-8 bg-primary/5 border border-primary/10 rounded-2xl px-5 py-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-500">
          {mode === "prompt" ? (
            <p className="text-[0.8125rem] text-muted-foreground leading-relaxed">
              <span className="text-primary font-bold uppercase tracking-tight mr-2">Prompt Optimization Mode</span> Comparing different prompt versions on the <span className="text-foreground font-bold underline decoration-primary/30 decoration-2 underline-offset-4">same LLM</span>. Find out which prompt wording yields better accuracy.
            </p>
          ) : (
            <p className="text-[0.8125rem] text-muted-foreground leading-relaxed">
              <span className="text-primary font-bold uppercase tracking-tight mr-2">Model Migration Mode</span> Comparing different LLMs running the <span className="text-foreground font-bold underline decoration-primary/30 decoration-2 underline-offset-4">same prompt version</span>. Find out if a cheaper model can match a premium one.
            </p>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-slate-500" /></div>
        ) : !data || allJobs.length < 2 ? (
          <div className="bg-card border border-border rounded-2xl p-12 text-center text-muted-foreground text-[0.8125rem] font-medium shadow-sm">
            Need at least two completed evaluation jobs on this dataset for A/B comparison.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Variant Selectors */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-2">
              <div className="flex items-center gap-4 bg-muted/20 border border-border p-3 rounded-2xl shadow-inner">
                <Badge variant="neutral" className="h-8 w-8 flex items-center justify-center rounded-lg shadow-sm">A</Badge>
                <select
                  value={variantAId}
                  onChange={(e) => handleVariantSelect("A", e.target.value)}
                  className="flex-1 bg-background border border-border rounded-xl px-4 py-2 text-[0.8125rem] text-foreground outline-none focus:ring-2 focus:ring-primary/10 transition-all font-semibold"
                >
                  {getVariantOptions(variantB).map((j) => (
                    <option key={j.job_id} value={j.job_id}>
                      {j.model} — v{j.version_id} (Acc: {((j.accuracy || 0) * 100).toFixed(1)}%)
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-4 bg-primary/5 border border-primary/10 p-3 rounded-2xl shadow-inner">
                <Badge variant="success" className="h-8 w-8 flex items-center justify-center rounded-lg shadow-sm">B</Badge>
                <select
                  value={variantBId}
                  onChange={(e) => handleVariantSelect("B", e.target.value)}
                  className="flex-1 bg-background border border-border rounded-xl px-4 py-2 text-[0.8125rem] text-foreground outline-none focus:ring-2 focus:ring-primary/10 transition-all font-semibold"
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
                {/* Side-by-side Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative pt-4">
                  <div className="hidden lg:flex absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-background border border-border rounded-full items-center justify-center z-10 text-primary text-xs font-black shadow-lg">
                    VS
                  </div>

                  {/* Variant A */}
                  <div className={`bg-card border rounded-2xl p-6 shadow-sm transition-all hover:shadow-md ${winner === "A" ? "ring-2 ring-emerald-500 shadow-emerald-500/10" : "border-border"}`}>
                    <div className="flex justify-between items-start mb-6 pb-6 border-b border-border/50">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="neutral">Variant A</Badge>
                          {winner === "A" && <Badge variant="success">Winner</Badge>}
                        </div>
                        <h3 className="text-foreground font-bold text-lg">{variantA.model}</h3>
                        <p className="text-muted-foreground text-xs font-mono">VERSION: {variantA.version_id}</p>
                      </div>
                      <div className="text-right">
                        <div className={`text-3xl font-bold tracking-tight ${winner === "A" ? "text-emerald-500" : "text-foreground"}`}>{((variantA.accuracy || 0) * 100).toFixed(1)}%</div>
                        <div className="text-muted-foreground text-[0.6rem] font-bold uppercase tracking-widest mt-1">Accuracy Score</div>
                      </div>
                    </div>
                    <div className="space-y-5">
                      <div>
                        <div className="flex justify-between text-[0.6875rem] font-bold uppercase tracking-wider mb-2">
                          <span className="text-muted-foreground">Cost Efficiency</span>
                          <span className="text-foreground">${variantA.cost_per_correct?.toFixed(4)} <span className="text-muted-foreground/60">/correct</span></span>
                        </div>
                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden shadow-inner">
                          <div className="h-full bg-primary transition-all duration-1000" style={{ width: `${Math.min(((variantA.accuracy || 0) * 100), 100)}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[0.6875rem] font-bold uppercase tracking-wider mb-2">
                          <span className="text-muted-foreground">P50 Latency</span>
                          <span className="text-foreground">{variantA.p50_latency_ms} <span className="text-muted-foreground/60">ms</span></span>
                        </div>
                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden shadow-inner">
                          <div className="h-full bg-primary/40 transition-all duration-1000" style={{ width: `${Math.max(100 - ((variantA.p50_latency_ms || 0) / 20), 10)}%` }} />
                        </div>
                      </div>
                      <div className="text-[0.6875rem] text-muted-foreground pt-3 flex items-center justify-between font-medium">
                        <span>Total Cost: <span className="text-amber-600 font-bold">${(variantA.total_cost || 0).toFixed(4)}</span></span>
                        <span>Examples: <span className="text-foreground font-bold">{variantA.total_examples || "—"}</span></span>
                      </div>
                    </div>
                  </div>

                  {/* Variant B */}
                  <div className={`bg-card border rounded-2xl p-6 shadow-sm transition-all hover:shadow-md ${winner === "B" ? "ring-2 ring-emerald-500 shadow-emerald-500/10" : "border-border"}`}>
                    <div className="flex justify-between items-start mb-6 pb-6 border-b border-border/50">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="success">Variant B</Badge>
                          {winner === "B" && <Badge variant="success">Winner</Badge>}
                        </div>
                        <h3 className="text-foreground font-bold text-lg">{variantB.model}</h3>
                        <p className="text-muted-foreground text-xs font-mono">VERSION: {variantB.version_id}</p>
                      </div>
                      <div className="text-right">
                        <div className={`text-3xl font-bold tracking-tight ${winner === "B" ? "text-emerald-500" : "text-foreground"}`}>{((variantB.accuracy || 0) * 100).toFixed(1)}%</div>
                        <div className="text-muted-foreground text-[0.6rem] font-bold uppercase tracking-widest mt-1">Accuracy Score</div>
                      </div>
                    </div>
                    <div className="space-y-5">
                      <div>
                        <div className="flex justify-between text-[0.6875rem] font-bold uppercase tracking-wider mb-2">
                          <span className="text-muted-foreground">Cost Efficiency</span>
                          <span className="text-foreground">${variantB.cost_per_correct?.toFixed(4)} <span className="text-muted-foreground/60">/correct</span></span>
                        </div>
                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden shadow-inner">
                          <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${Math.min(((variantB.accuracy || 0) * 100), 100)}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[0.6875rem] font-bold uppercase tracking-wider mb-2">
                          <span className="text-muted-foreground">P50 Latency</span>
                          <span className="text-foreground">{variantB.p50_latency_ms} <span className="text-muted-foreground/60">ms</span></span>
                        </div>
                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden shadow-inner">
                          <div className="h-full bg-emerald-400 transition-all duration-1000" style={{ width: `${Math.max(100 - ((variantB.p50_latency_ms || 0) / 20), 10)}%` }} />
                        </div>
                      </div>
                      <div className="text-[0.6875rem] text-muted-foreground pt-3 flex items-center justify-between font-medium">
                        <span>Total Cost: <span className="text-amber-600 font-bold">${(variantB.total_cost || 0).toFixed(4)}</span></span>
                        <span>Examples: <span className="text-foreground font-bold">{variantB.total_examples || "—"}</span></span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Charts + Winner */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <ChartCard title="Metric Comparison" subtitle="Radar view of multi-dimensional performance">
                    <div className="h-[320px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={[
                          { metric: 'Accuracy', A: (variantA.accuracy || 0) * 100, B: (variantB.accuracy || 0) * 100 },
                          { metric: 'Cost Eff', A: 100 - ((variantA.cost_per_correct || 0) * 100), B: 100 - ((variantB.cost_per_correct || 0) * 100) },
                          { metric: 'Speed', A: Math.max(0, 100 - ((variantA.p50_latency_ms || 0) / 20)), B: Math.max(0, 100 - ((variantB.p50_latency_ms || 0) / 20)) }
                        ]}>
                          <PolarGrid stroke="currentColor" className="text-border" />
                          <PolarAngleAxis dataKey="metric" tick={{ fill: 'currentColor', fontSize: 11, fontWeight: 700 }} className="text-muted-foreground" />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} stroke="currentColor" className="text-border" />
                          <Radar name="A" dataKey="A" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.15} dot={{ r: 4, fill: 'var(--primary)' }} />
                          <Radar name="B" dataKey="B" stroke="#10b981" fill="#10b981" fillOpacity={0.15} dot={{ r: 4, fill: '#10b981' }} />
                          <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 600, paddingTop: '20px' }} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </ChartCard>

                  <div className="bg-card border border-border rounded-2xl p-6 shadow-sm overflow-hidden flex flex-col">
                    <h3 className="text-[0.7rem] font-black text-muted-foreground uppercase tracking-[0.2em] mb-6">
                      {mode === "prompt" ? "Prompt Optimization Result" : "Model Migration Result"}
                    </h3>

                    {/* Mode context */}
                    <div className="text-[0.75rem] text-muted-foreground mb-6 p-4 bg-muted/40 rounded-xl border border-border/50">
                      {mode === "prompt" ? (
                        <div className="flex items-center gap-2">
                          <span className="opacity-60">Fixed LLM:</span> 
                          <span className="text-primary font-bold">{variantA.model}</span> 
                          <span className="h-1 w-1 bg-border rounded-full mx-1" />
                          <span className="opacity-60">Versions:</span> 
                          <span className="text-foreground font-bold">{variantA.version_id} vs {variantB.version_id}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="opacity-60">Fixed Prompt:</span> 
                          <span className="text-primary font-bold">V {variantA.version_id}</span> 
                          <span className="h-1 w-1 bg-border rounded-full mx-1" />
                          <span className="opacity-60">Comparing:</span> 
                          <span className="text-foreground font-bold">{variantA.model} vs {variantB.model}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1">
                      {winner !== "tie" ? (
                        <div className="space-y-6">
                          <div className="flex items-start gap-4 p-5 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl ring-4 ring-emerald-500/5">
                            <div className="mt-1 bg-emerald-500/10 p-2 rounded-lg">
                              <CheckCircle2 className="text-emerald-500" size={24} />
                            </div>
                            <div>
                              <h4 className="text-emerald-600 font-black text-sm mb-1.5 uppercase tracking-wide">
                                Variant {winner} is recommended
                              </h4>
                              <p className="text-muted-foreground text-[0.8125rem] leading-relaxed font-medium">
                                {mode === "prompt" ? (
                                  <>Prompt version <span className="text-foreground font-bold">{winner === "A" ? variantA.version_id : variantB.version_id}</span> achieved <span className="text-emerald-600 font-bold">{(((winner === "A" ? variantA.accuracy : variantB.accuracy) || 0) * 100).toFixed(1)}%</span> accuracy on {variantA.model}, outperforming the alternative.</>
                                ) : (
                                  <><span className="text-foreground font-bold">{winner === "A" ? variantA.model : variantB.model}</span> achieved <span className="text-emerald-600 font-bold">{(((winner === "A" ? variantA.accuracy : variantB.accuracy) || 0) * 100).toFixed(1)}%</span> accuracy, outperforming the legacy model.</>
                                )}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={handlePromote}
                            disabled={promoting}
                            className="w-full flex items-center justify-center gap-3 py-3.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-[0.8125rem] font-bold rounded-2xl transition-all shadow-lg shadow-primary/20 active:scale-[0.98]"
                          >
                            {promoting ? <Loader2 size={16} className="animate-spin" /> : null}
                            Promote Variant {winner} to Production <ChevronRight size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-start gap-4 p-5 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
                          <div className="mt-1 bg-amber-500/10 p-2 rounded-lg">
                            <SplitSquareHorizontal className="text-amber-600" size={24} />
                          </div>
                          <div>
                            <h4 className="text-amber-700 font-black text-sm mb-1.5 uppercase tracking-wide">Statistical Tie</h4>
                            <p className="text-muted-foreground text-[0.8125rem] leading-relaxed font-medium">
                              Both variants performed equally on accuracy and cost metrics. Consider running more examples to reach statistical significance.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
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
