
import React from 'react';
import { WizardStepHeader } from './WizardStepHeader';
import { SetupData } from '../../types';
import { Button } from '../ui/Button';
import { DetailedGroupingManager } from './DetailedGroupingManager';
import { TeacherGroupingManager } from './TeacherGroupingManager';
import { SubjectGroupingManager } from './SubjectGroupingManager';
import { GeneralGroupingManager } from './GeneralGroupingManager';
import { DidacticGroupingManager } from './DidacticGroupingManager';
import { TeacherSegmentationManager } from './TeacherSegmentationManager';
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
    const [isSubjectManagerOpen, setIsSubjectManagerOpen] = useState(false);
    const [isGeneralManagerOpen, setIsGeneralManagerOpen] = useState(false);
    const [isDidacticManagerOpen, setIsDidacticManagerOpen] = useState(false);
    const [isSegmentationManagerOpen, setIsSegmentationManagerOpen] = useState(false);
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
                                Os agrupamentos das aulas podem ser definidos em 4 opções abaixo da forma mais prioritária (DETALHADO) até a menos prioritária (GERAL)
                            </p>
                        </div>

                        <div className="space-y-3 pt-4">
                            {[
                                'Agrupamento DETALHADO',
                                'Agrupamento por Professor',
                                'Agrupamento por Disciplina ou Tema de Reunião',
                                'Agrupamento Geral'
                            ].map((label, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => {
                                        if (label === 'Agrupamento DETALHADO') setIsDetailedManagerOpen(true);
                                        if (label === 'Agrupamento por Professor') setIsTeacherManagerOpen(true);
                                        if (label === 'Agrupamento por Disciplina ou Tema de Reunião') setIsSubjectManagerOpen(true);
                                        if (label === 'Agrupamento Geral') setIsGeneralManagerOpen(true);
                                    }}
                                    className="w-full bg-[#f3f3f3] hover:bg-white p-3 rounded shadow-sm font-bold text-gray-700 text-center text-sm transition-all border border-gray-300"
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Right Column: Rule Stacks */}
                    <div className="flex flex-col gap-4">
                        {/* Top Green Box */}
                        <div className="bg-[#c5d8c1] p-6 rounded-2xl border-2 border-gray-300 shadow-sm flex flex-col gap-4">
                            <button
                                onClick={() => setIsDidacticManagerOpen(true)}
                                className="w-full bg-[#f3f3f3] hover:bg-white p-3 rounded shadow-sm font-bold text-gray-700 text-center text-sm transition-all border border-gray-300"
                            >
                                Agrupamento didático
                            </button>
                            <button
                                onClick={() => setIsSegmentationManagerOpen(true)}
                                className="w-full bg-[#f3f3f3] hover:bg-white p-3 rounded shadow-sm font-bold text-gray-700 text-center text-sm transition-all border border-gray-300"
                            >
                                Segmentação de Professor
                            </button>
                        </div>

                        {/* Middle Orange Box */}
                        <div className="bg-[#e9c48b] p-6 rounded-2xl border-2 border-gray-300 shadow-sm">
                            <button
                                onClick={() => setIsFixedLessonsOpen(true)}
                                className="w-full bg-[#f3f3f3] hover:bg-white p-3 rounded shadow-sm font-bold text-gray-700 text-center text-sm transition-all border border-gray-300"
                            >
                                Aulas Fixas
                            </button>
                        </div>

                        {/* Bottom Blue Box */}
                        <div className="bg-[#8cc3f5] p-6 rounded-2xl border-2 border-gray-300 shadow-sm">
                            <button className="w-full bg-[#f3f3f3] hover:bg-white p-3 rounded shadow-sm font-bold text-gray-700 text-center text-sm transition-all border border-gray-300">
                                Parâmetros de Processamento
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

            <SubjectGroupingManager
                isOpen={isSubjectManagerOpen}
                onClose={() => setIsSubjectManagerOpen(false)}
                data={data}
                setData={setData}
            />

            <GeneralGroupingManager
                isOpen={isGeneralManagerOpen}
                onClose={() => setIsGeneralManagerOpen(false)}
                data={data}
                setData={setData}
            />

            <DidacticGroupingManager
                isOpen={isDidacticManagerOpen}
                onClose={() => setIsDidacticManagerOpen(false)}
            />

            <TeacherSegmentationManager
                isOpen={isSegmentationManagerOpen}
                onClose={() => setIsSegmentationManagerOpen(false)}
                data={data}
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
