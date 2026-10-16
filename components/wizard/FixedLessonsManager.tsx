import React, { useState, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { SetupData, FixedLesson } from '../../types';
import { DAYS_OF_WEEK } from '../../constants';

interface FixedLessonsManagerProps {
    isOpen: boolean;
    onClose: () => void;
    data: SetupData;
    setData: React.Dispatch<React.SetStateAction<SetupData>>;
    gridRows: any[];
}

export const FixedLessonsManager: React.FC<FixedLessonsManagerProps> = ({ isOpen, onClose, data, setData, gridRows }) => {
    const formatTime = (totalMinutes: number) => {
        const h = Math.floor(totalMinutes / 60) % 24;
        const m = totalMinutes % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };
    const [activeTab, setActiveTab] = useState<'classes' | 'teachers'>('classes');
    const [selectedClassId, setSelectedClassId] = useState<string | null>(data.classes[0]?.id || null);
    const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
    const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const selectedClass = useMemo(() => data.classes.find(c => c.id === selectedClassId), [data.classes, selectedClassId]);
    const subjectsInSelectedClass = useMemo(() => {
        if (!selectedClass) return [];
        return data.subjects.filter(s => selectedClass.subjects.includes(s.id));
    }, [data.subjects, selectedClass]);

    const getAllocatedCount = (subId: string) => {
        if (!selectedClassId) return 0;
        return (data.fixedLessons || []).filter(fl => fl.classId === selectedClassId && fl.subjectId === subId).length;
    };

    const handleSelectSubject = (subId: string) => {
        setSelectedSubjectId(subId);
        setSelectedTeacherId(null);
    };

    const handleSelectTeacher = (teacherId: string) => {
        setSelectedTeacherId(teacherId);
    };

    const handleAllocate = (day: string, slotIndex: number) => {
        if (!selectedClassId || !selectedSubjectId || !selectedTeacherId) return;

        const alreadyAtSlot = (data.fixedLessons || []).find(fl => fl.classId === selectedClassId && fl.day === day && fl.slotIndex === slotIndex);
        if (alreadyAtSlot) return;

        const teacher = data.teachers.find(t => t.id === selectedTeacherId);
        const activeDaysList = data.weekConfig?.activeDays && data.weekConfig.activeDays.length > 0 ? data.weekConfig.activeDays : DAYS_OF_WEEK;
        const dayIdx = activeDaysList.indexOf(day);
        const status = teacher?.availability?.[`${dayIdx}-${slotIndex}`];
        if (status === 'ND') return;

        const teacherBusy = (data.fixedLessons || []).find(fl => fl.teacherId === selectedTeacherId && fl.day === day && fl.slotIndex === slotIndex);
        if (teacherBusy) return;

        const newFixed: FixedLesson = {
            classId: selectedClassId,
            subjectId: selectedSubjectId,
            teacherId: selectedTeacherId,
            day,
            slotIndex,
            isManual: true
        };

        setData(prev => ({
            ...prev,
            fixedLessons: [...(prev.fixedLessons || []), newFixed],
            pinnedLessons: [...(prev.pinnedLessons || []), newFixed]
        }));
    };

    const handleDeallocate = (day: string, slotIndex: number) => {
        setData(prev => ({
            ...prev,
            fixedLessons: (prev.fixedLessons || []).filter(fl => !(fl.classId === selectedClassId && fl.day === day && fl.slotIndex === slotIndex)),
            pinnedLessons: (prev.pinnedLessons || []).filter(fl => !(fl.classId === selectedClassId && fl.day === day && fl.slotIndex === slotIndex))
        }));
    };

    const slots = data.schedule[0]?.slots || [];
    const textOn = (hex?: string) => {
        const color = (hex || '#1259bd').replace('#', '');
        if (color.length < 6) return '#ffffff';
        const r = parseInt(color.slice(0, 2), 16);
        const g = parseInt(color.slice(2, 4), 16);
        const b = parseInt(color.slice(4, 6), 16);
        return (r * 299 + g * 587 + b * 114) / 1000 > 160 ? '#1f2937' : '#ffffff';
    };
    const fieldClass = 'h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-800 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';
    const placedHere = (data.fixedLessons || []).filter(fl => fl.classId === selectedClassId).length;
    const selectedTeacher = data.teachers.find(t => t.id === selectedTeacherId);
    const requiredTeachers = selectedSubjectId
        ? data.teachers.filter(t => t.subjects.includes(selectedSubjectId) && t.classAssignments?.[selectedSubjectId]?.[selectedClassId!] === 'OBRIGATORIAMENTE')
        : [];
    const optionalTeachers = selectedSubjectId
        ? data.teachers.filter(t => t.subjects.includes(selectedSubjectId) && t.classAssignments?.[selectedSubjectId]?.[selectedClassId!] === 'PODERÁ')
        : [];

    const visibleClasses = [...data.classes]
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true, sensitivity: 'base' }))
        .filter(cls => cls.name.toLowerCase().includes(searchTerm.toLowerCase()));
    const visibleTeachers = [...data.teachers]
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))
        .filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="full" scrollable={false}>
            <div className="flex min-h-0 flex-1 flex-col">
                <div className="bg-gradient-to-r from-[#1259bd] to-primary px-5 py-4 text-white flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                        <span className="material-symbols-outlined rounded-xl bg-white/15 p-2 text-[22px]">push_pin</span>
                        <div className="min-w-0">
                            <h2 className="text-base font-bold tracking-tight">Aulas fixas</h2>
                            <p className="text-sm text-white/80 mt-0.5 leading-snug">
                                Trave aulas em um dia e horário. O processamento mantém essas posições.
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

                <div className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 px-5 py-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                        {selectedClass ? selectedClass.name : 'Nenhuma turma'}
                        {selectedTeacher ? ` · ${selectedTeacher.name}` : ''}
                    </p>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        {placedHere === 1 ? '1 aula nesta grade' : `${placedHere} aulas nesta grade`}
                    </p>
                </div>

                <div className="flex min-h-0 flex-1 overflow-hidden">
                    <aside className={`${activeTab === 'classes' ? 'w-[440px]' : 'w-[260px]'} shrink-0 flex border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900`}>
                        <div className="flex min-w-0 flex-1 flex-col">
                            <div className="flex gap-1 p-3 pb-0">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('classes')}
                                    className={`flex-1 rounded-lg px-2 py-2 text-xs font-bold ${activeTab === 'classes' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'}`}
                                >
                                    Turmas
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setActiveTab('teachers');
                                        setSelectedSubjectId(null);
                                    }}
                                    className={`flex-1 rounded-lg px-2 py-2 text-xs font-bold ${activeTab === 'teachers' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'}`}
                                >
                                    Professores
                                </button>
                            </div>
                            <div className="p-3">
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder={activeTab === 'classes' ? 'Buscar turma' : 'Buscar professor'}
                                    className={fieldClass}
                                />
                            </div>
                            <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar px-2 pb-3">
                                {activeTab === 'classes' ? visibleClasses.map(cls => (
                                    <button
                                        key={cls.id}
                                        type="button"
                                        onClick={() => setSelectedClassId(cls.id)}
                                        className={`mb-1 w-full rounded-lg px-3 py-2 text-left text-sm font-bold ${selectedClassId === cls.id ? 'bg-primary text-white' : 'text-gray-700 hover:bg-primary/5 dark:text-gray-200'}`}
                                    >
                                        {cls.name}
                                    </button>
                                )) : visibleTeachers.map(t => (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => setSelectedTeacherId(t.id)}
                                        className={`mb-1 w-full rounded-lg px-3 py-2 text-left text-sm font-bold ${selectedTeacherId === t.id ? 'bg-primary text-white' : 'text-gray-700 hover:bg-primary/5 dark:text-gray-200'}`}
                                    >
                                        {t.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {activeTab === 'classes' && (
                            <div className="flex w-[210px] shrink-0 flex-col gap-1 overflow-y-auto custom-scrollbar border-l border-gray-100 p-3 dark:border-gray-800">
                                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Disciplinas</p>
                                {subjectsInSelectedClass.map(sub => {
                                    const total = selectedClass?.lessonsPerSubject[sub.id] || 0;
                                    const allocated = getAllocatedCount(sub.id);
                                    const isSelected = selectedSubjectId === sub.id;
                                    return (
                                        <button
                                            key={sub.id}
                                            type="button"
                                            onClick={() => handleSelectSubject(sub.id)}
                                            className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left ${isSelected ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 bg-white text-gray-700 hover:border-primary/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200'}`}
                                        >
                                            <span className="flex min-w-0 items-center gap-2">
                                                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: sub.color || '#94a3b8' }} />
                                                <span className="truncate text-xs font-bold">{sub.name}</span>
                                            </span>
                                            <span className="shrink-0 text-[10px] font-bold text-gray-500">{allocated} de {total}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </aside>

                    <div className="relative min-w-0 flex-1 overflow-auto bg-gray-50 p-5 custom-scrollbar dark:bg-gray-950">
                        <div className="mx-auto w-fit overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                            <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-800">
                                <div>
                                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{selectedClass?.name || 'Turma'}</p>
                                    <p className="text-xs text-gray-500">{data.institution.shift || 'Turno'}</p>
                                </div>
                                <p className="max-w-xs text-right text-xs text-gray-500">
                                    {selectedSubjectId && selectedTeacherId
                                        ? 'Clique num horário vazio para travar. Clique de novo para soltar.'
                                        : 'Escolha a disciplina e o professor antes de travar um horário.'}
                                </p>
                            </div>

                            <div className="flex border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
                                <div className="w-[72px] shrink-0" />
                                {DAYS_OF_WEEK.map(day => (
                                    <div key={day} className="w-[92px] py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                                        {day.substring(0, 3)}
                                    </div>
                                ))}
                            </div>

                            {gridRows.map((slot, sIdx) => {
                                if (slot.type === 'INTERVALO') {
                                    return (
                                        <div key={sIdx} className="flex items-center border-b border-gray-100 bg-amber-50/70 last:border-b-0 dark:border-gray-800 dark:bg-amber-950/20">
                                            <div className="w-[72px] shrink-0" />
                                            <div className="flex-1 py-2 text-center text-xs font-semibold text-amber-800 dark:text-amber-200">
                                                Intervalo · {formatTime(slot.end - slot.start)}
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <div key={sIdx} className="flex border-b border-gray-100 last:border-b-0 dark:border-gray-800">
                                        <div className="flex w-[72px] shrink-0 items-center justify-center text-xs font-bold text-gray-500">
                                            {formatTime(slot.start)}
                                        </div>
                                        {DAYS_OF_WEEK.map((day) => {
                                            const fixed = data.fixedLessons?.find(fl => fl.classId === selectedClassId && fl.day === day && fl.slotIndex === sIdx);
                                            const sub = fixed ? data.subjects.find(s => s.id === fixed.subjectId) : null;
                                            const teacher = fixed ? data.teachers.find(t => t.id === fixed.teacherId) : null;

                                            return (
                                                <button
                                                    key={day}
                                                    type="button"
                                                    onClick={() => fixed ? handleDeallocate(day, sIdx) : handleAllocate(day, sIdx)}
                                                    className="m-1 flex h-[52px] w-[84px] items-center justify-center rounded-lg border border-transparent bg-gray-50 text-center hover:border-primary/30 dark:bg-gray-800/60"
                                                    style={fixed ? { backgroundColor: sub?.color || '#1259bd', color: textOn(sub?.color) } : undefined}
                                                >
                                                    {fixed ? (
                                                        <span className="min-w-0 px-1">
                                                            <span className="block truncate text-[10px] font-bold uppercase leading-tight">{sub?.shortName || sub?.name}</span>
                                                            <span className="block truncate text-[9px] font-medium leading-tight opacity-80">{teacher?.name.split(' ')[0]}</span>
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] font-semibold text-gray-300">Fixar</span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>

                        {selectedTeacherId && (
                            <div className="absolute right-5 top-5 w-[280px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
                                <div className="flex items-center justify-between gap-2 bg-primary px-3 py-2 text-white">
                                    <span className="truncate text-xs font-bold">{selectedTeacher?.name}</span>
                                    <button type="button" onClick={() => setSelectedTeacherId(null)} aria-label="Fechar disponibilidade" className="rounded-full p-1 hover:bg-white/15">
                                        <span className="material-symbols-outlined text-base">close</span>
                                    </button>
                                </div>
                                <div className="p-2">
                                    <div className="grid grid-cols-[42px_repeat(5,1fr)] overflow-hidden rounded-lg border border-gray-200 text-[9px] dark:border-gray-700">
                                        <div className="bg-gray-50 dark:bg-gray-800" />
                                        {DAYS_OF_WEEK.map(d => <div key={d} className="bg-gray-50 py-1 text-center font-bold text-gray-400 dark:bg-gray-800">{d.substring(0, 3)}</div>)}
                                        {slots.map((s, sIdx) => (
                                            <React.Fragment key={s.id}>
                                                <div className="border-t border-gray-100 py-0.5 text-center font-bold text-gray-500 dark:border-gray-800">{s.start}</div>
                                                {DAYS_OF_WEEK.map((d, dIdx) => {
                                                    const teacher = data.teachers.find(t => t.id === selectedTeacherId);
                                                    const status = teacher?.availability?.[`${dIdx}-${sIdx}`];
                                                    const fixedElsewhere = data.fixedLessons?.find(fl => fl.teacherId === selectedTeacherId && fl.day === d && fl.slotIndex === sIdx && fl.classId !== selectedClassId);
                                                    let color = 'bg-sky-100 text-sky-800';
                                                    let text = 'D';
                                                    if (status === 'ND') { color = 'bg-red-500 text-white'; text = 'ND'; }
                                                    if (status === 'IN') { color = 'bg-amber-400 text-amber-950'; text = 'IND'; }
                                                    if (fixedElsewhere) { color = 'bg-red-800 text-white'; text = 'F'; }
                                                    return <div key={d} className={`flex h-4 items-center justify-center border-l border-t border-gray-100 font-bold dark:border-gray-800 ${color}`}>{text}</div>;
                                                })}
                                            </React.Fragment>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {selectedSubjectId && !selectedTeacherId && (
                            <div className="absolute inset-0 z-20 flex items-start justify-center bg-slate-950/25 p-6">
                                <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl dark:border-gray-700 dark:bg-gray-900">
                                    <div className="mb-4 flex items-start justify-between gap-3">
                                        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Quem vai lecionar esta disciplina nesta turma?</h3>
                                        <button type="button" onClick={() => setSelectedSubjectId(null)} aria-label="Fechar" className="rounded-full p-1 text-gray-500 hover:bg-gray-100">
                                            <span className="material-symbols-outlined text-base">close</span>
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {requiredTeachers.map(t => (
                                            <button key={t.id} type="button" onClick={() => handleSelectTeacher(t.id)} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:brightness-95">
                                                {t.name}
                                            </button>
                                        ))}
                                    </div>
                                    {optionalTeachers.length > 0 && (
                                        <>
                                            <p className="mb-2 mt-4 text-xs text-gray-500">Também podem lecionar</p>
                                            <div className="flex flex-wrap gap-2">
                                                {optionalTeachers.map(t => (
                                                    <button key={t.id} type="button" onClick={() => handleSelectTeacher(t.id)} className="rounded-xl border border-primary/30 bg-white px-4 py-2 text-sm font-bold text-primary hover:bg-primary/5 dark:bg-gray-900">
                                                        {t.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                    {requiredTeachers.length === 0 && optionalTeachers.length === 0 && (
                                        <p className="text-sm text-gray-500">Nenhum professor atribuído a esta disciplina nesta turma.</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
};
