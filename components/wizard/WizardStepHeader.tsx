
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
        <div className="bg-gradient-to-r from-[#1259bd] to-primary px-5 py-5 sm:px-7 text-white relative overflow-hidden rounded-t-2xl">
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                        <span className="material-symbols-outlined text-2xl rounded-xl bg-white/10 p-2">{icon}</span>
                        <h1 className="text-lg sm:text-xl font-bold tracking-tight">{title}</h1>
                    </div>
                    <p className="text-white/80 font-normal text-sm leading-relaxed">{description}</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 relative z-20">
                    {count && (
                        <div className="flex items-center gap-2 mr-2">
                                <div className="flex flex-col items-end px-4 py-1.5 bg-white/10 rounded-xl border border-white/10 backdrop-blur-sm">
                                <span className="text-[10px] font-semibold uppercase text-white/70 leading-none mb-1.5 tracking-wider">{count.label}</span>
                                <span className="text-2xl font-bold leading-none">{count.value}</span>
                            </div>
                        </div>
                    )}
                    {actions}
                </div>
            </div>
            <span className="material-symbols-outlined absolute -right-4 -bottom-4 text-7xl opacity-5 rotate-12 select-none pointer-events-none">
                {icon}
            </span>
        </div>
    );
};
