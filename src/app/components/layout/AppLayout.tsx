import { Outlet } from "react-router";
import { Sidebar } from "./Sidebar";

export function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-900 font-[Inter,system-ui,sans-serif]">
      <Sidebar />
      <div className="ml-[260px] min-h-screen">
        <Outlet />
      </div>
    </div>
  );
}
