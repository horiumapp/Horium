import { describe, it, expect } from 'vitest';
import { ensureScheduleSlots } from '../scheduleService';
import { SetupData } from '../../types';

describe('scheduleService - ensureScheduleSlots', () => {
    it('deve inicializar estrutura de slots quando o schedule for vazio', () => {
        const input: SetupData = {
            institution: { name: 'Escola Modelo', shift: 'MATUTINO', year: '2026', additionalInfo: '' },
            classes: [],
            subjects: [],
            teachers: [],
            schedule: [],
            groupingOptions: {
                minimizeMovement: false,
                clusterLessons: true,
                distributionType: 'consecutive',
                doubleLessons: 'allowed',
                maxWindows: 0,
                syncLunch: true
            },
            fixedLessons: []
        };

        const result = ensureScheduleSlots(input);

        expect(result.schedule).toBeDefined();
        expect(result.schedule.length).toBeGreaterThan(0);
        expect(result.schedule[0].slots.length).toBe(6); // 5 aulas + 1 intervalo
        expect(result.schedule[0].slots.some(s => s.type === 'INTERVALO')).toBe(true);
    });

    it('deve preservar slots existentes caso já estejam configurados', () => {
        const customSlots = [
            { id: '1', name: '1ª Aula', start: '07:00', end: '07:50', type: 'AULA' as const },
            { id: '2', name: '2ª Aula', start: '07:50', end: '08:40', type: 'AULA' as const }
        ];

        const input: SetupData = {
            institution: { name: 'Escola Teste', shift: 'MATUTINO', year: '2026', additionalInfo: '' },
            classes: [],
            subjects: [],
            teachers: [],
            schedule: [{ day: 'Segunda', slots: customSlots }],
            groupingOptions: {
                minimizeMovement: false,
                clusterLessons: true,
                distributionType: 'consecutive',
                doubleLessons: 'allowed',
                maxWindows: 0,
                syncLunch: true
            },
            fixedLessons: []
        };

        const result = ensureScheduleSlots(input);
        expect(result.schedule[0].slots.length).toBe(2);
        expect(result.schedule[0].slots[0].start).toBe('07:00');
    });
});
