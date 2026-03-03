import { useState } from "react";
import { Topbar } from "../components/layout/Topbar";
import { Badge } from "../components/shared/Badge";
import { Check, Eye, EyeOff } from "lucide-react";

const pricingData = [
  { model: "GPT-4o", provider: "OpenAI", inputPrice: "$2.50 / 1M", outputPrice: "$10.00 / 1M" },
  { model: "GPT-4o-mini", provider: "OpenAI", inputPrice: "$0.15 / 1M", outputPrice: "$0.60 / 1M" },
  { model: "Gemini Pro", provider: "Google", inputPrice: "$0.50 / 1M", outputPrice: "$1.50 / 1M" },
  { model: "Gemini Flash", provider: "Google", inputPrice: "$0.075 / 1M", outputPrice: "$0.30 / 1M" },
  { model: "Llama 3 70B", provider: "Groq", inputPrice: "$0.59 / 1M", outputPrice: "$0.79 / 1M" },
  { model: "Llama 3 8B", provider: "Groq", inputPrice: "$0.05 / 1M", outputPrice: "$0.08 / 1M" },
];

export function SettingsPage() {
  const [theme, setTheme] = useState("dark");
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [env, setEnv] = useState("production");

  const apiKeys = [
    { name: "OpenAI", key: "sk-proj-abc...xyz", status: "active" },
    { name: "Google AI", key: "AIza...789", status: "active" },
    { name: "Groq", key: "gsk_...def", status: "active" },
  ];

  return (
    <div>
      <Topbar title="Settings" subtitle="Application configuration" />
      <div className="p-6 space-y-8 max-w-4xl">
        {/* Theme */}
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6">
          <h3 className="text-white text-[0.9375rem] mb-4">Theme</h3>
          <div className="flex gap-3">
            {["dark", "light", "matte"].map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`px-6 py-3 rounded-xl text-[0.8125rem] border transition-all ${
                  theme === t
                    ? "border-indigo-500 bg-indigo-500/10 text-indigo-400"
                    : "border-slate-700 text-slate-400 hover:border-slate-600"
                }`}
              >
                <div className="flex items-center gap-2">
                  {theme === t && <Check size={14} />}
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </div>
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
            {apiKeys.map((api) => (
              <div key={api.name} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-[0.8125rem] text-white w-24">{api.name}</span>
                  <code className="text-[0.75rem] text-slate-400 font-mono bg-slate-900 px-2 py-1 rounded">
                    {showKeys[api.name] ? api.key.replace("...", "1234567890") : api.key}
                  </code>
                  <button
                    onClick={() => setShowKeys((p) => ({ ...p, [api.name]: !p[api.name] }))}
                    className="text-slate-500 hover:text-slate-300"
                  >
                    {showKeys[api.name] ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <Badge variant="success">{api.status}</Badge>
              </div>
            ))}
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
              {pricingData.map((row) => (
                <tr key={row.model} className="border-b border-slate-700/30">
                  <td className="px-3 py-2.5 text-[0.8125rem] text-white">{row.model}</td>
                  <td className="px-3 py-2.5"><Badge variant="info">{row.provider}</Badge></td>
                  <td className="px-3 py-2.5 text-[0.8125rem] text-slate-300">{row.inputPrice}</td>
                  <td className="px-3 py-2.5 text-[0.8125rem] text-slate-300">{row.outputPrice}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
