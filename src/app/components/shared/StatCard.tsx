import { type ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: { value: string; positive: boolean };
  valueColor?: string;
  onClick?: () => void;
}

export function StatCard({ title, value, subtitle, icon, trend, valueColor = "text-white", onClick }: StatCardProps) {
  return (
    <div 
      onClick={onClick}
      className={`bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 shadow-lg shadow-indigo-500/5 ${
        onClick ? "cursor-pointer hover:bg-slate-800/80 hover:border-indigo-500/50 transition-colors" : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-[0.8125rem] mb-1">{title}</p>
          <p className={`text-[1.5rem] tracking-tight ${valueColor}`}>{value}</p>
          {subtitle && <p className="text-slate-500 text-[0.75rem] mt-1">{subtitle}</p>}
          {trend && (
            <p className={`text-[0.75rem] mt-1 ${trend.positive ? "text-emerald-400" : "text-rose-400"}`}>
              {trend.positive ? "+" : ""}{trend.value}
            </p>
          )}
        </div>
        {icon && <div className="text-indigo-400 bg-indigo-500/10 p-2 rounded-lg">{icon}</div>}
      </div>
    </div>
  );
}
