import { SetupData, TimeSlot, DaySchedule } from '../types';

export const formatTime = (totalMinutes: number): string => {
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

export const ensureScheduleSlots = (data: SetupData): SetupData => {
    const week = data.weekConfig || {
        activeDays: ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'],
        startHour: 7,
        startMinute: 0,
        durationMinute: 45,
        lessonsPerDayGlobal: 5,
        intervals: [{ id: 'int-1', afterLesson: 2, durationMinutes: 15 }]
    };

    const activeDays = week.activeDays && week.activeDays.length > 0
        ? week.activeDays
        : ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];

    const hasValidSlots = data.schedule &&
        data.schedule.length > 0 &&
        data.schedule[0]?.slots &&
        data.schedule[0].slots.length > 0;

    if (hasValidSlots) {
        return data;
    }

    let currentTotalMinutes = (week.startHour ?? 7) * 60 + (week.startMinute ?? 0);
    const slots: TimeSlot[] = [];

    for (let i = 1; i <= (week.lessonsPerDayGlobal ?? 5); i++) {
        const startTime = currentTotalMinutes;
        const endTime = startTime + (week.durationMinute ?? 45);
        slots.push({
            id: `slot-aula-${i}`,
            type: 'AULA',
            start: formatTime(startTime),
            end: formatTime(endTime)
        });
        currentTotalMinutes = endTime;

        const afterThis = (week.intervals || []).filter(int => int.afterLesson === i);
        afterThis.forEach(int => {
            slots.push({
                id: int.id || `slot-int-${i}`,
                type: 'INTERVALO',
                start: formatTime(currentTotalMinutes),
                end: formatTime(currentTotalMinutes + int.durationMinutes)
            });
            currentTotalMinutes += int.durationMinutes;
        });
    }

    const generatedSchedule: DaySchedule[] = activeDays.map(day => ({
        day,
        slots: slots.map(s => ({ ...s, id: crypto.randomUUID() }))
    }));

    return {
        ...data,
        schedule: generatedSchedule
    };
};
