
import React, { useState } from 'react';
import { WizardStepHeader } from './WizardStepHeader';
import { SetupData } from '../../types';
import { Button } from '../ui/Button';
import { DetailedGroupingManager } from './DetailedGroupingManager';
import { TeacherGroupingManager } from './TeacherGroupingManager';
import { GeneralGroupingManager } from './GeneralGroupingManager';
import { FixedLessonsManager } from './FixedLessonsManager';

interface Step6OptionsProps {
    data: SetupData;
    setData: React.Dispatch<React.SetStateAction<SetupData>>;
    gridRows: any[];
    onNext: () => void;
    onBack: () => void;
}

export const Step6Options: React.FC<Step6OptionsProps> = ({ data, setData, gridRows, onNext, onBack }) => {
    const [isDetailedManagerOpen, setIsDetailedManagerOpen] = useState(false);
    const [isTeacherManagerOpen, setIsTeacherManagerOpen] = useState(false);
    const [isGeneralManagerOpen, setIsGeneralManagerOpen] = useState(false);
    const [isFixedLessonsOpen, setIsFixedLessonsOpen] = useState(false);

    const pinnedCount = data.pinnedLessons?.length || 0;
    const groupingActions = [
        {
            priority: '1',
            title: 'Agrupamento detalhado',
            description: 'Regra de uma aula: professor, turma e disciplina.',
            onClick: () => setIsDetailedManagerOpen(true),
        },
        {
            priority: '2',
            title: 'Agrupamento por professor',
            description: 'Vale para todas as aulas do professor, se o detalhado não definir.',
            onClick: () => setIsTeacherManagerOpen(true),
        },
        {
            priority: '3',
            title: 'Agrupamento geral',
            description: 'Regra padrão de toda a escola, usada quando as outras ficam em branco.',
            onClick: () => setIsGeneralManagerOpen(true),
        },
    ];

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <WizardStepHeader
                title="Opções"
                description="Defina como as aulas se agrupam e quais horários ficam travados."
                icon="settings"
            />

            <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,1fr)] gap-5 items-stretch">
                    <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 shadow-sm flex flex-col">
                        <div className="flex items-start gap-3">
                            <span className="material-symbols-outlined rounded-xl bg-primary/10 text-primary p-2 text-[22px]">account_tree</span>
                            <div>
                                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Agrupamentos</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
                                    A regra 1 prevalece sobre a 2, e a 2 prevalece sobre a 3.
                                </p>
                            </div>
                        </div>

                        <div className="mt-5 space-y-3 flex-1">
                            {groupingActions.map((action) => (
                                <button
                                    key={action.priority}
                                    type="button"
                                    onClick={action.onClick}
                                    className="w-full flex items-center gap-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 px-4 py-3.5 text-left transition-all hover:border-primary/40 hover:bg-white dark:hover:bg-gray-800 hover:shadow-sm"
                                >
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
                                        {action.priority}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-sm font-bold text-gray-800 dark:text-gray-100">{action.title}</span>
                                        <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">{action.description}</span>
                                    </span>
                                    <span className="material-symbols-outlined text-gray-400 shrink-0">chevron_right</span>
                                </button>
                            ))}
                        </div>
                    </section>

                    <section className="rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 p-5 shadow-sm flex flex-col">
                        <div className="flex items-start gap-3">
                            <span className="material-symbols-outlined rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 p-2 text-[22px]">push_pin</span>
                            <div>
                                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Aulas fixas</h3>
                                <p className="text-sm text-amber-900/70 dark:text-amber-200/70 mt-0.5 leading-snug">
                                    Trave aulas em um dia e horário. O processamento mantém essas posições.
                                </p>
                            </div>
                        </div>

                        <div className="mt-5 rounded-xl bg-white/80 dark:bg-gray-900/50 border border-amber-100 dark:border-amber-900/40 px-4 py-4">
                            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 leading-none">{pinnedCount}</p>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-2">
                                {pinnedCount === 1 ? 'aula travada' : 'aulas travadas'}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => setIsFixedLessonsOpen(true)}
                            className="mt-auto w-full pt-5"
                        >
                            <span className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm min-h-12 px-4 transition-colors">
                                <span className="material-symbols-outlined text-[20px]">edit_calendar</span>
                                Configurar aulas fixas
                            </span>
                        </button>
                    </section>
                </div>

                <div className="lg:col-span-2 flex justify-center gap-4 pt-8 border-t border-gray-100 dark:border-gray-800">
                    <div className="flex gap-4 w-full max-w-lg">
                        <Button
                            onClick={onBack}
                            variant="soft"
                            size="lg"
                            className="flex-1"
                            leftIcon={<span className="material-symbols-outlined">arrow_back</span>}
                        >
                            Voltar
                        </Button>
                        <Button
                            onClick={onNext}
                            size="lg"
                            className="flex-1 shadow-xl"
                            rightIcon={<span className="material-symbols-outlined">bolt</span>}
                        >
                            Processar Horário
                        </Button>
                    </div>
                </div>
            </div>

            <DetailedGroupingManager
                isOpen={isDetailedManagerOpen}
                onClose={() => setIsDetailedManagerOpen(false)}
                data={data}
                setData={setData}
            />

            <TeacherGroupingManager
                isOpen={isTeacherManagerOpen}
                onClose={() => setIsTeacherManagerOpen(false)}
                data={data}
                setData={setData}
            />

            <GeneralGroupingManager
                isOpen={isGeneralManagerOpen}
                onClose={() => setIsGeneralManagerOpen(false)}
                data={data}
                setData={setData}
            />

            <FixedLessonsManager
                isOpen={isFixedLessonsOpen}
                onClose={() => setIsFixedLessonsOpen(false)}
                data={data}
                setData={setData}
                gridRows={gridRows}
            />
        </div>
    );
};
