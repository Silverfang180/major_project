import { useState, useEffect } from 'react';
import { Topbar } from '../components/layout/Topbar';
import { api, type PromptResponse, type DatasetResponse } from '../../lib/api';
import { 
  Trash2, RefreshCw, Clock, FileText, Database, 
  AlertCircle, ChevronRight, Search 
} from 'lucide-react';
import { toast } from 'sonner';

export function TrashPage() {
  const [trashedPrompts, setTrashedPrompts] = useState<PromptResponse[]>([]);
  const [trashedDatasets, setTrashedDatasets] = useState<DatasetResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadTrash();
  }, []);

  async function loadTrash() {
    setLoading(true);
    
    // Load prompts independently
    try {
      const prompts = await api.getTrashedPrompts();
      setTrashedPrompts(prompts);
    } catch (err: any) {
      console.error('Failed to load trashed prompts:', err);
      toast.error('Could not load prompts: ' + err.message);
    }

    // Load datasets independently
    try {
      const datasets = await api.getTrashedDatasets();
      setTrashedDatasets(datasets);
    } catch (err: any) {
      console.error('Failed to load trashed datasets:', err);
      // Only show error if it's not a expected empty state
      if (!err.message.includes('404')) {
        toast.error('Could not load datasets: ' + err.message);
      }
    }

    setLoading(false);
  }

  async function handleRestore(id: string, type: 'prompt' | 'dataset') {
    try {
      if (type === 'prompt') {
        await api.restorePrompt(id);
      } else {
        await api.restoreDataset(id);
      }
      toast.success(`${type === 'prompt' ? 'Prompt' : 'Dataset'} restored successfully`);
      loadTrash();
    } catch (err: any) {
      toast.error('Restoration failed: ' + err.message);
    }
  }

  const filteredPrompts = trashedPrompts.filter(p => p.title.toLowerCase().includes(search.toLowerCase()));
  const filteredDatasets = trashedDatasets.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="pb-12">
      <Topbar 
        title="Safety Pillar (Trash)" 
        subtitle="The 'Invisible Cloak' restorer. Items here are purged after 30 days." 
      />

      <div className="p-6 max-w-5xl mx-auto space-y-8">
        {/* Info Box */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-4 items-start animate-in fade-in slide-in-from-top-4 duration-500">
          <AlertCircle className="text-amber-500 flex-shrink-0 mt-1" size={18} />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-amber-500">Data Retention Policy</h3>
            <p className="text-xs text-amber-500/70 leading-relaxed">
              Soft-deleted items are stored in this bin for up to 30 days. You can restore them instantly to their original location.
              After 30 days, items are permanently shredded and cannot be recovered.
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <input 
            type="text" 
            placeholder="Search trashed items..."
            className="w-full pl-10 pr-4 py-2 bg-muted/50 border border-border rounded-lg text-sm outline-none focus:border-primary/50 transition-all font-sans"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Prompts Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <FileText size={16} className="text-muted-foreground" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[0.7rem] text-muted-foreground">Trashed Prompts ({filteredPrompts.length})</h2>
            </div>
            
            <div className="space-y-2">
              {filteredPrompts.length === 0 ? (
                <div className="p-8 border border-dashed border-border rounded-xl text-center">
                  <p className="text-xs text-muted-foreground">No prompts in trash</p>
                </div>
              ) : (
                filteredPrompts.map(p => (
                  <div key={p.prompt_id} className="group p-4 bg-card border border-border rounded-xl flex items-center justify-between hover:border-primary/30 transition-all">
                    <div className="space-y-1">
                      <h4 className="text-sm font-medium text-foreground">{p.title}</h4>
                      <div className="flex items-center gap-2 text-[0.65rem] text-muted-foreground font-mono">
                        <Clock size={10} />
                        <span>Deleted {new Date(p.deleted_at!).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleRestore(p.prompt_id, 'prompt')}
                      className="p-2 bg-primary/5 text-primary rounded-lg hover:bg-primary hover:text-primary-foreground transition-all"
                      title="Restore"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Datasets Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <Database size={16} className="text-muted-foreground" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[0.7rem] text-muted-foreground">Trashed Datasets ({filteredDatasets.length})</h2>
            </div>
            
            <div className="space-y-2">
              {filteredDatasets.length === 0 ? (
                <div className="p-8 border border-dashed border-border rounded-xl text-center">
                  <p className="text-xs text-muted-foreground">No datasets in trash</p>
                </div>
              ) : (
                filteredDatasets.map(d => (
                  <div key={d.dataset_id} className="group p-4 bg-card border border-border rounded-xl flex items-center justify-between hover:border-primary/30 transition-all">
                    <div className="space-y-1">
                      <h4 className="text-sm font-medium text-foreground">{d.name}</h4>
                      <div className="flex items-center gap-2 text-[0.65rem] text-muted-foreground font-mono">
                        <Clock size={10} />
                        <span>Deleted {new Date(d.deleted_at!).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleRestore(d.dataset_id, 'dataset')}
                      className="p-2 bg-primary/5 text-primary rounded-lg hover:bg-primary hover:text-primary-foreground transition-all"
                      title="Restore"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
