import React from 'react';

interface IconProps {
    name: string;
    className?: string;
    filled?: boolean;
    size?: number;
}

export const Icon: React.FC<IconProps> = ({ name, className = '', filled = false, size = 24 }) => {
    return (
        <span
            className={`material-symbols-outlined ${className}`}
            style={{
                fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${size}`,
                fontSize: `${size}px`,
                verticalAlign: 'middle',
            }}
        >
            {name}
        </span>
    );
};
