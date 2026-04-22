import React from 'react';
import { Icon } from '../ui/Icon';

interface TopAppBarProps {
    breadcrumb?: string;
}

export const TopAppBar: React.FC<TopAppBarProps> = ({ breadcrumb }) => {
    return (
        <header className="fixed top-0 left-64 right-0 h-14 z-50 flex justify-between items-center px-6 bg-slate-50 border-b border-slate-200/60 font-sans antialiased text-sm">
            <div className="flex items-center gap-4">
                {breadcrumb ? (
                    <span className="text-sm font-semibold text-slate-500">{breadcrumb}</span>
                ) : (
                    <div className="flex items-center gap-2">
                        <Icon name="monitor_heart" size={20} className="text-cyan-700" />
                        <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">System Status</span>
                        <div className="h-2 w-2 rounded-full bg-tertiary"></div>
                    </div>
                )}
            </div>
            <div className="flex items-center gap-4">
                {/* Search */}
                <div className="flex items-center bg-surface-container rounded-full px-3 py-1.5 border border-outline-variant/20">
                    <Icon name="search" size={18} className="text-slate-400 mr-2" />
                    <input
                        className="bg-transparent border-none focus:ring-0 focus:outline-none text-xs w-48 p-0 text-on-surface-variant placeholder:text-slate-400"
                        placeholder="Search prompts..."
                        type="text"
                    />
                </div>
                {/* Actions */}
                <button className="p-2 text-slate-500 hover:bg-slate-200/50 rounded-full transition-colors">
                    <Icon name="dark_mode" size={20} />
                </button>
                <button className="p-2 text-slate-500 hover:bg-slate-200/50 rounded-full transition-colors">
                    <Icon name="settings" size={20} />
                </button>
                {/* Avatar */}
                <div className="h-8 w-8 rounded-full bg-surface-container-highest border border-outline-variant overflow-hidden flex items-center justify-center">
                    <Icon name="person" size={20} className="text-on-surface-variant" />
                </div>
            </div>
        </header>
    );
};
