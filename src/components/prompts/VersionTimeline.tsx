import React from 'react';
import { Icon } from '../ui/Icon';

interface Version {
    version_id: number;
    ordinal: number;
    prompt_text: string;
    created_at: string;
    created_by: string;
    is_latest: boolean;
    change_note?: string;
    model_settings: Record<string, any>;
}

interface VersionTimelineProps {
    versions: Version[];
    selectedVersionId: number | null;
    onSelectVersion: (version: Version) => void;
    productionVersionId?: number | null;
    isLoading: boolean;
}

export const VersionTimeline: React.FC<VersionTimelineProps> = ({
    versions,
    selectedVersionId,
    onSelectVersion,
    productionVersionId,
    isLoading,
}) => {
    if (isLoading) {
        return (
            <section className="w-80 border-l border-outline-variant/20 bg-surface-container-low flex flex-col shrink-0">
                <div className="p-4 border-b border-outline-variant/10">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Version History</h3>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center border border-outline-variant/30 mb-2">
                        <Icon name="history_toggle_off" size={30} className="text-outline-variant" />
                    </div>
                    <p className="text-sm font-semibold text-on-surface">Loading...</p>
                    <div className="w-full pt-8 space-y-6 opacity-30">
                        {[1, 2].map((i) => (
                            <div key={i} className="flex gap-4 items-start">
                                <div className="w-2 h-2 rounded-full bg-outline-variant mt-1.5 shrink-0"></div>
                                <div className="space-y-2 flex-1">
                                    <div className="skeleton h-3 w-3/4 rounded"></div>
                                    <div className="skeleton h-2 w-1/2 rounded"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        );
    }

    if (versions.length === 0) {
        return (
            <section className="w-80 border-l border-outline-variant/20 bg-surface-container-low flex flex-col shrink-0">
                <div className="p-4 border-b border-outline-variant/10">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Version History</h3>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center border border-outline-variant/30 mb-2">
                        <Icon name="history_toggle_off" size={30} className="text-outline-variant" />
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm font-semibold text-on-surface">No history available</p>
                        <p className="text-xs text-on-surface-variant leading-normal">
                            Once you save or execute a prompt, its history will appear here.
                        </p>
                    </div>
                </div>
                <div className="p-4 bg-surface-container-high/50">
                    <div className="flex items-center justify-between text-[10px] font-mono text-on-surface-variant/70 uppercase tracking-tighter">
                        <span>Status</span>
                        <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
                            <span>System Ready</span>
                        </div>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="w-80 border-l border-slate-200/60 bg-surface-container-low flex flex-col shrink-0">
            <div className="p-6 border-b border-slate-200/40">
                <h3 className="text-sm font-bold text-on-surface tracking-tight">Version Timeline</h3>
                <p className="text-[10px] text-on-surface-variant font-medium mt-1">
                    History of {versions.length} version{versions.length !== 1 ? 's' : ''}
                </p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-hide">
                {versions.map((version, index) => {
                    const isProduction = version.version_id === productionVersionId;
                    const isSelected = version.version_id === selectedVersionId;
                    const isLast = index === versions.length - 1;

                    return (
                        <div key={version.version_id} className="relative pl-6">
                            {/* Timeline Line */}
                            <div className={`absolute left-0 top-0 bottom-0 w-px ml-[3px] ${isLast ? 'border-dashed border-l border-slate-200' : 'bg-slate-300'}`}></div>
                            {/* Timeline Dot */}
                            <div className={`absolute left-[-2px] top-4 w-3 h-3 rounded-full border-2 border-chr-surface shadow-sm z-10 ${isProduction ? 'bg-tertiary' : 'bg-slate-400'
                                }`}></div>

                            <div
                                onClick={() => onSelectVersion(version)}
                                className={`p-4 rounded-lg cursor-pointer transition-all ${isProduction
                                        ? 'bg-surface-container-lowest border border-tertiary/20 shadow-sm relative overflow-hidden'
                                        : isSelected
                                            ? 'bg-surface-container-lowest border border-primary/20 shadow-sm'
                                            : 'border border-transparent hover:bg-surface-container-lowest hover:border-outline-variant/30'
                                    } ${!isProduction && index >= 2 ? 'opacity-60' : ''}`}
                            >
                                {/* Production Badge */}
                                {isProduction && (
                                    <div className="absolute top-0 right-0 px-2 py-0.5 bg-tertiary text-[8px] font-black text-white uppercase tracking-tighter">
                                        Production
                                    </div>
                                )}

                                <div className="flex justify-between items-start mb-2">
                                    <span className={`text-xs ${isProduction ? 'font-bold' : 'font-semibold'} text-on-surface`}>
                                        Version #{version.ordinal}
                                    </span>
                                    <span className="text-[10px] font-mono text-slate-400">
                                        {new Date(version.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                                    </span>
                                </div>

                                {version.change_note && (
                                    <p className={`text-[11px] text-on-surface-variant mb-2 leading-snug ${isProduction ? 'italic' : ''}`}>
                                        {isProduction ? `"${version.change_note}"` : version.change_note}
                                    </p>
                                )}

                                {!version.change_note && (
                                    <p className="text-[11px] text-on-surface-variant mb-2 leading-snug line-clamp-1">
                                        {version.prompt_text.substring(0, 80)}...
                                    </p>
                                )}

                                {/* Mini sparkline for production */}
                                {isProduction && (
                                    <>
                                        <div className="h-8 flex items-end gap-[2px]">
                                            {[4, 5, 3, 7, 6, 8].map((h, i) => (
                                                <div
                                                    key={i}
                                                    className={`flex-1 rounded-t-sm ${i === 5 ? 'bg-tertiary' : 'bg-tertiary/20'}`}
                                                    style={{ height: `${h * 4}px` }}
                                                />
                                            ))}
                                        </div>
                                        <div className="mt-2 flex justify-between items-center text-[10px] font-bold text-on-surface-variant">
                                            <span>Latency (avg)</span>
                                            <span className="text-tertiary">0.9s</span>
                                        </div>
                                    </>
                                )}

                                {!isProduction && (
                                    <div className="flex items-center gap-2 text-[10px] font-medium text-slate-500">
                                        <Icon name="history" size={14} />
                                        {version.is_latest && !isProduction ? 'Latest' : 'Draft'}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="p-4 mt-auto">
                <button className="w-full text-xs font-bold text-on-surface-variant py-2 border border-outline-variant/30 rounded hover:bg-surface-container-high transition-colors">
                    View Full Audit Log
                </button>
            </div>
        </section>
    );
};
