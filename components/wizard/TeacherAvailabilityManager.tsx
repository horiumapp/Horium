
import React, { useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { SetupData, AvailabilityStatus, TimeSlot } from '../../types';

interface TeacherAvailabilityManagerProps {
    teacherId: string | null;
    onClose: () => void;
    data: SetupData;
    setData: React.Dispatch<React.SetStateAction<SetupData>>;
    activeDays: string[];
    gridRows: any[]; // Using any for now matching the generated grid structure in Step2
}

export const TeacherAvailabilityManager: React.FC<TeacherAvailabilityManagerProps> = ({
    teacherId, onClose, data, setData, activeDays, gridRows
}) => {
    const teacher = data.teachers.find(t => t.id === teacherId);

    if (!teacher) return null;

    const onlyLessons = gridRows.filter(r => r.type === 'AULA');
    const lessonsCount = onlyLessons.length;

    const formatTime = (totalMinutes: number) => {
        const h = Math.floor(totalMinutes / 60) % 24;
        const m = totalMinutes % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    const toggleTeacherAvailability = (dayIdx: number, slotIdx: number) => {
        const key = `${dayIdx}-${slotIdx}`;
        setData(prev => ({
            ...prev,
            teachers: prev.teachers.map(t => {
                if (t.id === teacherId) {
                    const current = t.availability?.[key] || 'D';
                    let next: AvailabilityStatus = 'D';
                    if (current === 'D') next = 'IN';
                    else if (current === 'IN') next = 'ND';
                    else if (current === 'ND') next = 'D';

                    return { ...t, availability: { ...t.availability, [key]: next } };
                }
                return t;
            })
        }));
    };

    const toggleRowAvailability = (slotIdx: number) => {
        const firstStatus = teacher.availability?.[`0-${slotIdx}`] || 'D';
        let next: AvailabilityStatus = 'D';
        if (firstStatus === 'D') next = 'IN';
        else if (firstStatus === 'IN') next = 'ND';
        else if (firstStatus === 'ND') next = 'D';

        const newAvailability = { ...(teacher.availability || {}) };
        activeDays.forEach((_, dayIdx) => {
            newAvailability[`${dayIdx}-${slotIdx}`] = next;
        });

        setData(prev => ({
            ...prev,
            teachers: prev.teachers.map(t => t.id === teacherId ? { ...t, availability: newAvailability } : t)
        }));
    };

    const toggleColumnAvailability = (dayIdx: number) => {
        const firstStatus = teacher.availability?.[`${dayIdx}-0`] || 'D';
        let next: AvailabilityStatus = 'D';
        if (firstStatus === 'D') next = 'IN';
        else if (firstStatus === 'IN') next = 'ND';
        else if (firstStatus === 'ND') next = 'D';

        const newAvailability = { ...(teacher.availability || {}) };
        onlyLessons.forEach((_, slotIdx) => {
            newAvailability[`${dayIdx}-${slotIdx}`] = next;
        });

        setData(prev => ({
            ...prev,
            teachers: prev.teachers.map(t => t.id === teacherId ? { ...t, availability: newAvailability } : t)
        }));
    };

    return (
        <Modal isOpen={!!teacherId} onClose={onClose} size="xl">
            <div className="bg-primary p-4 flex justify-between items-center text-white font-black uppercase tracking-tight">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base">help</span>
                    <h2 className="text-sm">ETAPA 5 - DISPONIBILIDADE DO PROFESSOR: "{teacher.name}"</h2>
                </div>
                <button onClick={onClose} className="size-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all">
                    <span className="material-symbols-outlined text-sm">close</span>
                </button>
            </div>

            <div className="p-6 space-y-6">
                <div className="flex items-center gap-2">
                    <p className="text-[#36a5b5] text-base font-bold">Marque a disponibilidade do professor na semana abaixo:</p>
                    <span className="material-symbols-outlined text-[#36a5b5] text-sm">help</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300 dark:border-gray-700">
                        <thead>
                            <tr className="bg-[#b5c69b] dark:bg-green-900/30 text-black dark:text-white">
                                <th className="border border-gray-300 p-1 w-24"></th>
                                <th className="border border-gray-300 p-1 w-36"></th>
                                {activeDays.map((day, dayIdx) => (
                                    <th
                                        key={day}
                                        onClick={() => toggleColumnAvailability(dayIdx)}
                                        className="border border-gray-300 p-2 text-xs font-black uppercase tracking-wider cursor-pointer hover:bg-[#a5b68b] transition-colors"
                                        title={`Alternar coluna ${day}`}
                                    >
                                        {day.slice(0, 3)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {onlyLessons.map((row, slotIdx) => (
                                <tr key={row.index} className="text-center h-12">
                                    {slotIdx === 0 && (
                                        <td rowSpan={lessonsCount + 1} className="border border-gray-300 bg-[#c6e2e9] dark:bg-cyan-950 font-black text-primary dark:text-cyan-200 uppercase text-[10px] vertical-text p-1 tracking-widest">
                                            {data.institution.shift}
                                        </td>
                                    )}
                                    <td
                                        className="border border-gray-300 bg-white dark:bg-gray-800 p-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                        onClick={() => toggleRowAvailability(slotIdx)}
                                        title="Alternar linha toda"
                                    >
                                        <div className="flex items-center justify-center border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 text-[10px] font-black text-[#1a3b50] dark:text-gray-200 bg-gray-50/50">
                                            {formatTime(row.start)} às {formatTime(row.end)}
                                        </div>
                                    </td>
                                    {activeDays.map((day, dayIdx) => {
                                        const status = teacher.availability?.[`${dayIdx}-${slotIdx}`] || 'D';
                                        return (
                                            <td
                                                key={day}
                                                onClick={() => toggleTeacherAvailability(dayIdx, slotIdx)}
                                                className={`border border-gray-300 p-1 font-black cursor-pointer transition-all select-none text-xs ${status === 'D' ? 'bg-[#5da9e9] text-black' :
                                                    status === 'IN' ? 'bg-[#facc15] text-black' :
                                                        'bg-[#ef4444] text-black'
                                                    }`}
                                            >
                                                {status}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                            {/* Daily Limit Row */}
                            <tr className="bg-[#fef9c3] dark:bg-yellow-900/20 h-12">
                                <td className="border border-gray-300 p-1">
                                    <div className="flex flex-col leading-none items-center justify-center">
                                        <span className="text-[10px] font-black text-[#854d0e] uppercase">Limite diário</span>
                                        <span className="text-[8px] font-bold text-[#a16207] uppercase mt-0.5">(máx aulas)</span>
                                    </div>
                                </td>
                                {activeDays.map((day, dayIdx) => {
                                    // Calculate available slots for this day ('D' or 'IN')
                                    let availableSlotsCount = 0;
                                    onlyLessons.forEach((_, slotIdx) => {
                                        const status = teacher.availability?.[`${dayIdx}-${slotIdx}`] || 'D';
                                        if (status === 'D' || status === 'IN') {
                                            availableSlotsCount++;
                                        }
                                    });

                                    const currentLimit = teacher.dailyLimits?.[dayIdx.toString()];
                                    return (
                                        <td key={day} className="border border-gray-300 p-1">
                                            <div className="flex justify-center">
                                                <div className="relative">
                                                    <select
                                                        value={currentLimit ?? availableSlotsCount}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            const newLimit = parseInt(val);
                                                            setData(prev => ({
                                                                ...prev,
                                                                teachers: prev.teachers.map(t => {
                                                                    if (t.id === teacherId) {
                                                                        const updatedLimits = { ...(t.dailyLimits || {}) };
                                                                        // If they select the max available, remove the explicit limit so it flows dynamically
                                                                        if (newLimit === availableSlotsCount) {
                                                                            delete updatedLimits[dayIdx.toString()];
                                                                        } else {
                                                                            updatedLimits[dayIdx.toString()] = newLimit;
                                                                        }
                                                                        return { ...t, dailyLimits: updatedLimits };
                                                                    }
                                                                    return t;
                                                                })
                                                            }));
                                                        }}
                                                        className="appearance-none bg-white dark:bg-gray-800 border border-[#854d0e]/30 text-[#854d0e] dark:text-amber-200 text-xs font-black rounded px-2 pr-6 py-0.5 outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer shadow-sm relative z-10"
                                                    >
                                                        {Array.from({ length: availableSlotsCount + 1 }, (_, i) => (
                                                            <option key={i} value={i}>{i}</option>
                                                        ))}
                                                    </select>
                                                    <span className="material-symbols-outlined absolute right-1 top-1/2 -translate-y-1/2 text-[#854d0e]/50 pointer-events-none text-[14px]">
                                                        expand_more
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-col gap-6">
                    <div className="bg-[#f1f5f9] dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 inline-block self-start">
                        <p className="text-[#ef4444] font-black text-[9px] uppercase mb-2">Legenda:</p>
                        <div className="flex flex-wrap gap-2">
                            <div className="flex items-center border border-black dark:border-gray-500 rounded overflow-hidden">
                                <span className="bg-[#5da9e9] px-2 py-0.5 font-bold text-[9px] text-black">D = Disponível</span>
                            </div>
                            <div className="flex items-center border border-black dark:border-gray-500 rounded overflow-hidden">
                                <span className="bg-[#facc15] px-2 py-0.5 font-bold text-[9px] text-black">IN = Indesejável</span>
                            </div>
                            <div className="flex items-center border border-black dark:border-gray-500 rounded overflow-hidden">
                                <span className="bg-[#ef4444] px-2 py-0.5 font-bold text-[9px] text-black">ND = Não Disponível</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
