import React, { useState, useMemo, useEffect } from 'react';
import { SetupData, FixedLesson } from '../../types';
import { DAYS_OF_WEEK } from '../../constants';
import { excelService } from '../../services/excelService';
import { ensureScheduleSlots, scheduleService } from '../../services/scheduleService';

interface TimetableResultViewProps {
    data: SetupData;
    setData?: React.Dispatch<React.SetStateAction<SetupData>>;
    onReprocess?: () => void;
    onLicenseNeeded?: () => void;
    activeLicenseStatus?: string;
    isStandalonePage?: boolean;
}

type ViewMode = 'TEACHER' | 'CLASS' | 'WEEKLY';

export const TimetableResultView: React.FC<TimetableResultViewProps> = ({
    data,
    setData,
    onReprocess,
    activeLicenseStatus,
    onLicenseNeeded,
    isStandalonePage = false,
}) => {
    const normalizedData = useMemo(() => ensureScheduleSlots(data), [data]);
    const isLocked = !normalizedData.isLicensed;
    const [viewMode, setViewMode] = useState<ViewMode>('CLASS');
    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<{ day: string; slotIndex: number; classId: string; teacherId: string } | null>(null);

    const activeDays = useMemo(() => {
        return normalizedData.weekConfig?.activeDays && normalizedData.weekConfig.activeDays.length > 0
            ? normalizedData.weekConfig.activeDays
            : DAYS_OF_WEEK;
    }, [normalizedData.weekConfig]);

    // Carrega a solução protegida sob demanda se a grade estiver licenciada e a solução ainda não estiver em memória
    useEffect(() => {
        if (!isLocked && data.id && (!data.fixedLessons || data.fixedLessons.length === 0) && setData) {
            scheduleService.getScheduleSolution(data.id)
                .then(solution => {
                    if (solution && solution.length > 0) {
                        setData(prev => ({ ...prev, fixedLessons: solution }));
                    }
                })
                .catch(err => console.warn("Aviso ao carregar solução da grade:", err.message));
        }
    }, [isLocked, data.id]);

    const handlePrint = () => {
        if (isLocked) return;
        window.print();
    };

    const sortedClasses = useMemo(() => {
        return [...normalizedData.classes].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    }, [normalizedData.classes]);

    const [selectedId, setSelectedId] = useState<string>(sortedClasses[0]?.id || '');
    const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);

    const lessons = useMemo(() => {
        if (!normalizedData.schedule || normalizedData.schedule.length === 0) return [];
        return normalizedData.schedule[0]?.slots.filter(s => s.type === 'AULA') || [];
    }, [normalizedData.schedule]);

    const entitiesList = useMemo(() => {
        if (viewMode === 'CLASS') return sortedClasses;
        if (viewMode === 'TEACHER') return normalizedData.teachers;
        if (viewMode === 'WEEKLY') return sortedClasses;
        return [];
    }, [viewMode, sortedClasses, normalizedData.teachers]);

    const currentEntityName = useMemo(() => {
        if (viewMode === 'WEEKLY') return activeDays[selectedDayIndex] || DAYS_OF_WEEK[selectedDayIndex];
        return entitiesList.find(e => e.id === selectedId)?.name || 'Selecione um item';
    }, [entitiesList, selectedId, viewMode, selectedDayIndex, activeDays]);

    const handleNavigate = (direction: 'prev' | 'next') => {
        if (viewMode === 'WEEKLY') {
            const totalDays = activeDays.length;
            const nextDay = direction === 'next' ? (selectedDayIndex + 1) % totalDays : (selectedDayIndex - 1 + totalDays) % totalDays;
            setSelectedDayIndex(nextDay);
            return;
        }

        const list = entitiesList;
        if (list.length <= 1) return;
        const currentIndex = list.findIndex(item => item.id === selectedId);
        if (currentIndex === -1) return;
        const nextIndex = direction === 'next' ? (currentIndex + 1) % list.length : (currentIndex - 1 + list.length) % list.length;
        setSelectedId(list[nextIndex].id);
    };

    const handleModeChange = (mode: ViewMode) => {
        setViewMode(mode);
        setIsEditMode(false);
        setSelectedSlot(null);
        if (mode === 'WEEKLY') {
            setSelectedId('general-week');
            setSelectedDayIndex(0);
        } else if (mode === 'CLASS') {
            setSelectedId(sortedClasses[0]?.id || '');
        } else if (mode === 'TEACHER') {
            setSelectedId(normalizedData.teachers[0]?.id || '');
        } else {
            setSelectedId('');
        }
    };

    const currentEntityLessonCount = useMemo(() => {
        if (viewMode === 'WEEKLY' || !selectedId) return { allocated: 0, total: 0 };

        const allocated = normalizedData.fixedLessons?.filter(fl =>
            viewMode === 'CLASS' ? fl.classId === selectedId : fl.teacherId === selectedId
        ).length || 0;

        let total = 0;
        if (viewMode === 'CLASS') {
            const classroom = normalizedData.classes.find(c => c.id === selectedId);
            if (classroom) {
                total = (Object.values(classroom.lessonsPerSubject || {}) as number[]).reduce((acc: number, val: number) => acc + (val || 0), 0);
            }
        } else { // TEACHER
            const teacher = normalizedData.teachers.find(t => t.id === selectedId);
            if (teacher && teacher.classAssignments) {
                Object.entries(teacher.classAssignments).forEach(([subjectId, assignments]) => {
                    Object.entries(assignments).forEach(([classId, status]) => {
                        if (status === 'OBRIGATORIAMENTE') {
                            const classroom = normalizedData.classes.find(c => c.id === classId);
                            if (classroom) {
                                total += classroom.lessonsPerSubject[subjectId] || 0;
                            }
                        }
                    });
                });
            }
        }

        return { allocated, total };
    }, [normalizedData.fixedLessons, selectedId, viewMode, normalizedData.classes, normalizedData.teachers]);

    const checkMovePossibility = (teacherId: string, classId: string, day: string, slotIndex: number, currentFixed: FixedLesson[]) => {
        const teacherConflict = currentFixed.some(fl => fl.day === day && fl.slotIndex === slotIndex && fl.teacherId === teacherId);
        const classConflict = currentFixed.some(fl => fl.day === day && fl.slotIndex === slotIndex && fl.classId === classId);

        const dIdx = activeDays.indexOf(day);
        const teacherAvail = normalizedData.teachers.find(t => t.id === teacherId)?.availability?.[`${dIdx}-${slotIndex}`] !== 'ND';
        const classAvail = normalizedData.classes.find(c => c.id === classId)?.timeConstraints?.[`${dIdx}-${slotIndex}`] !== 'ND';

        return {
            possible: !teacherConflict && !classConflict && teacherAvail && classAvail,
            teacherConflict,
            classConflict,
            teacherAvail,
            classAvail
        };
    };

    const handleCellClick = (dayIndex: number, slotIndex: number) => {
        if (!isEditMode || !setData) return;

        const day = activeDays[dayIndex];
        const existingLesson = normalizedData.fixedLessons?.find(fl => fl.day === day && fl.slotIndex === slotIndex &&
            (viewMode === 'CLASS' ? fl.classId === selectedId : fl.teacherId === selectedId));

        if (!selectedSlot) {
            if (existingLesson) {
                setSelectedSlot({ day, slotIndex, classId: existingLesson.classId, teacherId: existingLesson.teacherId });
            }
        } else {
            // Se clicar no mesmo, desseleciona
            if (selectedSlot.day === day && selectedSlot.slotIndex === slotIndex) {
                setSelectedSlot(null);
                return;
            }

            // Tenta mover
            const { possible } = checkMovePossibility(selectedSlot.teacherId, selectedSlot.classId, day, slotIndex, normalizedData.fixedLessons || []);

            if (possible) {
                const newFixed = (normalizedData.fixedLessons || []).map(fl => {
                    if (fl.day === selectedSlot.day && fl.slotIndex === selectedSlot.slotIndex &&
                        fl.classId === selectedSlot.classId && fl.teacherId === selectedSlot.teacherId) {
                        return { ...fl, day, slotIndex };
                    }
                    return fl;
                });
                setData(prev => ({ ...prev, fixedLessons: newFixed }));
                setSelectedSlot(null);
            } else {
                // Se clicar em outra aula, troca a seleção
                if (existingLesson) {
                    setSelectedSlot({ day, slotIndex, classId: existingLesson.classId, teacherId: existingLesson.teacherId });
                } else {
                    setSelectedSlot(null);
                }
            }
        }
    };

    const getFailureSuggestion = (failure: any) => {
        const teacher = normalizedData.teachers.find(t => t.id === failure.teacherId);
        const subject = normalizedData.subjects.find(s => s.id === failure.subjectId);
        const classroom = normalizedData.classes.find(c => c.id === failure.classId);
        const slotsPerDay = normalizedData.schedule[0]?.slots.filter(s => s.type === 'AULA').length || 5;

        const title = `${subject?.name || 'Disciplina'} (${classroom?.name || 'Turma'})`;
        let explanation = failure.details || "";
        let suggestion = "";

        switch (failure.reason) {
            case 'TEACHER_LIMIT':
                explanation = explanation || `O professor ${teacher?.name} atingiu o limite de ${slotsPerDay} aulas em um único dia.`;
                suggestion = "Tente aumentar o limite diário de aulas do professor ou reduzir sua carga horária total.";
                break;
            case 'NO_AVAILABILITY':
                explanation = explanation || `Não há horários livres que coincidam entre a turma e o professor ${teacher?.name}.`;
                suggestion = "Revise a grade de disponibilidade do professor e os horários de início da turma.";
                break;
            case 'CLASS_LIMIT':
                explanation = explanation || "A turma atingiu o limite máximo de aulas desta matéria no mesmo dia.";
                suggestion = "Verifique se a carga horária semanal não ultrapassa a capacidade de dias da semana.";
                break;
            case 'CONFLICT':
                explanation = explanation || "O professor já possui outra aula alocada neste mesmo horário.";
                suggestion = "Tente redistribuir as turmas ou verificar a carga horária do professor.";
                break;
            default:
                explanation = explanation || "Ocorreu um conflito inesperado de horários.";
                suggestion = "Tente regerar a grade para buscar uma nova combinação aleatória.";
        }

        return { title, explanation, suggestion };
    };

    return (
        <div className={`flex flex-col ${isStandalonePage ? 'h-full min-h-[calc(100vh-64px)]' : 'h-[750px]'} animate-in fade-in duration-500 overflow-hidden print:h-auto print:overflow-visible`}>
            <style>
                {`
                    @media print {
                        @page { 
                            size: A4 landscape;
                            margin: 1mm;
                        }
                        html, body {
                            width: 297mm;
                            height: 210mm;
                            margin: 0 !important;
                            padding: 0 !important;
                            overflow: visible !important;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                        aside, header, footer, .no-print, .failures-banner { display: none !important; }
                        main { padding-top: 0 !important; margin: 0 !important; }
                        
                        .print-area { 
                            width: 100% !important; 
                            height: auto !important;
                            margin: 0 !important; 
                            padding: 0 !important; 
                            border: none !important; 
                            box-shadow: none !important;
                            overflow: visible !important;
                        }

                        .print-header { margin-bottom: 2px !important; }
                        .print-header h1 { font-size: 13pt !important; margin: 0 !important; }
                        .print-header h2 { font-size: 9pt !important; margin: 0 !important; }
                        .print-header hr { margin: 1px 0 !important; }

                        .timetable-table {
                            width: 100% !important;
                            table-layout: fixed !important;
                            font-size: 7.5pt !important;
                            border-collapse: collapse !important;
                        }
                        .timetable-table th, .timetable-table td {
                            height: 26px !important;
                            padding: 1px 2px !important;
                            border: 1px solid #000 !important;
                        }
                        .timetable-table .time-cell {
                            width: 14% !important;
                            font-size: 6.5pt !important;
                            line-height: 1.1 !important;
                        }
                    }
                `}
            </style>

            {/* FAILURES BANNER */}
            {normalizedData.failures && normalizedData.failures.length > 0 && (
                <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2 flex items-center justify-between no-print shrink-0">
                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-amber-500 text-lg">warning</span>
                        <p className="text-xs text-amber-800 dark:text-amber-300 font-medium">
                            Atenção: <strong>{normalizedData.failures.length}</strong> aula(s) não puderam ser alocadas devido a restrições rígidas.
                        </p>
                    </div>
                    {onReprocess && (
                        <button
                            onClick={onReprocess}
                            className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-[11px] font-bold transition-all shadow-sm flex items-center gap-1"
                        >
                            <span className="material-symbols-outlined text-sm">refresh</span>
                            Tentar Otimizar Novamente
                        </button>
                    )}
                </div>
            )}

            <div className="flex-1 flex overflow-hidden">
                {/* SIDEBAR NAVIGATION */}
                <aside className="w-64 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-[#101822] flex flex-col shrink-0 overflow-y-auto no-print">
                    <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Visualização</span>
                        {setData && !isLocked && (
                            <button
                                onClick={() => {
                                    setIsEditMode(!isEditMode);
                                    setSelectedSlot(null);
                                }}
                                className={`text-[10px] font-black px-2 py-1 rounded transition-colors flex items-center gap-1 ${isEditMode ? 'bg-amber-500 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'}`}
                            >
                                <span className="material-symbols-outlined text-xs">{isEditMode ? 'edit_off' : 'edit'}</span>
                                {isEditMode ? 'MODO EDIÇÃO' : 'EDITAR'}
                            </button>
                        )}
                    </div>

                    <div className="p-3 grid grid-cols-3 gap-1 bg-gray-50 dark:bg-gray-900/50 m-3 rounded-xl border border-gray-100 dark:border-gray-800">
                        {[
                            { id: 'CLASS' as ViewMode, icon: 'groups', label: 'Turma' },
                            { id: 'TEACHER' as ViewMode, icon: 'person', label: 'Prof' },
                            { id: 'WEEKLY' as ViewMode, icon: 'calendar_view_week', label: 'Geral' }
                        ].map(opt => (
                            <button
                                key={opt.id}
                                onClick={() => handleModeChange(opt.id)}
                                className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg text-xs font-bold transition-all ${viewMode === opt.id ? 'bg-primary text-white shadow-sm' : 'text-gray-500 hover:bg-white dark:hover:bg-gray-800'}`}
                            >
                                <span className="material-symbols-outlined text-[18px]">{opt.icon}</span>
                                <span className="text-[9px] uppercase tracking-tighter">{opt.label}</span>
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 overflow-y-auto px-3 space-y-1 custom-scrollbar">
                        {viewMode === 'WEEKLY' ? (
                            activeDays.map((day, idx) => (
                                <button
                                    key={day}
                                    onClick={() => setSelectedDayIndex(idx)}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-between ${selectedDayIndex === idx ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                                >
                                    <span>{day}</span>
                                    <span className="material-symbols-outlined text-xs">arrow_forward_ios</span>
                                </button>
                            ))
                        ) : (
                            entitiesList.map(entity => (
                                <button
                                    key={entity.id}
                                    onClick={() => setSelectedId(entity.id)}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-between ${selectedId === entity.id ? 'bg-primary text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                                >
                                    <span className="truncate pr-2">{entity.name}</span>
                                    <span className="text-[10px] opacity-70">
                                        {viewMode === 'CLASS' ? 'Turma' : (entity as any).department || 'Geral'}
                                    </span>
                                </button>
                            ))
                        )}
                    </div>
                </aside>

                {/* MAIN PRINT / VIEW AREA */}
                <main className="flex-1 flex flex-col overflow-y-auto bg-gray-50/50 dark:bg-[#101822]/50 p-4 md:p-6 print:p-0 print:bg-white custom-scrollbar">
                    {/* TOP ACTION BAR */}
                    <div className="flex justify-between items-center mb-4 no-print flex-wrap gap-3">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handleNavigate('prev')}
                                className="size-8 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:border-primary shadow-sm"
                            >
                                <span className="material-symbols-outlined text-sm">chevron_left</span>
                            </button>
                            <h2 className="text-base font-black text-gray-800 dark:text-white uppercase tracking-tight">
                                {currentEntityName}
                            </h2>
                            <button
                                onClick={() => handleNavigate('next')}
                                className="size-8 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:border-primary shadow-sm"
                            >
                                <span className="material-symbols-outlined text-sm">chevron_right</span>
                            </button>

                            {viewMode !== 'WEEKLY' && (
                                <span className="text-xs text-gray-500 font-medium ml-2">
                                    ({currentEntityLessonCount.allocated} de {currentEntityLessonCount.total || currentEntityLessonCount.allocated} aulas)
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={handlePrint}
                                disabled={isLocked}
                                className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm ${isLocked ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50'}`}
                            >
                                <span className="material-symbols-outlined text-sm">print</span>
                                Imprimir
                            </button>
                            <button
                                onClick={() => {
                                    if (isLocked) {
                                        onLicenseNeeded?.();
                                        return;
                                    }
                                    if (viewMode === 'WEEKLY') {
                                        excelService.exportWeeklyView(selectedDayIndex, normalizedData);
                                    } else {
                                        excelService.exportEntityView(viewMode, selectedId, normalizedData);
                                    }
                                }}
                                className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm"
                            >
                                <span className="material-symbols-outlined text-sm">download</span>
                                Exportar Excel
                            </button>
                        </div>
                    </div>

                    {/* LOCK OVERLAY IF NOT LICENSED */}
                    <div className="relative flex-1">
                        {isLocked ? (
                            <div className="bg-white dark:bg-gray-900 border-2 border-dashed border-primary/30 rounded-3xl p-10 md:p-16 text-center flex flex-col items-center justify-center min-h-[420px] shadow-sm animate-in fade-in duration-300">
                                <div className="size-20 bg-primary/10 text-primary rounded-3xl flex items-center justify-center mb-6 shadow-inner">
                                    <span className="material-symbols-outlined text-4xl">lock</span>
                                </div>
                                <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-3 tracking-tight">Grade Otimizada com Sucesso!</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-300 max-w-md mb-8 leading-relaxed">
                                    Para visualizar a grade completa de todas as turmas, imprimir e exportar para Excel, ative a licença para as turmas da sua instituição.
                                </p>
                                <button
                                    onClick={onLicenseNeeded}
                                    className="px-8 py-4 bg-primary hover:bg-primary/90 text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/30 transition-all active:scale-95 flex items-center gap-3"
                                >
                                    <span className="material-symbols-outlined">workspace_premium</span>
                                    Adquirir Licença
                                </button>
                            </div>
                        ) : (
                            /* TIMETABLE GRID */
                            <div className="bg-white dark:bg-[#101822] p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-x-auto print-area">
                                {/* PRINT HEADER */}
                                <div className="hidden print:block text-center border-b pb-2 mb-2 print-header">
                                    <h1 className="font-black uppercase tracking-tight text-black">{normalizedData.institution?.name || 'Horário Escolar'}</h1>
                                    <h2 className="text-xs text-gray-600 font-bold uppercase">
                                        {currentEntityName} • {normalizedData.institution?.shift || 'Turno Geral'} • {normalizedData.institution?.year || '2026'}
                                    </h2>
                                </div>

                            {viewMode === 'WEEKLY' ? (
                                <table className="w-full border-collapse border border-gray-300 dark:border-gray-700 text-xs timetable-table min-w-[700px]">
                                    <thead>
                                        <tr className="bg-primary text-white">
                                            <th className="border border-gray-300 dark:border-gray-700 p-2 text-center uppercase tracking-wider font-bold w-24">Hora</th>
                                            {sortedClasses.map(c => (
                                                <th key={c.id} className="border border-gray-300 dark:border-gray-700 p-2 text-center uppercase tracking-wider font-bold">
                                                    {c.name}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lessons.map((lesson, slotIdx) => (
                                            <tr key={lesson.id} className="text-center h-12">
                                                <td className="border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 font-bold text-[10px] time-cell">
                                                    <div>{lesson.start} - {lesson.end}</div>
                                                    <span className="text-gray-400 text-[9px]">{slotIdx + 1}ª Aula</span>
                                                </td>
                                                {sortedClasses.map(c => {
                                                    const activeDay = activeDays[selectedDayIndex] || DAYS_OF_WEEK[selectedDayIndex];
                                                    const lessonItem = normalizedData.fixedLessons?.find(fl => fl.day === activeDay && fl.slotIndex === slotIdx && fl.classId === c.id);
                                                    const subject = normalizedData.subjects.find(s => s.id === lessonItem?.subjectId);
                                                    const teacher = normalizedData.teachers.find(t => t.id === lessonItem?.teacherId);

                                                    return (
                                                        <td
                                                            key={c.id}
                                                            className="border border-gray-300 dark:border-gray-700 p-1 font-bold transition-all relative"
                                                            style={{
                                                                backgroundColor: subject?.color ? `${subject.color}25` : undefined,
                                                                borderColor: subject?.color || undefined
                                                            }}
                                                        >
                                                            {lessonItem ? (
                                                                <div className="flex flex-col items-center justify-center leading-tight">
                                                                    <span className="font-black text-xs text-gray-900 dark:text-gray-100">{subject?.shortName || subject?.name}</span>
                                                                    <span className="text-[10px] text-gray-500 font-medium">{teacher?.name}</span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-gray-300 dark:text-gray-600">-</span>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <table className="w-full border-collapse border border-gray-300 dark:border-gray-700 text-xs timetable-table min-w-[600px]">
                                    <thead>
                                        <tr className="bg-primary text-white">
                                            <th className="border border-gray-300 dark:border-gray-700 p-2 text-center uppercase tracking-wider font-bold w-24">Hora</th>
                                            {activeDays.map(day => (
                                                <th key={day} className="border border-gray-300 dark:border-gray-700 p-2 text-center uppercase tracking-wider font-bold">
                                                    {day}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lessons.map((lesson, slotIdx) => (
                                            <tr key={lesson.id} className="text-center h-12">
                                                <td className="border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 font-bold text-[10px] time-cell">
                                                    <div>{lesson.start} - {lesson.end}</div>
                                                    <span className="text-gray-400 text-[9px]">{slotIdx + 1}ª Aula</span>
                                                </td>
                                                {activeDays.map((day, dayIdx) => {
                                                    const lessonItem = normalizedData.fixedLessons?.find(fl => fl.day === day && fl.slotIndex === slotIdx &&
                                                        (viewMode === 'CLASS' ? fl.classId === selectedId : fl.teacherId === selectedId));
                                                    const subject = normalizedData.subjects.find(s => s.id === lessonItem?.subjectId);
                                                    const otherEntity = viewMode === 'CLASS'
                                                        ? normalizedData.teachers.find(t => t.id === lessonItem?.teacherId)?.name
                                                        : normalizedData.classes.find(c => c.id === lessonItem?.classId)?.name;

                                                    const isSelected = selectedSlot?.day === day && selectedSlot?.slotIndex === slotIdx;

                                                    return (
                                                        <td
                                                            key={day}
                                                            onClick={() => handleCellClick(dayIdx, slotIdx)}
                                                            className={`border border-gray-300 dark:border-gray-700 p-1 font-bold transition-all relative ${isEditMode ? 'cursor-pointer hover:ring-2 hover:ring-primary/50' : ''} ${isSelected ? 'ring-4 ring-amber-500 bg-amber-100 dark:bg-amber-900/40 z-10 scale-[1.02]' : ''}`}
                                                            style={{
                                                                backgroundColor: !isSelected && subject?.color ? `${subject.color}25` : undefined
                                                            }}
                                                        >
                                                            {lessonItem ? (
                                                                <div className="flex flex-col items-center justify-center leading-tight">
                                                                    <span className="font-black text-xs text-gray-900 dark:text-gray-100">{subject?.shortName || subject?.name}</span>
                                                                    {otherEntity && <span className="text-[10px] text-gray-500 font-medium">({otherEntity})</span>}
                                                                </div>
                                                            ) : (
                                                                <span className="text-gray-300 dark:text-gray-600">-</span>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default TimetableResultView;
