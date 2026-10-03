import { describe, it, expect } from 'vitest';
import { runGeneratorEngine } from '../timetableWorker';

describe('runGeneratorEngine benchmark', () => {
    it('runs with 4 classes and 5 teachers', () => {
        const dummyData: any = {
            classes: [
                { id: 'c1', name: '6A', lessonsPerSubject: { 's1': 4, 's2': 4, 's3': 4, 's4': 4, 's5': 4 } },
                { id: 'c2', name: '7A', lessonsPerSubject: { 's1': 4, 's2': 4, 's3': 4, 's4': 4, 's5': 4 } },
                { id: 'c3', name: '8A', lessonsPerSubject: { 's1': 4, 's2': 4, 's3': 4, 's4': 4, 's5': 4 } },
                { id: 'c4', name: '9A', lessonsPerSubject: { 's1': 4, 's2': 4, 's3': 4, 's4': 4, 's5': 4 } },
            ],
            teachers: [
                { id: 't1', name: 'Prof 1', subjects: ['s1'], classAssignments: { 's1': { 'c1': 'OBRIGATORIAMENTE', 'c2': 'OBRIGATORIAMENTE', 'c3': 'OBRIGATORIAMENTE', 'c4': 'OBRIGATORIAMENTE' } } },
                { id: 't2', name: 'Prof 2', subjects: ['s2'], classAssignments: { 's2': { 'c1': 'OBRIGATORIAMENTE', 'c2': 'OBRIGATORIAMENTE', 'c3': 'OBRIGATORIAMENTE', 'c4': 'OBRIGATORIAMENTE' } } },
                { id: 't3', name: 'Prof 3', subjects: ['s3'], classAssignments: { 's3': { 'c1': 'OBRIGATORIAMENTE', 'c2': 'OBRIGATORIAMENTE', 'c3': 'OBRIGATORIAMENTE', 'c4': 'OBRIGATORIAMENTE' } } },
                { id: 't4', name: 'Prof 4', subjects: ['s4'], classAssignments: { 's4': { 'c1': 'OBRIGATORIAMENTE', 'c2': 'OBRIGATORIAMENTE', 'c3': 'OBRIGATORIAMENTE', 'c4': 'OBRIGATORIAMENTE' } } },
                { id: 't5', name: 'Prof 5', subjects: ['s5'], classAssignments: { 's5': { 'c1': 'OBRIGATORIAMENTE', 'c2': 'OBRIGATORIAMENTE', 'c3': 'OBRIGATORIAMENTE', 'c4': 'OBRIGATORIAMENTE' } } },
            ],
            subjects: [
                { id: 's1', name: 'Português' },
                { id: 's2', name: 'Matemática' },
                { id: 's3', name: 'História' },
                { id: 's4', name: 'Geografia' },
                { id: 's5', name: 'Ciências' },
            ],
            weekConfig: {
                activeDays: ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'],
                lessonsPerDayGlobal: 5
            }
        };

        const startTime = Date.now();
        const res = runGeneratorEngine(dummyData, (p, m) => {
            console.log(`[TEST] Progress: ${p}% - ${m} (${Date.now() - startTime}ms)`);
        });
        const elapsed = Date.now() - startTime;
        console.log(`[TEST] Finished in ${elapsed}ms. Fixed: ${res.fixedLessons.length}, Failures: ${res.failures.length}`);
        expect(res.fixedLessons.length).toBeGreaterThan(0);
    });
});
