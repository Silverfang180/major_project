import { useState } from "react";
import { Outlet, Navigate, useLocation } from "react-router";
import { Sidebar } from "./Sidebar";
import { useAuth } from "../../context/AuthContext";
import { Loader2 } from "lucide-react";

export function AppLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return (
    <div className="min-h-screen bg-background text-foreground font-[Inter,system-ui,sans-serif]">
      <Sidebar isSidebarOpen={isSidebarOpen} toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
      <div className={`${isSidebarOpen ? "ml-[260px]" : "ml-[68px]"} min-h-screen transition-[margin] duration-200 ease-in-out`}>
        <main className="page-fade-in min-h-screen">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
