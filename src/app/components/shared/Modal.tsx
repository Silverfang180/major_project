import { X } from "lucide-react";
import { type ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-foreground text-[0.9375rem] font-semibold">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-all hover:bg-muted p-1.5 rounded-lg">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-4 overflow-y-auto flex-1 text-foreground">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-muted/20">{footer}</div>
        )}
      </div>
    </div>
  );
}
