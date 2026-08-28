
import React, { useMemo } from 'react';
import { WizardStepHeader } from './WizardStepHeader';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { SetupData, IntervalConfig } from '../../types';

interface Step2WeekConfigProps {
    startHour: number;
    setStartHour: (h: number) => void;
    startMinute: number;
    setStartMinute: (m: number) => void;
    durationMinute: number;
    setDurationMinute: (m: number) => void;
    lessonsPerDayGlobal: number;
    setLessonsPerDayGlobal: (n: number) => void;
    intervals: IntervalConfig[];
    setIntervals: (intervals: IntervalConfig[]) => void;
    activeDays: string[];
    setActiveDays: (days: string[]) => void;
    data: SetupData; // For shift info in preview
    onNext: () => void;
    onBack: () => void;
}

export const Step2WeekConfig: React.FC<Step2WeekConfigProps> = ({
    startHour, setStartHour,
    startMinute, setStartMinute,
    durationMinute, setDurationMinute,
    lessonsPerDayGlobal, setLessonsPerDayGlobal,
    intervals, setIntervals,
    activeDays, setActiveDays,
    data,
    onNext,
    onBack,
}) => {
    const handleNext = () => {
        if (activeDays.length === 0) {
            alert('Selecione pelo menos um dia ativo para a semana.');
            return;
        }
        onNext();
    };

    const formatTime = (totalMinutes: number) => {
        const h = Math.floor(totalMinutes / 60) % 24;
        const m = totalMinutes % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    const handleAddInterval = () => {
        setIntervals([...intervals, { id: crypto.randomUUID(), afterLesson: 1, durationMinutes: 15 }]);
    };

    const handleRemoveInterval = (id: string) => {
        setIntervals(intervals.filter(i => i.id !== id));
    };

    const updateInterval = (id: string, field: keyof IntervalConfig, value: number) => {
        setIntervals(intervals.map(i => i.id === id ? { ...i, [field]: value } : i));
    };

    const toggleItemInList = (list: string[], item: string) =>
        list.includes(item) ? list.filter(i => i !== item) : [...list, item];

    const gridRows = useMemo(() => {
        let currentTotalMinutes = startHour * 60 + startMinute;
        const rows: any[] = [];

        for (let i = 1; i <= lessonsPerDayGlobal; i++) {
            const startTime = currentTotalMinutes;
            const endTime = startTime + durationMinute;
            rows.push({ type: 'AULA', index: i, start: startTime, end: endTime });
            currentTotalMinutes = endTime;

            const afterThisLesson = intervals.filter(int => int.afterLesson === i);
            afterThisLesson.forEach(int => {
                rows.push({
                    type: 'INTERVALO',
                    id: int.id,
                    duration: int.durationMinutes,
                    start: currentTotalMinutes,
                    end: currentTotalMinutes + int.durationMinutes
                });
                currentTotalMinutes += int.durationMinutes;
            });
        }
        return rows;
    }, [lessonsPerDayGlobal, startHour, startMinute, durationMinute, intervals]);

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <WizardStepHeader
                title="Semana e Grade"
                description="Configure os dias, intervalos e horários das aulas."
                icon="calendar_month"
            />
            <div className="p-6 grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-10 items-start">
                <div className="space-y-8 flex flex-col items-start w-full">
                    <div className="grid grid-cols-1 md:grid-cols-[140px_160px_160px] gap-6 w-full max-w-2xl">
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-black uppercase text-gray-400">Início das Aulas</label>
                            <input
                                type="time"
                                className="bg-gray-50 dark:bg-gray-800 h-11 rounded-lg px-3 border-2 border-gray-100 dark:border-gray-700 font-bold w-full outline-none focus:border-primary transition-all"
                                value={`${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`}
                                onChange={e => {
                                    const [h, m] = e.target.value.split(':');
                                    setStartHour(parseInt(h));
                                    setStartMinute(parseInt(m));
                                }}
                            />
                        </div>
                        <Input
                            label="Duração Aula (min)"
                            type="number"
                            value={durationMinute}
                            onChange={e => setDurationMinute(parseInt(e.target.value))}
                        />
                        <Input
                            label="Aulas por Dia"
                            type="number"
                            min={1}
                            max={15}
                            value={lessonsPerDayGlobal}
                            onChange={e => setLessonsPerDayGlobal(parseInt(e.target.value))}
                        />
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <label className="text-[10px] font-black uppercase text-gray-400">Configuração de Intervalos</label>
                            <button onClick={handleAddInterval} className="text-xs font-black text-primary flex items-center gap-1 hover:underline">
                                <span className="material-symbols-outlined text-sm">add_circle</span>
                                ADICIONAR INTERVALO
                            </button>
                        </div>

                        <div className="space-y-3">
                            {intervals.length === 0 && (
                                <div className="p-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-center text-xs text-gray-400 italic">
                                    Nenhum intervalo cadastrado. A grade será contínua.
                                </div>
                            )}
                            {intervals.map((int) => (
                                <div key={int.id} className="grid grid-cols-[200px_140px_40px] gap-6 items-center bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[9px] font-black text-gray-400 uppercase">Após qual aula?</span>
                                        <select
                                            className="h-10 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 rounded-lg text-xs font-bold"
                                            value={int.afterLesson}
                                            onChange={e => updateInterval(int.id, 'afterLesson', parseInt(e.target.value))}
                                        >
                                            {Array.from({ length: lessonsPerDayGlobal - 1 }, (_, i) => i + 1).map(n => (
                                                <option key={n} value={n}>{n}ª Aula</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[9px] font-black text-gray-400 uppercase">Duração (min)</span>
                                        <input
                                            type="number"
                                            className="h-10 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 rounded-lg text-xs font-bold w-full"
                                            value={int.durationMinutes}
                                            onChange={e => updateInterval(int.id, 'durationMinutes', parseInt(e.target.value))}
                                        />
                                    </div>
                                    <button onClick={() => handleRemoveInterval(int.id)} className="text-red-400 hover:text-red-600 self-end mb-2">
                                        <span className="material-symbols-outlined text-lg">delete</span>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black uppercase text-gray-400">Dias Ativos</label>
                        <div className="space-y-2">
                            <div className="flex flex-wrap gap-2">
                                {['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'].map(day => (
                                    <button
                                        key={day}
                                        onClick={() => setActiveDays(toggleItemInList(activeDays, day))}
                                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase border transition-all ${activeDays.includes(day) ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-gray-800 text-gray-400 border-gray-200'}`}
                                    >
                                        {day}
                                    </button>
                                ))}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {['Sábado', 'Domingo'].map(day => (
                                    <button
                                        key={day}
                                        onClick={() => setActiveDays(toggleItemInList(activeDays, day))}
                                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase border transition-all ${activeDays.includes(day) ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-gray-800 text-gray-400 border-gray-200'}`}
                                    >
                                        {day}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 flex flex-col h-[500px]">
                    <h3 className="text-sm font-black uppercase text-gray-500 mb-4 shrink-0">Preview da Estrutura</h3>
                    <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                        {gridRows.map((r, i) => (
                            <div key={i} className={`p-3 rounded-lg border flex justify-between items-center transition-all ${r.type === 'AULA' ? 'bg-white dark:bg-gray-800 border-gray-200' : 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 text-yellow-700 scale-[0.98]'}`}>
                                <span className="text-xs font-bold font-mono">{formatTime(r.start)} - {formatTime(r.end)}</span>
                                <span className={`text-[10px] font-black uppercase ${r.type === 'INTERVALO' ? 'italic' : ''}`}>{r.type === 'AULA' ? `${r.index}º AULA` : `INTERVALO (${r.duration}m)`}</span>
                            </div>
                        ))}
                    </div>
                    <p className="mt-4 text-[10px] text-gray-400 italic text-center">Término total: {formatTime(gridRows[gridRows.length - 1]?.end || 0)}</p>
                </div>

                <div className="lg:col-span-2 flex justify-center gap-4 mt-4">
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
                            className="flex-1 shadow-lg"
                        >
                            Salvar Configurações
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
