import { useState, useEffect } from "react";
import { Topbar } from "../components/layout/Topbar";
import { Badge } from "../components/shared/Badge";
import { GitBranch, Loader2, Trash2, Layers } from "lucide-react";
import { api, type PromptResponse, type VersionResponse } from "../../lib/api";
import { toast } from "sonner";
import { EmptyState } from "../components/shared/EmptyState";

interface VersionWithPrompt extends VersionResponse {
  promptKey: string;
  productionVersionId?: number | null;
}

export function VersionsPage() {
  const [versions, setVersions] = useState<VersionWithPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAllVersions();
  }, []);

  async function loadAllVersions() {
    setLoading(true);
    setError(null);
    try {
      const prompts = await api.getPrompts();
      const allVersions: VersionWithPrompt[] = [];

      await Promise.all(
        prompts.map(async (p: PromptResponse) => {
          try {
            const vers = await api.getVersions(p.prompt_id);
            vers.forEach((v) =>
              allVersions.push({
                ...v,
                promptKey: p.key,
                productionVersionId: p.production_version_id,
              })
            );
          } catch {
            // Prompt may have no versions
          }
        })
      );

      // Sort by created_at descending
      allVersions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setVersions(allVersions);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const promptCount = new Set(versions.map((v) => v.prompt_id)).size;

  async function handleDeleteVersion(versionId: number, isProduction: boolean) {
    if (isProduction) {
      toast.error("Cannot delete a production version. Promote a different version first.");
      return;
    }
    if (!confirm(`Are you sure you want to delete Version ${versionId}?`)) return;

    try {
      await api.deleteVersion(versionId);
      toast.success(`Version ${versionId} deleted successfully.`);
      // Optimistic update
      setVersions((prev) => prev.filter((v) => v.version_id !== versionId));
    } catch (e: any) {
      toast.error(`Failed to delete version: ${e.message}`);
    }
  }

  return (
    <div>
      <Topbar title="Versions" subtitle="All prompt versions across the system" />
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3 px-4 py-2 bg-muted/40 border border-border rounded-xl text-muted-foreground text-[0.8125rem] w-fit shadow-sm">
          <GitBranch size={16} className="text-primary" />
          <span className="font-bold tracking-tight">{versions.length} <span className="opacity-60 font-medium">versions across</span> {promptCount} <span className="opacity-60 font-medium">prompts</span></span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-slate-400"><Loader2 size={20} className="animate-spin" /> Loading versions...</div>
        ) : error ? (
          <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-6 text-rose-600 text-[0.8125rem] font-medium shadow-sm">{error}</div>
        ) : (
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full border-collapse">
              <thead className="bg-muted/30">
                <tr className="border-b border-border">
                  {["Version ID", "Prompt Key", "Ordinal", "Model Config", "Lifecycle", "Commited On", "Actions"].map((h) => (
                    <th key={h} className="text-left text-[0.6875rem] text-muted-foreground uppercase font-black tracking-widest px-6 py-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {versions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12">
                      <EmptyState
                        icon={Layers}
                        heading="No Prompt Versions"
                        subtext="Prompt versions track changes over time. Create a prompt and add text to see versions appear here."
                        ctaLabel="Go to Prompts"
                        ctaAction={() => (window.location.href = "/")}
                      />
                    </td>
                  </tr>
                ) : (
                  versions.map((v) => (
                    <tr key={v.version_id} className="border-b border-border/50 table-row-hover transition-colors">
                      <td className="px-6 py-4 text-[0.8125rem] text-foreground font-bold font-mono">#{v.version_id}</td>
                      <td className="px-6 py-4 text-[0.8125rem] font-bold text-primary">{v.promptKey}</td>
                      <td className="px-6 py-4 text-[0.8125rem] text-muted-foreground font-medium">#{v.ordinal}</td>
                      <td className="px-6 py-4">
                        {v.model_settings && Object.keys(v.model_settings).length > 0 ? (
                          <div className="inline-flex items-center gap-1.5 bg-amber-500/5 border border-amber-500/20 px-2 py-0.5 rounded-lg">
                            <code className="text-[0.6875rem] text-amber-600 font-bold uppercase tracking-tight">Configuration</code>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/30 text-[0.6875rem] uppercase font-black tracking-widest">Default</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          {v.productionVersionId === v.version_id
                            ? <Badge variant="success" className="font-black uppercase tracking-tighter">production</Badge>
                            : v.is_latest
                              ? <Badge variant="info" className="font-black uppercase tracking-tighter">current</Badge>
                              : <Badge variant="neutral" className="opacity-50 font-black uppercase tracking-tighter">legacy</Badge>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[0.8125rem] text-muted-foreground font-medium">
                        {new Date(v.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleDeleteVersion(v.version_id, v.productionVersionId === v.version_id)}
                          className={`p-2 rounded-xl transition-all ${
                            v.productionVersionId === v.version_id
                              ? "text-muted-foreground/20 cursor-not-allowed"
                              : "text-muted-foreground hover:text-rose-500 hover:bg-rose-500/5 active:scale-90"
                          }`}
                          title={v.productionVersionId === v.version_id ? "Cannot delete production version" : "Delete version"}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
