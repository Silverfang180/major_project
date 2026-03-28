import { useState, useEffect } from "react";
import { Topbar } from "../components/layout/Topbar";
import { Badge } from "../components/shared/Badge";
import { Modal } from "../components/shared/Modal";
import { Plus, Trash2, Database, Loader2, FolderOpen, TableProperties } from "lucide-react";
import { api, type DatasetResponse, type ExampleResponse } from "../../lib/api";
import { EmptyState } from "../components/shared/EmptyState";

export function DatasetsPage() {
  const [datasets, setDatasets] = useState<DatasetResponse[]>([]);
  const [examples, setExamples] = useState<ExampleResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [addExampleOpen, setAddExampleOpen] = useState(false);
  const [createDatasetOpen, setCreateDatasetOpen] = useState(false);
  const [examplesLoading, setExamplesLoading] = useState(false);

  // Create dataset form
  const [dsName, setDsName] = useState("");
  const [dsDesc, setDsDesc] = useState("");
  const [dsTaskType, setDsTaskType] = useState("classification");

  // Add example form
  const [exInputJson, setExInputJson] = useState("");
  const [exExpected, setExExpected] = useState("");

  useEffect(() => {
    loadDatasets();
  }, []);

  async function loadDatasets() {
    setLoading(true);
    try {
      const data = await api.getDatasets();
      setDatasets(data);
      if (data.length > 0 && !selected) {
        selectDataset(data[0].dataset_id);
      }
    } catch (e: any) {
      console.error("Failed to load datasets:", e);
    } finally {
      setLoading(false);
    }
  }

  async function selectDataset(datasetId: string) {
    setSelected(datasetId);
    setExamplesLoading(true);
    try {
      const exs = await api.getExamples(datasetId);
      setExamples(exs);
    } catch {
      setExamples([]);
    } finally {
      setExamplesLoading(false);
    }
  }

  async function handleCreateDataset() {
    if (!dsName.trim()) return;
    try {
      const ds = await api.createDataset(dsName.trim(), dsDesc.trim(), dsTaskType);
      setCreateDatasetOpen(false);
      setDsName(""); setDsDesc(""); setDsTaskType("classification");
      loadDatasets();
      selectDataset(ds.dataset_id);
    } catch (e: any) {
      alert("Failed: " + e.message);
    }
  }

  async function handleAddExample() {
    if (!selected || !exInputJson.trim() || !exExpected.trim()) return;
    try {
      const inputVars = JSON.parse(exInputJson);
      await api.addExample(selected, inputVars, exExpected.trim());
      setAddExampleOpen(false);
      setExInputJson(""); setExExpected("");
      selectDataset(selected);
    } catch (e: any) {
      alert("Failed: " + e.message);
    }
  }

  async function handleDeleteDataset() {
    if (!selected || !confirm("Delete this dataset?")) return;
    try {
      await api.deleteDataset(selected);
      setSelected(null);
      setExamples([]);
      loadDatasets();
    } catch (e: any) {
      alert("Failed: " + e.message);
    }
  }

  const dataset = datasets.find((d) => d.dataset_id === selected);

  return (
    <div>
      <Topbar title="Datasets" subtitle="Manage evaluation datasets and examples" />
      <div className="flex h-[calc(100vh-57px)]">
        <div className="w-64 border-r border-slate-800 p-4 space-y-2 overflow-y-auto shrink-0">
          <button onClick={() => setCreateDatasetOpen(true)} className="w-full flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[0.8125rem] rounded-lg transition-colors">
            <Plus size={14} /> New Dataset
          </button>
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-slate-500" /></div>
          ) : (
            <div className="space-y-1 mt-4">
              {datasets.map((ds) => (
                <button key={ds.dataset_id} onClick={() => selectDataset(ds.dataset_id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-[0.8125rem] transition-colors flex items-center gap-2 ${selected === ds.dataset_id ? "bg-indigo-600/15 text-indigo-400" : "text-slate-400 hover:bg-slate-800"}`}>
                  <Database size={14} /> {ds.name}
                </button>
              ))}
              {datasets.length === 0 && (
                <div className="py-8 px-2 text-center">
                  <Database size={24} className="mx-auto text-slate-700 mb-2" />
                  <p className="text-slate-500 text-[0.75rem]">No datasets created yet</p>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex-1 p-6 overflow-y-auto">
          {dataset ? (
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-white text-[1.125rem]">{dataset.name}</h2>
                  <div className="flex items-center gap-3 mt-1">
                    <Badge variant="info">{dataset.task_type}</Badge>
                    <span className="text-[0.75rem] text-slate-500">{examples.length} examples</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setAddExampleOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[0.8125rem] rounded-lg transition-colors">
                    <Plus size={14} /> Add Example
                  </button>
                  <button onClick={handleDeleteDataset} className="flex items-center gap-1.5 px-3 py-1.5 border border-rose-500/30 text-rose-400 text-[0.8125rem] rounded-lg hover:bg-rose-500/10 transition-colors">
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </div>
              {examplesLoading ? (
                <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-slate-500" /></div>
              ) : (
                <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead className="sticky top-0 z-10 bg-slate-900 shadow-sm shadow-slate-950/50">
                      <tr className="border-b border-slate-700/50 text-slate-500 uppercase text-[0.6875rem] font-semibold tracking-wider">
                        <th className="text-left px-4 py-3">Example ID</th>
                        <th className="text-left px-4 py-3">Input Variables</th>
                        <th className="text-left px-4 py-3">Expected Output</th>
                      </tr>
                    </thead>
                    <tbody>
                      {examples.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-4 py-12">
                            <EmptyState
                              icon={TableProperties}
                              heading="Empty Dataset"
                              subtext="This dataset contains no examples. Add your first example to start running evaluations."
                              ctaLabel="Add Example"
                              ctaAction={() => setAddExampleOpen(true)}
                            />
                          </td>
                        </tr>
                      ) : examples.map((ex) => (
                        <tr key={ex.example_id} className="border-b border-slate-700/30 table-row-hover">
                          <td className="px-4 py-3 text-[0.8125rem] text-slate-300 font-mono">{String(ex.example_id)}</td>
                          <td className="px-4 py-3">
                            <pre className="text-[0.75rem] text-indigo-300 bg-slate-800 rounded px-2 py-1 max-w-xs truncate">{JSON.stringify(ex.input_vars)}</pre>
                          </td>
                          <td className="px-4 py-3 text-[0.8125rem] text-slate-300 max-w-xs truncate">{ex.expected_output}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <div className="flex h-full items-center justify-center">
              <EmptyState
                icon={FolderOpen}
                heading="No Dataset Selected"
                subtext="Choose a dataset from the sidebar to view its examples or create a new one to get started."
                ctaLabel="Create Dataset"
                ctaAction={() => setCreateDatasetOpen(true)}
              />
            </div>
          )}
        </div>
      </div>
      {/* Create Dataset Modal */}
      <Modal open={createDatasetOpen} onClose={() => setCreateDatasetOpen(false)} title="Create Dataset"
        footer={<>
          <button onClick={() => setCreateDatasetOpen(false)} className="px-4 py-2 text-[0.8125rem] text-slate-400 border border-slate-600 rounded-lg hover:bg-slate-800">Cancel</button>
          <button onClick={handleCreateDataset} className="px-4 py-2 text-[0.8125rem] bg-indigo-600 text-white rounded-lg hover:bg-indigo-500">Create</button>
        </>}>
        <div className="space-y-4">
          <div>
            <label className="block text-[0.8125rem] text-slate-400 mb-1.5">Name</label>
            <input value={dsName} onChange={(e) => setDsName(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-[0.8125rem] text-white outline-none focus:border-indigo-500" placeholder="e.g. QA Pairs v2" />
          </div>
          <div>
            <label className="block text-[0.8125rem] text-slate-400 mb-1.5">Description</label>
            <input value={dsDesc} onChange={(e) => setDsDesc(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-[0.8125rem] text-white outline-none focus:border-indigo-500" placeholder="Optional description" />
          </div>
          <div>
            <label className="block text-[0.8125rem] text-slate-400 mb-1.5">Task Type</label>
            <select value={dsTaskType} onChange={(e) => setDsTaskType(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-[0.8125rem] text-white outline-none">
              <option value="classification">Classification</option>
              <option value="qa">Question Answering</option>
              <option value="generation">Generation</option>
            </select>
          </div>
        </div>
      </Modal>
      {/* Add Example Modal */}
      <Modal open={addExampleOpen} onClose={() => setAddExampleOpen(false)} title="Add Example"
        footer={<>
          <button onClick={() => setAddExampleOpen(false)} className="px-4 py-2 text-[0.8125rem] text-slate-400 border border-slate-600 rounded-lg hover:bg-slate-800">Cancel</button>
          <button onClick={handleAddExample} className="px-4 py-2 text-[0.8125rem] bg-indigo-600 text-white rounded-lg hover:bg-indigo-500">Save</button>
        </>}>
        <div className="space-y-4">
          <div>
            <label className="block text-[0.8125rem] text-slate-400 mb-1.5">Input Variables (JSON)</label>
            <textarea value={exInputJson} onChange={(e) => setExInputJson(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-[0.8125rem] text-emerald-400 font-mono outline-none focus:border-indigo-500 h-32 resize-none" placeholder='{"key": "value"}' />
          </div>
          <div>
            <label className="block text-[0.8125rem] text-slate-400 mb-1.5">Expected Output</label>
            <textarea value={exExpected} onChange={(e) => setExExpected(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-[0.8125rem] text-white outline-none focus:border-indigo-500 h-20 resize-none" placeholder="Expected model output..." />
          </div>
        </div>
      </Modal>
    </div>
  );
}
