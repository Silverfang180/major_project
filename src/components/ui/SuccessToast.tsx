import React, { useEffect, useState } from 'react';
import { Icon } from '../ui/Icon';

interface SuccessToastProps {
    message: string;
    type?: 'success' | 'error' | 'info';
    onClose: () => void;
    duration?: number;
}

export const SuccessToast: React.FC<SuccessToastProps> = ({
    message,
    type = 'success',
    onClose,
    duration = 4000,
}) => {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(false);
            setTimeout(onClose, 300);
        }, duration);
        return () => clearTimeout(timer);
    }, [duration, onClose]);

    const config = {
        success: {
            borderColor: 'border-l-tertiary',
            bgColor: 'bg-tertiary-container',
            textColor: 'text-tertiary',
            iconColor: 'text-on-tertiary-container',
            icon: 'check_circle',
            label: 'Success',
        },
        error: {
            borderColor: 'border-l-error',
            bgColor: 'bg-error-container/30',
            textColor: 'text-error',
            iconColor: 'text-error',
            icon: 'error',
            label: 'Error',
        },
        info: {
            borderColor: 'border-l-primary',
            bgColor: 'bg-primary-container/30',
            textColor: 'text-primary',
            iconColor: 'text-primary',
            icon: 'info',
            label: 'Info',
        },
    };

    const c = config[type];

    return (
        <div
            className={`fixed bottom-6 right-6 z-[110] flex items-center gap-4 bg-surface-container-lowest border border-outline-variant/20 pl-4 pr-6 py-4 rounded-xl shadow-[0_12px_32px_-4px_rgba(44,52,55,0.1)] border-l-4 ${c.borderColor} transition-all duration-300 ${isVisible ? 'animate-toast-in' : 'opacity-0 translate-y-4'
                }`}
        >
            <div className={`flex-shrink-0 w-10 h-10 rounded-full ${c.bgColor} flex items-center justify-center`}>
                <Icon name={c.icon} size={20} className={c.iconColor} filled />
            </div>
            <div className="flex flex-col">
                <span className={`text-xs font-bold uppercase tracking-widest ${c.textColor} leading-none mb-1`}>{c.label}</span>
                <p className="text-sm font-medium text-on-surface">{message}</p>
            </div>
            <button onClick={onClose} className="ml-4 p-1 text-on-surface-variant hover:text-on-surface transition-colors">
                <Icon name="close" size={20} />
            </button>
        </div>
    );
};
