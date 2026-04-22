import React from 'react';
import { Icon } from '../ui/Icon';

interface Prompt {
    prompt_id: string;
    key: string;
    title: string;
    latest_version?: {
        is_latest: boolean;
        ordinal: number;
    };
    deleted_at?: string | null;
}

interface PromptListSidebarProps {
    prompts: Prompt[];
    selectedId: string;
    onSelect: (id: string) => void;
    isLoading: boolean;
}

export const PromptListSidebar: React.FC<PromptListSidebarProps> = ({
    prompts,
    selectedId,
    onSelect,
    isLoading,
}) => {
    return (
        <section className="w-72 border-r border-slate-200/60 flex flex-col bg-surface-container-low overflow-y-auto shrink-0">
            <div className="p-4 border-b border-slate-200/40 flex justify-between items-center">
                <span className="chr-label">
                    Active Prompts {!isLoading && `(${prompts.length})`}
                </span>
                {isLoading && <span className="skeleton h-4 w-8 rounded"></span>}
            </div>
            <div className="flex-1 py-2 overflow-y-auto scroll-hide">
                {isLoading ? (
                    <div className="p-4 space-y-3">
                        {[1, 0.8, 0.6, 0.4, 0.2].map((opacity, i) => (
                            <div key={i} className="skeleton h-16 w-full rounded-lg" style={{ opacity }}></div>
                        ))}
                    </div>
                ) : (
                    prompts.map((prompt) => {
                        const isSelected = prompt.prompt_id === selectedId;
                        const hasProduction = prompt.latest_version?.is_latest;

                        return (
                            <div key={prompt.prompt_id} className="px-3 py-1">
                                <div
                                    onClick={() => onSelect(prompt.prompt_id)}
                                    className={`p-3 rounded-lg cursor-pointer transition-all ${isSelected
                                            ? 'bg-surface-container-lowest border-l-4 border-primary shadow-sm'
                                            : 'hover:bg-slate-200/50 border border-transparent'
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className={`text-xs tracking-tight ${isSelected ? 'font-bold text-on-surface' : 'font-medium text-on-surface'}`}>
                                            {prompt.title}
                                        </span>
                                        <span className={`text-[10px] font-mono px-1.5 rounded ${isSelected
                                                ? 'bg-primary-container/30 text-primary-dim'
                                                : 'text-slate-400'
                                            }`}>
                                            {prompt.key?.substring(0, 8).toUpperCase() || 'N/A'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        {hasProduction ? (
                                            <>
                                                <Icon name="check_circle" size={14} className="text-tertiary" />
                                                <span className="text-[10px] font-medium text-on-surface-variant">Production</span>
                                            </>
                                        ) : (
                                            <>
                                                <Icon name="history" size={14} className="text-slate-400" />
                                                <span className="text-[10px] font-medium text-slate-400">Draft</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </section>
    );
};
