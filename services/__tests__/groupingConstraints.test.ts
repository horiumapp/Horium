import { describe, it, expect } from 'vitest';
import { runGeneratorEngine, parseGroupingRule, getMaxConsecutiveStreak } from '../timetableWorker';
import { SetupData } from '../../types';

describe('Pedagogical Grouping Constraints and Max Consecutive Streaks', () => {
    describe('parseGroupingRule', () => {
        it('parses default Horium rule correctly (max 2 daily, max 2 consecutive)', () => {
            const rule = parseGroupingRule('Agrupar no máximo 2 aulas por dia SEGUIDAS');
            expect(rule.maxDaily).toBe(2);
            expect(rule.maxConsecutive).toBe(2);
            expect(rule.allowConsecutive).toBe(true);
        });

        it('parses intercalated rules (maxConsecutive = 1, allowConsecutive = false)', () => {
            const rule = parseGroupingRule('Permitir no máximo 2 aulas por dia INTERCALADAS');
            expect(rule.maxDaily).toBe(2);
            expect(rule.maxConsecutive).toBe(1);
            expect(rule.allowConsecutive).toBe(false);
        });

        it('parses max 1 lesson per day', () => {
            const rule = parseGroupingRule('No máximo 1 aula por dia');
            expect(rule.maxDaily).toBe(1);
            expect(rule.maxConsecutive).toBe(1);
            expect(rule.allowConsecutive).toBe(false);
        });

        it('parses triple lessons (maxConsecutive = 3)', () => {
            const rule = parseGroupingRule('Agrupar no máximo 3 aulas por dia SEGUIDAS');
            expect(rule.maxDaily).toBe(3);
            expect(rule.maxConsecutive).toBe(3);
            expect(rule.allowConsecutive).toBe(true);
        });
    });

    describe('getMaxConsecutiveStreak', () => {
        it('calculates streaks correctly', () => {
            expect(getMaxConsecutiveStreak([])).toBe(0);
            expect(getMaxConsecutiveStreak([1])).toBe(1);
            expect(getMaxConsecutiveStreak([1, 2])).toBe(2);
            expect(getMaxConsecutiveStreak([1, 2, 3])).toBe(3); // 3 tempos seguidos
            expect(getMaxConsecutiveStreak([1, 3, 4])).toBe(2);
            expect(getMaxConsecutiveStreak([4, 2, 3])).toBe(3); // unordered
            expect(getMaxConsecutiveStreak([0, 2, 4])).toBe(1); // intercaladas
        });
    });

    describe('Timetable Engine Generation under Grouping Constraints', () => {
        it('NEVER creates 3 consecutive periods of the same subject under default rule', () => {
            // Recreating the exact scenario from user:
            // Turma 1º A has Ciências (3 lessons), Matemática (4 lessons), Português (4 lessons), História (3 lessons), Geografia (3 lessons), Artes (2 lessons), EdFísica (2 lessons), Espanhol (2 lessons)
            // Total 23 lessons in a 5-day, 5-slot week (25 total slots)
            const setupData: any = {
                classes: [
                    {
                        id: 'c1',
                        name: '1º A',
                        lessonsPerSubject: {
                            's_cie': 3, // Carla
                            's_mat': 4, // Jackson
                            's_por': 4, // Ana Paula
                            's_his': 3, // Diego
                            's_geo': 3, // Elisa
                            's_art': 2, // Fabiano
                            's_efis': 2, // Gabriela
                            's_esp': 2  // Isabela
                        }
                    }
                ],
                teachers: [
                    { id: 't_carla', name: 'Carla', subjects: ['s_cie'], classAssignments: { 's_cie': { 'c1': 'OBRIGATORIAMENTE' } } },
                    { id: 't_jackson', name: 'Jackson', subjects: ['s_mat'], classAssignments: { 's_mat': { 'c1': 'OBRIGATORIAMENTE' } } },
                    { id: 't_anapaula', name: 'Ana Paula', subjects: ['s_por'], classAssignments: { 's_por': { 'c1': 'OBRIGATORIAMENTE' } } },
                    { id: 't_diego', name: 'Diego', subjects: ['s_his'], classAssignments: { 's_his': { 'c1': 'OBRIGATORIAMENTE' } } },
                    { id: 't_elisa', name: 'Elisa', subjects: ['s_geo'], classAssignments: { 's_geo': { 'c1': 'OBRIGATORIAMENTE' } } },
                    { id: 't_fabiano', name: 'Fabiano', subjects: ['s_art'], classAssignments: { 's_art': { 'c1': 'OBRIGATORIAMENTE' } } },
                    { id: 't_gabriela', name: 'Gabriela', subjects: ['s_efis'], classAssignments: { 's_efis': { 'c1': 'OBRIGATORIAMENTE' } } },
                    { id: 't_isabela', name: 'Isabela', subjects: ['s_esp'], classAssignments: { 's_esp': { 'c1': 'OBRIGATORIAMENTE' } } }
                ],
                subjects: [
                    { id: 's_cie', name: 'Ciências' },
                    { id: 's_mat', name: 'Matemática' },
                    { id: 's_por', name: 'Português' },
                    { id: 's_his', name: 'História' },
                    { id: 's_geo', name: 'Geografia' },
                    { id: 's_art', name: 'Artes' },
                    { id: 's_efis', name: 'Educação Física' },
                    { id: 's_esp', name: 'Espanhol' }
                ],
                generalGrouping: 'Agrupar no máximo 2 aulas por dia SEGUIDAS',
                weekConfig: {
                    activeDays: ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'],
                    lessonsPerDayGlobal: 5
                }
            };

            const result = runGeneratorEngine(setupData);

            expect(result.failures).toHaveLength(0);
            expect(result.fixedLessons).toHaveLength(23);

            // Group by class, day, subject to verify streaks and daily counts
            const daySubjectMap: Record<string, number[]> = {};
            const dayTeacherMap: Record<string, number[]> = {};

            result.fixedLessons.forEach(fl => {
                const subKey = `${fl.classId}|${fl.day}|${fl.subjectId}`;
                const teachKey = `${fl.classId}|${fl.day}|${fl.teacherId}`;

                if (!daySubjectMap[subKey]) daySubjectMap[subKey] = [];
                if (!dayTeacherMap[teachKey]) dayTeacherMap[teachKey] = [];

                daySubjectMap[subKey].push(fl.slotIndex);
                dayTeacherMap[teachKey].push(fl.slotIndex);
            });

            // CRITÉRIO FUNDAMENTAL: Nenhuma matéria pode ter mais de 2 aulas no mesmo dia
            // e JAMAIS pode ter 3 tempos seguidos!
            Object.entries(daySubjectMap).forEach(([key, slots]) => {
                const streak = getMaxConsecutiveStreak(slots);
                expect(slots.length, `Matéria ${key} excedeu 2 aulas no mesmo dia`).toBeLessThanOrEqual(2);
                expect(streak, `Matéria ${key} formou ${streak} tempos seguidos (máximo permitido é 2)`).toBeLessThanOrEqual(2);
            });

            // O mesmo professor na mesma turma não pode ter 3 tempos seguidos
            Object.entries(dayTeacherMap).forEach(([key, slots]) => {
                const streak = getMaxConsecutiveStreak(slots);
                expect(streak, `Professor ${key} formou ${streak} tempos seguidos (máximo permitido é 2)`).toBeLessThanOrEqual(2);
            });

            // Verificar especificamente a Carla (Ciências - 3 aulas)
            const carlaLessons = result.fixedLessons.filter(fl => fl.teacherId === 't_carla');
            expect(carlaLessons).toHaveLength(3);

            // As 3 aulas da Carla devem estar distribuídas em 2 dias (ex: 2 em um dia e 1 em outro)
            const carlaDays = new Set(carlaLessons.map(fl => fl.day));
            expect(carlaDays.size, 'As 3 aulas de Ciências devem estar divididas em pelo menos 2 dias').toBeGreaterThanOrEqual(2);
        });

        it('strictly enforces Intercalated rules when requested (no consecutive periods)', () => {
            const setupData: any = {
                classes: [
                    {
                        id: 'c1',
                        name: '6º A',
                        lessonsPerSubject: { 's1': 4, 's2': 4 }
                    }
                ],
                teachers: [
                    { id: 't1', name: 'Prof 1', subjects: ['s1'], classAssignments: { 's1': { 'c1': 'OBRIGATORIAMENTE' } } },
                    { id: 't2', name: 'Prof 2', subjects: ['s2'], classAssignments: { 's2': { 'c1': 'OBRIGATORIAMENTE' } } }
                ],
                subjects: [
                    { id: 's1', name: 'Matemática' },
                    { id: 's2', name: 'História' }
                ],
                generalGrouping: 'Permitir no máximo 2 aulas por dia INTERCALADAS',
                weekConfig: {
                    activeDays: ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'],
                    lessonsPerDayGlobal: 5
                }
            };

            const result = runGeneratorEngine(setupData);
            expect(result.failures).toHaveLength(0);

            const daySubjectMap: Record<string, number[]> = {};
            result.fixedLessons.forEach(fl => {
                const key = `${fl.day}|${fl.subjectId}`;
                if (!daySubjectMap[key]) daySubjectMap[key] = [];
                daySubjectMap[key].push(fl.slotIndex);
            });

            // Intercaladas: streak must never exceed 1
            Object.entries(daySubjectMap).forEach(([key, slots]) => {
                const streak = getMaxConsecutiveStreak(slots);
                expect(streak, `Matéria ${key} teve aulas consecutivas quando a regra exige INTERCALADAS`).toBeLessThanOrEqual(1);
            });
        });

        it('regenerates a fresh timetable when reprocessed and does not lock previous generated results', () => {
            const setupData: any = {
                classes: [
                    { id: 'c1', name: '1º A', lessonsPerSubject: { 's1': 4, 's2': 4, 's3': 4 } }
                ],
                teachers: [
                    { id: 't1', name: 'Prof 1', subjects: ['s1'], classAssignments: { 's1': { 'c1': 'OBRIGATORIAMENTE' } } },
                    { id: 't2', name: 'Prof 2', subjects: ['s2'], classAssignments: { 's2': { 'c1': 'OBRIGATORIAMENTE' } } },
                    { id: 't3', name: 'Prof 3', subjects: ['s3'], classAssignments: { 's3': { 'c1': 'OBRIGATORIAMENTE' } } }
                ],
                subjects: [
                    { id: 's1', name: 'Matemática' },
                    { id: 's2', name: 'Português' },
                    { id: 's3', name: 'Ciências' }
                ],
                weekConfig: {
                    activeDays: ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'],
                    lessonsPerDayGlobal: 5
                }
            };

            // 1ª Geração
            const firstResult = runGeneratorEngine(setupData);
            expect(firstResult.fixedLessons).toHaveLength(12);

            // Simula reprocessamento onde o estado anterior continha status 'Finalizado' e as fixedLessons da 1ª rodada
            const reprocessData = {
                ...setupData,
                status: 'Finalizado',
                fixedLessons: firstResult.fixedLessons
            };

            const secondResult = runGeneratorEngine(reprocessData);
            expect(secondResult.fixedLessons).toHaveLength(12);
            expect(secondResult.failures).toHaveLength(0);

            // Nenhuma matéria pode exceder o limite diário de 2 aulas
            const dayMap: Record<string, number[]> = {};
            secondResult.fixedLessons.forEach(fl => {
                const k = `${fl.day}|${fl.subjectId}`;
                if (!dayMap[k]) dayMap[k] = [];
                dayMap[k].push(fl.slotIndex);
            });
            Object.values(dayMap).forEach(slots => {
                expect(slots.length).toBeLessThanOrEqual(2);
                expect(getMaxConsecutiveStreak(slots)).toBeLessThanOrEqual(2);
            });
        });
    });
});
