import { type ReactNode } from "react";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

export function ChartCard({ title, subtitle, children, className = "" }: ChartCardProps) {
  return (
    <div className={`bg-card border border-border rounded-xl p-5 shadow-sm ${className}`}>
      <div className="mb-4">
        <h3 className="text-foreground text-[0.875rem] font-semibold">{title}</h3>
        {subtitle && <p className="text-muted-foreground text-[0.75rem] mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
