
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
        <section className={`bg-white dark:bg-[#152233] rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 ${className}`}>
            {(title || icon) && (
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2.5">
                    {icon && <span className="material-symbols-outlined text-primary text-[22px]" aria-hidden="true">{icon}</span>}
                    {title && <h3 className="font-semibold text-base text-gray-900 dark:text-gray-100">{title}</h3>}
                </div>
            )}
            <div className="p-5">
                {children}
            </div>
        </section>
    );
};
