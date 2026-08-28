
import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { SetupData, AvailabilityStatus } from '../../types';
import { GROUPING_OPTIONS_2_LESSONS, GROUPING_OPTIONS_3_LESSONS, GROUPING_OPTIONS_4_LESSONS, GROUPING_OPTIONS_5_LESSONS, GROUPING_OPTIONS_10_LESSONS } from '../../constants';

interface ClassSubjectsManagerProps {
    classId: string | null;
    onClose: () => void;
    data: SetupData;
    setData: React.Dispatch<React.SetStateAction<SetupData>>;
    activeDays: string[];
    gridRows: any[];
}

export const ClassSubjectsManager: React.FC<ClassSubjectsManagerProps> = ({
    classId,
    onClose,
    data,
    setData,
    activeDays,
    gridRows
}) => {
    const selectedClass = data.classes.find(c => c.id === classId);
    const [isAddSubjectOpen, setIsAddSubjectOpen] = useState(false);
    const [showSpecificTimeOptions, setShowSpecificTimeOptions] = useState(false);
    const [isSaved, setIsSaved] = useState(false);

    if (!selectedClass) return null;

    const handleSave = () => {
        // Update the main data to trigger auto-save (and manual confirmation)
        setData(prev => ({
            ...prev,
            classes: prev.classes.map(c => c.id === selectedClass.id ? selectedClass : c)
        }));

        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
    };

    const handleUpdateClass = (field: string, value: any) => {
        setData(prev => ({
            ...prev,
            classes: prev.classes.map(c => c.id === classId ? { ...c, [field]: value } : c)
        }));
    };

    const toggleSubjectInClass = (subjectId: string) => {
        if (selectedClass.subjects.includes(subjectId)) {
            // Remove
            const newSubjects = selectedClass.subjects.filter(id => id !== subjectId);
            const newLessons = { ...selectedClass.lessonsPerSubject };
            delete newLessons[subjectId];

            setData(prev => ({
                ...prev,
                classes: prev.classes.map(c => c.id === classId ? { ...c, subjects: newSubjects, lessonsPerSubject: newLessons } : c)
            }));
        } else {
            // Add
            const newSubjects = [...selectedClass.subjects, subjectId];
            const newLessons = { ...selectedClass.lessonsPerSubject, [subjectId]: 2 }; // Default 2 lessons

            setData(prev => ({
                ...prev,
                classes: prev.classes.map(c => c.id === classId ? { ...c, subjects: newSubjects, lessonsPerSubject: newLessons } : c)
            }));
        }
        setIsAddSubjectOpen(false);
    };

    const selectAllSubjects = () => {
        const allSubjectIds = data.subjects.map(s => s.id);
        const newLessons: Record<string, number> = {};

        allSubjectIds.forEach(id => {
            newLessons[id] = selectedClass.lessonsPerSubject[id] || 2; // Keep existing or default to 2
        });

        setData(prev => ({
            ...prev,
            classes: prev.classes.map(c =>
                c.id === classId
                    ? { ...c, subjects: allSubjectIds, lessonsPerSubject: newLessons }
                    : c
            )
        }));
        setIsAddSubjectOpen(false);
    };

    const updateLessonCount = (subjectId: string, count: number) => {
        setData(prev => ({
            ...prev,
            classes: prev.classes.map(c =>
                c.id === classId
                    ? { ...c, lessonsPerSubject: { ...c.lessonsPerSubject, [subjectId]: count } }
                    : c
            )
        }));
    };

    const handleUpdateSpecificTimeSubject = (subjectId: string, updates: { type?: string; time?: string }) => {
        setData(prev => ({
            ...prev,
            classes: prev.classes.map(c =>
                c.id === classId
                    ? {
                        ...c,
                        specificTimeSubjects: {
                            ...(c.specificTimeSubjects || {}),
                            [subjectId]: {
                                ...(c.specificTimeSubjects?.[subjectId] || { type: 'any' }),
                                ...updates
                            }
                        }
                    }
                    : c
            )
        }));
    };





    // Calculate totals
    const lessonsList = Object.values(selectedClass.lessonsPerSubject || {}) as number[];
    const totalAllocated = lessonsList.reduce((a, b) => a + (b || 0), 0);
    const totalSlots = activeDays.length * gridRows.filter((r: any) => r.type === 'AULA').length;

    // Helper to find teacher for a subject (naive search)
    const getTeacherForSubject = (subjectId: string) => {
        // In Step 4 we might not have assignments yet, but let's check if any teacher has this class+subject assigned
        // Actually, SetupData structure puts assignments inside Teacher object.
        // We iterate teachers to find if any has assignment for this class & subject
        const teacher = data.teachers.find(t =>
            t.classAssignments?.[subjectId]?.[selectedClass.id] === 'OBRIGATORIAMENTE' ||
            t.classAssignments?.[subjectId]?.[selectedClass.id] === 'PODERÁ'
        );
        return teacher;
    };

    return (
        <Modal isOpen={!!classId} onClose={onClose} size="xl" title="Configuração de Matérias">
            <div className="flex flex-col lg:flex-row h-[650px] overflow-hidden bg-white">
                {/* Left Column: Info Summary */}
                <div className="w-full lg:w-[28%] p-5 flex flex-col gap-5 border-r border-gray-100 bg-gray-50/30">
                    <div className="space-y-4 pt-1">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-[#1a3b50]/40 block px-0.5">Identificação</label>
                            <input
                                type="text"
                                className="w-full bg-transparent border-b border-gray-200 text-2xl font-black text-[#1a3b50] placeholder:text-gray-300 focus:outline-none focus:border-primary transition-all pb-1.5"
                                value={selectedClass.name}
                                onChange={(e) => handleUpdateClass('name', e.target.value)}
                            />
                        </div>

                        <div className="flex flex-col gap-1 px-0.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-[#1a3b50]/40">Status da Carga Horária</label>
                            <div className="flex items-baseline gap-1.5 mt-1">
                                <span className={`text-3xl font-black leading-none ${totalAllocated > totalSlots ? 'text-red-500' : 'text-amber-500'}`}>{totalAllocated}</span>
                                <span className="text-gray-400 font-bold text-sm">/ {totalSlots} aulas</span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1.5 ring-1 ring-black/5">
                                <div
                                    className={`h-full transition-all duration-700 ease-out ${totalAllocated === totalSlots ? 'bg-green-500' : totalAllocated > totalSlots ? 'bg-red-500' : 'bg-primary'}`}
                                    style={{ width: `${Math.min(100, (totalAllocated / totalSlots) * 100)}%` }}
                                ></div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between px-0.5 py-2 border-y border-gray-100/50 mt-4">
                            <label className="text-[10px] font-black uppercase tracking-widest text-[#1a3b50]/40 text-xs">Turno:</label>
                            <span className="text-[11px] font-black text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/10">{data.institution.shift}</span>
                        </div>
                    </div>

                    <div className="mt-auto p-4 bg-primary/5 rounded-xl border border-primary/10">
                        <div className="flex gap-2">
                            <span className="material-symbols-outlined text-primary text-lg">lightbulb</span>
                            <p className="text-[10px] text-primary/70 font-bold leading-tight uppercase tracking-tighter">
                                Vincule professores no painel ao lado para completar esta grade.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Right Column: Dense Subject Table */}
                <div className="w-full lg:w-[72%] p-5 bg-white flex flex-col gap-4">
                    <div className="flex items-center justify-between pb-2 border-b border-gray-50">
                        <div className="flex flex-col">
                            <h3 className="text-xs font-black text-[#1a3b50] uppercase tracking-widest flex items-center gap-2">
                                Matérias da Turma
                                <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded text-[9px] font-black">{selectedClass.subjects.length}</span>
                            </h3>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => setIsAddSubjectOpen(!isAddSubjectOpen)}
                                className={`flex items-center gap-1.5 h-[32px] px-3 text-[10px] font-black uppercase rounded-lg transition-all border-2 ${isAddSubjectOpen ? 'bg-primary text-white border-primary' : 'bg-white border-primary/10 text-primary hover:border-primary/30'}`}
                            >
                                <span className="material-symbols-outlined text-[16px]">{isAddSubjectOpen ? 'close' : 'add'}</span>
                                {isAddSubjectOpen ? 'CONCLUIR' : 'ADICIONAR'}
                            </button>

                            <button
                                onClick={handleSave}
                                className={`flex items-center gap-1.5 px-4 h-[32px] text-[10px] font-black uppercase tracking-widest rounded-lg shadow-sm transition-all active:scale-95 ${isSaved ? 'bg-green-500 text-white' : 'bg-[#1a3b50] text-white hover:bg-black'}`}
                            >
                                <span className="material-symbols-outlined text-[16px]">{isSaved ? 'check' : 'save'}</span>
                                {isSaved ? 'SALVO' : 'SALVAR'}
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 relative">
                        {isAddSubjectOpen && (
                            <div className="bg-gray-50 p-4 rounded-xl border-2 border-primary/5 mb-4 animate-in fade-in slide-in-from-top-2 duration-200 sticky top-0 z-20 shadow-xl shadow-white/80">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Matérias Disponíveis</span>
                                    <button onClick={selectAllSubjects} className="text-[9px] font-black text-primary uppercase hover:bg-primary/5 px-2 py-1 rounded">Vincular Todas</button>
                                </div>
                                <div className="grid grid-cols-3 gap-1.5">
                                    {data.subjects.sort((a, b) => a.name.localeCompare(b.name)).map(s => (
                                        <button
                                            key={s.id}
                                            onClick={() => toggleSubjectInClass(s.id)}
                                            className={`p-1.5 rounded-md text-left text-[10px] font-bold border transition-all flex items-center gap-1.5 truncate ${selectedClass.subjects.includes(s.id) ? 'bg-primary text-white border-primary' : 'bg-white border-gray-100 hover:border-primary/30 text-gray-500'}`}
                                        >
                                            <div className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: selectedClass.subjects.includes(s.id) ? '#fff' : s.color }}></div>
                                            <span className="truncate">{s.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <table className="w-full text-left border-separate border-spacing-y-1">
                            <thead>
                                <tr className="text-[9px] font-black text-[#1a3b50]/30 uppercase tracking-[0.15em]">
                                    <th className="px-3 py-1">Matéria / Disciplina</th>
                                    <th className="px-3 py-1 text-center w-32">Aulas</th>
                                    <th className="px-3 py-1 text-right">Professor Responsável</th>
                                    <th className="w-8"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {[...selectedClass.subjects]
                                    .sort((a, b) => {
                                        const subA = data.subjects.find(s => s.id === a)?.name || '';
                                        const subB = data.subjects.find(s => s.id === b)?.name || '';
                                        return subA.localeCompare(subB);
                                    })
                                    .map((subjectId, idx) => {
                                        const subject = data.subjects.find(s => s.id === subjectId);
                                        if (!subject) return null;
                                        const lessons = selectedClass.lessonsPerSubject[subjectId] || 0;
                                        const assignedTeacher = getTeacherForSubject(subjectId);

                                        return (
                                            <tr key={subjectId} className="group hover:bg-primary/[0.03] transition-colors rounded-lg overflow-hidden border border-transparent">
                                                <td className="px-3 py-2 bg-gray-50/50 group-hover:bg-transparent rounded-l-lg border-y border-l border-transparent group-hover:border-primary/5">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="size-2 rounded-full shadow-sm ring-1 ring-black/5" style={{ backgroundColor: subject.color }}></div>
                                                        <span className="text-[11px] font-black text-[#1a3b50] leading-none">{subject.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2 bg-gray-50/50 group-hover:bg-transparent border-y border-transparent group-hover:border-primary/5">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button
                                                            onClick={() => updateLessonCount(subjectId, Math.max(0, lessons - 1))}
                                                            className="size-6 bg-white rounded flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all border border-gray-100 group-hover:border-primary/10"
                                                        >
                                                            <span className="material-symbols-outlined text-[14px]">remove</span>
                                                        </button>
                                                        <span className="w-6 text-center text-[12px] font-black text-[#1a3b50]">{lessons}</span>
                                                        <button
                                                            onClick={() => updateLessonCount(subjectId, lessons + 1)}
                                                            className="size-6 bg-white rounded flex items-center justify-center text-gray-400 hover:text-green-600 hover:bg-green-50 transition-all border border-gray-100 group-hover:border-primary/10"
                                                        >
                                                            <span className="material-symbols-outlined text-[14px]">add</span>
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2 bg-gray-50/50 group-hover:bg-transparent border-y border-transparent group-hover:border-primary/5 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <span className={`text-[10px] font-black uppercase tracking-tight ${assignedTeacher ? 'text-primary' : 'text-gray-300'}`}>
                                                            {assignedTeacher ? assignedTeacher.name : 'Aguardando Professor'}
                                                        </span>
                                                        {assignedTeacher && <span className="material-symbols-outlined text-primary text-[14px]">verified</span>}
                                                    </div>
                                                </td>
                                                <td className="px-1 py-1 bg-gray-50/50 group-hover:bg-transparent rounded-r-lg border-y border-r border-transparent group-hover:border-primary/5 text-center">
                                                    <button
                                                        onClick={() => toggleSubjectInClass(subjectId)}
                                                        className="size-6 text-gray-200 hover:text-red-500 hover:bg-red-50 rounded transition-all opacity-0 group-hover:opacity-100"
                                                        title="Remover Disciplina"
                                                    >
                                                        <span className="material-symbols-outlined text-[16px]">delete</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                            </tbody>
                        </table>

                        {selectedClass.subjects.length === 0 && (
                            <div className="text-center py-24 flex flex-col items-center gap-3">
                                <div className="size-16 bg-gray-50 rounded-full flex items-center justify-center mb-1">
                                    <span className="material-symbols-outlined text-gray-200 text-3xl">post_add</span>
                                </div>
                                <h4 className="text-xs font-black text-[#1a3b50] uppercase tracking-widest">A grade está vazia</h4>
                                <p className="text-[10px] text-gray-400 font-bold max-w-[200px] leading-relaxed">Clique no botão superior para vincular as disciplinas desta turma.</p>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-gray-50">
                        <button
                            onClick={() => setShowSpecificTimeOptions(!showSpecificTimeOptions)}
                            className={`flex items-center gap-2 h-[30px] px-4 rounded-lg text-[9px] font-black uppercase transition-all ring-1 ring-inset ${showSpecificTimeOptions
                                ? 'bg-amber-400 text-white ring-amber-500'
                                : 'bg-white text-amber-600 ring-amber-200 hover:bg-amber-50'
                                }`}
                        >
                            <span className="material-symbols-outlined text-[14px]">event_busy</span>
                            Restrições de Horários Específicos
                        </button>

                        {showSpecificTimeOptions && (
                            <div className="px-3 bg-amber-50 rounded-lg flex items-center gap-2 text-[9px] font-bold text-amber-700 animate-in fade-in slide-in-from-left-2 transition-all">
                                <span className="material-symbols-outlined text-[14px]">info</span>
                                Clique nos itens da tabela para definir preferências
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
};
