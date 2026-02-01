import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { X, RotateCcw, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface TrashBinProps {
    onClose: () => void;
    onRestore: () => void; // Callback to refresh main list
}

// Unified Type for Table
type TrashItem = {
    type: 'prompt' | 'version';
    id: string | number; // Common ID accessor
    title: string;
    key?: string;
    deleted_at?: string | null;
    prompt_id?: string; // For prompts
    version_id?: number; // For versions
    ordinal?: number; // For versions
};

export const TrashBin: React.FC<TrashBinProps> = ({ onClose, onRestore }) => {
    const [items, setItems] = useState<TrashItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        loadTrash();
    }, []);

    const loadTrash = async () => {
        setLoading(true);
        try {
            const [prompts, versions] = await Promise.all([
                api.getTrashedPrompts(),
                api.getTrashedVersions()
            ]);

            // Normalize
            const combined: TrashItem[] = [
                ...prompts.map(p => ({
                    type: 'prompt' as const,
                    id: p.prompt_id,
                    title: p.title,
                    key: p.key,
                    deleted_at: p.deleted_at,
                    prompt_id: p.prompt_id
                })),
                ...versions.map(v => ({
                    type: 'version' as const,
                    id: v.version_id,
                    title: `Version #${v.ordinal}`,
                    key: `Ver`,
                    deleted_at: v.deleted_at,
                    version_id: v.version_id,
                    ordinal: v.ordinal
                }))
            ];

            // Sort by deleted_at desc
            combined.sort((a, b) => {
                const da = a.deleted_at ? new Date(a.deleted_at).getTime() : 0;
                const db = b.deleted_at ? new Date(b.deleted_at).getTime() : 0;
                return db - da;
            });

            setItems(combined);
        } catch (e) {
            setError("Failed to load trash");
        } finally {
            setLoading(false);
        }
    };

    const handleRestore = async (item: TrashItem) => {
        try {
            if (item.type === 'prompt' && item.prompt_id) {
                await api.restorePrompt(item.prompt_id);
            } else if (item.type === 'version' && item.version_id) {
                await api.restoreVersion(item.version_id);
            }
            // Remove from list
            setItems(prev => prev.filter(i => i.id !== item.id));
            onRestore();
        } catch (e: any) {
            alert(e.message || "Failed to restore");
        }
    };

    const handleDeleteForever = async (item: TrashItem) => {
        if (!confirm("Are you sure? This cannot be undone.")) return;

        try {
            if (item.type === 'prompt' && item.prompt_id) {
                await api.deletePrompt(item.prompt_id, true);
            } else if (item.type === 'version' && item.version_id) {
                await api.deleteVersion(item.version_id, true);
            }
            // Remove from list
            setItems(prev => prev.filter(i => i.id !== item.id));
        } catch (e: any) {
            alert(e.message || "Failed to delete");
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                <div className="p-4 border-b border-border flex justify-between items-center bg-muted/20">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Trash2 className="w-5 h-5 text-muted-foreground" />
                        Trash Bin
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-accent rounded-full text-muted-foreground hover:text-foreground transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {loading && <div className="text-center p-8 text-muted-foreground">Loading trash...</div>}
                    {error && <div className="text-center text-destructive p-4">{error}</div>}

                    {!loading && items.length === 0 && (
                        <div className="text-center text-muted-foreground p-12 flex flex-col items-center gap-3">
                            <Trash2 className="w-12 h-12 opacity-10" />
                            <p>Trash is empty</p>
                        </div>
                    )}

                    {items.map(item => (
                        <div key={`${item.type}-${item.id}`} className="group flex justify-between items-center p-3 rounded-md border border-border bg-background/50 hover:bg-accent/40 transition-all">
                            <div className="min-w-0 flex-1 flex flex-col gap-1">
                                <h3 className="font-medium truncate flex items-center gap-2">
                                    <span className={cn("text-[10px] uppercase px-1.5 py-0.5 rounded font-bold tracking-wide",
                                        item.type === 'prompt' ? "bg-blue-500/10 text-blue-600" : "bg-purple-500/10 text-purple-600")}>
                                        {item.type}
                                    </span>
                                    {item.title}
                                </h3>
                                <div className="text-xs text-muted-foreground flex items-center gap-3">
                                    {item.key && item.key !== 'ignored' && <span className="font-mono bg-muted px-1 rounded">{item.key || 'N/A'}</span>}
                                    {item.deleted_at && <span>Deleted: {new Date(item.deleted_at).toLocaleDateString()}</span>}
                                </div>
                            </div>

                            <div className="flex items-center gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => handleRestore(item)}
                                    className="px-3 py-1.5 text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 rounded-md flex items-center gap-1.5 transition-colors"
                                    title="Restore"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    Restore
                                </button>
                                <button
                                    onClick={() => handleDeleteForever(item)}
                                    className="px-3 py-1.5 text-xs font-medium bg-red-500/10 text-red-600 hover:bg-red-500/20 rounded-md flex items-center gap-1.5 transition-colors"
                                    title="Delete Forever"
                                >
                                    <X className="w-3.5 h-3.5" />
                                    Delete Forever
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-3 border-t border-border bg-muted/30 text-[10px] text-muted-foreground text-center">
                    Items are automatically permanently deleted after 20 days.
                </div>
            </div>
        </div>
    );
};
