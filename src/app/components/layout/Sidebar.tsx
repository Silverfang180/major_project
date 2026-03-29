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
  const currentEnv = localStorage.getItem("chronicle-env") || "production";
  
  const envConfig = {
    development: { color: "bg-blue-500", label: "Development" },
    staging: { color: "bg-amber-500", label: "Staging" },
    production: { color: "bg-emerald-500", label: "Production" },
  };

  const { color, label } = envConfig[currentEnv as keyof typeof envConfig] || envConfig.production;

  return (
    <aside className="fixed left-0 top-0 h-full w-[260px] bg-sidebar border-r border-sidebar-border flex flex-col z-30 transition-colors duration-300">
      <div className="px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
            <Zap size={16} className="text-primary-foreground" />
          </div>
          <span className="text-foreground text-[1rem] font-medium tracking-tight">Chronicle</span>
          <div className="px-1.5 py-0.5 bg-primary/10 border border-primary/20 rounded text-[0.625rem] text-primary font-bold tracking-widest uppercase">
            Beta
          </div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {navSections.map((section) => (
          <div key={section.label}>
            <p className="px-3 mb-2 text-[0.6875rem] text-muted-foreground uppercase tracking-[0.1em] font-medium">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-2 text-[0.8125rem] transition-all relative rounded-lg ${
                      isActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <div className="absolute left-0 top-1 bottom-1 w-[3px] bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
                      )}
                      <item.icon size={16} className={isActive ? "text-primary" : "text-muted-foreground"} />
                      {item.label}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="px-4 py-3 border-t border-sidebar-border bg-sidebar-accent/30">
        <div className="flex items-center gap-2 text-[0.75rem] text-muted-foreground font-medium">
          <div className={`w-2 h-2 rounded-full ${color} animate-pulse`} />
          {label}
        </div>
      </div>
    </aside>
  );
}
