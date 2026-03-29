import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  heading: string;
  subtext: string;
  ctaLabel?: string;
  ctaAction?: () => void;
  secondaryLabel?: string;
  secondaryAction?: () => void;
}

export function EmptyState({
  icon: Icon,
  heading,
  subtext,
  ctaLabel,
  ctaAction,
  secondaryLabel,
  secondaryAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="w-16 h-16 bg-muted border border-border rounded-full flex items-center justify-center mb-6 shadow-sm ring-8 ring-muted/20">
        <Icon size={32} className="text-primary" />
      </div>
      <h3 className="text-xl font-bold text-foreground mb-2">{heading}</h3>
      <p className="text-[0.8125rem] text-muted-foreground max-w-[340px] mb-8 leading-relaxed font-medium">
        {subtext}
      </p>
      <div className="flex flex-col sm:flex-row items-center gap-3">
        {ctaLabel && (
          <button
            onClick={ctaAction}
            className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-[0.8125rem] font-bold rounded-xl transition-all active:scale-95 shadow-lg shadow-primary/20"
          >
            {ctaLabel}
          </button>
        )}
        {secondaryLabel && (
          <button
            onClick={secondaryAction}
            className="px-6 py-2.5 bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground text-[0.8125rem] font-bold rounded-xl transition-all active:scale-95 border border-border"
          >
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  );
}
