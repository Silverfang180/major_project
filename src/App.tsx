import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Activity, Layers, Terminal, Database, Zap, TrendingUp, ChevronRight, Plus,
  ShieldCheck, Search, Settings, Cpu, Clock, DollarSign, Filter, GitCommit,
  History, CheckCircle2, Command, MoreHorizontal, Split, Maximize2, X,
  Lock, MessageSquare, Sparkles, Ghost, Copy, LayoutGrid, Link, Globe,
  ArrowUpRight, BookOpen, Users, CreditCard, AppWindow, Variable as VariableIcon,
  BarChart3, ChevronDown, Trash2, Check, AlertTriangle, RefreshCw, Layers2,
  ArrowLeftRight, Info, HardDrive, CpuIcon, AlertCircle, Play
} from 'lucide-react';

const WORKSPACES = ['Chronicle Dev', 'Chronicle Staging', 'Chronicle Production'];

// API Client
const BASE = 'http://localhost:8000/api/v1';
const H = { 'Content-Type': 'application/json', 'X-API-Key': 'chronicle-dev-key' };
const api = {
  getPrompts: () => fetch(`${BASE}/version-control/prompts`, { headers: H }),
  getVersions: (id) => fetch(`${BASE}/version-control/versions/${id}/history`, { headers: H }),
  promote: (promptId, versionId) => fetch(`${BASE}/version-control/prompts/${promptId}/promote`, { method: 'POST', headers: H, body: JSON.stringify({ version_id: versionId }) }),
  getAliasHistory: (id) => fetch(`${BASE}/version-control/prompts/${id}/alias-history`, { headers: H }),
  execute: (key, vars, versionId) => fetch(`${BASE}/execute/${key}${versionId ? `?version_id=${versionId}` : ''}`, { method: 'POST', headers: H, body: JSON.stringify({ variables: vars }) }),
  getDashboard: () => fetch(`${BASE}/eval/dashboard`, { headers: H }),
  getDatasets: () => fetch(`${BASE}/eval/datasets`, { headers: H }),
  getExamples: (id) => fetch(`${BASE}/eval/datasets/${id}/examples`, { headers: H }),
  createJob: (data) => fetch(`${BASE}/eval/jobs`, { method: 'POST', headers: H, body: JSON.stringify(data) }),
  getJob: (id) => fetch(`${BASE}/eval/jobs/${id}`, { headers: H }),
  getJobReport: (id) => fetch(`${BASE}/eval/jobs/${id}/report`, { headers: H }),
  compareDataset: (id) => fetch(`${BASE}/eval/compare/dataset/${id}`, { headers: H }),
  getLeaderboard: (id) => fetch(`${BASE}/eval/datasets/${id}/leaderboard`, { headers: H }),
};

// Helpers
const relTime = (iso) => {
  if (!iso) return 'â€”';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const extractVars = (text) => {
  if (!text) return [];
  const matches = [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)];
  return [...new Set(matches.map(m => m[1]))];
};

const StatusBadge = ({ status }) => {
  const styles = {
    production: 'bg-black text-white px-3',
    latest: 'bg-[#E2F581] text-black px-3 border border-black/10',
    stable: 'bg-white text-slate-600 px-3 border border-slate-200',
    archive: 'bg-slate-100 text-slate-400 px-3',
    ERROR: 'bg-rose-500 text-white px-3',
    SUCCESS: 'bg-[#E2F581] text-black px-3',
    pending: 'bg-slate-200 text-slate-600 px-3',
    running: 'bg-indigo-600 text-white px-3',
    failed: 'bg-rose-500 text-white px-3',
    completed: 'bg-[#E2F581] text-black px-3'
  };
  return (
    <span className={`text-[10px] font-black rounded-full py-1 ${styles[status] || styles.latest} uppercase tracking-tighter`}>
      {status}
    </span>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState('prompts');
  const [activeWorkspace, setActiveWorkspace] = useState(WORKSPACES[0]);
  const [detailTab, setDetailTab] = useState('prompt');

  // Core data
  const [prompts, setPrompts] = useState([]);
  const [versions, setVersions] = useState([]);
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [aliasHistory, setAliasHistory] = useState([]);

  // Evaluation
  const [dashboard, setDashboard] = useState(null);
  const [datasets, setDatasets] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [datasetExamples, setDatasetExamples] = useState([]);
  const [comparisonResult, setComparisonResult] = useState(null);
  const [activeJob, setActiveJob] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [testVars, setTestVars] = useState({});

  // UI state
  const [loading, setLoading] = useState({});
  const pollRef = useRef(null);

  // Drawer & Modal States
  const [activeRun, setActiveRun] = useState(null);
  const [isNewPromptModalOpen, setIsNewPromptModalOpen] = useState(false);
  const [isNewVersionPanelOpen, setIsNewVersionPanelOpen] = useState(false);
  const [confirmPromote, setConfirmPromote] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isPromoting, setIsPromoting] = useState(false);
  const [isRunEvalModalOpen, setIsRunEvalModalOpen] = useState(false);
  const [evalConfig, setEvalConfig] = useState({ exact_match: true, llm_judge: true, confidence_calibration: false });
  const [evalPromptId, setEvalPromptId] = useState('');
  const [evalVersionId, setEvalVersionId] = useState('');

  const [notification, setNotification] = useState(null);
  const [sparkMessage, setSparkMessage] = useState("Control plane active.");

  const load = async (key, fn) => {
    setLoading(p => ({ ...p, [key]: true }));
    try { return await fn(); }
    catch (e) { notify(e.message, 'error'); }
    finally { setLoading(p => ({ ...p, [key]: false })); }
  };

  // Data Fetching
  useEffect(() => {
    load('dashboard', async () => {
      const r = await api.getDashboard();
      if (r.ok) setDashboard(await r.json());
    });
  }, []);

  useEffect(() => {
    if (activeTab !== 'prompts') return;
    load('prompts', async () => {
      const r = await api.getPrompts();
      if (r.ok) setPrompts(await r.json());
    });
  }, [activeTab]);

  useEffect(() => {
    if (!selectedPrompt) return;
    setVersions([]); setAliasHistory([]);
    load('versions', async () => {
      const [vr, ar] = await Promise.all([
        api.getVersions(selectedPrompt.prompt_id),
        api.getAliasHistory(selectedPrompt.prompt_id)
      ]);
      if (vr.ok) {
        const vs = await vr.json();
        setVersions(vs);
        setSelectedVersion(vs[0] || null);
      }
      if (ar.ok) setAliasHistory(await ar.json());
    });
  }, [selectedPrompt?.prompt_id]);

  useEffect(() => {
    if (activeTab !== 'datasets' && activeTab !== 'evaluations') return;
    load('datasets', async () => {
      const r = await api.getDatasets();
      if (r.ok) setDatasets(await r.json());
    });
  }, [activeTab]);

  useEffect(() => {
    if (!selectedDataset) return;
    setComparisonResult(null);
    setDatasetExamples([]);
    load('comparison', async () => {
      const r = await api.compareDataset(selectedDataset.dataset_id);
      if (r.ok) setComparisonResult(await r.json());

      const exRes = await api.getExamples(selectedDataset.dataset_id);
      if (exRes.ok) setDatasetExamples(await exRes.json());
    });
  }, [selectedDataset?.dataset_id]);

  // Event Listeners
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const triggerSpark = (msg) => {
    setSparkMessage(msg);
    setTimeout(() => setSparkMessage("Control plane active."), 3000);
  };

  const notify = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handlePromoteAction = async () => {
    if (!selectedPrompt || !selectedVersion) return;
    setIsPromoting(true);
    triggerSpark("Alias shifting...");
    const r = await api.promote(selectedPrompt.prompt_id, selectedVersion.version_id);
    setIsPromoting(false);
    setConfirmPromote(false);
    
    if (r.ok) {
      notify( shifted to Production, 'success');
      triggerSpark("Routing updated globally.");
      // Refresh versions to update production badge
      const vr = await api.getVersions(selectedPrompt.prompt_id);
      if (vr.ok) {
        const vs = await vr.json();
        setVersions(vs);
        setSelectedPrompt(p => ({ ...p, production_version_id: selectedVersion.version_id }));
      }
    } else {
      const err = await r.json().catch(() => ({}));
      notify(err.detail || 'Promotion failed', 'error');
    }
  };

  const handleTestExecute = async () => {
    if (!selectedPrompt || !selectedVersion) return;
    setTestResult(null);
    load('execute', async () => {
      const r = await api.execute(selectedPrompt.key, testVars, selectedVersion.version_id);
      const data = await r.json();
      setTestResult(data);
    });
  };

  const startJobPoll = (jobId, datasetId) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const r = await api.getJob(jobId);
      if (!r.ok) return;
      const job = await r.json();
      setActiveJob(job);
      if (job.status === 'completed' || job.status === 'failed') {
        clearInterval(pollRef.current);
        pollRef.current = null;
        if (job.status === 'completed') {
          notify('Eval job completed ?', 'success');
          triggerSpark('Evaluation complete. Frontier updated.');
          // Refresh comparison
          const cr = await api.compareDataset(datasetId);
          if (cr.ok) setComparisonResult(await cr.json());
        } else {
          notify('Eval job failed', 'error');
        }
        setTimeout(() => setActiveJob(null), 5000); // clear active job banner after 5 sec
      }
    }, 2000);
  };

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const handleCreateEvalJob = async (ev) => {
    ev.preventDefault();
    if (!evalPromptId) return notify('Please select a prompt', 'error');
    if (!evalVersionId) return notify('Please select a version', 'error');
    if (!selectedDataset) return;
    
    const evaluators = Object.keys(evalConfig).filter(k => evalConfig[k]);
    if (evaluators.length === 0) return notify('Select at least one evaluator', 'error');
    
    setIsRunEvalModalOpen(false);
    
    const r = await api.createJob({
      prompt_id: evalPromptId,
      version_id: evalVersionId,
      dataset_id: selectedDataset.dataset_id,
      evaluators: evaluators,
      created_by: 'Dashboard UI'
    });
    
    if (r.ok) {
      const data = await r.json();
      setActiveJob(data);
      notify('Eval job started', 'success');
      startJobPoll(data.job_id, selectedDataset.dataset_id);
    } else {
      const err = await r.json().catch(() => ({}));
      notify(err.detail || 'Failed to start eval', 'error');
    }
  };

  // Memoized computations
  const paretoPoints = useMemo(() => {
    if (!comparisonResult?.jobs?.length) return [];
    const jobs = comparisonResult.jobs.filter(j => j.cost_per_correct != null && j.accuracy != null);
    if (!jobs.length) return [];
    
    const costs = jobs.map(j => j.cost_per_correct);
    const accs = jobs.map(j => j.accuracy);
    const minC = Math.min(...costs), maxC = Math.max(...costs);
    const minA = Math.min(...accs), maxA = Math.max(...accs);
    const cRange = maxC - minC || 1;
    const aRange = maxA - minA || 1;

    return jobs.map(j => ({
      ...j,
      cx: 5 + ((j.cost_per_correct - minC) / cRange) * 88,
      cy: 93 - ((j.accuracy - minA) / aRange) * 86,
      label: \\\,
      isKnee: j.job_id === comparisonResult.knee_point_job_id,
    }));
  }, [comparisonResult]);

  const activeVars = extractVars(selectedVersion?.prompt_text);
  const varsMissing = activeVars.filter(v => !testVars[v]);

  const NavItem = ({ id, icon: Icon, active }) => (
    <button 
      onClick={() => { setActiveTab(id); setSelectedPrompt(null); }}
      className={\w-12 h-12 flex items-center justify-center rounded-2xl transition-all \\}
    >
      <Icon size={20} />
    </button>
  );
  
  return (
    <div className="min-h-screen bg-[#F3F4F1] text-slate-900 font-sans selection:bg-[#E2F581] antialiased p-6 overflow-hidden flex flex-col items-stretch">
      {/* Platform Level Health Bar */}
      <div className="fixed bottom-10 left-32 right-10 z-[80] flex gap-4 animate-in slide-in-from-bottom-10 duration-700">
         <div className="bg-black text-white px-8 py-4 rounded-3xl shadow-2xl flex items-center gap-12 border border-white/10 backdrop-blur-xl bg-opacity-90">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Workspace 24h Spend</span>
              <span className="text-[18px] font-black text-[#E2F581]">
                {dashboard?.top_summaries?.length > 0 
                  ? \\$\\
                  : '—'
                } <span className="text-[10px] text-slate-400 font-medium">USD</span>
              </span>
            </div>
            <div className="flex flex-col border-l border-white/10 pl-12">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Error Rate</span>
              <span className="text-[18px] font-black text-rose-500">
                {dashboard?.total_jobs > 0
                  ? \\%\
                  : '—'
                }
              </span>
            </div>
            <div className="flex flex-col border-l border-white/10 pl-12">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Avg Latency</span>
              <span className="text-[18px] font-black">
                {dashboard?.top_summaries?.length > 0
                  ? \\ms\
                  : '—'
                }
              </span>
            </div>
            <div className="flex flex-col border-l border-white/10 pl-12">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active Prompts</span>
              <span className="text-[18px] font-black text-[#E2F581]">
                {prompts?.length || dashboard?.total_datasets || '—'}
              </span>
            </div>
         </div>
      </div>

      {/* Sidebar */}
      <aside className="fixed left-6 top-6 bottom-6 w-20 bg-[#141414] rounded-[2.5rem] flex flex-col items-center py-8 shrink-0 shadow-2xl z-[100]">
        <div className="mb-10 p-1 bg-white rounded-xl cursor-pointer hover:rotate-12 transition-transform">
           <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
             <GitCommit className="text-white" size={18} />
           </div>
        </div>
        <nav className="flex-1 flex flex-col gap-4">
          <NavItem id="prompts" icon={Layers} active={activeTab === 'prompts'} />
          <NavItem id="runs" icon={Activity} active={activeTab === 'runs'} />
          <NavItem id="evaluations" icon={BarChart3} active={activeTab === 'evaluations'} />
          <NavItem id="datasets" icon={Database} active={activeTab === 'datasets'} />
          <NavItem id="synthetic" icon={Sparkles} active={activeTab === 'synthetic'} />
          <NavItem id="settings" icon={Settings} active={activeTab === 'settings'} />
        </nav>
        <div className="mt-auto flex flex-col gap-6 items-center">
          <div className="w-8 h-8 rounded-full bg-[#E2F581] flex items-center justify-center text-black font-bold text-[10px]">JD</div>
          <Ghost size={20} className={sparkMessage !== "Control plane active." ? "animate-bounce text-[#E2F581]" : "animate-pulse text-white/30"} />
        </div>
      </aside>

      <main className="ml-28 flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Workspace Switcher Header */}
        <header className="flex justify-between items-center mb-8 pr-4">
          <div className="flex items-center gap-6">
             <div className="flex flex-col">
               <div className="flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                  <Globe size={12} /> Environment
               </div>
               <div className="flex items-center gap-3 cursor-pointer hover:opacity-70 transition-all">
                  <h2 className="text-[24px] font-bold tracking-tight">{activeWorkspace}</h2>
                  <ChevronDown size={18} />
               </div>
             </div>
          </div>
          <div className="flex items-center gap-4">
             {activeJob && ['running', 'pending'].includes(activeJob.status) && (
               <div className="flex items-center gap-3 bg-[#E2F581] px-5 py-2.5 rounded-2xl">
                 <RefreshCw size={13} className="animate-spin" />
                 <span className="text-[11px] font-black uppercase tracking-widest">Eval {activeJob.status}...</span>
               </div>
             )}
             <div className="flex items-center bg-white border border-slate-200 rounded-2xl px-5 py-3 gap-3 text-slate-400 shadow-sm">
                <Search size={18} />
                <span className="text-[13px] font-bold">Search platform...</span>
                <div className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-black text-slate-500">
                   <Command size={10} /> K
                </div>
             </div>
             <button onClick={() => setIsNewPromptModalOpen(true)} className="bg-black text-white px-8 py-4 rounded-[1.5rem] text-[15px] font-black flex items-center gap-3 hover:bg-slate-800 transition-all shadow-2xl">
               <Plus size={22} /> New Prompt
             </button>
          </div>
        </header>

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Prompts Matrix */}
          {activeTab === 'prompts' && !selectedPrompt && (
            <div className="flex-1 flex flex-col overflow-hidden space-y-8 animate-in fade-in duration-500">
              <div className="flex-1 bg-white rounded-[3rem] border border-slate-100 flex flex-col overflow-hidden shadow-2xl">
                 <div className="px-10 py-10 border-b border-slate-50 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-900 shadow-sm">
                        <Layers2 size={24} />
                      </div>
                      <div>
                        <h3 className="text-[22px] font-bold">Prompt Registry</h3>
                        <p className="text-[12px] font-medium text-slate-400">Manage immutable artifacts and routing aliases</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                       <button className="px-5 py-2.5 bg-slate-50 rounded-xl text-[12px] font-black uppercase border border-slate-100 hover:bg-slate-100 transition-all">Export JSON</button>
                    </div>
                 </div>
                 <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-left">
                      <thead className="sticky top-0 bg-white/90 backdrop-blur-md z-10 border-b border-slate-50">
                         <tr className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em]">
                           <th className="px-12 py-5">Key / Alias</th>
                           <th className="px-12 py-5">Provider</th>
                           <th className="px-12 py-5">Active v</th>
                           <th className="px-12 py-5">Variables</th>
                           <th className="px-12 py-5 text-right">Health</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {prompts.map((p) => (
                          <tr key={p.prompt_id} onClick={() => { setSelectedPrompt(p); triggerSpark(\Viewing lineage of \\); }} className="hover:bg-slate-50/80 cursor-pointer group transition-all">
                            <td className="px-12 py-7">
                              <div className="text-[17px] font-bold text-slate-900 group-hover:text-black">{p.key}</div>
                              <div className="text-[11px] font-black text-slate-400 font-mono mt-1 opacity-60">{p.prompt_id}</div>
                            </td>
                            <td className="px-12 py-7">
                               <div className="flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-full w-fit">
                                  <CpuIcon size={12} className="text-slate-500" />
                                  <span className="text-[11px] font-black text-slate-600 uppercase tracking-tighter">
                                    {p.latest_version?.model_settings?.model || '—'}
                                  </span>
                               </div>
                            </td>
                            <td className="px-12 py-7">
                              {p.production_version_id ? <StatusBadge status="production" /> : <span className="text-slate-300 text-[10px] font-black uppercase">Unlinked</span>}
                            </td>
                            <td className="px-12 py-7">
                               <div className="flex gap-1.5 flex-wrap">
                                  {extractVars(p.latest_version?.prompt_text).map(v => (
                                    <span key={v} className="text-[9px] font-black text-indigo-400 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 uppercase">{v}</span>
                                  ))}
                               </div>
                            </td>
                            <td className="px-12 py-7 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                 {[1, 2, 3, 4, 5].map(i => <div key={i} className={\w-1.5 h-6 rounded-full \\} />)}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                 </div>
              </div>
            </div>
          )}

          {/* Prompt Deep Dive */}
          {selectedPrompt && (
            <div className="flex-1 flex gap-6 animate-in slide-in-from-right-4 duration-500 overflow-hidden">
               
               {/* Work Surface */}
               <div className="flex-1 bg-white rounded-[3rem] flex flex-col overflow-hidden border border-slate-100 shadow-2xl relative">
                  <header className="px-10 py-8 border-b border-slate-50 flex justify-between items-center bg-white/50 backdrop-blur-xl shrink-0">
                     <div className="flex gap-2">
                        {['prompt', 'validation', 'lineage'].map((t) => (
                          <button 
                            key={t}
                            onClick={() => setDetailTab(t)}
                            className={\px-5 py-2 text-[12px] font-black uppercase tracking-widest rounded-2xl transition-all \\}
                          >
                            {t}
                          </button>
                        ))}
                     </div>
                     <button onClick={() => setSelectedPrompt(null)} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-400 hover:text-black transition-all">
                        <X size={24} />
                     </button>
                  </header>

                  <div className="flex-1 overflow-y-auto p-12">
                     {detailTab === 'prompt' && selectedVersion && (
                       <div className="space-y-12">
                          <div className="flex justify-between items-end">
                             <div>
                               <h3 className="text-[32px] font-bold tracking-tight">Version v{selectedVersion.ordinal}</h3>
                               <div className="flex items-center gap-3 mt-2">
                                  <div className="flex items-center gap-1.5 text-[11px] font-black bg-[#E2F581] px-3 py-1 rounded-full uppercase tracking-widest">
                                    <CpuIcon size={12} /> {selectedVersion.model_settings?.model || '—'}
                                  </div>
                               </div>
                             </div>
                             <div className="flex gap-3">
                                <button className="px-6 py-3 bg-slate-50 text-[12px] font-black rounded-2xl border border-slate-100 hover:bg-white shadow-sm transition-all flex items-center gap-2">
                                  <Copy size={16} /> Raw Payload
                                </button>
                                <button onClick={() => setIsNewVersionPanelOpen(true)} className="px-6 py-3 bg-black text-white text-[12px] font-black rounded-2xl shadow-xl transition-all flex items-center gap-2">
                                  <Plus size={16} /> New Iteration
                                </button>
                             </div>
                          </div>
                          
                          <div className="relative group">
                            <div className="bg-[#F8F9F8] border border-slate-200 rounded-[2.5rem] p-12 font-mono text-[16px] leading-relaxed text-slate-700 shadow-inner whitespace-pre-wrap">
                               <p className="mb-6 opacity-60 italic"># Prompt Artifact: {selectedPrompt.key}</p>
                               {selectedVersion.prompt_text}
                            </div>
                            <div className="absolute top-12 right-12 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                               <button className="p-3 bg-white rounded-2xl border border-slate-200 shadow-xl hover:bg-[#E2F581]"><Maximize2 size={20} /></button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-8 pt-8">
                             <div className="col-span-2 p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                                <h4 className="text-[12px] font-black uppercase text-slate-400 tracking-widest mb-6">Extracted Variables</h4>
                                <div className="flex flex-col gap-2">
                                   {extractVars(selectedVersion.prompt_text).map(v => (
                                     <div key={v} className="flex items-center justify-between bg-white px-4 py-2.5 rounded-2xl border border-slate-200">
                                        <span className="text-[12px] font-black text-indigo-600 tracking-tighter uppercase">{v}</span>
                                        <StatusBadge status="latest" />
                                     </div>
                                   ))}
                                </div>
                             </div>
                          </div>
                       </div>
                     )}
                     {detailTab === 'validation' && selectedVersion && (
                        <div className="space-y-12 animate-in fade-in">
                           <div className="flex justify-between items-center">
                              <h3 className="text-[28px] font-bold tracking-tight">Strict Validation</h3>
                              <div className="flex items-center gap-3">
                                 <span className="text-[11px] font-black uppercase text-slate-400">Strict Mode</span>
                                 <button className="w-12 h-6 bg-black rounded-full relative p-1 shadow-inner">
                                    <div className="w-4 h-4 bg-[#E2F581] rounded-full ml-auto" />
                                 </button>
                              </div>
                           </div>

                           <div className="grid grid-cols-3 gap-8">
                              <div className="col-span-1 space-y-6">
                                 <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Test Inputs</h4>
                                 {activeVars.map(v => (
                                   <div key={v} className="space-y-2">
                                      <label className="text-[10px] font-black uppercase ml-1 opacity-40">{v}</label>
                                      <textarea 
                                        value={testVars[v] || ''}
                                        onChange={(e) => setTestVars({...testVars, [v]: e.target.value})}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-[13px] font-bold focus:outline-none focus:border-black transition-all resize-none h-24 shadow-inner" 
                                        placeholder={\Provide value for \...\} 
                                      />
                                   </div>
                                 ))}
                                 <button 
                                   onClick={handleTestExecute}
                                   disabled={varsMissing.length > 0 || loading.execute}
                                   className={\w-full py-5 rounded-[1.5rem] font-black uppercase tracking-widest shadow-2xl transition-all flex items-center justify-center gap-3 \\}
                                 >
                                    {loading.execute ? <RefreshCw className="animate-spin" size={18} /> : <Play size={18} />} Execute Test
                                 </button>
                              </div>
                              <div className="col-span-2 space-y-6">
                                 <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Rendered Preview</h4>
                                 <div className="bg-[#141414] text-slate-300 rounded-[2.5rem] p-10 font-mono text-sm h-[500px] shadow-2xl border border-white/5 overflow-y-auto">
                                    {testResult ? (
                                      <div className="space-y-6">
                                        <div className="flex gap-4 mb-4 border-b border-white/10 pb-4">
                                          <div className="text-[#E2F581] text-[11px] font-black tracking-widest">LATENCY: {testResult.latency_ms}ms</div>
                                          <div className="text-slate-400 text-[11px] font-black tracking-widest">TOKENS: {testResult.raw_response?.usage?.prompt_tokens} + {testResult.raw_response?.usage?.completion_tokens}</div>
                                          <div className="text-emerald-400 text-[11px] font-black tracking-widest">COST: \</div>
                                        </div>
                                        <div className="text-white whitespace-pre-wrap">
                                          {typeof testResult.response === 'string' ? testResult.response : JSON.stringify(testResult.response, null, 2)}
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        <p className="text-slate-500 mb-8"># Dry run execution logs will appear here...</p>
                                        {varsMissing.length > 0 && (
                                          <div className="flex items-center gap-2 text-rose-500">
                                            <AlertTriangle size={14} />
                                            <span>Missing required variables: [{varsMissing.join(', ')}]</span>
                                          </div>
                                        )}
                                      </>
                                    )}
                                 </div>
                              </div>
                           </div>
                        </div>
                     )}

                     {detailTab === 'lineage' && (
                        <div className="space-y-12 animate-in fade-in">
                           <h3 className="text-[28px] font-bold tracking-tight">Alias Routing Log</h3>
                           <div className="space-y-4">
                              {aliasHistory.map((log, i) => (
                                <div key={i} className="p-8 border border-slate-100 rounded-[2.5rem] bg-white shadow-sm flex items-center justify-between group hover:border-black transition-all">
                                   <div className="flex items-center gap-8">
                                      <div className="flex flex-col">
                                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Shift Sequence</span>
                                         <div className="flex items-center gap-3 mt-1">
                                            {log.from_version_id ? (
                                              <span className="text-[15px] font-black opacity-40">v{log.from_version_id}</span>
                                            ) : (
                                              <span className="text-[15px] font-black opacity-40">None</span>
                                            )}
                                            <ArrowLeftRight size={14} className="text-indigo-600" />
                                            <span className="text-[18px] font-black">v{log.to_version_id}</span>
                                         </div>
                                      </div>
                                      <div className="flex flex-col border-l border-slate-100 pl-8">
                                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Authored By</span>
                                         <div className="flex items-center gap-2 mt-1">
                                            <div className="w-5 h-5 rounded-full bg-slate-900 flex items-center justify-center text-[8px] font-bold text-white uppercase">{log.promoted_by.substring(0, 2)}</div>
                                            <span className="text-[13px] font-black uppercase tracking-tight">{log.promoted_by}</span>
                                         </div>
                                      </div>
                                      <div className="flex flex-col border-l border-slate-100 pl-8">
                                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Timestamp</span>
                                         <span className="text-[13px] font-bold text-slate-500 mt-1">{relTime(log.promoted_at)}</span>
                                      </div>
                                   </div>
                                </div>
                              ))}
                              {aliasHistory.length === 0 && (
                                <div className="text-center py-12 text-slate-400 font-bold text-[13px]">No alias promotion history yet.</div>
                              )}
                           </div>
                        </div>
                     )}
                  </div>
               </div>

               {/* Right Timeline Panel */}
               <div className="w-96 bg-white rounded-[3rem] flex flex-col overflow-hidden border border-slate-100 shadow-sm shrink-0">
                  <header className="px-8 py-10 border-b border-slate-50 flex justify-between items-center shrink-0">
                     <div>
                        <h3 className="text-[12px] font-black uppercase tracking-[0.3em] text-slate-400">Lineage Trail</h3>
                        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-1">Multi-select enabled</p>
                     </div>
                     <button onClick={() => setIsNewVersionPanelOpen(true)} className="w-10 h-10 bg-black text-white rounded-2xl flex items-center justify-center shadow-lg hover:rotate-90 transition-all"><Plus size={20} /></button>
                  </header>
                  <div className="flex-1 overflow-y-auto p-10 space-y-0 relative">
                     <div className="absolute left-[52px] top-12 bottom-12 w-[2px] bg-slate-100" />
                     {versions.map((v) => {
                       const vStatus = v.version_id === selectedPrompt?.production_version_id ? 'production' : v.ordinal === versions[0]?.ordinal ? 'latest' : 'stable';
                       return (
                         <div 
                           key={v.version_id} 
                           onClick={() => setSelectedVersion(v)}
                           className={\elative pl-14 pb-14 cursor-pointer group transition-all \\}
                         >
                           <div className={\bsolute left-[48px] top-1.5 w-3 h-3 rounded-full z-10 transition-all \\} />
                           <div className="space-y-2">
                             <div className="flex items-center justify-between">
                               <div className="text-[14px] font-black text-slate-900 uppercase tracking-tighter">v{v.ordinal}</div>
                               {vStatus === 'production' && <StatusBadge status="production" />}
                             </div>
                             <div className="text-[11px] text-slate-400 font-black uppercase tracking-widest italic">{relTime(v.created_at)}</div>
                             <div className="flex items-center gap-3 pt-2">
                                <span className="text-[10px] font-black text-slate-400 font-mono bg-slate-50 px-3 py-1 rounded-xl border border-slate-100">{Math.ceil((v.prompt_text?.length || 0)/4)} tok</span>
                             </div>
                           </div>
                         </div>
                       );
                     })}
                  </div>
                  <div className="p-8 border-t border-slate-50 bg-slate-50/50">
                     <button 
                       disabled={selectedVersion?.version_id === selectedPrompt?.production_version_id}
                       onClick={() => setConfirmPromote(true)}
                       className={\w-full py-5 rounded-[1.8rem] font-black text-[13px] uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3 \\}
                     >
                        <Zap size={16} /> {selectedVersion?.version_id === selectedPrompt?.production_version_id ? 'Live in Production' : 'Shift to Production'}
                     </button>
                  </div>
               </div>
            </div>
          )}
