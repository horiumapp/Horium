
import React from 'react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    headerColor?: string; // Optional custom header color
}

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    size = 'md',
    headerColor = 'bg-primary'
}) => {
    if (!isOpen) return null;

    const maxWidths = {
        sm: 'max-w-md',
        md: 'max-w-xl',
        lg: 'max-w-3xl',
        xl: 'max-w-5xl'
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className={`w-full ${maxWidths[size]} bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-200 dark:border-gray-800`}
                onClick={(e) => e.stopPropagation()}
            >
                {title && (
                    <div className={`${headerColor} p-6 text-white flex justify-between items-center`}>
                        <div className="flex items-center gap-2">
                            <h3 className="text-xl font-bold uppercase tracking-wide">
                                {title}
                            </h3>
                        </div>
                        <button
                            onClick={onClose}
                            className="size-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all shrink-0"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                )}
                <div className="max-h-[80vh] overflow-y-auto custom-scrollbar">
                    {children}
                </div>
            </div>
        </div>
    );
};
