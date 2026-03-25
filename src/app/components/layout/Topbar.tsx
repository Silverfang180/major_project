import { type ReactNode } from "react";
import { Search, Bell, User } from "lucide-react";

interface TopbarProps {
  title: string;
  subtitle?: ReactNode;
}

export function Topbar({ title, subtitle }: TopbarProps) {
  return (
    <header className="sticky top-0 z-20 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
      <div className="flex items-center justify-between px-6 py-3">
        <div>
          <h1 className="text-white text-[1.125rem] tracking-tight">{title}</h1>
          {subtitle && <p className="text-slate-500 text-[0.75rem]">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-1.5 gap-2">
            <Search size={14} className="text-slate-500" />
            <input
              placeholder="Search..."
              className="bg-transparent text-[0.8125rem] text-slate-300 placeholder:text-slate-600 outline-none w-48"
            />
          </div>
          <button className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors relative">
            <Bell size={16} />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-indigo-500 rounded-full" />
          </button>
          <button className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
            <User size={14} />
          </button>
        </div>
      </div>
    </header>
  );
}
