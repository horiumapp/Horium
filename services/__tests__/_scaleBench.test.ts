import { describe, it } from 'vitest';
import { runGeneratorEngine, getMaxConsecutiveStreak } from '../timetableWorker';

describe('scale', () => {
    it('20 classes, 30 teachers', () => {
        const subjects = ['s1', 's2', 's3', 's4', 's5', 's6'];
        const loads = [5, 4, 4, 3, 2, 2];
        const classes = Array.from({ length: 20 }, (_, i) => ({
            id: `c${i}`,
            name: `T${i}`,
            lessonsPerSubject: Object.fromEntries(subjects.map((s, k) => [s, loads[k]]))
        }));
        const teachers: any[] = [];
        subjects.forEach((subject, sk) => {
            for (let t = 0; t < 5; t++) {
                const owned = classes.filter((_, ci) => ci % 5 === t);
                teachers.push({
                    id: `t${sk}_${t}`,
                    name: `P${sk}_${t}`,
                    subjects: [subject],
                    classAssignments: {
                        [subject]: Object.fromEntries(owned.map(c => [c.id, 'OBRIGATORIAMENTE']))
                    }
                });
            }
        });
        const data: any = {
            classes,
            teachers,
            subjects: subjects.map(s => ({ id: s, name: s })),
            generalGrouping: 'Agrupar no máximo 2 aulas por dia SEGUIDAS',
            weekConfig: { activeDays: ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'], lessonsPerDayGlobal: 6 }
        };
        const t0 = Date.now();
        const res = runGeneratorEngine(data);
        const elapsed = Date.now() - t0;
        let gaps = 0;
        let worst = 0;
        const byTeacherDay: Record<string, number[]> = {};
        for (const lesson of res.fixedLessons) {
            const key = `${lesson.teacherId}|${lesson.day}`;
            (byTeacherDay[key] ||= []).push(lesson.slotIndex);
        }
        for (const slots of Object.values(byTeacherDay)) {
            slots.sort((a, b) => a - b);
            for (let i = 1; i < slots.length; i++) {
                const gap = slots[i] - slots[i - 1] - 1;
                if (gap > 0) gaps += gap;
                if (gap > worst) worst = gap;
            }
        }
        let maxStreak = 0;
        let overDaily = 0;
        const bySub: Record<string, number[]> = {};
        for (const lesson of res.fixedLessons) {
            const key = `${lesson.classId}|${lesson.day}|${lesson.subjectId}`;
            (bySub[key] ||= []).push(lesson.slotIndex);
        }
        for (const slots of Object.values(bySub)) {
            maxStreak = Math.max(maxStreak, getMaxConsecutiveStreak(slots));
            if (slots.length > 2) overDaily++;
        }
        const requested = 20 * loads.reduce((a, b) => a + b, 0);
        console.log(JSON.stringify({ elapsed, requested, fixed: res.fixedLessons.length, failures: res.failures.length, gaps, worst, maxStreak, overDaily }));
    });
});