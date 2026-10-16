import React, { useMemo, useState } from 'react';
import { Modal } from '../ui/Modal';
import { SetupData } from '../../types';
import { GENERAL_GROUPING_OPTIONS } from '../../constants';

interface TeacherGroupingManagerProps {
    isOpen: boolean;
    onClose: () => void;
    data: SetupData;
    setData: React.Dispatch<React.SetStateAction<SetupData>>;
}

export const TeacherGroupingManager: React.FC<TeacherGroupingManagerProps> = ({ isOpen, onClose, data, setData }) => {
    const [query, setQuery] = useState('');

    const handleUpdateGrouping = (teacherId: string, grouping: string) => {
        setData(prev => ({
            ...prev,
            teacherGroupings: {
                ...(prev.teacherGroupings || {}),
                [teacherId]: grouping
            }
        }));
    };

    const teachers = useMemo(() => {
        const term = query.trim().toLocaleLowerCase('pt-BR');
        const list = [...data.teachers].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
        if (!term) return list;
        return list.filter(teacher => teacher.name.toLocaleLowerCase('pt-BR').includes(term));
    }, [data.teachers, query]);

    const fieldClass = 'h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-800 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';
    const rowGrid = 'grid grid-cols-[12rem_minmax(0,1fr)] gap-3';

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="xl" scrollable={false}>
            <div className="flex min-h-0 flex-1 flex-col">
                <div className="bg-gradient-to-r from-[#1259bd] to-primary px-5 py-4 text-white flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-sm font-bold text-primary">2</span>
                        <div className="min-w-0">
                            <h2 className="text-base font-bold tracking-tight">Agrupamento por professor</h2>
                            <p className="text-sm text-white/80 mt-0.5 leading-snug">
                                Vale para todas as aulas do professor, se o detalhado não definir.
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

                <div className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 px-5 py-4">
                    <label className="flex max-w-sm flex-col gap-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Professor</span>
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Buscar professor"
                            className={fieldClass}
                        />
                    </label>
                    <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                        {teachers.length} de {data.teachers.length} {data.teachers.length === 1 ? 'professor' : 'professores'}
                    </p>
                </div>

                <div className="min-h-0 flex-1 overflow-auto custom-scrollbar">
                    <div className={`sticky top-0 z-10 ${rowGrid} border-b border-gray-200 bg-white/95 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95`}>
                        <span>Professor</span>
                        <span>Agrupamento</span>
                    </div>

                    {teachers.map((teacher) => {
                        const grouping = data.teacherGroupings?.[teacher.id] || 'Não Especificado';

                        return (
                            <div
                                key={teacher.id}
                                className={`${rowGrid} items-center border-b border-gray-100 px-5 py-2.5 hover:bg-primary/[0.04] dark:border-gray-800 dark:hover:bg-white/[0.03]`}
                            >
                                <span className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate" title={teacher.name}>
                                    {teacher.name}
                                </span>
                                <select
                                    value={grouping}
                                    title={grouping}
                                    onChange={(e) => handleUpdateGrouping(teacher.id, e.target.value)}
                                    className={fieldClass}
                                >
                                    {GENERAL_GROUPING_OPTIONS.map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </div>
                        );
                    })}

                    {teachers.length === 0 && (
                        <div className="px-6 py-16 text-center">
                            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Nenhum professor com esse nome</p>
                            <p className="text-xs text-gray-500 mt-1">Limpe a busca para ver a lista completa.</p>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};
