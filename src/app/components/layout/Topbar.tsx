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
    <header className="sticky top-0 z-20 h-16 bg-background border-b border-border transition-colors duration-300">
      <div className="flex items-center justify-between px-6 h-full">
        <div>
          <h1 className="text-foreground text-[1.125rem] tracking-tight font-medium">{title}</h1>
          {subtitle && <div className="text-muted-foreground text-[0.75rem]">{subtitle}</div>}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-background border border-border rounded-lg px-3 py-1.5 gap-2 group focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 transition-all shadow-sm">
            <Search size={14} className="text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input
              name="chronicle-global-search"
              autoComplete="off"
              placeholder="Search..."
              className="bg-transparent text-[0.8125rem] text-foreground placeholder:text-muted-foreground/50 outline-none w-48 font-medium"
            />
          </div>
          <button className="text-muted-foreground hover:text-foreground p-2 rounded-lg hover:bg-muted/50 transition-all relative" title="Notifications">
            <Bell size={16} />
            <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-primary rounded-full ring-2 ring-card" />
          </button>
          
          <div className="relative" ref={profileRef}>
            <button 
              onClick={() => setProfileOpen(!profileOpen)}
              className="w-8 h-8 rounded-lg bg-muted/50 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-all hover:border-primary/50"
              title="Profile"
            >
              <User size={14} />
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50 py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="px-4 py-2 border-b border-border/50">
                  <p className="text-sm font-medium text-foreground">{user?.name || 'User'}</p>
                  <p className="text-[0.6875rem] text-muted-foreground truncate">{user?.email || 'user@example.com'}</p>
                </div>
                <button
                  onClick={() => {
                    setProfileOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-[0.8125rem] text-destructive hover:bg-destructive/10 transition-colors text-left font-medium"
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
