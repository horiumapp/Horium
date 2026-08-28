import React, { useState, useMemo } from 'react';
import { SetupData, Subject } from '../types';
import { DAYS_OF_WEEK, INITIAL_SETUP } from '../constants';
import { excelService } from '../services/excelService';

interface TimetableResultProps {
  data: SetupData;
  onReprocess: () => void;
}

type ViewMode = 'TEACHER' | 'CLASS' | 'WEEKLY';

const TimetableResult: React.FC<TimetableResultProps> = ({ data, onReprocess }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('CLASS');
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
    if (viewMode === 'WEEKLY') return sortedClasses; // Na visão semanal, usamos classes como colunas
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
    if (viewMode === 'WEEKLY' || !selectedId) return 0;
    return data.fixedLessons?.filter(fl =>
      viewMode === 'CLASS' ? fl.classId === selectedId : fl.teacherId === selectedId
    ).length || 0;
  }, [data.fixedLessons, selectedId, viewMode]);

  return (
    <main className="flex-1 flex overflow-hidden h-full bg-[#f8fafc] dark:bg-background-dark text-[#111418]">
      <aside className="w-72 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col shrink-0 overflow-y-auto">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20">
          <h1 className="text-[#111418] dark:text-white text-lg font-black tracking-tight uppercase">Resultados</h1>
          <p className="text-[#617289] text-[10px] font-bold uppercase tracking-widest mt-1">Navegação Inteligente</p>
        </div>

        <div className="p-4 flex flex-col gap-1">
          <h3 className="px-3 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 mt-4">Visualizar por:</h3>
          {[
            { id: 'TEACHER' as ViewMode, icon: 'person', label: 'Professor' },
            { id: 'CLASS' as ViewMode, icon: 'group', label: 'Turma' },
            { id: 'WEEKLY' as ViewMode, icon: 'calendar_view_week', label: 'Semanal' }
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => handleModeChange(opt.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${viewMode === opt.id ? 'bg-primary text-white shadow-lg shadow-primary/30 scale-[1.02]' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            >
              <span className="material-symbols-outlined text-[20px]">{opt.icon}</span>
              <p className="text-sm font-bold">{opt.label}</p>
            </button>
          ))}
        </div>

        {viewMode !== 'WEEKLY' && (
          <div className="flex-1 p-4 border-t border-gray-100 dark:border-gray-800 mt-4">
            <h3 className="px-3 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">
              Itens Disponíveis
            </h3>
            <div className="space-y-1">
              {entitiesList.map(entity => (
                <button
                  key={entity.id}
                  onClick={() => setSelectedId(entity.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all border ${selectedId === entity.id ? 'bg-primary/5 border-primary text-primary shadow-sm' : 'border-transparent text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                >
                  {entity.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-6 flex justify-between items-center transition-colors">
          <div className="flex items-center gap-4">
            <button onClick={() => handleNavigate('prev')} className="size-10 rounded-full border border-gray-200 dark:border-gray-800 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-30" disabled={viewMode !== 'WEEKLY' && entitiesList.length <= 1}><span className="material-symbols-outlined">chevron_left</span></button>
            <div className="text-center min-w-[200px]">
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-black text-primary uppercase tracking-widest">
                  {viewMode === 'CLASS' ? 'Turma' : viewMode === 'TEACHER' ? 'Professor' : 'Relatório Geral'}
                </span>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-black">{currentEntityName}</h2>
                  {viewMode !== 'WEEKLY' && (
                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter border border-primary/20">
                      {currentEntityLessonCount} Aulas
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button onClick={() => handleNavigate('next')} className="size-10 rounded-full border border-gray-200 dark:border-gray-800 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-30" disabled={viewMode !== 'WEEKLY' && entitiesList.length <= 1}><span className="material-symbols-outlined">chevron_right</span></button>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex gap-3">
              <button onClick={onReprocess} className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all">
                <span className="material-symbols-outlined text-[18px]">sync</span>
                Regerar Horário
              </button>
              <button
                onClick={() => {
                  if (viewMode === 'WEEKLY') {
                    excelService.exportWeeklyView(selectedDayIndex, data);
                  } else {
                    excelService.exportEntityView(viewMode, selectedId, data);
                  }
                }}
                className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg shadow-emerald-200"
              >
                <span className="material-symbols-outlined text-[18px]">table_view</span>
                Excel
              </button>
              <button className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-200 transition-all flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                PDF
              </button>
            </div>
            {data.failures && data.failures.length > 0 && (
              <div className="flex items-center gap-2 text-[10px] font-black text-red-500 uppercase tracking-tighter bg-red-50 px-3 py-1 rounded-full border border-red-100">
                <span className="material-symbols-outlined text-sm">warning</span>
                {data.failures.length} aulas não alocadas
              </div>
            )}
          </div>
        </header>

        {data.failures && data.failures.length > 0 && (
          <div className="px-6 py-3 bg-red-50 border-b border-red-100 flex flex-wrap gap-4 items-center">
            <span className="text-[10px] font-black text-red-600 uppercase tracking-widest flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">error</span>
              Falhas na Geração:
            </span>
            <div className="flex flex-wrap gap-2">
              {data.failures.map((fail, idx) => {
                const subject = data.subjects.find(s => s.id === fail.subjectId);
                const classroom = data.classes.find(c => c.id === fail.classId);
                return (
                  <div key={idx} className="bg-white px-3 py-1 rounded-lg border border-red-200 text-[9px] font-bold text-gray-600 shadow-sm flex items-center gap-2">
                    <span className="text-red-500">{subject?.name}</span> em <span className="text-primary">{classroom?.name}</span>
                    <span className="text-gray-400 italic">({fail.details})</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto p-4 md:p-6 bg-[#f1f5f9]/50">
          <div className="min-w-fit bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div
              className="grid bg-[#eef2f6] dark:bg-gray-800 border-b border-gray-200 dark:border-gray-800"
              style={{ gridTemplateColumns: `80px repeat(${viewMode === 'WEEKLY' ? sortedClasses.length : 5}, minmax(160px, 1fr))` }}
            >
              <div className="p-4 border-r border-gray-200 dark:border-gray-800 flex items-center justify-center">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">HORA</span>
              </div>
              {(viewMode === 'WEEKLY' ? sortedClasses : DAYS_OF_WEEK).map(item => (
                <div key={typeof item === 'string' ? item : item.id} className="p-4 text-center font-black text-[12px] uppercase tracking-widest text-primary dark:text-gray-300 border-r border-gray-200 dark:border-gray-800 last:border-r-0">
                  {typeof item === 'string' ? item : item.name}
                </div>
              ))}
            </div>

            <div className="divide-y divide-gray-200 dark:divide-gray-800">
              {lessons.map((lesson, idx) => (
                <div
                  key={lesson.id}
                  className="grid group hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors"
                  style={{ gridTemplateColumns: `80px repeat(${viewMode === 'WEEKLY' ? sortedClasses.length : 5}, minmax(160px, 1fr))` }}
                >
                  <div className="p-4 border-r border-gray-200 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-800/20 text-center flex flex-col justify-center">
                    <span className="text-sm font-black text-slate-700 dark:text-gray-300">{lesson.start}</span>
                    <span className="text-[10px] text-gray-400 font-bold">{lesson.end}</span>
                  </div>

                  {(viewMode === 'WEEKLY' ? sortedClasses : DAYS_OF_WEEK).map(colItem => {
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
                    const globalSubject = lessonData ? INITIAL_SETUP.subjects.find(s => s.id === lessonData.subjectId) : null;
                    const teacher = lessonData ? data.teachers.find(t => t.id === lessonData.teacherId) : null;
                    const classroom = lessonData ? data.classes.find(c => c.id === lessonData.classId) : null;

                    const shortName = globalSubject?.shortName || subject?.shortName || subject?.name || '';

                    if (!lessonData || !subject) {
                      return (
                        <div key={typeof colItem === 'string' ? colItem : colItem.id} className="p-1 border-r border-gray-100 dark:border-gray-800 last:border-r-0 min-h-[100px]">
                          <div className="h-full w-full rounded-lg bg-gray-50/20 dark:bg-gray-800/5 border-2 border-dashed border-gray-100 dark:border-gray-800/50"></div>
                        </div>
                      );
                    }

                    return (
                      <div key={typeof colItem === 'string' ? colItem : colItem.id} className="p-1.5 border-r border-gray-100 dark:border-gray-800 last:border-r-0 min-h-[110px]">
                        <div
                          className="relative h-full w-full p-4 rounded-lg shadow-sm border border-gray-200/50 flex flex-col items-center justify-center text-center transition-all hover:scale-[1.02] cursor-default"
                          style={{ backgroundColor: subject.color }}
                        >
                          <div className="absolute top-1 left-2 text-[10px] font-bold text-white/90">{lesson.start}</div>
                          <div className="absolute bottom-1 right-2 text-[10px] font-bold text-white/90">{lesson.end}</div>

                          <p className="text-white text-sm font-black leading-tight uppercase drop-shadow-sm">{shortName}</p>
                          <p className="text-white/80 text-[10px] font-bold mt-1 uppercase tracking-wider">
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
        </div>
      </div>
    </main>
  );
};

export default TimetableResult;
