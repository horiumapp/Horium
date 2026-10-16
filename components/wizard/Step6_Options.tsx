
import React from 'react';
import { WizardStepHeader } from './WizardStepHeader';
import { SetupData } from '../../types';
import { Button } from '../ui/Button';
import { DetailedGroupingManager } from './DetailedGroupingManager';
import { TeacherGroupingManager } from './TeacherGroupingManager';
import { GeneralGroupingManager } from './GeneralGroupingManager';
import { FixedLessonsManager } from './FixedLessonsManager';
import { useState } from 'react';

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

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <WizardStepHeader
                title="Opções"
                description="Configure os parâmetros de agrupamento e processamento do horário."
                icon="settings"
            />

            <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                    {/* Left Column: Agrupamentos */}
                    <div className="bg-[#b5cca6] p-6 rounded-2xl border-2 border-gray-300 shadow-sm space-y-4 h-full">
                        <div className="space-y-1">
                            <h3 className="text-lg font-bold text-gray-800">Agrupamentos</h3>
                            <p className="text-xs text-black font-medium leading-tight">
                                Os agrupamentos das aulas podem ser definidos em 3 opções abaixo da forma mais prioritária (DETALHADO) até a menos prioritária (GERAL)
                            </p>
                        </div>

                        <div className="space-y-3 pt-4">
                            {[
                                'Agrupamento DETALHADO',
                                'Agrupamento por Professor',
                                'Agrupamento Geral'
                            ].map((label, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => {
                                        if (label === 'Agrupamento DETALHADO') setIsDetailedManagerOpen(true);
                                        if (label === 'Agrupamento por Professor') setIsTeacherManagerOpen(true);
                                        if (label === 'Agrupamento Geral') setIsGeneralManagerOpen(true);
                                    }}
                                    className="w-full bg-[#f3f3f3] hover:bg-white p-3 rounded shadow-sm font-bold text-gray-700 text-center text-sm transition-all border border-gray-300"
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-[#e9c48b] p-6 rounded-2xl border-2 border-gray-300 shadow-sm">
                        <div className="space-y-1">
                            <h3 className="text-lg font-bold text-gray-800">Aulas fixas</h3>
                            <p className="text-xs text-black font-medium leading-tight">
                                Trave aulas em dias e horários específicos. O processamento respeita essas posições.
                            </p>
                        </div>
                        <div className="pt-4">
                            <button
                                onClick={() => setIsFixedLessonsOpen(true)}
                                className="w-full bg-[#f3f3f3] hover:bg-white p-3 rounded shadow-sm font-bold text-gray-700 text-center text-sm transition-all border border-gray-300"
                            >
                                Aulas Fixas
                            </button>
                        </div>
                    </div>
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
