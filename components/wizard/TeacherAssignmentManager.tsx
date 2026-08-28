
import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { SetupData, ClassAssignmentStatus } from '../../types';

interface TeacherAssignmentManagerProps {
    teacherId: string | null;
    onClose: () => void;
    data: SetupData;
    setData: React.Dispatch<React.SetStateAction<SetupData>>;
}

export const TeacherAssignmentManager: React.FC<TeacherAssignmentManagerProps> = ({ teacherId, onClose, data, setData }) => {
    const teacher = data.teachers.find(t => t.id === teacherId);
    const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);

    if (!teacher) return null;

    const teacherSubjects = data.subjects.filter(s => teacher.subjects.includes(s.id));
    const effectiveActiveSubjectId = activeSubjectId || (teacherSubjects.length > 0 ? teacherSubjects[0].id : null);
    const activeSubject = teacherSubjects.find(s => s.id === effectiveActiveSubjectId);
    const relevantClasses = data.classes
        .filter(c => c.subjects.includes(activeSubject?.id || ''))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

    // Find classes already taken by other teachers for the active subject
    const takenClasses: Record<string, string> = {}; // classId -> teacherName
    if (activeSubject) {
        data.teachers.forEach(t => {
            if (t.id !== teacherId && t.classAssignments?.[activeSubject.id]) {
                Object.entries(t.classAssignments[activeSubject.id]).forEach(([classId, status]) => {
                    if (status === 'OBRIGATORIAMENTE') {
                        takenClasses[classId] = t.name;
                    }
                });
            }
        });
    }

    const handleUpdateAssignment = (subjectId: string, classId: string, status: ClassAssignmentStatus) => {
        setData(prev => ({
            ...prev,
            teachers: prev.teachers.map(t => {
                if (t.id === teacherId) {
                    const currentAssignments = t.classAssignments || {};
                    const subjectAssignments = currentAssignments[subjectId] || {};
                    return {
                        ...t,
                        classAssignments: {
                            ...currentAssignments,
                            [subjectId]: {
                                ...subjectAssignments,
                                [classId]: status
                            }
                        }
                    };
                }
                return t;
            })
        }));
    };

    return (
        <Modal isOpen={!!teacherId} onClose={onClose} size="lg">
            <div className="bg-primary p-3 flex justify-between items-center text-white font-black uppercase tracking-tight">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base">help</span>
                    <h2 className="text-sm">ETAPA 5 - ATRIBUIÇÃO DE TURMAS: "{teacher.name}"</h2>
                </div>
                <button onClick={onClose} className="size-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all">
                    <span className="material-symbols-outlined text-sm">close</span>
                </button>
            </div>

            <div className="p-6 space-y-6">
                <div className="flex items-start gap-2">
                    <p className="text-[#36a5b5] text-base font-bold leading-tight">
                        Para cada matéria que este professor ministra, selecione opcionalmente as salas onde ele deve ministrar.
                    </p>
                    <span className="material-symbols-outlined text-[#36a5b5] text-sm shrink-0">help</span>
                </div>

                <div className="flex flex-wrap gap-2">
                    {teacherSubjects.map(s => (
                        <button
                            key={s.id}
                            onClick={() => setActiveSubjectId(s.id)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase transition-all shadow-sm ${effectiveActiveSubjectId === s.id ? 'bg-[#136dec] text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}
                        >
                            {s.name}
                        </button>
                    ))}
                </div>

                {activeSubject && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-[1fr_2fr] gap-4 px-2">
                            <span className="text-[10px] font-black uppercase text-[#000080] dark:text-blue-400">Sala / Turma</span>
                            <span className="text-[10px] font-black uppercase text-[#000080] dark:text-blue-400">Restrição de Sala Obrigatória</span>
                        </div>

                        <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar space-y-2">
                            {relevantClasses.length === 0 ? (
                                <div className="p-10 text-center text-gray-400 text-sm italic bg-gray-50 dark:bg-gray-800 rounded-xl border border-dashed border-gray-200">
                                    Nenhuma turma cadastrada com esta disciplina.
                                </div>
                            ) : (
                                relevantClasses.map(c => {
                                    const currentStatus = teacher.classAssignments?.[activeSubject.id]?.[c.id] || 'NÃO';
                                    const otherTeacherName = takenClasses[c.id];
                                    const isDisabled = !!otherTeacherName;

                                    return (
                                        <div key={c.id} className="grid grid-cols-[1fr_2fr] gap-4 items-center">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{c.name}</span>
                                                {isDisabled && (
                                                    <span className="text-[9px] font-black uppercase text-red-500 leading-tight">
                                                        Já atribuído ao Prof. {otherTeacherName}
                                                    </span>
                                                )}
                                            </div>
                                            <select
                                                value={isDisabled ? 'NÃO' : currentStatus}
                                                disabled={isDisabled}
                                                onChange={(e) => handleUpdateAssignment(activeSubject.id, c.id, e.target.value as ClassAssignmentStatus)}
                                                className={`w-full h-10 bg-white dark:bg-gray-900 border border-gray-400 dark:border-gray-600 rounded px-3 text-xs font-bold outline-none focus:ring-1 focus:ring-[#136dec] ${isDisabled ? 'opacity-40 cursor-not-allowed bg-gray-100 text-gray-500' : 'text-[#000080] dark:text-blue-300'}`}
                                            >
                                                <option value="PODERÁ">PODERÁ ministrar {activeSubject.name} nesta sala / turma</option>
                                                <option value="OBRIGATORIAMENTE">Ministrará OBRIGATORIAMENTE {activeSubject.name} nesta sala / turma</option>
                                                <option value="NÃO">NÃO ministrará {activeSubject.name} nesta sala / turma</option>
                                            </select>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};
