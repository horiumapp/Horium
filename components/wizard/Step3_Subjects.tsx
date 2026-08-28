
import React, { useState, useMemo } from 'react';
import { WizardStepHeader } from './WizardStepHeader';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { SetupData, Subject } from '../../types';
import { COLORS, CATEGORIES } from '../../constants';

interface Step3SubjectsProps {
    data: SetupData;
    setData: React.Dispatch<React.SetStateAction<SetupData>>;
    onNext: () => void;
    onBack: () => void;
}

export const Step3Subjects: React.FC<Step3SubjectsProps> = ({ data, setData, onNext, onBack }) => {
    const handleNext = () => {
        if (data.subjects.length === 0) {
            alert('Cadastre pelo menos uma disciplina antes de continuar.');
            return;
        }
        onNext();
    };
    const [newSubject, setNewSubject] = useState<Partial<Subject>>({ name: '', shortName: '', category: CATEGORIES[0], color: COLORS[0].hex });
    const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);

    const usedColors = useMemo(() => {
        return data.subjects
            .filter(s => s.id !== editingSubjectId)
            .map(s => s.color);
    }, [data.subjects, editingSubjectId]);

    const handleAddSubject = () => {
        if (!newSubject.name || !newSubject.shortName) return;

        if (editingSubjectId) {
            setData(prev => ({
                ...prev,
                subjects: prev.subjects.map(s => s.id === editingSubjectId ? { ...s, ...newSubject as Subject } : s)
            }));
            setEditingSubjectId(null);
        } else {
            const subject: Subject = { id: crypto.randomUUID(), ...newSubject as Subject };
            setData(prev => ({ ...prev, subjects: [...prev.subjects, subject] }));
        }

        const nextAvailableColor = COLORS.find(c => !data.subjects.map(s => s.color).includes(c.hex))?.hex || COLORS[0].hex;
        setNewSubject({ name: '', shortName: '', category: CATEGORIES[0], color: nextAvailableColor });
    };

    const handleEditSubject = (subject: Subject) => {
        setEditingSubjectId(subject.id);
        setNewSubject({ name: subject.name, shortName: subject.shortName, category: subject.category, color: subject.color });
    };

    const cancelEdit = () => {
        setEditingSubjectId(null);
        const nextAvailableColor = COLORS.find(c => !data.subjects.map(s => s.color).includes(c.hex))?.hex || COLORS[0].hex;
        setNewSubject({ name: '', shortName: '', category: CATEGORIES[0], color: nextAvailableColor });
    };

    const handleDeleteSubject = (id: string) => {
        setData(prev => {
            const updatedClasses = prev.classes.map(c => {
                const newSubjects = c.subjects.filter(s => s !== id);
                const newLessons = { ...c.lessonsPerSubject };
                delete newLessons[id];
                return { ...c, subjects: newSubjects, lessonsPerSubject: newLessons };
            });

            const updatedTeachers = prev.teachers.map(t => {
                const newSubjects = t.subjects.filter(s => s !== id);
                const newClassAssignments = { ...t.classAssignments };
                delete newClassAssignments[id];
                return { ...t, subjects: newSubjects, classAssignments: newClassAssignments };
            });

            const updatedFixed = (prev.fixedLessons || []).filter(fl => fl.subjectId !== id);

            return {
                ...prev,
                subjects: prev.subjects.filter(sub => sub.id !== id),
                classes: updatedClasses,
                teachers: updatedTeachers,
                fixedLessons: updatedFixed
            };
        });
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <WizardStepHeader
                title="Disciplinas"
                description="Cadastre as matérias da grade curricular."
                icon="menu_book"
                count={{ label: 'Disciplinas', value: data.subjects.length }}
            />
            <div className="p-6 space-y-8">
                <div className={`p-6 rounded-2xl border transition-all space-y-6 ${editingSubjectId ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200' : 'bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700'}`}>
                    {editingSubjectId && (
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-xs font-black uppercase text-amber-600 flex items-center gap-2">
                                <span className="material-symbols-outlined text-base">edit</span>
                                Editando disciplina: {data.subjects.find(s => s.id === editingSubjectId)?.name}
                            </span>
                            <button onClick={cancelEdit} className="text-[10px] font-black uppercase text-amber-700 hover:underline">Cancelar Edição</button>
                        </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_200px] gap-4 items-end">
                        <Input
                            label="Nome da Disciplina"
                            placeholder="Ex: Matemática"
                            value={newSubject.name}
                            onChange={e => setNewSubject({ ...newSubject, name: e.target.value })}
                        />
                        <Input
                            label="Abrev."
                            placeholder="MAT"
                            maxLength={4}
                            className="text-center uppercase"
                            value={newSubject.shortName}
                            onChange={e => setNewSubject({ ...newSubject, shortName: e.target.value })}
                        />
                        <Button
                            onClick={handleAddSubject}
                            variant={editingSubjectId ? 'secondary' : 'primary'}
                            className={editingSubjectId ? 'bg-amber-500 text-white hover:bg-amber-600 border-none' : ''}
                            size="md" // h-10 vs h-12 in original, keeping consistent with new UI
                        >
                            {editingSubjectId ? 'Salvar Alterações' : 'Adicionar'}
                        </Button>
                    </div>

                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase text-gray-400 block">Escolha uma Cor (Cores já usadas ficam bloqueadas)</label>
                        <div className="flex flex-wrap gap-2 p-1">
                            {COLORS.map(color => {
                                const isUsed = usedColors.includes(color.hex);
                                const isCurrent = newSubject.color === color.hex;
                                return (
                                    <button
                                        key={color.hex}
                                        disabled={isUsed}
                                        onClick={() => !isUsed && setNewSubject({ ...newSubject, color: color.hex })}
                                        title={isUsed ? `Cor já usada: ${color.name}` : color.name}
                                        className={`size-10 rounded-full border-2 transition-all relative flex items-center justify-center ${isUsed
                                            ? 'opacity-20 grayscale border-transparent cursor-not-allowed'
                                            : isCurrent
                                                ? 'border-primary ring-4 ring-primary/20 scale-110'
                                                : 'border-transparent hover:scale-110'
                                            }`}
                                        style={{ backgroundColor: color.hex }}
                                    >
                                        {isCurrent && !isUsed && <span className="material-symbols-outlined text-white text-base font-bold">check</span>}
                                        {isUsed && <span className="material-symbols-outlined text-black text-xs">block</span>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...data.subjects].sort((a, b) => a.name.localeCompare(b.name)).map(s => (
                        <div key={s.id} className={`p-5 bg-white dark:bg-gray-800 border rounded-2xl shadow-sm flex items-center justify-between group transition-all hover:shadow-md ${editingSubjectId === s.id ? 'border-amber-400 ring-2 ring-amber-100' : 'border-gray-100 dark:border-gray-700'}`}>
                            <div className="flex items-center gap-4">
                                <div className="size-6 rounded-full shadow-inner border border-black/5" style={{ backgroundColor: s.color }}></div>
                                <div className="flex flex-col">
                                    <span className="font-black text-sm uppercase tracking-tight leading-tight">{s.name}</span>
                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{s.shortName}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button onClick={() => handleEditSubject(s)} className="text-gray-400 opacity-0 group-hover:opacity-100 hover:text-primary transition-all p-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
                                    <span className="material-symbols-outlined text-lg">edit</span>
                                </button>
                                <button onClick={() => handleDeleteSubject(s.id)} className="text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-all p-2 bg-red-50 dark:bg-red-900/10 rounded-lg">
                                    <span className="material-symbols-outlined text-lg">delete</span>
                                </button>
                            </div>
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
                            onClick={handleNext}
                            size="lg"
                            className="flex-1 shadow-xl"
                        >
                            Próxima Etapa
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
