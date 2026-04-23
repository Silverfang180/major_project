import { create } from 'zustand';

export type Role = 'system' | 'user' | 'assistant';

export interface Message {
    id: string;
    role: Role;
    content: string;
}

export interface DashboardState {
    // Project / Prompt Selection
    activePromptId: string;
    currentVersionId: string;

    // Config (Model settings)
    provider: string;
    model: string;
    temperature: number;
    topP: number;
    maxTokens: number;

    // Editor State
    messages: Message[];

    // Output Panel
    isStreaming: boolean;
    output: string;
    trace: any | null;

    // Actions
    setActivePromptId: (id: string) => void;
    setCurrentVersionId: (id: string) => void;
    setConfig: (config: Partial<Pick<DashboardState, 'provider' | 'model' | 'temperature' | 'topP' | 'maxTokens'>>) => void;
    setMessages: (messages: Message[]) => void;
    addMessage: (message: Message) => void;
    updateMessage: (id: string, content: string) => void;
    removeMessage: (id: string) => void;
    setOutput: (output: string) => void;
    setStreaming: (isStreaming: boolean) => void;
    setTrace: (trace: any) => void;

    // High-level Actions
    loadVersionData: (promptText: string, modelSettings?: any) => void;
}

// Minimal XML-like parsing for prompt_text
export const parsePromptText = (text: string): Message[] => {
    if (!text || !text.includes('<system>') && !text.includes('<user>') && !text.includes('<assistant>')) {
        // Fallback or old format
        return [{ id: Date.now().toString(), role: 'user', content: text }];
    }

    const messages: Message[] = [];
    const regex = /<(system|user|assistant)>(.*?)<\/\1>/gs;
    let match;

    while ((match = regex.exec(text)) !== null) {
        messages.push({
            id: Date.now().toString() + Math.random(),
            role: match[1] as Role,
            content: match[2].trim()
        });
    }

    // If no matches found despite tags existing (malformed), fallback
    if (messages.length === 0) {
        return [{ id: Date.now().toString(), role: 'user', content: text }];
    }
    return messages;
};

export const stringifyMessages = (messages: Message[]): string => {
    return messages.map(m => `<${m.role}>\n${m.content}\n</${m.role}>`).join('\n\n');
};

export const useDashboardStore = create<DashboardState>()((set) => ({
    // Selection
    activePromptId: '',
    currentVersionId: '',

    // Config
    provider: 'openai',
    model: 'gpt-4o',
    temperature: 0.7,
    topP: 1,
    maxTokens: 1000,

    // Messages
    messages: [
        { id: '1', role: 'system', content: 'You are a helpful assistant.' },
        { id: '2', role: 'user', content: '' }
    ],

    // Output
    isStreaming: false,
    output: '',
    trace: null,

    setActivePromptId: (id: string) => set({ activePromptId: id }),
    setCurrentVersionId: (id: string) => set({ currentVersionId: id }),
    setConfig: (config) => set((state: DashboardState) => ({ ...state, ...config })),
    setMessages: (messages: Message[]) => set({ messages }),
    addMessage: (message: Message) => set((state: DashboardState) => ({ messages: [...state.messages, message] })),
    updateMessage: (id: string, content: string) => set((state: DashboardState) => ({
        messages: state.messages.map((m: Message) => m.id === id ? { ...m, content } : m)
    })),
    removeMessage: (id: string) => set((state: DashboardState) => ({
        messages: state.messages.filter((m: Message) => m.id !== id)
    })),
    setOutput: (output: string) => set({ output }),
    setStreaming: (isStreaming: boolean) => set({ isStreaming }),
    setTrace: (trace: any) => set({ trace }),

    loadVersionData: (promptText: string, modelSettings?: any) => {
        set((state: DashboardState) => {
            const parsedMessages = parsePromptText(promptText);
            const settings = modelSettings || {};
            return {
                ...state,
                messages: parsedMessages.length > 0 ? parsedMessages : [{ id: '1', role: 'user', content: '' }],
                provider: settings.provider || state.provider,
                model: settings.model || state.model,
                temperature: settings.temperature ?? state.temperature,
                topP: settings.topP ?? state.topP,
                maxTokens: settings.maxTokens ?? state.maxTokens,
            };
        });
    }
}));
