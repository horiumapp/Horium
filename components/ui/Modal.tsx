
import React, { useEffect, useId } from 'react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    headerColor?: string;
}

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    size = 'md',
    headerColor = 'bg-primary'
}) => {
    const titleId = useId();

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const maxWidths = {
        sm: 'max-w-md',
        md: 'max-w-xl',
        lg: 'max-w-3xl',
        xl: 'max-w-5xl'
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-950/55 p-0 sm:p-4"
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? titleId : undefined}
                className={`w-full ${maxWidths[size]} bg-white dark:bg-[#152233] rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-800 max-h-[92vh] flex flex-col`}
                onClick={(e) => e.stopPropagation()}
            >
                {title && (
                    <div className={`${headerColor} px-5 py-4 text-white flex justify-between items-center gap-3 shrink-0`}>
                        <h3 id={titleId} className="text-lg font-semibold tracking-tight">
                            {title}
                        </h3>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Fechar"
                            className="size-9 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors shrink-0"
                        >
                            <span className="material-symbols-outlined" aria-hidden="true">close</span>
                        </button>
                    </div>
                )}
                <div className="overflow-y-auto custom-scrollbar">
                    {children}
                </div>
            </div>
        </div>
    );
};
