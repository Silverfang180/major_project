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

const DEFAULT_PROVIDERS = [
  { name: "OpenAI", key: "", status: "not configured" },
  { name: "Anthropic", key: "", status: "not configured" },
  { name: "Google Gemini", key: "", status: "not configured" },
  { name: "Mistral AI", key: "", status: "not configured" },
  { name: "Cohere", key: "", status: "not configured" },
  { name: "DeepSeek", key: "", status: "not configured" },
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
    
    setLoadingKeys(true);
    api.getApiKeys().then(keys => {
      // Merge default providers with fetched keys
      const merged = DEFAULT_PROVIDERS.map(def => {
        const found = keys.find(k => k.name === def.name);
        return found || def;
      });
      // Add any custom providers from API that aren't in defaults
      keys.forEach(k => {
        if (!DEFAULT_PROVIDERS.find(d => d.name === k.name)) {
          merged.push(k);
        }
      });
      setApiKeys(merged);
    }).finally(() => setLoadingKeys(false));
  }, []);

  async function handleUpdateKey(name: string) {
    const newKey = editKeys[name];
    if (!newKey || !newKey.trim()) return;
    try {
      await api.updateApiKey(name, newKey);
      toast.success(`${name} API Key updated securely.`);
      setEditKeys((prev) => ({ ...prev, [name]: "" }));
      const updated = await api.getApiKeys();
      // Re-merge after update
      const mergedLabels = [...DEFAULT_PROVIDERS];
      const merged = mergedLabels.map(def => {
        const found = updated.find(k => k.name === def.name);
        return found || def;
      });
      updated.forEach(k => {
        if (!mergedLabels.find(d => d.name === k.name)) {
          merged.push(k);
        }
      });
      setApiKeys(merged);
    } catch (e: any) {
      toast.error(`Failed to update key: ${e.message}`);
    }
  }

  // Apply theme to the DOM
  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem("chronicle-theme", theme);
  }, [theme]);

  // Handle Environment Change with Quick Reload
  const handleEnvChange = (newEnv: string) => {
    setEnv(newEnv);
    localStorage.setItem("chronicle-env", newEnv);
    toast.info(`Switching to ${newEnv.toUpperCase()}...`, {
      description: "Reloading to apply changes strictly.",
      duration: 1500
    });
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  function applyTheme(t: string) {
    const root = document.documentElement;
    root.classList.remove("light", "dark", "matte");
    if (t === "light") root.classList.add("light");
    else if (t === "dark") root.classList.add("dark");
    else root.classList.add("matte");
  }

  return (
    <div className="min-h-screen bg-background">
      <Topbar title="Settings" subtitle="Application configuration & environment management" />
      <div className="p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Theme Section */}
        <section className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="p-6 sm:p-8">
            <div className="mb-6">
              <h3 className="text-foreground text-[1.125rem] font-semibold mb-1">Display Theme</h3>
              <p className="text-muted-foreground text-[0.8125rem]">
                Select a visual style that matches your working environment. 
                Chronicle themes are optimized for "PromptOps" workflows to reduce eye strain.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {themeOptions.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`relative flex flex-col items-center gap-3 p-5 rounded-xl text-[0.8125rem] border transition-all ${
                    theme === t.id
                      ? "border-primary bg-primary/5 text-primary shadow-sm"
                      : "border-border text-muted-foreground hover:border-border-hover hover:bg-muted/50"
                  }`}
                >
                  <div className={`p-2 rounded-lg ${theme === t.id ? "bg-primary/10" : "bg-muted"}`}>
                    <t.icon size={22} />
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="font-semibold text-foreground">{t.label}</span>
                    <span className="text-[0.6875rem] text-muted-foreground mt-1 text-center">{t.description}</span>
                  </div>
                  {theme === t.id && (
                    <div className="absolute top-3 right-3 text-primary">
                      <Check size={16} />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Environment Section */}
        <section className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="p-6 sm:p-8">
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-foreground text-[1.125rem] font-semibold">Environment</h3>
                <Badge variant={env === "production" ? "success" : env === "staging" ? "warning" : "info"}>
                  {env.toUpperCase()}
                </Badge>
              </div>
              <p className="text-muted-foreground text-[0.8125rem]">
                Environments strictly separate your prompt versions and execution contexts. 
                <span className="text-primary font-medium ml-1">Changes here will reload the app to ensure data isolation.</span>
              </p>
            </div>
            
            <div className="flex flex-wrap gap-3">
              {[
                { id: "development", label: "Development", desc: "Local testing & iterations" },
                { id: "staging", label: "Staging", desc: "Pre-production validation" },
                { id: "production", label: "Production", desc: "Live prompt deployments" }
              ].map((e) => (
                <button
                  key={e.id}
                  onClick={() => handleEnvChange(e.id)}
                  className={`flex-1 min-w-[140px] px-5 py-4 rounded-xl border text-left transition-all ${
                    env === e.id
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border text-muted-foreground hover:border-border-hover hover:bg-muted/50"
                  }`}
                >
                  <p className={`text-[0.875rem] font-bold mb-1 ${env === e.id ? "text-primary" : "text-foreground"}`}>
                    {e.label}
                  </p>
                  <p className="text-[0.75rem] text-muted-foreground leading-tight">{e.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* API Keys Section */}
        <section className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="p-6 sm:p-8">
            <div className="mb-6">
              <h3 className="text-foreground text-[1.125rem] font-semibold mb-1">Model Provider Keys</h3>
              <p className="text-muted-foreground text-[0.8125rem]">
                Chronicle uses these keys to execute and evaluate prompts across different models (OpenAI, Anthropic, etc.). 
                Keys are encrypted at rest and never returned raw in UI once saved.
              </p>
            </div>
            
            <div className="space-y-4">
              {loadingKeys ? (
                <div className="py-8 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
                  <Loader2 size={24} className="animate-spin text-primary" />
                  <span>Fetching secure configuration...</span>
                </div>
              ) : (
                apiKeys.map((apiItem) => (
                  <div key={apiItem.name} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-background border border-border rounded-xl transition-all hover:border-primary/30 group shadow-sm hover:shadow-md">
                    <div className="flex flex-col gap-1 mb-3 sm:mb-0">
                      <span className="text-[0.875rem] font-bold text-foreground">{apiItem.name}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant={apiItem.status === "active" ? "success" : "neutral"}>
                          {apiItem.status}
                        </Badge>
                        <span className="text-[0.6875rem] text-muted-foreground italic font-medium">
                          {apiItem.status === "active" ? "Connected" : "Action Required"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <input
                          name={apiItem.name}
                          autoComplete="new-password"
                          type={showKeys[apiItem.name] ? "text" : "password"}
                          className="w-full sm:w-64 text-[0.8125rem] text-foreground font-mono bg-background border border-border focus:border-primary rounded-lg px-4 py-2 outline-none transition-all pr-10"
                          placeholder={apiItem.status === "active" ? "••••••••••••••••" : "Enter API key..."}
                          value={editKeys[apiItem.name] || ""}
                          onChange={(e) => setEditKeys({ ...editKeys, [apiItem.name]: e.target.value })}
                          onKeyDown={(e) => e.key === "Enter" && handleUpdateKey(apiItem.name)}
                        />
                        <button
                          onClick={() => setShowKeys((p) => ({ ...p, [apiItem.name]: !p[apiItem.name] }))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 transition-colors"
                        >
                          {showKeys[apiItem.name] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                      
                      {editKeys[apiItem.name] && (
                        <button
                          onClick={() => handleUpdateKey(apiItem.name)}
                          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-[0.8125rem] font-bold hover:bg-primary-hover active:scale-95 transition-all shadow-sm"
                        >
                          <Save size={14} /> <span>Save</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
