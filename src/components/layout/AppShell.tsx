import React, { useState } from 'react';
import { Outlet } from 'react-router';
import { SideNavBar } from './SideNavBar';
import { TopAppBar } from './TopAppBar';
import { CreatePromptModal } from '../prompts/CreatePromptModal';

export const AppShell: React.FC = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    return (
        <div className="h-screen overflow-hidden bg-chr-surface text-on-surface antialiased">
            <SideNavBar onNewPrompt={() => setIsModalOpen(true)} />
            <TopAppBar />
            <main className="ml-64 pt-14 h-screen">
                <Outlet context={{ openNewPromptModal: () => setIsModalOpen(true), refreshTrigger }} />
            </main>
            {isModalOpen && (
                <CreatePromptModal
                    onClose={() => setIsModalOpen(false)}
                    onCreated={() => setRefreshTrigger(prev => prev + 1)}
                />
            )}
        </div>
    );
};
