import { NavLink } from "react-router";
import {
  FileText, GitBranch, Play, Database, FlaskConical, Split, BarChart3,
  Triangle, Activity, Settings, Zap, Layers
} from "lucide-react";

const navSections = [
  {
    label: "PromptOps",
    items: [
      { to: "/", icon: BarChart3, label: "Dashboard" },
      { to: "/prompts", icon: FileText, label: "Prompts" },
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
      { to: "/pareto", icon: Triangle, label: "Pareto Frontier" },
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
          <span className="text-white text-[1rem] font-medium tracking-tight">Chronicle</span>
          <div className="px-1.5 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded text-[0.625rem] text-indigo-400 font-bold tracking-widest uppercase">
            Beta
          </div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {navSections.map((section) => (
          <div key={section.label}>
            <p className="px-3 mb-2 text-[0.6875rem] text-slate-500 uppercase tracking-[0.1em] font-medium">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-2 text-[0.8125rem] transition-all relative ${
                      isActive
                        ? "bg-indigo-600/10 text-indigo-400 font-medium"
                        : "text-slate-400 hover:text-white hover:bg-slate-800/40"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                      )}
                      <item.icon size={16} className={isActive ? "text-indigo-400" : "text-slate-500"} />
                      {item.label}
                    </>
                  )}
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
