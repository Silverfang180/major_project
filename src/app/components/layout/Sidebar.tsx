import { NavLink } from "react-router";
import {
  FileText, GitBranch, Play, Database, FlaskConical, Split, BarChart3,
  Triangle, Activity, Settings, Zap, Layers, PanelLeftClose, PanelLeft, Trash2
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
      { to: "/metrics", icon: BarChart3, label: "Metrics" },
      { to: "/settings", icon: Settings, label: "Settings" },
      { to: "/trash", icon: Trash2, label: "Trash" },
    ],
  },
];

interface SidebarProps {
  isSidebarOpen?: boolean;
  toggleSidebar?: () => void;
}

export function Sidebar({ isSidebarOpen = true, toggleSidebar }: SidebarProps) {
  const currentEnv = localStorage.getItem("chronicle-env") || "production";
  
  const envConfig = {
    development: { color: "bg-blue-500", label: "Development" },
    staging: { color: "bg-amber-500", label: "Staging" },
    production: { color: "bg-emerald-500", label: "Production" },
  };

  const { color, label } = envConfig[currentEnv as keyof typeof envConfig] || envConfig.production;

  return (
    <aside className={`fixed left-0 top-0 h-full ${isSidebarOpen ? "w-[260px]" : "w-[68px]"} bg-sidebar border-r border-sidebar-border flex flex-col z-30 transition-[width] duration-300 ease-in-out overflow-hidden`}>
      <div className="h-16 px-4 border-b border-sidebar-border flex items-center justify-between shrink-0">
        <div className={`flex items-center gap-2.5 transition-opacity duration-200 ${isSidebarOpen ? "opacity-100" : "opacity-0 hidden"}`}>
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
            <Zap size={16} className="text-primary-foreground" />
          </div>
          <span className="text-foreground text-[1rem] font-medium tracking-tight whitespace-nowrap">Chronicle</span>
        </div>
        {toggleSidebar && (
          <button 
            onClick={toggleSidebar} 
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all shrink-0 ml-auto"
            title={isSidebarOpen ? "Close Sidebar" : "Open Sidebar"}
          >
            {isSidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
          </button>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6 overflow-x-hidden">
        {navSections.map((section) => (
          <div key={section.label}>
            <p className={`px-3 mb-2 text-[0.6875rem] text-muted-foreground uppercase tracking-[0.1em] font-medium transition-opacity ${isSidebarOpen ? "opacity-100" : "opacity-0 h-0 overflow-hidden mb-0"}`}>
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 text-[0.8125rem] transition-all relative rounded-lg ${
                      isActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    } ${!isSidebarOpen && "justify-center"}`
                  }
                  title={!isSidebarOpen ? item.label : undefined}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <div className="absolute left-0 top-1 bottom-1 w-[3px] bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
                      )}
                      <item.icon size={16} className={`shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                      <span className={`whitespace-nowrap transition-opacity duration-200 ${isSidebarOpen ? "opacity-100" : "opacity-0 w-0 hidden"}`}>
                        {item.label}
                      </span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="px-4 py-3 border-t border-sidebar-border bg-sidebar-accent/30 flex items-center shrink-0 min-h-[48px]">
        <div className={`flex items-center gap-2 text-[0.75rem] text-muted-foreground font-medium ${!isSidebarOpen && "justify-center w-full"}`}>
          <div className={`w-2 h-2 rounded-full ${color} animate-pulse shrink-0`} title={!isSidebarOpen ? label : undefined} />
          <span className={`whitespace-nowrap transition-opacity duration-200 ${isSidebarOpen ? "opacity-100" : "opacity-0 w-0 hidden"}`}>
            {label}
          </span>
        </div>
      </div>
    </aside>
  );
}
