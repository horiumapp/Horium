import React from 'react';

interface WizardStepHeaderProps {
    title: string;
    description: string;
    icon: string;
    count?: {
        label: string;
        value: number;
    };
    actions?: React.ReactNode;
}

export const WizardStepHeader: React.FC<WizardStepHeaderProps> = ({ title, description, icon, count, actions }) => {
    return (
        <div className="bg-primary px-5 py-4 sm:px-6 text-white">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div className="flex gap-3 min-w-0">
                    <span className="material-symbols-outlined text-[26px] shrink-0" aria-hidden="true">{icon}</span>
                    <div className="min-w-0">
                        <h1 className="text-lg sm:text-xl font-semibold tracking-tight">{title}</h1>
                        <p className="text-white/90 text-sm mt-0.5">{description}</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {count && (
                        <div className="flex flex-col items-end px-3 py-1.5 bg-white/10 rounded-xl border border-white/15">
                            <span className="text-[11px] font-medium text-white/80 leading-none mb-1">{count.label}</span>
                            <span className="text-xl font-semibold leading-none">{count.value}</span>
                        </div>
                    )}
                    {actions}
                </div>
            </div>
        </div>
    );
};
