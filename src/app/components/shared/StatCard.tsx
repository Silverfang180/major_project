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

export function StatCard({ title, value, subtitle, icon, trend, valueColor = "text-foreground", onClick }: StatCardProps) {
  return (
    <div 
      onClick={onClick}
      className={`bg-card border border-border rounded-xl p-5 shadow-sm transition-all duration-300 ${
        onClick ? "cursor-pointer hover:bg-muted/50 hover:border-primary/50" : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-muted-foreground text-[0.8125rem] font-medium mb-1">{title}</p>
          <p className={`text-[1.5rem] font-bold tracking-tight ${valueColor}`}>{value}</p>
          {subtitle && <p className="text-muted-foreground/60 text-[0.75rem] mt-1 italic">{subtitle}</p>}
          {trend && (
            <p className={`text-[0.75rem] mt-1 font-semibold ${trend.positive ? "text-emerald-500" : "text-rose-500"}`}>
              {trend.positive ? "↑" : "↓"} {trend.value} <span className="text-muted-foreground/40 font-normal">vs last month</span>
            </p>
          )}
        </div>
        {icon && <div className="text-primary bg-primary/10 p-2.5 rounded-xl shadow-inner shadow-primary/5">{icon}</div>}
      </div>
    </div>
  );
}
