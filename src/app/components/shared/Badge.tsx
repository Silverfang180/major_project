interface BadgeProps {
  variant: "success" | "error" | "warning" | "info" | "neutral" | "pulse";
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeProps["variant"], string> = {
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 shadow-sm",
  error: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 shadow-sm",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 shadow-sm",
  info: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 shadow-sm",
  neutral: "bg-muted text-muted-foreground border-border shadow-sm",
  pulse: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 animate-pulse",
};

export function Badge({ variant, children, className = "" }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[0.75rem] border ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
}
