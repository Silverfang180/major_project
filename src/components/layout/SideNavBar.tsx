import React from 'react';
import { NavLink, useLocation } from 'react-router';
import { Icon } from '../ui/Icon';

interface SideNavBarProps {
    onNewPrompt: () => void;
}

const NAV_ITEMS = [
    { path: '/', label: 'Prompts', icon: 'terminal' },
    { path: '/executions', label: 'Executions', icon: 'play_circle' },
    { path: '/datasets', label: 'Datasets', icon: 'database' },
    { path: '/evaluators', label: 'Evaluators', icon: 'analytics' },
    { path: '/settings', label: 'Settings', icon: 'tune' },
];

export const SideNavBar: React.FC<SideNavBarProps> = ({ onNewPrompt }) => {
    const location = useLocation();

    return (
        <aside className="fixed left-0 top-0 h-screen flex flex-col py-4 z-40 bg-slate-100 w-64 border-r border-slate-200/60">
            {/* Brand */}
            <div className="px-6 mb-8">
                <h1 className="text-xl font-black text-cyan-800 tracking-tight">Chronicle</h1>
                <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 font-semibold">v2.4.0-stable</p>
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 px-3 space-y-1">
                {NAV_ITEMS.map((item) => {
                    const isActive = item.path === '/'
                        ? location.pathname === '/'
                        : location.pathname.startsWith(item.path);

                    return (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={isActive ? 'chr-nav-item-active' : 'chr-nav-item'}
                        >
                            <Icon name={item.icon} size={20} />
                            <span className="text-xs font-medium tracking-wide uppercase">{item.label}</span>
                        </NavLink>
                    );
                })}
            </nav>

            {/* Bottom Section */}
            <div className="mt-auto px-3 space-y-1 border-t border-slate-200 pt-4">
                <a href="#" className="chr-nav-item">
                    <Icon name="help" size={20} />
                    <span className="text-xs font-medium tracking-wide uppercase">Documentation</span>
                </a>
                <a href="#" className="chr-nav-item">
                    <Icon name="contact_support" size={20} />
                    <span className="text-xs font-medium tracking-wide uppercase">Support</span>
                </a>
                <div className="px-4 py-2 mt-4">
                    <button
                        onClick={onNewPrompt}
                        className="w-full bg-gradient-to-br from-primary to-primary-dim text-white py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider hover:opacity-90 transition-all shadow-md"
                    >
                        New Prompt
                    </button>
                </div>
            </div>
        </aside>
    );
};
