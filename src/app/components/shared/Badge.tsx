interface BadgeProps {
  variant: "success" | "error" | "warning" | "info" | "neutral" | "pulse";
  children: React.ReactNode;
}

const variantClasses: Record<BadgeProps["variant"], string> = {
  success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  error: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  info: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  neutral: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  pulse: "bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse",
};

export function Badge({ variant, children }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[0.75rem] border ${variantClasses[variant]}`}>
      {children}
    </span>
  );
}
