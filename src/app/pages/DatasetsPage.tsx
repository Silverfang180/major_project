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
        <div className="w-64 border-r border-border p-4 space-y-2 overflow-y-auto shrink-0 bg-muted/10">
          <button 
            onClick={() => setCreateDatasetOpen(true)} 
            className="w-full flex items-center gap-2 px-3 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-[0.8125rem] font-bold rounded-xl transition-all shadow-md active:scale-95"
          >
            <Plus size={14} /> New Dataset
          </button>
          {loading ? (
            <div className="flex justify-center py-6 text-muted-foreground animate-pulse"><Loader2 size={16} className="animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-1 mt-4">
              {datasets.map((ds) => (
                <button key={ds.dataset_id} onClick={() => selectDataset(ds.dataset_id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-[0.8125rem] transition-all flex items-center gap-2 group ${selected === ds.dataset_id ? "bg-primary/10 text-primary font-bold shadow-sm" : "text-muted-foreground hover:bg-muted"}`}>
                  <Database size={14} className={selected === ds.dataset_id ? "text-primary" : "text-muted-foreground/60 transition-colors group-hover:text-primary"} /> {ds.name}
                </button>
              ))}
              {datasets.length === 0 && (
                <div className="py-8 px-2 text-center opacity-40">
                  <Database size={24} className="mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground text-[0.75rem]">No datasets created yet</p>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex-1 p-6 overflow-y-auto">
          {dataset ? (
            <>
              <div className="flex items-center justify-between mb-8 pb-6 border-b border-border">
                <div>
                  <h2 className="text-foreground text-[1.25rem] font-bold tracking-tight">{dataset.name}</h2>
                  <div className="flex items-center gap-3 mt-1.5">
                    <Badge variant="info">{dataset.task_type}</Badge>
                    <span className="text-[0.75rem] text-muted-foreground font-medium">{examples.length} examples tracked</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setAddExampleOpen(true)} className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-[0.8125rem] font-bold rounded-xl transition-all shadow-md active:scale-95">
                    <Plus size={14} /> Add Example
                  </button>
                  <button onClick={handleDeleteDataset} className="flex items-center gap-1.5 px-4 py-2 border border-rose-500/30 text-rose-500 hover:text-white text-[0.8125rem] font-bold rounded-xl hover:bg-rose-500 transition-all active:scale-95 shadow-sm shadow-rose-500/10">
                    <Trash2 size={14} /> Delete Dataset
                  </button>
                </div>
              </div>
              {examplesLoading ? (
                <div className="flex justify-center py-12 text-muted-foreground animate-pulse"><Loader2 size={24} className="animate-spin text-primary" /> Loading examples...</div>
              ) : (
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full">
                    <thead className="sticky top-0 z-10 bg-muted/50">
                      <tr className="border-b border-border text-muted-foreground uppercase text-[0.6875rem] font-bold tracking-wider">
                        <th className="text-left px-4 py-4">Example ID</th>
                        <th className="text-left px-4 py-4">Input Variables</th>
                        <th className="text-left px-4 py-4">Expected Output</th>
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
                        <tr key={ex.example_id} className="border-b border-border/10 table-row-hover transition-colors">
                          <td className="px-4 py-3 text-[0.8125rem] text-muted-foreground font-mono">{String(ex.example_id).slice(0, 8)}</td>
                          <td className="px-4 py-3">
                            <pre className="text-[0.7rem] text-primary font-mono bg-muted/50 border border-border rounded-lg px-3 py-1.5 max-w-sm overflow-x-auto shadow-inner">{JSON.stringify(ex.input_vars, null, 2)}</pre>
                          </td>
                          <td className="px-4 py-3 text-[0.8125rem] text-foreground font-medium max-w-sm truncate">{ex.expected_output}</td>
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
      {/* Create Dataset Modal */}
      <Modal open={createDatasetOpen} onClose={() => setCreateDatasetOpen(false)} title="Create Dataset"
        footer={<>
          <button onClick={() => setCreateDatasetOpen(false)} className="px-4 py-2 text-[0.8125rem] text-muted-foreground bg-muted border border-border rounded-xl hover:bg-muted-hover transition-all font-bold">Cancel</button>
          <button onClick={handleCreateDataset} className="px-6 py-2 text-[0.8125rem] bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all font-bold">Create Dataset</button>
        </>}>
        <div className="space-y-5">
          <div className="space-y-1.5">
            <label className="block text-[0.7rem] text-muted-foreground uppercase font-bold tracking-wider">Name</label>
            <input value={dsName} onChange={(e) => setDsName(e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-3 text-[0.8125rem] text-foreground outline-none focus:ring-2 focus:ring-primary/10 transition-all shadow-sm" placeholder="e.g. QA Pairs v2" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[0.7rem] text-muted-foreground uppercase font-bold tracking-wider">Description</label>
            <input value={dsDesc} onChange={(e) => setDsDesc(e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-3 text-[0.8125rem] text-foreground outline-none focus:ring-2 focus:ring-primary/10 transition-all shadow-sm" placeholder="Optional description" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[0.7rem] text-muted-foreground uppercase font-bold tracking-wider">Task Type</label>
            <select value={dsTaskType} onChange={(e) => setDsTaskType(e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-3 text-[0.8125rem] text-foreground outline-none focus:ring-2 focus:ring-primary/10 transition-all shadow-sm">
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
          <button onClick={() => setAddExampleOpen(false)} className="px-4 py-2 text-[0.8125rem] text-muted-foreground bg-muted border border-border rounded-xl hover:bg-muted-hover transition-all font-bold">Cancel</button>
          <button onClick={handleAddExample} className="px-6 py-2 text-[0.8125rem] bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all font-bold">Save Example</button>
        </>}>
        <div className="space-y-5">
          <div className="space-y-1.5">
            <label className="block text-[0.7rem] text-muted-foreground uppercase font-bold tracking-wider">Input Variables (JSON)</label>
            <textarea value={exInputJson} onChange={(e) => setExInputJson(e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-3 text-[0.8125rem] text-primary font-mono outline-none focus:ring-2 focus:ring-primary/10 transition-all h-32 resize-none shadow-sm shadow-inner" placeholder='{"key": "value"}' />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[0.7rem] text-muted-foreground uppercase font-bold tracking-wider">Expected Output</label>
            <textarea value={exExpected} onChange={(e) => setExExpected(e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-3 text-[0.8125rem] text-foreground outline-none focus:ring-2 focus:ring-primary/10 transition-all h-20 resize-none shadow-sm shadow-inner" placeholder="Expected model output..." />
          </div>
        </div>
      </Modal>
    </div>
  );
}
