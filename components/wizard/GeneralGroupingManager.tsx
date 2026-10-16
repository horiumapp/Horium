import React from 'react';
import { Modal } from '../ui/Modal';
import { SetupData } from '../../types';
import { GENERAL_GROUPING_OPTIONS } from '../../constants';

interface GeneralGroupingManagerProps {
    isOpen: boolean;
    onClose: () => void;
    data: SetupData;
    setData: React.Dispatch<React.SetStateAction<SetupData>>;
}

export const GeneralGroupingManager: React.FC<GeneralGroupingManagerProps> = ({ isOpen, onClose, data, setData }) => {
    const grouping = data.generalGrouping || 'Agrupar no máximo 2 aulas por dia SEGUIDAS';

    const handleUpdateGrouping = (value: string) => {
        setData(prev => ({
            ...prev,
            generalGrouping: value
        }));
    };

    const fieldClass = 'h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-800 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="lg">
            <div className="bg-gradient-to-r from-[#1259bd] to-primary px-5 py-4 text-white flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-sm font-bold text-primary">3</span>
                    <div className="min-w-0">
                        <h2 className="text-base font-bold tracking-tight">Agrupamento geral</h2>
                        <p className="text-sm text-white/80 mt-0.5 leading-snug">
                            Regra padrão de toda a escola, usada quando as outras ficam em branco.
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Fechar"
                    className="size-10 shrink-0 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                >
                    <span className="material-symbols-outlined">close</span>
                </button>
            </div>

            <div className="bg-white dark:bg-gray-900 px-5 py-5">
                <label className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Agrupamento</span>
                    <select
                        value={grouping}
                        title={grouping}
                        onChange={(e) => handleUpdateGrouping(e.target.value)}
                        className={fieldClass}
                    >
                        {GENERAL_GROUPING_OPTIONS.map(option => (
                            <option key={option} value={option}>{option}</option>
                        ))}
                    </select>
                </label>
            </div>
        </Modal>
    );
};
