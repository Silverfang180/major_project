import React, { useEffect, useState } from 'react';
import { PromptListSidebar } from '../components/prompts/PromptListSidebar';
import { PromptWorkPanel } from '../components/prompts/PromptWorkPanel';
import { VersionTimeline } from '../components/prompts/VersionTimeline';
import { EmptyState } from '../components/prompts/EmptyState';
import { SuccessToast } from '../components/ui/SuccessToast';
import { api } from '../lib/api';
import type { PromptResponse, VersionResponse } from '../lib/api';
import { useOutletContext } from 'react-router-dom';

export const PromptsPage: React.FC = () => {
    const { openNewPromptModal, refreshTrigger } = useOutletContext<{ openNewPromptModal: () => void, refreshTrigger: number }>();

    const [prompts, setPrompts] = useState<PromptResponse[]>([]);
    const [isLoadingPrompts, setIsLoadingPrompts] = useState(true);
    const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);

    const [versions, setVersions] = useState<VersionResponse[]>([]);
    const [isLoadingVersions, setIsLoadingVersions] = useState(false);
    const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);

    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);

    useEffect(() => {
        loadPrompts();
    }, [refreshTrigger]);

    const loadPrompts = async () => {
        setIsLoadingPrompts(true);
        try {
            const data = await api.getPrompts();
            setPrompts(data || []);
            // Auto-select first prompt if none selected
            if (data && data.length > 0 && !selectedPromptId) {
                handleSelectPrompt(data[0].prompt_id);
            }
        } catch (e) {
            console.error(e);
            setToast({ message: 'Failed to load prompts', type: 'error' });
        } finally {
            setIsLoadingPrompts(false);
        }
    };

    const handleSelectPrompt = async (id: string) => {
        setSelectedPromptId(id);
        setIsLoadingVersions(true);
        setVersions([]);
        setSelectedVersionId(null);
        try {
            const data = await api.getVersions(id);
            // Sort by ordinal descending
            const sorted = data.sort((a, b) => b.ordinal - a.ordinal);
            setVersions(sorted);
            if (sorted.length > 0) {
                // Select latest by default
                setSelectedVersionId(sorted[0].version_id);
            }
        } catch (e) {
            console.error(e);
            setToast({ message: 'Failed to load version history', type: 'error' });
        } finally {
            setIsLoadingVersions(false);
        }
    };

    const handleVersionCreated = () => {
        if (selectedPromptId) {
            handleSelectPrompt(selectedPromptId);
            setToast({ message: 'New version saved successfully', type: 'success' });
        }
    };

    const handlePromoteVersion = async (versionId: number) => {
        if (!selectedPromptId) return;
        try {
            await api.promoteVersion(selectedPromptId, versionId);
            setToast({ message: 'Version promoted to production', type: 'success' });
            // Refresh
            handleSelectPrompt(selectedPromptId);
            loadPrompts(); // to update production badge on sidebar
        } catch (e: any) {
            setToast({ message: e.message || 'Failed to promote version', type: 'error' });
        }
    };

    const selectedPrompt = prompts.find(p => p.prompt_id === selectedPromptId);
    const selectedVersion = versions.find(v => v.version_id === selectedVersionId);

    return (
        <div className="flex h-full">
            <PromptListSidebar
                prompts={prompts}
                selectedId={selectedPromptId || ''}
                onSelect={handleSelectPrompt}
                isLoading={isLoadingPrompts}
            />

            {selectedPrompt ? (
                <>
                    <PromptWorkPanel
                        prompt={selectedPrompt}
                        currentVersion={selectedVersion}
                        onVersionCreated={handleVersionCreated}
                        onPromoteVersion={handlePromoteVersion}
                    />
                    <VersionTimeline
                        versions={versions}
                        selectedVersionId={selectedVersionId}
                        onSelectVersion={(v) => setSelectedVersionId(v.version_id)}
                        productionVersionId={selectedPrompt?.production_version_id}
                        isLoading={isLoadingVersions}
                    />
                </>
            ) : (
                <EmptyState onCreatePrompt={openNewPromptModal} />
            )}

            {toast && (
                <SuccessToast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </div>
    );
};
