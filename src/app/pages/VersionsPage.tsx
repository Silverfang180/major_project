import { useState, useEffect } from "react";
import { Topbar } from "../components/layout/Topbar";
import { Badge } from "../components/shared/Badge";
import { GitBranch, Loader2 } from "lucide-react";
import { api, type PromptResponse, type VersionResponse } from "../../lib/api";

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

  return (
    <div>
      <Topbar title="Versions" subtitle="All prompt versions across the system" />
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-2 text-slate-400 text-[0.8125rem]">
          <GitBranch size={16} />
          <span>{versions.length} versions across {promptCount} prompts</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-slate-400"><Loader2 size={20} className="animate-spin" /> Loading versions...</div>
        ) : error ? (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-6 text-rose-400 text-sm">{error}</div>
        ) : (
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700/50">
                  {["Version ID", "Prompt", "Ordinal", "Settings", "Status", "Created"].map((h) => (
                    <th key={h} className="text-left text-[0.75rem] text-slate-500 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {versions.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500 text-sm">No versions found.</td></tr>
                ) : versions.map((v) => (
                  <tr key={v.version_id} className="border-b border-slate-700/30 hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 text-[0.8125rem] text-slate-300 font-mono">{v.version_id}</td>
                    <td className="px-4 py-3 text-[0.8125rem] text-indigo-400">{v.promptKey}</td>
                    <td className="px-4 py-3 text-[0.8125rem] text-slate-300">#{v.ordinal}</td>
                    <td className="px-4 py-3">
                      {v.model_settings && Object.keys(v.model_settings).length > 0 ? (
                        <code className="text-[0.6875rem] text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded">JSON</code>
                      ) : (
                        <span className="text-slate-600 text-[0.75rem]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {v.productionVersionId === v.version_id
                        ? <Badge variant="success">production</Badge>
                        : v.is_latest
                          ? <Badge variant="info">latest</Badge>
                          : <Badge variant="neutral">archived</Badge>}
                    </td>
                    <td className="px-4 py-3 text-[0.8125rem] text-slate-500">{new Date(v.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
