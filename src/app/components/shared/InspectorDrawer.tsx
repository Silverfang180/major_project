import { X } from "lucide-react";
import { type ReactNode } from "react";

interface InspectorDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function InspectorDrawer({ open, onClose, title, children }: InspectorDrawerProps) {
  return (
    <div
      className={`fixed top-0 right-0 h-full w-[420px] bg-slate-900 border-l border-slate-700 shadow-2xl z-40 transform transition-transform duration-300 ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
        <h3 className="text-white text-[0.875rem]">{title}</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
          <X size={18} />
        </button>
      </div>
      <div className="p-5 overflow-y-auto h-[calc(100%-57px)]">{children}</div>
    </div>
  );
}
