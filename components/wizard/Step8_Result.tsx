
import React, { useState, useMemo } from 'react';
import { SetupData } from '../../types';
import { DAYS_OF_WEEK } from '../../constants';
import { excelService } from '../../services/excelService';

interface Step8ResultProps {
    data: SetupData;
    setData: React.Dispatch<React.SetStateAction<SetupData>>;
    onReprocess: () => void;
    activeLicenseStatus?: string;
    onLicenseNeeded?: () => void;
}

type ViewMode = 'TEACHER' | 'CLASS' | 'WEEKLY';

export const Step8Result: React.FC<Step8ResultProps> = ({
    data,
    setData,
    onReprocess,
    activeLicenseStatus,
    onLicenseNeeded
}) => {
    const isLocked = !data.isLicensed;
    const [viewMode, setViewMode] = useState<ViewMode>('CLASS');
    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<{ day: string, slotIndex: number, classId: string, teacherId: string } | null>(null);

    const handlePrint = () => {
        if (isLocked) return;
        window.print();
    };
    const [selectedId, setSelectedId] = useState<string>(data.classes[0]?.id || '');
    const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);

    const lessons = useMemo(() => {
        if (!data.schedule || data.schedule.length === 0) return [];
        return data.schedule[0].slots.filter(s => s.type === 'AULA');
    }, [data.schedule]);

    const sortedClasses = useMemo(() => {
        return [...data.classes].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    }, [data.classes]);

    const entitiesList = useMemo(() => {
        if (viewMode === 'CLASS') return sortedClasses;
        if (viewMode === 'TEACHER') return data.teachers;
        if (viewMode === 'WEEKLY') return sortedClasses;
        return [];
    }, [viewMode, sortedClasses, data.teachers]);

    const currentEntityName = useMemo(() => {
        if (viewMode === 'WEEKLY') return DAYS_OF_WEEK[selectedDayIndex];
        return entitiesList.find(e => e.id === selectedId)?.name || 'Selecione um item';
    }, [entitiesList, selectedId, viewMode, selectedDayIndex]);

    const handleNavigate = (direction: 'prev' | 'next') => {
        if (viewMode === 'WEEKLY') {
            const totalDays = DAYS_OF_WEEK.length;
            let nextDay = direction === 'next' ? (selectedDayIndex + 1) % totalDays : (selectedDayIndex - 1 + totalDays) % totalDays;
            setSelectedDayIndex(nextDay);
            return;
        }

        const list = entitiesList;
        if (list.length <= 1) return;
        const currentIndex = list.findIndex(item => item.id === selectedId);
        if (currentIndex === -1) return;
        let nextIndex = direction === 'next' ? (currentIndex + 1) % list.length : (currentIndex - 1 + list.length) % list.length;
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
            setSelectedId(data.classes[0]?.id || '');
        } else if (mode === 'TEACHER') {
            setSelectedId(data.teachers[0]?.id || '');
        } else {
            setSelectedId('');
        }
    };

    const currentEntityLessonCount = useMemo(() => {
        if (viewMode === 'WEEKLY' || !selectedId) return { allocated: 0, total: 0 };

        const allocated = data.fixedLessons?.filter(fl =>
            viewMode === 'CLASS' ? fl.classId === selectedId : fl.teacherId === selectedId
        ).length || 0;

        let total = 0;
        if (viewMode === 'CLASS') {
            const classroom = data.classes.find(c => c.id === selectedId);
            if (classroom) {
                total = (Object.values(classroom.lessonsPerSubject) as number[]).reduce((acc: number, val: number) => acc + (val || 0), 0);
            }
        } else { // TEACHER
            const teacher = data.teachers.find(t => t.id === selectedId);
            if (teacher && teacher.classAssignments) {
                Object.entries(teacher.classAssignments).forEach(([subjectId, assignments]) => {
                    Object.entries(assignments).forEach(([classId, status]) => {
                        if (status === 'OBRIGATORIAMENTE') {
                            const classroom = data.classes.find(c => c.id === classId);
                            if (classroom) {
                                total += classroom.lessonsPerSubject[subjectId] || 0;
                            }
                        }
                    });
                });
            }
        }

        return { allocated, total };
    }, [data.fixedLessons, selectedId, viewMode, data.classes, data.teachers]);

    const checkMovePossibility = (teacherId: string, classId: string, day: string, slotIndex: number, currentFixed: any[]) => {
        const teacherConflict = currentFixed.some(fl => fl.day === day && fl.slotIndex === slotIndex && fl.teacherId === teacherId);
        const classConflict = currentFixed.some(fl => fl.day === day && fl.slotIndex === slotIndex && fl.classId === classId);

        const dIdx = DAYS_OF_WEEK.indexOf(day);
        const teacherAvail = data.teachers.find(t => t.id === teacherId)?.availability?.[`${dIdx}-${slotIndex}`] !== 'ND';
        const classAvail = data.classes.find(c => c.id === classId)?.timeConstraints?.[`${dIdx}-${slotIndex}`] !== 'ND';

        return {
            possible: !teacherConflict && !classConflict && teacherAvail && classAvail,
            teacherConflict,
            classConflict,
            teacherAvail,
            classAvail
        };
    };

    const handleCellClick = (dayIndex: number, slotIndex: number) => {
        if (!isEditMode) return;

        const day = DAYS_OF_WEEK[dayIndex];
        const existingLesson = data.fixedLessons?.find(fl => fl.day === day && fl.slotIndex === slotIndex &&
            (viewMode === 'CLASS' ? fl.classId === selectedId : fl.teacherId === selectedId));

        if (!selectedSlot) {
            if (existingLesson) {
                setSelectedSlot({ day, slotIndex, classId: existingLesson.classId, teacherId: existingLesson.teacherId });
            }
        } else {
            // Se clicar no mesmo, deseleciona
            if (selectedSlot.day === day && selectedSlot.slotIndex === slotIndex) {
                setSelectedSlot(null);
                return;
            }

            // Tenta mover
            const { possible } = checkMovePossibility(selectedSlot.teacherId, selectedSlot.classId, day, slotIndex, data.fixedLessons || []);

            if (possible) {
                const newFixed = (data.fixedLessons || []).map(fl => {
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
        const teacher = data.teachers.find(t => t.id === failure.teacherId);
        const subject = data.subjects.find(s => s.id === failure.subjectId);
        const classroom = data.classes.find(c => c.id === failure.classId);
        const slotsPerDay = data.schedule[0]?.slots.filter(s => s.type === 'AULA').length || 0;

        let title = `${subject?.name} (${classroom?.name})`;
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
        <div className="flex flex-col h-[700px] animate-in fade-in duration-500 overflow-hidden print:h-auto print:overflow-visible">
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

                        .grid-container {
                            display: grid !important;
                            width: 100% !important;
                            grid-template-columns: 40px repeat(${viewMode === 'WEEKLY' ? sortedClasses.length : 5}, 1fr) !important;
                        }

                        .grid-cell {
                            padding: 0.1px !important;
                            min-height: 20px !important; 
                            border-bottom: 0.1px solid #eee !important;
                        }

                        .subject-name {
                            font-size: 7px !important;
                            font-weight: 900 !important;
                            line-height: 1 !important;
                        }

                        .sub-info {
                            font-size: 5px !important;
                            margin-top: 0px !important;
                        }

                        .time-info {
                            font-size: 5px !important;
                        }
                        
                        .rounded-lg, .rounded-2xl {
                            border-radius: 0 !important;
                        }
                    }
                `}
            </style>

            <div className="hidden print:block print-header text-center">
                <h1 className="font-black uppercase tracking-tighter text-primary">Horium - Relatório de Horário</h1>
                <h2 className="font-black uppercase text-gray-700">
                    {currentEntityName}
                </h2>
                <hr className="border-gray-200" />
            </div>

            <div className="flex-1 flex overflow-hidden print:overflow-visible">
                <aside className="w-64 border-r border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-900/50 flex flex-col shrink-0 overflow-y-auto">
                    <div className="p-4 flex flex-col gap-1">
                        <h3 className="px-3 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 mt-2">Visualizar por:</h3>
                        {[
                            { id: 'TEACHER' as ViewMode, icon: 'person', label: 'Professor' },
                            { id: 'CLASS' as ViewMode, icon: 'group', label: 'Turma' },
                            { id: 'WEEKLY' as ViewMode, icon: 'calendar_view_week', label: 'Semanal' }
                        ].map(opt => (
                            <button
                                key={opt.id}
                                onClick={() => handleModeChange(opt.id)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${viewMode === opt.id ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'text-gray-500 hover:bg-white dark:hover:bg-gray-800'}`}
                            >
                                <span className="material-symbols-outlined text-[18px]">{opt.icon}</span>
                                <p className="text-xs font-bold">{opt.label}</p>
                            </button>
                        ))}
                    </div>

                    {viewMode !== 'WEEKLY' && (
                        <div className="flex-1 p-4 border-t border-gray-100 dark:border-gray-800 mt-2">
                            <h3 className="px-3 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">
                                {viewMode === 'TEACHER' ? 'Professores' : 'Turmas'}
                            </h3>
                            <div className="space-y-1">
                                {entitiesList.map(entity => (
                                    <button
                                        key={entity.id}
                                        onClick={() => {
                                            setSelectedId(entity.id);
                                            setSelectedSlot(null);
                                        }}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-[11px] font-bold transition-all ${selectedId === entity.id ? 'bg-primary/10 text-primary border-l-4 border-primary' : 'text-gray-500 hover:bg-white dark:hover:bg-gray-800'}`}
                                    >
                                        {entity.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* CONFLICT DIAGNOSIS PANEL */}
                    {data.failures && data.failures.length > 0 && (
                        <div className="p-4 border-t border-amber-100 bg-amber-50/50 dark:bg-amber-900/10 dark:border-amber-900/20">
                            <div className="flex items-center gap-2 mb-3 text-amber-600 dark:text-amber-400">
                                <span className="material-symbols-outlined text-sm">warning</span>
                                <h3 className="text-[10px] font-black uppercase tracking-widest">Ajustes Necessários</h3>
                            </div>
                            <div className="space-y-3">
                                {data.failures.slice(0, 3).map((f, i) => {
                                    const diag = getFailureSuggestion(f);
                                    return (
                                        <div key={i} className="bg-white dark:bg-gray-800 p-2.5 rounded-lg border border-amber-200 dark:border-amber-900/50 shadow-sm">
                                            <p className="text-[10px] font-black text-gray-800 dark:text-gray-200 block mb-1 uppercase">{diag.title}</p>
                                            <p className="text-[9px] text-gray-500 dark:text-gray-400 leading-tight mb-2 italic">"{diag.explanation}"</p>
                                            <div className="p-1.5 bg-amber-50 dark:bg-amber-900/30 rounded text-[8px] font-bold text-amber-700 dark:text-amber-400 leading-normal flex items-start gap-1">
                                                <span className="material-symbols-outlined text-[10px] mt-0.5">lightbulb</span>
                                                {diag.suggestion}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </aside>

                <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-gray-900">
                    <header className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
                        <div className="flex items-center gap-3">
                            <button onClick={() => handleNavigate('prev')} className="size-8 rounded-full border border-gray-100 flex items-center justify-center hover:bg-gray-50 transition-colors disabled:opacity-30" disabled={viewMode !== 'WEEKLY' && entitiesList.length <= 1}><span className="material-symbols-outlined text-sm">chevron_left</span></button>
                            <div className="text-center min-w-[150px]">
                                <span className="text-[9px] font-black text-primary uppercase tracking-widest block">
                                    {viewMode === 'CLASS' ? 'Turma' : viewMode === 'TEACHER' ? 'Professor' : 'Relatório Geral'}
                                </span>
                                <div className="flex items-center justify-center gap-2">
                                    <h2 className="text-sm font-black uppercase text-gray-800 dark:text-gray-200 tracking-tight">{currentEntityName}</h2>
                                    {viewMode !== 'WEEKLY' && (
                                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter border ${currentEntityLessonCount.allocated < currentEntityLessonCount.total ? 'bg-amber-100 text-amber-600 border-amber-200' : 'bg-primary/10 text-primary border-primary/20'}`}>
                                            {currentEntityLessonCount.allocated} / {currentEntityLessonCount.total} Aulas
                                        </span>
                                    )}
                                </div>
                            </div>
                            <button onClick={() => handleNavigate('next')} className="size-8 rounded-full border border-gray-100 flex items-center justify-center hover:bg-gray-50 transition-colors disabled:opacity-30" disabled={viewMode !== 'WEEKLY' && entitiesList.length <= 1}><span className="material-symbols-outlined text-sm">chevron_right</span></button>
                        </div>
                        <div className="flex gap-2">
                            {viewMode !== 'WEEKLY' && (
                                <button
                                    onClick={() => {
                                        setIsEditMode(!isEditMode);
                                        setSelectedSlot(null);
                                    }}
                                    className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transform transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2 ${isEditMode ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30' : 'bg-amber-100 text-amber-600 hover:bg-amber-200 hover:shadow-amber-500/10'}`}
                                >
                                    <span className="material-symbols-outlined text-[14px]">{isEditMode ? 'close' : 'edit'}</span>
                                    {isEditMode ? 'Sair da Edição' : 'Ajustar Manual'}
                                </button>
                            )}
                            <button onClick={onReprocess} className="bg-primary/10 text-primary px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transform transition-all duration-200 hover:bg-primary hover:text-white hover:scale-[1.05] hover:brightness-110 active:scale-95 shadow-sm hover:shadow-xl hover:shadow-primary/30">
                                Regerar Horário
                            </button>
                            <button
                                onClick={handlePrint}
                                className="bg-red-50 dark:bg-red-950/30 text-[#E53935] px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transform transition-all duration-200 hover:bg-[#E53935] hover:text-white hover:scale-[1.05] active:scale-95 flex items-center gap-2 shadow-sm hover:shadow-xl hover:shadow-red-500/30 border border-red-100 dark:border-red-900/20"
                            >
                                <span className="material-symbols-outlined text-[14px]">picture_as_pdf</span>
                                PDF
                            </button>
                            <button
                                onClick={async () => {
                                    if (viewMode === 'WEEKLY') {
                                        await excelService.exportWeeklyView(selectedDayIndex, data);
                                    } else {
                                        await excelService.exportEntityView(viewMode, selectedId, data);
                                    }
                                }}
                                className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transform transition-all duration-200 hover:bg-emerald-600 hover:text-white hover:scale-[1.05] active:scale-95 flex items-center gap-2 shadow-sm hover:shadow-xl hover:shadow-emerald-500/30 border border-emerald-100 dark:border-emerald-900/20"
                            >
                                <span className="material-symbols-outlined text-[14px]">table_view</span>
                                Planilha
                            </button>
                        </div>
                    </header>

                    <div className="flex-1 overflow-auto p-4">
                        {data.failures && data.failures.length > 0 && (
                            <div className="mb-6 bg-red-50 dark:bg-red-900/10 border-2 border-red-100 dark:border-red-900/20 rounded-2xl p-4 shadow-sm animate-in slide-in-from-top duration-700 no-print failures-banner">
                                <div className="flex items-start gap-4">
                                    <div className="size-12 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                                        <span className="material-symbols-outlined text-red-600 dark:text-red-400 text-3xl">lightbulb_circle</span>
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="text-sm font-black text-red-900 dark:text-red-300 uppercase tracking-tight mb-1">
                                            Atenção: {data.failures.length} {data.failures.length === 1 ? 'aula não pôde' : 'aulas não puderam'} ser {data.failures.length === 1 ? 'alocada' : 'alocadas'}!
                                        </h4>
                                        <p className="text-xs text-red-700/80 dark:text-red-400/80 font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                                            Ajuste manualmente ou regere o horário. Conflitos atuais encontrados no painel lateral.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {isEditMode && (
                            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 animate-in slide-in-from-top duration-300">
                                <span className="material-symbols-outlined text-amber-600">info</span>
                                <p className="text-[10px] font-bold text-amber-800 uppercase leading-snug">
                                    {selectedSlot
                                        ? "Agora clique em um espaço vazio iluminado para mover a aula."
                                        : "Clique em uma aula para selecioná-la e ver os espaços disponíveis para mover."}
                                </p>
                            </div>
                        )}

                        <div className="relative flex-1 overflow-hidden flex flex-col">
                            <div className={`border border-gray-100 dark:border-gray-800 rounded-2xl overflow-x-auto shadow-sm bg-white print-area print:overflow-visible transition-all duration-700 ${viewMode === 'WEEKLY' && sortedClasses.length > 10 ? 'print-condensed' : ''} ${isLocked ? 'blur-[8px] grayscale opacity-50 select-none pointer-events-none' : ''}`}>
                                <div
                                    className={`grid bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-800 grid-container ${viewMode === 'WEEKLY' ? 'w-max min-w-full print:w-full' : 'w-full'}`}
                                    style={{ gridTemplateColumns: `80px repeat(${viewMode === 'WEEKLY' ? sortedClasses.length : 5}, ${viewMode === 'WEEKLY' ? '180px' : '1fr'})` }}
                                >
                                    <div className="p-2 border-r border-gray-100 dark:border-gray-800 flex items-center justify-center">
                                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">HORA</span>
                                    </div>
                                    {(viewMode === 'WEEKLY' ? sortedClasses : DAYS_OF_WEEK).map(item => (
                                        <div key={typeof item === 'string' ? item : item.id} className="p-2 text-center font-black text-[9px] uppercase tracking-widest text-gray-400 border-r border-gray-100 dark:border-gray-800 last:border-r-0">
                                            {typeof item === 'string' ? item : item.name}
                                        </div>
                                    ))}
                                </div>

                                <div className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                                    {lessons.map((lesson, idx) => (
                                        <div
                                            key={lesson.id}
                                            className={`grid group hover:bg-gray-50/50 transition-colors grid-container ${viewMode === 'WEEKLY' ? 'w-max min-w-full print:w-full' : 'w-full'}`}
                                            style={{ gridTemplateColumns: `80px repeat(${viewMode === 'WEEKLY' ? sortedClasses.length : 5}, ${viewMode === 'WEEKLY' ? '180px' : '1fr'})` }}
                                        >
                                            <div className="p-2 border-r border-gray-100 dark:border-gray-800 bg-gray-50/50 text-center flex flex-col justify-center">
                                                <span className="text-[11px] font-black text-gray-700 dark:text-gray-300">{lesson.start}</span>
                                                <p className="text-[8px] font-bold text-gray-400 uppercase">{idx + 1}º Aula</p>
                                            </div>

                                            {(viewMode === 'WEEKLY' ? sortedClasses : DAYS_OF_WEEK).map((colItem, dayIdx) => {
                                                const currentDay = viewMode === 'WEEKLY' ? DAYS_OF_WEEK[selectedDayIndex] : (colItem as string);
                                                const currentClassId = viewMode === 'WEEKLY' ? (colItem as any).id : (viewMode === 'CLASS' ? selectedId : null);
                                                const currentTeacherId = viewMode === 'TEACHER' ? selectedId : null;

                                                const lessonData = data.fixedLessons?.find(fl =>
                                                    fl.day === currentDay &&
                                                    fl.slotIndex === idx &&
                                                    (currentClassId ? fl.classId === currentClassId :
                                                        currentTeacherId ? fl.teacherId === currentTeacherId : false)
                                                );

                                                const subject = lessonData ? data.subjects.find(s => s.id === lessonData.subjectId) : null;
                                                const teacher = lessonData ? data.teachers.find(t => t.id === lessonData.teacherId) : null;
                                                const classroom = lessonData ? data.classes.find(c => c.id === lessonData.classId) : null;

                                                const shortName = subject?.shortName || subject?.name || '';
                                                const isSelected = selectedSlot && selectedSlot.day === currentDay && selectedSlot.slotIndex === idx;

                                                // Verifica possibilidade de mover para esta célula vazia
                                                const { possible } = selectedSlot ? checkMovePossibility(selectedSlot.teacherId, selectedSlot.classId, currentDay, idx, data.fixedLessons || []) : { possible: false };

                                                if (!lessonData || !subject) {
                                                    return (
                                                        <div
                                                            key={typeof colItem === 'string' ? colItem : colItem.id}
                                                            className={`p-1 border-r border-gray-100 dark:border-gray-800 last:border-r-0 min-h-[70px] transition-all ${isEditMode ? 'cursor-pointer' : ''}`}
                                                            onClick={() => handleCellClick(viewMode === 'WEEKLY' ? selectedDayIndex : dayIdx, idx)}
                                                        >
                                                            <div className={`h-full w-full rounded-lg border-2 border-dashed transition-all ${possible ? 'bg-green-50 border-green-300 animate-pulse' : 'bg-gray-50/20 dark:bg-gray-800/5 border-gray-100 dark:border-gray-800/50'}`}></div>
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <div
                                                        key={typeof colItem === 'string' ? colItem : colItem.id}
                                                        className={`p-1 border-r border-gray-100 dark:border-gray-800 last:border-r-0 min-h-[70px] grid-cell ${isEditMode ? 'cursor-pointer' : ''}`}
                                                        onClick={() => handleCellClick(viewMode === 'WEEKLY' ? selectedDayIndex : dayIdx, idx)}
                                                    >
                                                        <div
                                                            className={`relative h-full w-full p-2 rounded-lg shadow-sm border-l-4 flex flex-col items-center justify-center text-center transition-all ${isSelected ? 'scale-[1.05] ring-4 ring-primary ring-opacity-50 z-20 shadow-xl' : 'hover:scale-[1.02]'}`}
                                                            style={{
                                                                backgroundColor: isSelected ? subject.color : `${subject.color}15`,
                                                                borderLeftColor: isSelected ? 'white' : subject.color
                                                            }}
                                                        >
                                                            <div className="absolute top-0.5 left-1.5 text-[8px] font-bold time-info" style={{ color: isSelected ? 'white' : subject.color }}>{lesson.start}</div>
                                                            <div className="absolute bottom-0.5 right-1.5 text-[8px] font-bold time-info" style={{ color: isSelected ? '#ffffff90' : '#9ca3af' }}>{lesson.end}</div>

                                                            <p className="text-[10px] font-black leading-tight uppercase truncate w-full subject-name" style={{ color: isSelected ? 'white' : subject.color }}>{shortName}</p>
                                                            <p className={`text-[8px] font-bold mt-0.5 uppercase tracking-wider truncate w-full sub-info ${isSelected ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>
                                                                {viewMode === 'TEACHER' ? classroom?.name : teacher?.name}
                                                            </p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* LOCK OVERLAY */}
                            {isLocked && (
                                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-4 text-center bg-gray-900/10 backdrop-blur-[2px] animate-in fade-in duration-1000 overflow-y-auto">
                                    <div className="bg-white dark:bg-gray-950 p-8 rounded-[32px] shadow-2xl border border-gray-100 dark:border-gray-800 max-w-md transform animate-in slide-in-from-bottom-10 duration-700 my-auto">
                                        <div className="size-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce-slow">
                                            <span className="material-symbols-outlined text-4xl text-primary">lock</span>
                                        </div>
                                        <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter mb-3 uppercase">
                                            Aprovação Pendente
                                        </h2>
                                        <p className="text-gray-500 dark:text-gray-400 font-medium text-sm leading-relaxed mb-6">
                                            Sua grade de horários foi otimizada com sucesso! Para visualizar a grade final, imprimir e exportar, é necessário que o pagamento da licença seja confirmado.
                                        </p>
                                        <div className="space-y-4">
                                            <button
                                                onClick={onLicenseNeeded}
                                                className="w-full py-4 bg-primary hover:bg-primary/90 text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-primary/30 transition-all active:scale-95 group flex items-center justify-center gap-3"
                                            >
                                                Adquirir / Ver Licença
                                                <span className="material-symbols-outlined text-lg group-hover:translate-x-1 transition-transform">arrow_forward</span>
                                            </button>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2">
                                                A liberação ocorre automaticamente após a confirmação.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
