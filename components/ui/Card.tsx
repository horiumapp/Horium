
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
        <div className={`bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800 overflow-hidden ${className}`}>
            {(title || icon) && (
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
                    {icon && <span className="material-symbols-outlined text-primary bg-primary/10 rounded-xl p-2">{icon}</span>}
                    {title && <h3 className="font-bold text-base text-gray-800 dark:text-gray-100">{title}</h3>}
                </div>
            )}
            <div className="p-5 md:p-6">
                {children}
            </div>
        </div>
    );
};
