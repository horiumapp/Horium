
import React, { useState, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { SetupData } from '../../types';
import { GROUPING_OPTIONS_2_LESSONS, GROUPING_OPTIONS_3_LESSONS, GROUPING_OPTIONS_4_LESSONS, GROUPING_OPTIONS_5_LESSONS, GROUPING_OPTIONS_10_LESSONS } from '../../constants';

interface DetailedGroupingManagerProps {
    isOpen: boolean;
    onClose: () => void;
    data: SetupData;
    setData: React.Dispatch<React.SetStateAction<SetupData>>;
}

export const DetailedGroupingManager: React.FC<DetailedGroupingManagerProps> = ({ isOpen, onClose, data, setData }) => {
    const [filters, setFilters] = useState({
        classId: 'all',
        subjectId: 'all',
        teacherId: 'all',
        lessons: 'all'
    });

    const assignments = useMemo(() => {
        const list: any[] = [];
        data.teachers.forEach(teacher => {
            if (teacher.classAssignments) {
                Object.entries(teacher.classAssignments).forEach(([subjectId, classes]) => {
                    Object.entries(classes).forEach(([classId, status]) => {
                        if (status === 'OBRIGATORIAMENTE') {
                            const cls = data.classes.find(c => c.id === classId);
                            const sub = data.subjects.find(s => s.id === subjectId);
                            if (cls && sub) {
                                const lessonCount = cls.lessonsPerSubject[subjectId] || 0;
                                list.push({
                                    teacher,
                                    subject: sub,
                                    classroom: cls,
                                    lessons: lessonCount,
                                    key: `${teacher.id}|${classId}|${subjectId}`
                                });
                            }
                        }
                    });
                });
            }
        });
        return list.sort((a, b) =>
            a.classroom.name.localeCompare(b.classroom.name, 'pt-BR', { numeric: true, sensitivity: 'base' }) ||
            a.subject.name.localeCompare(b.subject.name, 'pt-BR') ||
            a.teacher.name.localeCompare(b.teacher.name, 'pt-BR')
        );
    }, [data]);

    const filteredAssignments = useMemo(() => {
        return assignments.filter(a => {
            if (filters.classId !== 'all' && a.classroom.id !== filters.classId) return false;
            if (filters.subjectId !== 'all' && a.subject.id !== filters.subjectId) return false;
            if (filters.teacherId !== 'all' && a.teacher.id !== filters.teacherId) return false;
            if (filters.lessons !== 'all' && a.lessons.toString() !== filters.lessons) return false;
            return true;
        });
    }, [assignments, filters]);

    const handleUpdateGrouping = (key: string, grouping: string) => {
        setData(prev => ({
            ...prev,
            assignmentGroupings: {
                ...(prev.assignmentGroupings || {}),
                [key]: grouping
            }
        }));
    };

    const clearFilters = () => {
        setFilters({ classId: 'all', subjectId: 'all', teacherId: 'all', lessons: 'all' });
    };

    const filtersActive = filters.classId !== 'all' || filters.subjectId !== 'all' || filters.teacherId !== 'all' || filters.lessons !== 'all';
    const fieldClass = 'h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-800 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';

    const sortedClasses = [...data.classes].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true, sensitivity: 'base' }));

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="full" scrollable={false}>
            <div className="flex min-h-0 flex-1 flex-col">
                <div className="bg-gradient-to-r from-[#1259bd] to-primary px-5 py-4 text-white flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-sm font-bold text-primary">1</span>
                        <div className="min-w-0">
                            <h2 className="text-base font-bold tracking-tight">Agrupamento detalhado</h2>
                            <p className="text-sm text-white/80 mt-0.5 leading-snug">
                                Regra de cada aula fixada na etapa de professores. Esta opção prevalece sobre as demais.
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
                    <div className="flex flex-wrap items-end gap-3">
                        <label className="flex min-w-[180px] flex-1 flex-col gap-1.5">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Turma</span>
                            <select value={filters.classId} onChange={(e) => setFilters(prev => ({ ...prev, classId: e.target.value }))} className={fieldClass}>
                                <option value="all">Todas as turmas</option>
                                {sortedClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </label>
                        <label className="flex min-w-[180px] flex-1 flex-col gap-1.5">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Disciplina</span>
                            <select value={filters.subjectId} onChange={(e) => setFilters(prev => ({ ...prev, subjectId: e.target.value }))} className={fieldClass}>
                                <option value="all">Todas as disciplinas</option>
                                {data.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </label>
                        <label className="flex min-w-[180px] flex-1 flex-col gap-1.5">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Professor</span>
                            <select value={filters.teacherId} onChange={(e) => setFilters(prev => ({ ...prev, teacherId: e.target.value }))} className={fieldClass}>
                                <option value="all">Todos os professores</option>
                                {data.teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </label>
                        <label className="flex w-28 flex-col gap-1.5">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Aulas</span>
                            <select value={filters.lessons} onChange={(e) => setFilters(prev => ({ ...prev, lessons: e.target.value }))} className={fieldClass}>
                                <option value="all">Todas</option>
                                {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                        </label>
                        <button
                            type="button"
                            onClick={clearFilters}
                            disabled={!filtersActive}
                            className="h-10 shrink-0 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-600 hover:border-primary/40 hover:text-primary disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                        >
                            Limpar
                        </button>
                    </div>
                    <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                        {filteredAssignments.length} de {assignments.length} {assignments.length === 1 ? 'atribuição' : 'atribuições'}
                    </p>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
                    <div className="sticky top-0 z-10 grid grid-cols-[minmax(88px,0.7fr)_minmax(130px,1fr)_minmax(140px,1.1fr)_72px_minmax(220px,1.8fr)] gap-3 border-b border-gray-200 bg-white/95 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95">
                        <span>Turma</span>
                        <span>Disciplina</span>
                        <span>Professor</span>
                        <span>Aulas</span>
                        <span>Agrupamento</span>
                    </div>

                    {filteredAssignments.map((a) => {
                        const defaultGrouping = (a.lessons === 1 || a.lessons === 2) ? 'No máximo 1 aula por dia' : 'Não Especificado';
                        const grouping = data.assignmentGroupings?.[a.key] || defaultGrouping;
                        const options = a.lessons === 2 ? GROUPING_OPTIONS_2_LESSONS
                            : a.lessons === 3 ? GROUPING_OPTIONS_3_LESSONS
                                : a.lessons === 4 ? GROUPING_OPTIONS_4_LESSONS
                                    : a.lessons === 5 ? GROUPING_OPTIONS_5_LESSONS
                                        : a.lessons === 10 ? GROUPING_OPTIONS_10_LESSONS
                                            : ['Não Especificado'];

                        return (
                            <div
                                key={a.key}
                                className="grid grid-cols-[minmax(88px,0.7fr)_minmax(130px,1fr)_minmax(140px,1.1fr)_72px_minmax(220px,1.8fr)] gap-3 items-center border-b border-gray-100 px-5 py-2.5 hover:bg-primary/[0.04] dark:border-gray-800 dark:hover:bg-white/[0.03]"
                            >
                                <span className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">{a.classroom.name}</span>
                                <span className="flex items-center gap-2 min-w-0">
                                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: a.subject.color || '#94a3b8' }} />
                                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate">{a.subject.name}</span>
                                </span>
                                <span className="text-sm text-gray-600 dark:text-gray-300 truncate">{a.teacher.name}</span>
                                <span className="inline-flex h-7 w-fit items-center rounded-lg bg-gray-100 px-2 text-xs font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                                    {a.lessons}
                                </span>
                                {a.lessons === 1 ? (
                                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">No máximo 1 aula por dia</span>
                                ) : (
                                    <select
                                        value={grouping}
                                        onChange={(e) => handleUpdateGrouping(a.key, e.target.value)}
                                        className={fieldClass}
                                    >
                                        {options.map(o => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                )}
                            </div>
                        );
                    })}

                    {filteredAssignments.length === 0 && (
                        <div className="px-6 py-16 text-center">
                            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Nenhuma atribuição com esses filtros</p>
                            <p className="text-xs text-gray-500 mt-1">Limpe os filtros ou ajuste turma, disciplina e professor.</p>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};
