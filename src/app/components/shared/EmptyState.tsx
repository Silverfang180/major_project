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
      <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-4 ring-8 ring-slate-900/50">
        <Icon size={32} className="text-slate-400" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{heading}</h3>
      <p className="text-sm text-slate-400 max-w-[320px] mb-8 leading-relaxed">
        {subtext}
      </p>
      <div className="flex flex-col sm:flex-row items-center gap-3">
        {ctaLabel && (
          <button
            onClick={ctaAction}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-all active:scale-95 shadow-lg shadow-indigo-600/20"
          >
            {ctaLabel}
          </button>
        )}
        {secondaryLabel && (
          <button
            onClick={secondaryAction}
            className="px-6 py-2.5 bg-transparent hover:bg-slate-800 text-slate-300 hover:text-white text-sm font-medium rounded-lg transition-all active:scale-95"
          >
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  );
}
