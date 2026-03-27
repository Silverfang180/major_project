import { useState, useEffect } from "react";
import { Topbar } from "../components/layout/Topbar";
import { Badge } from "../components/shared/Badge";
import { Check, Eye, EyeOff, Moon, Sun, Monitor, Loader2, Save } from "lucide-react";
import { api } from "../../lib/api";
import { toast } from "sonner";

const themeOptions = [
  { id: "matte", label: "Matte", icon: Moon, description: "Warm off-black default" },
  { id: "dark", label: "Dark", icon: Monitor, description: "Deep navy dark mode" },
  { id: "light", label: "Light", icon: Sun, description: "Clean bright mode" },
];

export function SettingsPage() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("chronicle-theme") || "matte";
  });
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [env, setEnv] = useState(() => {
    return localStorage.getItem("chronicle-env") || "production";
  });
  const [pricingData, setPricingData] = useState<any[]>([]);
  const [loadingPricing, setLoadingPricing] = useState(true);
  
  const [apiKeys, setApiKeys] = useState<{name: string, key: string, status: string}[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [editKeys, setEditKeys] = useState<Record<string, string>>({});

  useEffect(() => {
    api.getPricing().then(setPricingData).finally(() => setLoadingPricing(false));
    api.getApiKeys().then(setApiKeys).finally(() => setLoadingKeys(false));
  }, []);

  async function handleUpdateKey(name: string) {
    const newKey = editKeys[name];
    if (!newKey || !newKey.trim()) return;
    try {
      await api.updateApiKey(name, newKey);
      toast.success(`${name} API Key updated securely.`);
      setEditKeys((prev) => ({ ...prev, [name]: "" }));
      // Refetch keys to get updated masked version
      const updated = await api.getApiKeys();
      setApiKeys(updated);
    } catch (e: any) {
      toast.error(`Failed to update key: ${e.message}`);
    }
  }


  // Apply theme to the DOM
  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem("chronicle-theme", theme);
  }, [theme]);

  // Save env to localstorage
  useEffect(() => {
    localStorage.setItem("chronicle-env", env);
  }, [env]);

  function applyTheme(t: string) {
    const root = document.documentElement;
    root.classList.remove("light", "dark", "matte");
    if (t === "light") root.classList.add("light");
    else if (t === "dark") root.classList.add("dark");
    else root.classList.add("matte"); // Default to matte
  }

  return (
    <div>
      <Topbar title="Settings" subtitle="Application configuration" />
      <div className="p-6 space-y-8 max-w-4xl">
        {/* Theme */}
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6">
          <h3 className="text-white text-[0.9375rem] mb-4">Theme</h3>
          <div className="grid grid-cols-3 gap-3">
            {themeOptions.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl text-[0.8125rem] border transition-all ${
                  theme === t.id
                    ? "border-indigo-500 bg-indigo-500/10 text-indigo-400 shadow-lg shadow-indigo-500/10"
                    : "border-slate-700 text-slate-400 hover:border-slate-600 hover:bg-slate-800/50"
                }`}
              >
                <t.icon size={20} />
                <div className="flex items-center gap-1.5">
                  {theme === t.id && <Check size={14} />}
                  {t.label}
                </div>
                <span className="text-[0.6875rem] text-slate-500">{t.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Environment */}
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6">
          <h3 className="text-white text-[0.9375rem] mb-4">Environment</h3>
          <div className="flex gap-3">
            {["development", "staging", "production"].map((e) => (
              <button
                key={e}
                onClick={() => setEnv(e)}
                className={`px-4 py-2 rounded-lg text-[0.8125rem] border transition-all ${
                  env === e
                    ? "border-indigo-500 bg-indigo-500/10 text-indigo-400"
                    : "border-slate-700 text-slate-400 hover:border-slate-600"
                }`}
              >
                {e.charAt(0).toUpperCase() + e.slice(1)}
              </button>
            ))}
          </div>
          <div className="mt-3">
            <Badge variant={env === "production" ? "success" : env === "staging" ? "warning" : "info"}>
              {env.toUpperCase()}
            </Badge>
          </div>
        </div>

        {/* API Keys */}
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6">
          <h3 className="text-white text-[0.9375rem] mb-4">API Keys</h3>
          <div className="space-y-3">
            {loadingKeys ? (
              <div className="py-4 flex items-center gap-2 justify-center text-slate-500 text-sm">
                <Loader2 size={16} className="animate-spin" /> Loading configuration...
              </div>
            ) : (
              apiKeys.map((apiItem) => (
                <div key={apiItem.name} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-800/50 rounded-lg gap-3">
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <span className="text-[0.8125rem] text-white w-24 shrink-0">{apiItem.name}</span>
                    <div className="relative flex-1 sm:w-64">
                      <input
                        type={showKeys[apiItem.name] ? "text" : "password"}
                        className="w-full text-[0.75rem] text-slate-300 font-mono bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-md px-3 py-1.5 outline-none"
                        placeholder={apiItem.key || "Paste new API key here..."}
                        value={editKeys[apiItem.name] !== undefined ? editKeys[apiItem.name] : ""}
                        onChange={(e) => setEditKeys({ ...editKeys, [apiItem.name]: e.target.value })}
                        onKeyDown={(e) => e.key === "Enter" && handleUpdateKey(apiItem.name)}
                      />
                      <button
                        onClick={() => setShowKeys((p) => ({ ...p, [apiItem.name]: !p[apiItem.name] }))}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                        title={showKeys[apiItem.name] ? "Hide key" : "Show key"}
                      >
                        {showKeys[apiItem.name] ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {editKeys[apiItem.name] && editKeys[apiItem.name].trim().length > 0 && (
                      <button
                        onClick={() => handleUpdateKey(apiItem.name)}
                        className="flex items-center gap-1.5 text-[0.6875rem] bg-indigo-500 hover:bg-indigo-600 text-white px-2 py-1.5 rounded-md transition-colors"
                      >
                        <Save size={12} /> Save
                      </button>
                    )}
                    <Badge variant={apiItem.status === "active" ? "success" : "neutral"}>
                      {apiItem.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pricing */}
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6">
          <h3 className="text-white text-[0.9375rem] mb-4">Model Pricing</h3>
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700/50">
                {["Model", "Provider", "Input Price", "Output Price"].map((h) => (
                  <th key={h} className="text-left text-[0.75rem] text-slate-500 px-3 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loadingPricing ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-slate-500 text-[0.8125rem]">
                    <Loader2 size={16} className="animate-spin inline mr-2" />
                    Loading current pricing...
                  </td>
                </tr>
              ) : pricingData.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-slate-500 text-[0.8125rem]">No pricing data available.</td>
                </tr>
              ) : (
                pricingData.map((row) => (
                  <tr key={row.model} className="border-b border-slate-700/30">
                    <td className="px-3 py-2.5 text-[0.8125rem] text-white">{row.model}</td>
                    <td className="px-3 py-2.5"><Badge variant="info">{row.provider}</Badge></td>
                    <td className="px-3 py-2.5 text-[0.8125rem] text-slate-300">{row.inputPrice}</td>
                    <td className="px-3 py-2.5 text-[0.8125rem] text-slate-300">{row.outputPrice}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
