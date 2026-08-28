
import React, { useState } from 'react';
import { WizardStepHeader } from './WizardStepHeader';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { SetupData, Teacher } from '../../types';
import { TeacherAvailabilityManager } from './TeacherAvailabilityManager';
import { TeacherAssignmentManager } from './TeacherAssignmentManager';

interface Step5TeachersProps {
    data: SetupData;
    setData: React.Dispatch<React.SetStateAction<SetupData>>;
    activeDays: string[];
    gridRows: any[];
    onComplete: () => void;
    onBack: () => void;
}

export const Step5Teachers: React.FC<Step5TeachersProps> = ({ data, setData, activeDays, gridRows, onComplete, onBack }) => {
    const handleComplete = () => {
        if (data.teachers.length === 0) {
            alert('Cadastre pelo menos um professor para a sua instituição.');
            return;
        }
        onComplete();
    };
    const [newTeacher, setNewTeacher] = useState<Partial<Teacher>>({ name: '', department: 'Geral', subjects: [], shifts: ['Manhã'] });
    const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);
    const [availabilityTeacherId, setAvailabilityTeacherId] = useState<string | null>(null);
    const [assignmentTeacherId, setAssignmentTeacherId] = useState<string | null>(null);

    const getInitials = (name: string) => {
        if (!name) return '??';
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.slice(0, 2).toUpperCase();
    };

    const handleAddTeacher = () => {
        if (!newTeacher.name) return;

        if (editingTeacherId) {
            setData(prev => ({
                ...prev,
                teachers: prev.teachers.map(t => t.id === editingTeacherId ? { ...t, ...newTeacher as Teacher } : t)
            }));
            setEditingTeacherId(null);
        } else {
            const teacher: Teacher = { id: crypto.randomUUID(), ...newTeacher as Teacher, availability: {}, classAssignments: {} };
            setData(prev => ({ ...prev, teachers: [...prev.teachers, teacher] }));
        }

        setNewTeacher({ name: '', department: 'Geral', subjects: [], shifts: ['Manhã'] });
    };

    const handleEditTeacher = (teacher: Teacher) => {
        setEditingTeacherId(teacher.id);
        setNewTeacher({
            name: teacher.name,
            department: teacher.department,
            subjects: teacher.subjects || [],
            shifts: teacher.shifts || ['Manhã']
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelEditTeacher = () => {
        setEditingTeacherId(null);
        setNewTeacher({ name: '', department: 'Geral', subjects: [], shifts: ['Manhã'] });
    };

    const handleDeleteTeacher = (id: string) => {
        setData(prev => ({
            ...prev,
            teachers: prev.teachers.filter(prof => prof.id !== id),
            fixedLessons: (prev.fixedLessons || []).filter(fl => fl.teacherId !== id)
        }));
    };

    const toggleSubjectInTeacher = (subjectId: string) => {
        const currentSubjects = newTeacher.subjects || [];
        const newSubjects = currentSubjects.includes(subjectId)
            ? currentSubjects.filter(id => id !== subjectId)
            : [...currentSubjects, subjectId];
        setNewTeacher({ ...newTeacher, subjects: newSubjects });
    };


    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 relative">
            <WizardStepHeader
                title="Professores"
                description="Cadastre o corpo docente e suas especialidades."
                icon="person"
                count={{ label: 'Professores', value: data.teachers.length }}
            />
            <div className="p-6 space-y-6">
                <div className={`p-6 rounded-2xl border transition-all space-y-6 ${editingTeacherId ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200' : 'bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700'}`}>
                    {editingTeacherId && (
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-black uppercase text-amber-600 flex items-center gap-2">
                                <span className="material-symbols-outlined text-base">edit</span>
                                Editando Professor: {data.teachers.find(t => t.id === editingTeacherId)?.name}
                            </span>
                            <button onClick={cancelEditTeacher} className="text-[10px] font-black uppercase text-amber-700 hover:underline">Cancelar Edição</button>
                        </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="Nome do Professor"
                            placeholder="Nome Completo"
                            value={newTeacher.name}
                            onChange={e => setNewTeacher({ ...newTeacher, name: e.target.value })}
                        />
                        <Select
                            label="Departamento / Área"
                            value={newTeacher.department}
                            onChange={e => setNewTeacher({ ...newTeacher, department: e.target.value })}
                            options={[
                                { value: 'Exatas', label: 'Exatas' },
                                { value: 'Humanas', label: 'Humanas' },
                                { value: 'Linguagens', label: 'Linguagens' },
                                { value: 'Biológicas', label: 'Biológicas' },
                                { value: 'Geral', label: 'Geral' }
                            ]}
                        />
                    </div>

                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase text-gray-400">Disciplinas que este professor ministra</label>
                        <div className="flex flex-wrap gap-2">
                            {[...data.subjects].sort((a, b) => a.name.localeCompare(b.name)).map(s => {
                                const isSelected = newTeacher.subjects?.includes(s.id);
                                return (
                                    <button
                                        key={s.id}
                                        onClick={() => toggleSubjectInTeacher(s.id)}
                                        className={`px-3 py-1.5 rounded-lg border-2 text-[10px] font-black uppercase transition-all flex items-center gap-2 ${isSelected ? 'border-primary bg-primary/5 text-primary shadow-sm' : 'border-gray-100 dark:border-gray-800 text-gray-400 hover:border-gray-200'}`}
                                    >
                                        <div className="size-2 rounded-full" style={{ backgroundColor: s.color }}></div>
                                        {s.name}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <Button
                        onClick={handleAddTeacher}
                        variant={editingTeacherId ? 'secondary' : 'primary'}
                        className={`w-full ${editingTeacherId ? 'bg-amber-500 text-white hover:bg-amber-600 border-none' : ''}`}
                        size="md"
                    >
                        {editingTeacherId ? 'Salvar Alterações' : 'Cadastrar Professor'}
                    </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {data.teachers.map(t => (
                        <div
                            key={t.id}
                            onClick={() => handleEditTeacher(t)}
                            className={`p-4 bg-white dark:bg-gray-800 border-2 rounded-2xl flex flex-col gap-4 group hover:shadow-md transition-all cursor-pointer ${editingTeacherId === t.id ? 'border-amber-400 ring-2 ring-amber-100' : 'border-gray-100 dark:border-gray-700'}`}
                        >
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="size-12 bg-primary/10 rounded-full flex items-center justify-center text-primary font-black uppercase text-base tracking-tighter border-2 border-primary/20 shrink-0">
                                        {getInitials(t.name)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-black text-xs uppercase leading-tight line-clamp-2">{t.name}</h4>
                                        <span className="text-[9px] font-bold uppercase text-gray-400 tracking-widest">{t.department}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 p-1 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setAssignmentTeacherId(t.id); }}
                                        title="Atribuição de Turmas"
                                        className="flex-1 text-[#136dec] flex items-center justify-center py-1.5 hover:bg-[#136dec]/10 rounded-lg transition-all"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">school</span>
                                    </button>
                                    <div className="w-px h-4 bg-gray-200 dark:bg-gray-700"></div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setAvailabilityTeacherId(t.id); }}
                                        title="Disponibilidade"
                                        className="flex-1 text-[#36a5b5] flex items-center justify-center py-1.5 hover:bg-[#36a5b5]/10 rounded-lg transition-all"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">calendar_month</span>
                                    </button>
                                    <div className="w-px h-4 bg-gray-200 dark:bg-gray-700"></div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleEditTeacher(t); }}
                                        title="Editar"
                                        className="flex-1 text-primary flex items-center justify-center py-1.5 hover:bg-primary/10 rounded-lg transition-all"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">edit</span>
                                    </button>
                                    <div className="w-px h-4 bg-gray-200 dark:bg-gray-700"></div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteTeacher(t.id); }}
                                        title="Excluir"
                                        className="flex-1 text-red-400 flex items-center justify-center py-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">delete</span>
                                    </button>
                                </div>
                            </div>

                            {t.subjects && t.subjects.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1 pt-3 border-t border-gray-50 dark:border-gray-700/50">
                                    <div className="flex flex-wrap gap-1 flex-1">
                                        {t.subjects.map(subId => {
                                            const sub = data.subjects.find(s => s.id === subId);
                                            return sub ? (
                                                <span key={subId} className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase text-white shadow-sm" style={{ backgroundColor: sub.color }}>
                                                    {sub.shortName}
                                                </span>
                                            ) : null;
                                        })}
                                    </div>
                                    {(() => {
                                        let totalLessons = 0;
                                        if (t.classAssignments) {
                                            Object.entries(t.classAssignments).forEach(([subId, classes]) => {
                                                Object.entries(classes).forEach(([classId, status]) => {
                                                    if (status === 'OBRIGATORIAMENTE') {
                                                        const classroom = data.classes.find(c => c.id === classId);
                                                        const lessons = classroom?.lessonsPerSubject?.[subId] || 0;
                                                        totalLessons += lessons;
                                                    }
                                                });
                                            });
                                        }
                                        return totalLessons > 0 ? (
                                            <div className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full text-[9px] font-black text-gray-500 dark:text-gray-400">
                                                <span className="material-symbols-outlined text-[12px]">schedule</span>
                                                {totalLessons} AULAS
                                            </div>
                                        ) : null;
                                    })()}
                                </div>
                            )}
                        </div>
                    ))}
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
                            onClick={handleComplete}
                            size="lg"
                            className="flex-1 shadow-2xl"
                        >
                            Próxima Etapa
                        </Button>
                    </div>
                </div>
            </div>

            <TeacherAvailabilityManager
                teacherId={availabilityTeacherId}
                onClose={() => setAvailabilityTeacherId(null)}
                data={data}
                setData={setData}
                activeDays={activeDays}
                gridRows={gridRows}
            />

            <TeacherAssignmentManager
                teacherId={assignmentTeacherId}
                onClose={() => setAssignmentTeacherId(null)}
                data={data}
                setData={setData}
            />

        </div>
    );
};
