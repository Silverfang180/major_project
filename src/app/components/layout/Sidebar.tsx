import { NavLink } from "react-router";
import {
  FileText, GitBranch, Play, Database, FlaskConical, Split, BarChart3,
  Triangle, Activity, Settings, Zap, Layers
} from "lucide-react";

const navSections = [
  {
    label: "PromptOps",
    items: [
      { to: "/", icon: FileText, label: "Prompts" },
      { to: "/versions", icon: GitBranch, label: "Versions" },
      { to: "/runs", icon: Play, label: "Runs" },
    ],
  },
  {
    label: "Evaluation",
    items: [
      { to: "/datasets", icon: Database, label: "Datasets" },
      { to: "/eval-jobs", icon: FlaskConical, label: "Eval Jobs" },
      { to: "/ab-tests", icon: Split, label: "A/B Tests" },
      { to: "/model-comparisons", icon: Layers, label: "Model Comparisons" },
      { to: "/pareto", icon: Triangle, label: "Pareto Analysis" },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/monitor", icon: Activity, label: "Monitor" },
      { to: "/settings", icon: Settings, label: "Settings" },
    ],
  },
];

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-full w-[260px] bg-slate-950 border-r border-slate-800 flex flex-col z-30">
      <div className="px-5 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Zap size={16} className="text-white" />
          </div>
          <span className="text-white text-[1rem] tracking-tight">Chronicle</span>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {navSections.map((section) => (
          <div key={section.label}>
            <p className="px-3 mb-2 text-[0.6875rem] text-slate-500 uppercase tracking-wider">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-[0.8125rem] transition-all ${
                      isActive
                        ? "bg-indigo-600/15 text-indigo-400 border-l-2 border-indigo-500 shadow-sm shadow-indigo-500/10"
                        : "text-slate-400 hover:text-white hover:bg-slate-800/50 border-l-2 border-transparent"
                    }`
                  }
                >
                  <item.icon size={16} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="px-4 py-3 border-t border-slate-800">
        <div className="flex items-center gap-2 text-[0.75rem] text-slate-500">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          Production
        </div>
      </div>
    </aside>
  );
}
