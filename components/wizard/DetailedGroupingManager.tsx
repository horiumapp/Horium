
import React, { useState, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { SetupData, Teacher, Subject, ClassRoom } from '../../types';
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
        return list;
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

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="full" className="p-0 overflow-hidden bg-[#e0e0e0]">
            {/* Header */}
            <div className="bg-primary p-3 flex justify-between items-center text-white border-b border-gray-300">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg">settings</span>
                    <h2 className="text-sm font-black uppercase">Agrupamento Detalhado</h2>
                </div>
                <button onClick={onClose} className="hover:bg-white/10 rounded-full p-1 transition-colors">
                    <span className="material-symbols-outlined">close</span>
                </button>
            </div>

            {/* Filters Bar */}
            <div className="bg-[#f0f0f0] p-2 flex flex-wrap items-center gap-4 text-[11px] font-bold text-gray-700 border-b border-gray-300 uppercase shadow-sm">
                <span>Filtrar:</span>

                <div className="flex items-center gap-1">
                    <label>Turma:</label>
                    <select
                        value={filters.classId}
                        onChange={(e) => setFilters(prev => ({ ...prev, classId: e.target.value }))}
                        className="min-w-[160px] bg-white border border-gray-400 rounded px-2 pr-6 py-0.5 outline-none focus:ring-1 focus:ring-primary h-6 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C/polyline%3E%3C/svg%3E')] bg-[length:12px] bg-[right_4px_center] bg-no-repeat transition-all"
                    >
                        <option value="all">Todas as salas / turmas</option>
                        {[...data.classes].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                <div className="flex items-center gap-1">
                    <label>Disciplina:</label>
                    <select
                        value={filters.subjectId}
                        onChange={(e) => setFilters(prev => ({ ...prev, subjectId: e.target.value }))}
                        className="min-w-[150px] bg-white border border-gray-400 rounded px-2 pr-6 py-0.5 outline-none focus:ring-1 focus:ring-primary h-6 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C/polyline%3E%3C/svg%3E')] bg-[length:12px] bg-[right_4px_center] bg-no-repeat transition-all"
                    >
                        <option value="all">Todas as disciplinas</option>
                        {data.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>

                <div className="flex items-center gap-1">
                    <label>Professor:</label>
                    <select
                        value={filters.teacherId}
                        onChange={(e) => setFilters(prev => ({ ...prev, teacherId: e.target.value }))}
                        className="min-w-[160px] bg-white border border-gray-400 rounded px-2 pr-6 py-0.5 outline-none focus:ring-1 focus:ring-primary h-6 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C/polyline%3E%3C/svg%3E')] bg-[length:12px] bg-[right_4px_center] bg-no-repeat transition-all"
                    >
                        <option value="all">Todos os professores</option>
                        {data.teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                </div>

                <div className="flex items-center gap-1">
                    <label>Núm. Aulas:</label>
                    <select
                        value={filters.lessons}
                        onChange={(e) => setFilters(prev => ({ ...prev, lessons: e.target.value }))}
                        className="bg-white border border-gray-400 rounded px-1 pr-6 py-0.5 outline-none focus:ring-1 focus:ring-primary h-6 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C/polyline%3E%3C/svg%3E')] bg-[length:12px] bg-[right_4px_center] bg-no-repeat"
                    >
                        <option value="all">Todos</option>
                        {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                </div>

                <button
                    onClick={clearFilters}
                    className="bg-white border border-gray-400 rounded px-2 py-0.5 hover:bg-gray-100 transition-colors shadow-sm"
                >
                    Limpar todos os filtros
                </button>
            </div>

            <div className="p-0 h-[calc(100vh-140px)] overflow-hidden flex flex-col bg-white">
                <div className="bg-[#dccfb4] p-3 text-center text-xs font-bold text-gray-700 uppercase border-b border-gray-300">
                    Informe a configuração desejada para o agrupamento de aulas de cada professor que foi fixado nas turmas da ETAPA 5.
                </div>

                {/* Table Header */}
                <div className="grid grid-cols-[120px_150px_180px_120px_1fr] bg-[#dccfb4]/40 border-b border-gray-300 px-4 py-2 text-[11px] font-black uppercase text-gray-600">
                    <span className="text-primary italic">Turma</span>
                    <span className="text-green-600 italic">Disciplina</span>
                    <span className="text-blue-600 italic">Professor Obrigatório</span>
                    <span>Núm. Aulas</span>
                    <span>Escolha a configuração de agrupamento para cada caso</span>
                </div>

                {/* Table Body */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {filteredAssignments.map((a, idx) => {
                        const defaultGrouping = (a.lessons === 1 || a.lessons === 2) ? 'No máximo 1 aula por dia' : 'Não Especificado';
                        const grouping = data.assignmentGroupings?.[a.key] || defaultGrouping;

                        return (
                            <div
                                key={a.key}
                                className={`grid grid-cols-[120px_150px_180px_120px_1fr] gap-0 px-4 py-1 items-center border-b border-gray-100 hover:bg-blue-50/30 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                            >
                                <span className="text-xs font-bold text-blue-800">{a.classroom.name}</span>
                                <span className="text-xs font-bold text-green-700">{a.subject.name}</span>
                                <span className="text-xs font-bold text-gray-500">{a.teacher.name}</span>
                                <span className="text-xs font-bold text-gray-700">({a.lessons} {a.lessons === 1 ? 'aula' : 'aulas'})</span>

                                <div className="pl-4">
                                    {a.lessons === 1 ? (
                                        <div className="text-[11px] font-bold text-gray-800 py-1">No máximo 1 aula por dia</div>
                                    ) : (
                                        <select
                                            value={grouping}
                                            onChange={(e) => handleUpdateGrouping(a.key, e.target.value)}
                                            className="w-full border border-gray-300 rounded px-2 pr-8 py-1 text-[11px] font-bold outline-none focus:ring-1 focus:ring-primary shadow-sm h-8 bg-white appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C/polyline%3E%3C/svg%3E')] bg-[length:14px] bg-[right_8px_center] bg-no-repeat uppercase"
                                        >
                                            {a.lessons === 2 ? GROUPING_OPTIONS_2_LESSONS.map(o => <option key={o} value={o}>{o}</option>) :
                                                a.lessons === 3 ? GROUPING_OPTIONS_3_LESSONS.map(o => <option key={o} value={o}>{o}</option>) :
                                                    a.lessons === 4 ? GROUPING_OPTIONS_4_LESSONS.map(o => <option key={o} value={o}>{o}</option>) :
                                                        a.lessons === 5 ? GROUPING_OPTIONS_5_LESSONS.map(o => <option key={o} value={o}>{o}</option>) :
                                                            a.lessons === 10 ? GROUPING_OPTIONS_10_LESSONS.map(o => <option key={o} value={o}>{o}</option>) :
                                                                <option value="Não Especificado">Não Especificado</option>}
                                        </select>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {filteredAssignments.length === 0 && (
                        <div className="p-20 text-center text-gray-400 italic bg-gray-50">
                            Nenhuma atribuição encontrada para os filtros selecionados.
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};
