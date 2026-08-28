
import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    title?: string;
    icon?: string;
}

export const Card: React.FC<CardProps> = ({
    children,
    className = '',
    title,
    icon
}) => {
    return (
        <div className={`bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 overflow-hidden ${className}`}>
            {(title || icon) && (
                <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
                    {icon && <span className="material-symbols-outlined text-primary">{icon}</span>}
                    {title && <h3 className="font-black text-lg uppercase text-gray-700 dark:text-gray-200">{title}</h3>}
                </div>
            )}
            <div className="p-6">
                {children}
            </div>
        </div>
    );
};
