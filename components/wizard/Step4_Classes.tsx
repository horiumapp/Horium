
import React, { useState } from 'react';
import { WizardStepHeader } from './WizardStepHeader';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { SetupData, ClassRoom } from '../../types';
import { ClassSubjectsManager } from './ClassSubjectsManager';

interface Step4ClassesProps {
    data: SetupData;
    setData: React.Dispatch<React.SetStateAction<SetupData>>;
    activeDays: string[];
    gridRows: any[];
    onNext: () => void;
    onBack: () => void;
}


export const Step4Classes: React.FC<Step4ClassesProps> = ({ data, setData, activeDays, gridRows, onNext, onBack }) => {
    const handleNext = () => {
        if (data.classes.length === 0) {
            alert('Cadastre pelo menos uma turma para a sua escola.');
            return;
        }
        onNext();
    };
    const [newClass, setNewClass] = useState<Partial<ClassRoom>>({ name: '', room: '', subjects: [], lessonsPerSubject: {} });
    const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

    const handleAddClass = () => {
        if (!newClass.name) return;
        const classroom: ClassRoom = {
            id: crypto.randomUUID(),
            ...newClass as ClassRoom,
            students: 0,
            lessonsPerSubject: {},
            shift: 'Manhã',
            timeConstraints: {}
        };
        setData(prev => ({ ...prev, classes: [...prev.classes, classroom] }));
        setNewClass({ name: '', room: '', subjects: [], lessonsPerSubject: {} });
    };

    const handleDuplicateClass = (originalClass: ClassRoom) => {
        const duplicatedClass: ClassRoom = {
            ...originalClass,
            id: crypto.randomUUID(),
            name: `${originalClass.name} (Cópia)`,
            subjects: [...originalClass.subjects],
            lessonsPerSubject: { ...originalClass.lessonsPerSubject }
        };
        setData(prev => ({ ...prev, classes: [...prev.classes, duplicatedClass] }));
    };

    const handleDeleteClass = (id: string) => {
        setData(prev => {
            const updatedTeachers = prev.teachers.map(t => {
                if (!t.classAssignments) return t;
                const newAssignments: Record<string, Record<string, string>> = {};
                Object.entries(t.classAssignments).forEach(([subjectId, classes]) => {
                    const filteredClasses = { ...(classes as Record<string, string>) };
                    delete filteredClasses[id];
                    newAssignments[subjectId] = filteredClasses;
                });
                return { ...t, classAssignments: newAssignments };
            });

            const updatedFixed = (prev.fixedLessons || []).filter(fl => fl.classId !== id);

            return {
                ...prev,
                classes: prev.classes.filter(cl => cl.id !== id),
                teachers: updatedTeachers,
                fixedLessons: updatedFixed
            };
        });
    };

    // Calculate total slots once
    const totalSlots = activeDays.length * gridRows.filter(r => r.type === 'AULA').length;

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <WizardStepHeader
                title="Turmas"
                description="Quais turmas precisam de horário?"
                icon="groups"
                count={{ label: 'Turmas', value: data.classes.length }}
            />
            <div className="p-6 space-y-6">
                <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700">
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-4 items-end">
                        <Input
                            label="Identificação da Turma"
                            placeholder="Ex: 1º Ano A"
                            value={newClass.name}
                            onChange={e => setNewClass({ ...newClass, name: e.target.value })}
                        />
                        <Button
                            onClick={handleAddClass}
                            size="md"
                            className="w-full shadow-md h-[44px]"
                        >
                            Adicionar Turma
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {[...data.classes].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })).map(c => {
                        const totalAllocated = Number(Object.values(c.lessonsPerSubject || {}).reduce((acc: number, val: any) => acc + (Number(val) || 0), 0));
                        const isComplete = totalAllocated === totalSlots;
                        const isOverloaded = totalAllocated > totalSlots;

                        return (
                            <div
                                key={c.id}
                                onClick={() => setSelectedClassId(c.id)}
                                className={`p-5 bg-white dark:bg-gray-900 border-2 rounded-2xl relative group hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer flex flex-col items-center text-center ${isComplete
                                    ? 'border-green-500/20 bg-green-50/5'
                                    : isOverloaded
                                        ? 'border-red-500/20 bg-red-50/5'
                                        : totalAllocated > 0
                                            ? 'border-primary/20'
                                            : 'border-gray-100 dark:border-gray-800'
                                    }`}
                            >
                                <h4 className="font-black text-2xl uppercase text-primary leading-tight truncate w-full mb-1">{c.name}</h4>

                                <div className="mt-2 space-y-2 w-full">
                                    <div className="flex flex-col items-center">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Progresso da Grade</p>
                                        <div className={`text-lg font-black mt-0.5 ${isComplete
                                            ? 'text-green-500'
                                            : isOverloaded
                                                ? 'text-red-500'
                                                : totalAllocated > 0
                                                    ? 'text-amber-500'
                                                    : 'text-gray-300'
                                            }`}>
                                            {totalAllocated} <span className="text-gray-300 text-xs font-normal">/</span> {totalSlots}
                                        </div>
                                    </div>

                                    {/* Progress mini-bar */}
                                    <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-500 ${isComplete ? 'bg-green-500' : isOverloaded ? 'bg-red-500' : 'bg-primary'}`}
                                            style={{ width: `${Math.min(100, (totalAllocated / totalSlots) * 100)}%` }}
                                        ></div>
                                    </div>

                                    <div className={`inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-xs font-black uppercase tracking-tight shadow-sm ${totalAllocated > 0
                                        ? 'bg-blue-50 text-blue-600 border border-blue-100'
                                        : 'bg-gray-50 text-gray-400 border border-gray-100'
                                        }`}>
                                        <span className="material-symbols-outlined text-sm">menu_book</span>
                                        {c.subjects.length} Disciplinas
                                    </div>
                                </div>

                                <div className="absolute top-2 right-2 flex gap-1">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDuplicateClass(c); }}
                                        title="Duplicar Turma"
                                        className="text-primary opacity-0 group-hover:opacity-100 transition-all p-1 bg-primary/5 dark:bg-primary/20 rounded-lg hover:bg-primary/20"
                                    >
                                        <span className="material-symbols-outlined text-base">content_copy</span>
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteClass(c.id); }}
                                        title="Excluir Turma"
                                        className="text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100"
                                    >
                                        <span className="material-symbols-outlined text-base">delete</span>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="flex justify-center gap-4">
                    <div className="flex gap-4 w-full max-w-lg">
                        <Button
                            onClick={onBack}
                            variant="soft"
                            size="lg"
                            className="flex-1"
                        >
                            Voltar
                        </Button>
                        <Button
                            onClick={handleNext}
                            size="lg"
                            className="flex-1 shadow-xl"
                        >
                            Próxima Etapa
                        </Button>
                    </div>
                </div>
            </div>

            <ClassSubjectsManager
                classId={selectedClassId}
                onClose={() => setSelectedClassId(null)}
                data={data}
                setData={setData}
                activeDays={activeDays}
                gridRows={gridRows}
            />
        </div>
    );
};
