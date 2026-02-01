import React, { useState, useEffect } from 'react';
import { VersionHistorySidebar } from '../dashboard/VersionHistorySidebar';
import { PromptEditor } from '../dashboard/PromptEditor';
import { DiffViewer } from '../dashboard/DiffViewer';
import { type Version } from '../../lib/mockData';
import { api } from '../../lib/api';
import { Loader2 } from 'lucide-react';
import { TrashBin } from '../dashboard/TrashBin';

const USER_ID = "00000000-0000-0000-0000-000000000000"; // Placeholder UUID for demo

export const MainLayout: React.FC = () => {
    const [versions, setVersions] = useState<Version[]>([]);
    const [currentVersionId, setCurrentVersionId] = useState<string>("");
    const [showDiff, setShowDiff] = useState(false);
    const [loading, setLoading] = useState(true);
    const [showTrash, setShowTrash] = useState(false);
    const [activePromptId, setActivePromptId] = useState<string>("");
    const [promptList, setPromptList] = useState<any[]>([]); // Store list of prompts

    useEffect(() => {
        const init = async () => {
            try {
                setLoading(true);
                // 1. Get Prompts
                const prompts = await api.getPrompts();
                setPromptList(prompts); // Save list for sidebar selector

                let promptId = "";

                if (prompts.length > 0) {
                    promptId = prompts[0].prompt_id;
                } else {
                    console.log("No prompts found yet. User will create one.");
                }

                if (promptId) {
                    setActivePromptId(promptId);
                    // 2. Get History
                    const history = await api.getVersions(promptId);
                    if (history.length > 0) {
                        setVersions(history);
                        setCurrentVersionId(history[0].id);
                    } else {
                        setVersions([]);
                    }
                }
            } catch (e) {
                console.error("Failed to load data", e);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    // Effect: Reload versions when Active Prompt changes (Switching folders)
    useEffect(() => {
        const loadHistory = async () => {
            if (!activePromptId) return;
            setLoading(true);
            try {
                const history = await api.getVersions(activePromptId);
                if (history.length > 0) {
                    setVersions(history);
                    setCurrentVersionId(history[0].id);
                } else {
                    // Check if we have a provisional 'Draft' version created locally
                    // If so, preserve it instead of wiping everything
                    setVersions(prev => {
                        if (prev.length === 1 && prev[0].id === 'Draft') {
                            return prev;
                        }
                        return [];
                    });

                    setCurrentVersionId(prev => {
                        if (prev === 'Draft') return prev;
                        return "";
                    });
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        // Only run if we actually have an ID and it's not the initial load (which is handled above)
        // Actually, simpler to just have this effect handle all loads if we move init logic?
        // For now, let's just run this if activePromptId changes after mount.
        if (activePromptId) loadHistory();
    }, [activePromptId]);


    const currentVersion = versions.find(v => v.id === currentVersionId) || versions[0];

    // Find previous version
    const currentIndex = versions.findIndex(v => v.id === currentVersionId);
    const previousVersion = currentIndex < versions.length - 1 ? versions[currentIndex + 1] : undefined;

    const handleSaveNewVersion = async (newText: string, usage?: any) => {
        try {
            let targetPromptId = activePromptId;

            // If we don't have a prompt ID yet, create one now
            if (!targetPromptId) {
                console.log("Creating new prompt...");
                // Ask user for a name, default to "New Chat"
                let name = prompt("Enter a name for this new conversation:", "New Chat");
                if (!name) name = "Untitled Chat"; // Fallback if cancelled/empty

                const uniqueKey = "prompt-" + Date.now();
                const newPrompt = await api.createPrompt(uniqueKey, name, USER_ID);
                targetPromptId = newPrompt.prompt_id;
                setActivePromptId(targetPromptId);

                // Refresh prompt list immediately so it appears in dropdown
                const updatedList = await api.getPrompts();
                setPromptList(updatedList);
            }

            await api.createVersion(targetPromptId, newText, USER_ID, usage);

            // Refresh list
            const history = await api.getVersions(targetPromptId);
            setVersions(history);
            if (history.length > 0) {
                setCurrentVersionId(history[0].id);
            }
        } catch (e) {
            console.error("Failed to save version", e);
            alert("Failed to save. Is the backend running?");
        }
    };

    const handleDeleteVersion = async (version: Version) => {
        if (!version.db_id) {
            alert("Cannot delete mock version");
            return;
        }
        if (!confirm(`Are you sure you want to delete ${version.id}?`)) return;

        try {
            await api.deleteVersion(version.db_id);

            // Refresh list
            const history = await api.getVersions(activePromptId);
            setVersions(history);

            // If we deleted the current version, switch to another
            if (currentVersionId === version.id && history.length > 0) {
                setCurrentVersionId(history[0].id);
            } else if (history.length === 0) {
                setCurrentVersionId(""); // Clear selection if empty
            }
        } catch (e) {
            console.error("Delete failed", e);
            alert("Failed to delete version.");
        }
    };

    if (loading) {
        return <div className="h-screen w-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    }

    const handleNewPrompt = async () => {
        setLoading(true);
        try {
            // Revert to Immediate Creation (Ghost Prompts allowed)
            console.log("Creating new prompt immediately...");
            // Ask user for a name, default to "New Chat"
            let name = prompt("Enter a name for this new conversation:", "New Chat");
            if (!name) name = "Untitled Chat";

            const uniqueKey = "prompt-" + Date.now();
            const newPrompt = await api.createPrompt(uniqueKey, name, USER_ID);

            setActivePromptId(newPrompt.prompt_id);
            setCurrentVersionId(""); // Clear version selection
            setVersions([]); // Clear versions list (it's new)

            // Set virtual draft version for UI
            const draftVersion: Version = {
                id: "Draft",
                date: new Date().toISOString().split('T')[0],
                author: "You",
                status: "Draft",
                cost: "N/A",
                text: "",
                accuracy: "N/A"
            };
            setVersions([draftVersion]);
            setCurrentVersionId("Draft");

            // Refresh prompt list
            const updatedList = await api.getPrompts();
            setPromptList(updatedList);

        } catch (e) {
            console.error(e);
            alert("Failed to create prompt");
        } finally {
            setLoading(false);
        }
    };

    // Empty state if no versions
    if (!currentVersion) {
        return (
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-background text-foreground gap-4">
                <h2 className="text-xl font-bold">No Versions Found</h2>
                <p className="text-muted-foreground">The database is empty.</p>
                <button
                    onClick={handleNewPrompt}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md shadow hover:bg-primary/90 transition-colors"
                    disabled={loading}
                >
                    Create First Version
                </button>
            </div>
        )
    }



    const handleRenamePrompt = async (id: string, newTitle: string) => {
        try {
            await api.updatePrompt(id, newTitle);
            // Refresh list
            const updatedList = await api.getPrompts();
            setPromptList(updatedList);
        } catch (e) {
            alert("Failed to rename prompt");
        }
    };

    const handleDeletePrompt = async (id: string) => {
        try {
            await api.deletePrompt(id);
            // Refresh list
            const updatedList = await api.getPrompts();
            setPromptList(updatedList);
            // If we deleted the active one, switch to another or reset
            if (updatedList.length > 0) {
                setActivePromptId(updatedList[0].prompt_id);
            } else {
                handleNewPrompt(); // fully reset
            }
        } catch (e) {
            alert("Failed to delete prompt");
        }
    };

    return (
        <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground font-sans selection:bg-primary/20">
            {/* Left Sidebar */}
            <VersionHistorySidebar
                versions={versions}
                currentVersionId={currentVersionId}
                onSelectVersion={setCurrentVersionId}
                onDeleteVersion={handleDeleteVersion}
                onNewPrompt={handleNewPrompt}
                prompts={promptList}
                activePromptId={activePromptId}
                onSelectPrompt={setActivePromptId}
                onRenamePrompt={handleRenamePrompt}
                onDeletePrompt={handleDeletePrompt}
                onOpenTrash={() => setShowTrash(true)}
            />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col relative min-w-0">
                <PromptEditor
                    version={currentVersion}
                    onSave={handleSaveNewVersion}
                    onToggleDiff={() => setShowDiff(!showDiff)}
                    showDiff={showDiff}
                />

                {/* Diff Overlay Pane */}
                {showDiff && (
                    <DiffViewer
                        currentVersion={currentVersion}
                        previousVersion={previousVersion}
                        onClose={() => setShowDiff(false)}
                    />
                )}

                {/* Trash Bin Modal */}
                {showTrash && (
                    <TrashBin
                        onClose={() => setShowTrash(false)}
                        onRestore={async () => {
                            try {
                                // 1. Refresh global prompts list (for sidebar)
                                const updatedList = await api.getPrompts();
                                setPromptList(updatedList);

                                // 2. Refresh active prompt's versions (if one is selected)
                                if (activePromptId) {
                                    const history = await api.getVersions(activePromptId);
                                    const mappedVersions = history.map((v: any) => ({
                                        id: String(v.version_id), // FIX: Convert number to string
                                        date: new Date(v.created_at).toLocaleDateString(),
                                        timestamp: v.created_at,
                                        text: v.prompt_text,
                                        cost: "$0.0000",
                                        author: "You",
                                        status: "Draft" as const, // FIX: Cast to literal type
                                        accuracy: "N/A"
                                    }));
                                    setVersions(mappedVersions);

                                    // Also update current version if needed
                                    if (updatedList.length > 0) {
                                        const active = updatedList.find((p: any) => p.prompt_id === activePromptId);
                                        // Optional: logic to select latest
                                    }
                                } else if (updatedList.length > 0) {
                                    setActivePromptId(updatedList[0].prompt_id);
                                }
                            } catch (error) {
                                console.error("Failed to restore:", error);
                            }
                        }}
                    />
                )}
            </div>
        </div>
    );
};
