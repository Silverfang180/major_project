import { Outlet, Navigate, useLocation } from "react-router";
import { Sidebar } from "./Sidebar";
import { useAuth } from "../../context/AuthContext";
import { Loader2 } from "lucide-react";

export function AppLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return (
    <div className="min-h-screen bg-slate-900 font-[Inter,system-ui,sans-serif]">
      <Sidebar />
      <div className="ml-[260px] min-h-screen">
        <Outlet />
      </div>
    </div>
  );
}
