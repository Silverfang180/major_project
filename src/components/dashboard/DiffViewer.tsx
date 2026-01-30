import React from 'react';
import type { Version } from '../../lib/mockData';
import { X, ArrowRight, TrendingUp, TrendingDown, DollarSign, Cpu } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DiffViewerProps {
    currentVersion: Version;
    previousVersion?: Version;
    onClose: () => void;
}

// Helper to compute diff (simple line-by-line)
const computeDiff = (oldText: string, newText: string) => {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    const maxLines = Math.max(oldLines.length, newLines.length);
    const diffs: { type: 'same' | 'added' | 'removed' | 'modified', text: string, lineNo: number }[] = [];

    for (let i = 0; i < maxLines; i++) {
        const oldLine = oldLines[i];
        const newLine = newLines[i];

        if (oldLine === newLine) {
            diffs.push({ type: 'same', text: oldLine || '', lineNo: i + 1 });
        } else if (oldLine === undefined) {
            diffs.push({ type: 'added', text: newLine, lineNo: i + 1 });
        } else if (newLine === undefined) {
            diffs.push({ type: 'removed', text: oldLine, lineNo: i + 1 });
        } else {
            // Check similarity or just mark modified. For simple demo: treat as remove+add pair
            diffs.push({ type: 'removed', text: oldLine, lineNo: i + 1 });
            diffs.push({ type: 'added', text: newLine, lineNo: i + 1 });
        }
    }
    return diffs;
};

// Cost Parser
const parseCost = (costStr: string) => {
    if (!costStr || costStr === 'N/A') return 0;
    return parseFloat(costStr.replace('$', ''));
};

export const DiffViewer: React.FC<DiffViewerProps> = ({ currentVersion, previousVersion, onClose }) => {
    const changes = previousVersion
        ? computeDiff(previousVersion.text, currentVersion.text)
        : currentVersion.text.split('\n').map((line, i) => ({ type: 'added' as const, text: line, lineNo: i + 1 }));

    const currCost = parseCost(currentVersion.cost);
    const prevCost = parseCost(previousVersion?.cost || 'N/A');
    const costDiff = currCost - prevCost;

    // Attempt to extract model name from "Accuracy" field if we used it, or better, we need it in Version interface.
    // For now, we don't have model name in Version interface explicitly. 
    // Ideally we would fetch it, but `api.ts` maps `model_settings` loosely. 
    // We didn't add `model` to `Version` interface. 
    // Let's assume user just compares Cost for now as requested.

    return (
        <div className="absolute top-0 right-0 h-full w-1/2 min-w-[500px] bg-background border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 z-10">
            <div className="h-14 border-b border-border flex items-center justify-between px-6 bg-card">
                <h2 className="font-semibold text-lg flex items-center gap-2">
                    Version Comparison
                    <span className="text-xs font-normal text-muted-foreground px-2 py-1 bg-secondary rounded-full">
                        {previousVersion ? `${previousVersion.id} → ${currentVersion.id}` : currentVersion.id}
                    </span>
                </h2>
                <button
                    onClick={onClose}
                    className="p-2 hover:bg-accent rounded-full transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Cost & Metrics Comparison Header */}
            {previousVersion && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-secondary/20 border-b border-border">
                    <div className="p-3 bg-card rounded-lg border border-border">
                        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Previous ({previousVersion.id})</div>
                        <div className="text-sm font-mono flex items-center gap-2">
                            <DollarSign className="w-3 h-3" />
                            {previousVersion.cost}
                        </div>
                    </div>
                    <div className="p-3 bg-card rounded-lg border border-border">
                        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Current ({currentVersion.id})</div>
                        <div className="flex items-center justify-between">
                            <div className="text-sm font-mono flex items-center gap-2">
                                <DollarSign className="w-3 h-3" />
                                {currentVersion.cost}
                            </div>
                            {costDiff !== 0 && (
                                <div className={cn("text-xs flex items-center gap-1 font-bold", costDiff > 0 ? "text-red-500" : "text-green-500")}>
                                    {costDiff > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                    {Math.abs(costDiff * 100 / (prevCost || 1)).toFixed(1)}%
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-6 font-mono text-sm">
                {changes.map((change, idx) => (
                    <div
                        key={idx}
                        className={cn(
                            "flex mb-1 rounded-sm leading-relaxed",
                            change.type === 'added' && "bg-green-500/10 text-green-700 dark:text-green-400",
                            change.type === 'removed' && "bg-red-500/10 text-red-700 dark:text-red-400 line-through opacity-70",
                            change.type === 'same' && "text-muted-foreground"
                        )}
                    >
                        <div className="w-8 text-xs text-muted-foreground/50 select-none py-1 text-right pr-3 font-sans">
                            {change.lineNo}
                        </div>
                        <div className="flex-1 py-1 whitespace-pre-wrap break-all">
                            {change.type === 'added' && <span className="select-none text-green-500/50 mr-2">+</span>}
                            {change.type === 'removed' && <span className="select-none text-red-500/50 mr-2">-</span>}
                            {change.text}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
