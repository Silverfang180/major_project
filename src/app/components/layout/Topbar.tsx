import { useState, useRef, useEffect, type ReactNode } from "react";
import { Search, Bell, User, LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

interface TopbarProps {
  title: string;
  subtitle?: ReactNode;
}

export function Topbar({ title, subtitle }: TopbarProps) {
  const { user, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
          <button className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors relative" title="Notifications">
            <Bell size={16} />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-indigo-500 rounded-full" />
          </button>
          
          <div className="relative" ref={profileRef}>
            <button 
              onClick={() => setProfileOpen(!profileOpen)}
              className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
              title="Profile"
            >
              <User size={14} />
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden z-50 py-1">
                <div className="px-4 py-2 border-b border-slate-700/50">
                  <p className="text-sm font-medium text-white">{user?.name}</p>
                  <p className="text-[0.6875rem] text-slate-400 truncate">{user?.email}</p>
                </div>
                <button
                  onClick={() => {
                    setProfileOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-[0.8125rem] text-rose-400 hover:bg-slate-700/50 transition-colors text-left"
                >
                  <LogOut size={14} />
                  Log Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
