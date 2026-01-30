import React from 'react';
import type { Version } from '../../lib/mockData';
import { cn } from '../../lib/utils';
import { Clock, User, GitCommit, Trash2, Plus, Edit2 } from 'lucide-react';

interface VersionHistorySidebarProps {
    versions: Version[];
    currentVersionId: string;
    onSelectVersion: (id: string) => void;
    onDeleteVersion: (version: Version) => void;
    onNewPrompt: () => void;
    prompts: any[]; // List of available prompts
    activePromptId: string;
    onSelectPrompt: (id: string) => void;
    onDeletePrompt: (id: string) => void;
    onRenamePrompt: (id: string, newTitle: string) => void;
}

export const VersionHistorySidebar: React.FC<VersionHistorySidebarProps> = ({
    versions,
    currentVersionId,
    onSelectVersion,
    onDeleteVersion,
    onNewPrompt,
    prompts,
    activePromptId,
    onSelectPrompt,
    onDeletePrompt,
    onRenamePrompt
}) => {
    return (
        <div className="w-80 border-r border-border bg-card flex flex-col h-full">
            <div className="p-4 border-b border-border flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Clock className="w-5 h-5 text-muted-foreground" />
                        Version History
                    </h2>
                    <button
                        onClick={onNewPrompt}
                        className="p-1.5 hover:bg-primary/10 text-primary hover:text-primary rounded-md transition-colors"
                        title="New Prompt (Folder)"
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                </div>

                {/* Prompt Switcher & Actions */}
                {prompts.length > 0 && (
                    <div className="flex items-center gap-1">
                        <select
                            value={activePromptId}
                            onChange={(e) => onSelectPrompt(e.target.value)}
                            className="flex-1 text-xs p-2 rounded border border-input bg-background text-foreground truncate"
                        >
                            <option value="" disabled>Select a prompt...</option>
                            {prompts.map(p => (
                                <option key={p.prompt_id} value={p.prompt_id}>
                                    {p.title}
                                </option>
                            ))}
                        </select>

                        {/* Edit Name */}
                        <button
                            onClick={() => {
                                const current = prompts.find(p => p.prompt_id === activePromptId);
                                if (!current) return;
                                const newName = prompt("Rename Prompt:", current.title);
                                if (newName && newName.trim()) {
                                    onRenamePrompt(activePromptId, newName.trim());
                                }
                            }}
                            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded"
                            title="Rename Folder"
                            disabled={!activePromptId}
                        >
                            <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Folder */}
                        <button
                            onClick={() => {
                                if (confirm("Delete this entire folder and all its history?")) {
                                    onDeletePrompt(activePromptId);
                                }
                            }}
                            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded"
                            title="Delete Folder"
                            disabled={!activePromptId}
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {versions.map((version) => (
                    <div
                        key={version.id}
                        className={cn(
                            "group relative p-3 rounded-lg cursor-pointer transition-all border",
                            currentVersionId === version.id
                                ? "bg-accent border-primary/20 shadow-sm"
                                : "hover:bg-accent/50 border-transparent hover:border-border"
                        )}
                        onClick={() => onSelectVersion(version.id)}
                    >
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-1.5 font-medium">
                                <GitCommit className="w-4 h-4 text-primary" />
                                {version.id}
                            </div>

                            {/* Delete Button (Visible on Hover) */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation(); // Prevent selection when deleting
                                    onDeleteVersion(version);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 hover:text-destructive rounded transition-all absolute top-2 right-2"
                                title="Delete Version"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>

                            <span className={cn(
                                "text-xs px-2 py-0.5 rounded-full font-medium ml-auto mr-6", // Added margin for delete button space
                                version.status === "Production" && "bg-green-500/10 text-green-500",
                                version.status === "Staging" && "bg-yellow-500/10 text-yellow-500",
                                version.status === "Draft" && "bg-slate-500/10 text-slate-500",
                            )}>
                                {version.status}
                            </span>
                        </div>

                        <div className="text-sm text-muted-foreground mb-3 line-clamp-2">
                            {version.text}
                        </div>

                        <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                            <div className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {version.author}
                            </div>
                            <div className="flex gap-2">
                                <span>{version.date}</span>
                                <span className="font-mono text-primary/80">{version.cost}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
