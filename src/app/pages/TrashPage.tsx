import { useState, useEffect } from 'react';
import { Topbar } from '../components/layout/Topbar';
import { api, type PromptResponse, type DatasetResponse, type VersionResponse } from '../../lib/api';
import { 
  Trash2, RefreshCw, Clock, FileText, Database, 
  AlertCircle, ChevronRight, Search, GitBranch
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../components/shared/Badge';

export function TrashPage() {
  const [trashedPrompts, setTrashedPrompts] = useState<PromptResponse[]>([]);
  const [trashedVersions, setTrashedVersions] = useState<VersionResponse[]>([]);
  const [trashedDatasets, setTrashedDatasets] = useState<DatasetResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadTrash();
  }, []);

  async function loadTrash() {
    setLoading(true);
    
    try {
      const [prompts, versions, datasets] = await Promise.all([
        api.getTrashedPrompts().catch(() => []),
        api.getTrashedVersions().catch(() => []),
        api.getTrashedDatasets().catch(() => [])
      ]);
      setTrashedPrompts(prompts);
      setTrashedVersions(versions);
      setTrashedDatasets(datasets);
    } catch (err: any) {
      console.error('Failed to load trash:', err);
      toast.error('Could not load some trashed items');
    }

    setLoading(false);
  }

  async function handleRestore(id: string | number, type: 'prompt' | 'dataset' | 'version') {
    try {
      if (type === 'prompt') {
        await api.restorePrompt(id as string);
      } else if (type === 'version') {
        await api.restoreVersion(id as number);
      } else {
        await api.restoreDataset(id as string);
      }
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} restored successfully`);
      loadTrash();
    } catch (err: any) {
      toast.error('Restoration failed: ' + err.message);
    }
  }

  async function handlePermanentDelete(id: string | number, type: 'prompt' | 'dataset' | 'version') {
    if (!confirm(`Are you absolutely sure? This will permanently shred this ${type} and all its associated data. This action CANNOT be undone.`)) {
      return;
    }

    try {
      if (type === 'prompt') {
        await api.deletePrompt(id as string, true);
      } else if (type === 'version') {
        await api.deleteVersion(id as number, true);
      } else {
        await api.deleteDataset(id as string, true);
      }
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} permanently deleted`);
      loadTrash();
    } catch (err: any) {
      toast.error('Deletion failed: ' + err.message);
    }
  }

  const filteredPrompts = trashedPrompts.filter(p => p.title.toLowerCase().includes(search.toLowerCase()));
  const filteredVersions = trashedVersions.filter(v => v.prompt_text.toLowerCase().includes(search.toLowerCase()) || v.change_note?.toLowerCase().includes(search.toLowerCase()));
  const filteredDatasets = trashedDatasets.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="pb-12">
      <Topbar 
        title="Safety Pillar (Trash)" 
        subtitle="The 'Invisible Cloak' restorer. Items here are purged after 30 days." 
      />

      <div className="p-6 max-w-6xl mx-auto space-y-8">
        {/* Info Box */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-4 items-start animate-in fade-in slide-in-from-top-4 duration-500">
          <AlertCircle className="text-amber-500 flex-shrink-0 mt-1" size={18} />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-amber-500">Data Retention Policy</h3>
            <p className="text-xs text-amber-500/70 leading-relaxed">
              Soft-deleted items are stored in this bin for up to 30 days. You can restore them instantly.
              After 30 days, items are permanently shredded. <strong>Permanent delete</strong> bypasses the 30-day window.
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <input 
            type="text" 
            placeholder="Search trashed items..."
            className="w-full pl-10 pr-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm outline-none focus:border-primary/50 transition-all font-sans"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Categories */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Prompts Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-muted-foreground" />
                <h2 className="text-[0.7rem] font-bold uppercase tracking-widest text-muted-foreground">Trashed Prompts ({filteredPrompts.length})</h2>
              </div>
            </div>
            
            <div className="space-y-3">
              {filteredPrompts.length === 0 ? (
                <div className="p-8 border border-dashed border-border rounded-xl text-center bg-muted/5">
                  <p className="text-[0.7rem] text-muted-foreground font-medium uppercase tracking-tighter">Empty Bin</p>
                </div>
              ) : (
                filteredPrompts.map(p => (
                  <div key={p.prompt_id} className="group p-4 bg-card border border-border rounded-xl space-y-3 hover:border-primary/30 transition-all shadow-sm">
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-foreground truncate">{p.title}</h4>
                      <div className="flex items-center gap-2 text-[0.65rem] text-muted-foreground font-mono">
                        <Clock size={10} />
                        <span>{new Date(p.deleted_at!).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleRestore(p.prompt_id, 'prompt')}
                        className="flex-1 flex items-center justify-center gap-2 py-1.5 bg-primary/5 text-primary text-xs font-bold rounded-lg hover:bg-primary hover:text-primary-foreground transition-all"
                      >
                        <RefreshCw size={12} /> Restore
                      </button>
                      <button 
                        onClick={() => handlePermanentDelete(p.prompt_id, 'prompt')}
                        className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                        title="Delete Permanently"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Versions Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <GitBranch size={16} className="text-muted-foreground" />
                <h2 className="text-[0.7rem] font-bold uppercase tracking-widest text-muted-foreground">Trashed Versions ({filteredVersions.length})</h2>
              </div>
            </div>
            
            <div className="space-y-3">
              {filteredVersions.length === 0 ? (
                <div className="p-8 border border-dashed border-border rounded-xl text-center bg-muted/5">
                  <p className="text-[0.7rem] text-muted-foreground font-medium uppercase tracking-tighter">Empty Bin</p>
                </div>
              ) : (
                filteredVersions.map(v => (
                  <div key={v.version_id} className="group p-4 bg-card border border-border rounded-xl space-y-3 hover:border-primary/30 transition-all shadow-sm">
                    <div className="space-y-1">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 overflow-hidden">
                           <FileText size={10} className="text-muted-foreground flex-shrink-0" />
                           <span className="text-[0.6rem] font-bold text-muted-foreground uppercase truncate tracking-tight">
                            {v.prompt_title || 'Unknown Prompt'}
                           </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="neutral" className="font-mono text-[0.6rem] px-1 h-4 flex items-center">v{v.ordinal}</Badge>
                          <h4 className="text-[0.7rem] font-medium text-foreground truncate italic opacity-60">
                            {v.change_note || 'Untitled version'}
                          </h4>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-[0.65rem] text-muted-foreground font-mono">
                        <Clock size={10} />
                        <span>{new Date(v.deleted_at!).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleRestore(v.version_id, 'version')}
                        className="flex-1 flex items-center justify-center gap-2 py-1.5 bg-primary/5 text-primary text-xs font-bold rounded-lg hover:bg-primary hover:text-primary-foreground transition-all"
                      >
                        <RefreshCw size={12} /> Restore
                      </button>
                      <button 
                        onClick={() => handlePermanentDelete(v.version_id, 'version')}
                        className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                        title="Delete Permanently"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Datasets Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Database size={16} className="text-muted-foreground" />
                <h2 className="text-[0.7rem] font-bold uppercase tracking-widest text-muted-foreground">Trashed Datasets ({filteredDatasets.length})</h2>
              </div>
            </div>
            
            <div className="space-y-3">
              {filteredDatasets.length === 0 ? (
                <div className="p-8 border border-dashed border-border rounded-xl text-center bg-muted/5">
                  <p className="text-[0.7rem] text-muted-foreground font-medium uppercase tracking-tighter">Empty Bin</p>
                </div>
              ) : (
                filteredDatasets.map(d => (
                  <div key={d.dataset_id} className="group p-4 bg-card border border-border rounded-xl space-y-3 hover:border-primary/30 transition-all shadow-sm">
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-foreground truncate">{d.name}</h4>
                      <div className="flex items-center gap-2 text-[0.65rem] text-muted-foreground font-mono">
                        <Clock size={10} />
                        <span>{new Date(d.deleted_at!).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => handleRestore(d.dataset_id, 'dataset')}
                        className="flex-1 flex items-center justify-center gap-2 py-1.5 bg-primary/5 text-primary text-xs font-bold rounded-lg hover:bg-primary hover:text-primary-foreground transition-all"
                      >
                        <RefreshCw size={12} /> Restore
                      </button>
                      <button 
                        onClick={() => handlePermanentDelete(d.dataset_id, 'dataset')}
                        className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                        title="Delete Permanently"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
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
