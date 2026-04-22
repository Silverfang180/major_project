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

export const useDashboardStore = create<DashboardState>((set) => ({
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

    setActivePromptId: (id) => set({ activePromptId: id }),
    setCurrentVersionId: (id) => set({ currentVersionId: id }),
    setConfig: (config) => set((state) => ({ ...state, ...config })),
    setMessages: (messages) => set({ messages }),
    addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
    updateMessage: (id, content) => set((state) => ({
        messages: state.messages.map(m => m.id === id ? { ...m, content } : m)
    })),
    removeMessage: (id) => set((state) => ({
        messages: state.messages.filter(m => m.id !== id)
    })),
    setOutput: (output) => set({ output }),
    setStreaming: (isStreaming) => set({ isStreaming }),
    setTrace: (trace) => set({ trace }),

    loadVersionData: (promptText, modelSettings) => {
        set((state) => {
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
