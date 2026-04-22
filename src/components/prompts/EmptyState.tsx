import React from 'react';
import { Icon } from '../ui/Icon';

interface EmptyStateProps {
    onCreatePrompt: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ onCreatePrompt }) => {
    return (
        <section className="flex-1 flex flex-col bg-chr-surface overflow-y-auto items-center justify-center p-12 relative">
            <div className="max-w-md w-full text-center space-y-8 animate-fade-in">
                {/* Icon Area */}
                <div className="relative group inline-block">
                    <div className="w-24 h-24 mx-auto bg-surface-container-highest rounded-3xl flex items-center justify-center transform rotate-3 group-hover:rotate-0 transition-transform duration-500 shadow-sm border border-outline-variant/20">
                        <Icon name="auto_awesome" size={48} className="text-primary" filled />
                    </div>
                    <div className="absolute -top-2 -right-2 w-10 h-10 bg-tertiary-container rounded-full flex items-center justify-center shadow-lg transform -rotate-12">
                        <Icon name="add" size={20} className="text-on-tertiary-container" />
                    </div>
                </div>

                {/* Text */}
                <div className="space-y-3">
                    <h2 className="text-2xl font-bold text-on-surface tracking-tight">Welcome to Chronicle</h2>
                    <p className="text-on-surface-variant leading-relaxed">
                        Select a prompt from the sidebar or create a new one to get started. Your engineering workspace is ready.
                    </p>
                </div>

                {/* CTA */}
                <div className="flex flex-col items-center gap-4">
                    <button
                        onClick={onCreatePrompt}
                        className="px-8 py-3 bg-gradient-to-br from-primary to-primary-dim text-on-primary font-semibold rounded-lg shadow-xl shadow-primary/10 hover:shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-3"
                    >
                        <Icon name="add_circle" size={20} />
                        Create New Prompt
                    </button>
                    <div className="flex items-center gap-2 text-xs text-on-surface-variant/60 font-medium pt-4">
                        <Icon name="keyboard" size={14} />
                        <span>Press <kbd className="px-1.5 py-0.5 bg-surface-container-high rounded border border-outline-variant/30 font-mono text-[10px]">⌘ K</kbd> to search</span>
                    </div>
                </div>
            </div>

            {/* Background Glow */}
            <div className="absolute inset-0 pointer-events-none opacity-20 overflow-hidden">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-tertiary/10 rounded-full blur-[120px]"></div>
            </div>
        </section>
    );
};
