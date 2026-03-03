import { type ReactNode } from "react";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

export function ChartCard({ title, subtitle, children, className = "" }: ChartCardProps) {
  return (
    <div className={`bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 shadow-lg shadow-indigo-500/5 ${className}`}>
      <div className="mb-4">
        <h3 className="text-white text-[0.875rem]">{title}</h3>
        {subtitle && <p className="text-slate-500 text-[0.75rem] mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
