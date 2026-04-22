import React, { useState } from 'react';
import { Icon } from '../ui/Icon';
import { api } from '../../lib/api';

interface CreatePromptModalProps {
    onClose: () => void;
    onCreated?: (prompt: any) => void;
}

export const CreatePromptModal: React.FC<CreatePromptModalProps> = ({ onClose, onCreated }) => {
    const [title, setTitle] = useState('');
    const [key, setKey] = useState('');
    const [description, setDescription] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) {
            setError('Title is required');
            return;
        }
        setIsCreating(true);
        setError('');
        try {
            const result = await api.createPrompt(
                key.trim() || title.toLowerCase().replace(/\s+/g, '-'),
                title.trim(),
                '00000000-0000-0000-0000-000000000000'
            );
            onCreated?.(result);
            onClose();
        } catch (e: any) {
            setError(e.message || 'Failed to create prompt');
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-fade-in">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-on-surface/20 backdrop-blur-sm" onClick={onClose}></div>

            {/* Modal */}
            <div className="relative w-full max-w-lg glass-effect rounded-xl shadow-[0_12px_32px_-4px_rgba(44,52,55,0.08)] border border-white overflow-hidden animate-slide-in">
                {/* Header */}
                <div className="px-8 pt-8 pb-4">
                    <h3 className="text-xl font-bold tracking-tight text-on-surface leading-tight">Create New Prompt</h3>
                    <p className="text-sm text-on-surface-variant mt-1">Define a new LLM prompt template for your workspace.</p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="px-8 py-4 space-y-6">
                    <div>
                        <label className="block text-[11px] font-bold tracking-[0.05em] uppercase text-outline mb-2">Prompt Title</label>
                        <input
                            className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-container/30 focus:border-primary outline-none transition-all placeholder:text-on-surface-variant/40"
                            placeholder="e.g. Customer Support Summarizer"
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold tracking-[0.05em] uppercase text-outline mb-2">Key (ID)</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2">
                                <Icon name="code" size={18} className="text-on-surface-variant/60" />
                            </span>
                            <input
                                className="w-full bg-surface-container-low border border-outline-variant/30 rounded pl-11 pr-4 py-2.5 text-sm font-mono text-primary focus:ring-2 focus:ring-primary-container/30 focus:border-primary outline-none transition-all"
                                placeholder="summarizer-v2"
                                type="text"
                                value={key}
                                onChange={(e) => setKey(e.target.value)}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold tracking-[0.05em] uppercase text-outline mb-2">Description</label>
                        <textarea
                            className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-container/30 focus:border-primary outline-none transition-all placeholder:text-on-surface-variant/40 resize-none"
                            placeholder="Explain the purpose and expected variables for this prompt..."
                            rows={3}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    {error && (
                        <div className="text-sm text-error bg-error-container/20 px-3 py-2 rounded">
                            {error}
                        </div>
                    )}
                </form>

                {/* Footer */}
                <div className="px-8 pb-8 pt-4 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-semibold text-secondary hover:bg-surface-container-high rounded transition-colors duration-200"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isCreating || !title.trim()}
                        className="bg-primary text-primary-foreground focus:ring-2 focus:ring-primary/50 hover:opacity-90 px-5 py-2.5 rounded text-sm font-semibold transition-all disabled:opacity-50"
                    >
                        {isCreating ? 'Creating...' : 'Create Prompt'}
                    </button>
                </div>
            </div>
        </div>
    );
};
