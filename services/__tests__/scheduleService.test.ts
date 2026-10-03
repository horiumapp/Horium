import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SetupData, FixedLesson } from '../../types';

// Mock Supabase client
const mockGetUser = vi.fn();
const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock('../supabaseClient', () => ({
    supabase: {
        auth: {
            getUser: () => mockGetUser()
        },
        rpc: (...args: any[]) => mockRpc(...args),
        from: (...args: any[]) => mockFrom(...args)
    }
}));

import { scheduleService, ensureScheduleSlots } from '../scheduleService';

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

describe('scheduleService - Paywall e Segregação de fixedLessons', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetUser.mockResolvedValue({
            data: { user: { id: 'test-user-id' } },
            error: null
        });
        mockRpc.mockImplementation((rpcName: string) => {
            if (rpcName === 'is_current_user_admin') {
                return Promise.resolve({ data: false, error: null });
            }
            return Promise.resolve({ data: null, error: null });
        });
    });

    it('saveSchedule: deve manter fixedLessons na memória do cliente mesmo após o banco remover do campo data', async () => {
        const mockLessons: FixedLesson[] = [
            { classId: 'c1', subjectId: 's1', teacherId: 't1', day: 'Segunda', slotIndex: 0 }
        ];

        const inputData: SetupData = {
            institution: { name: 'Escola Central', shift: 'MATUTINO', year: '2026', additionalInfo: '' },
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
            fixedLessons: mockLessons
        };

        // Simula o retorno do banco onde o trigger removeu fixedLessons de schedules.data
        const mockDbData = {
            id: 'generated-schedule-uuid',
            user_id: 'test-user-id',
            created_at: new Date().toISOString(),
            data: {
                institution: { name: 'Escola Central', shift: 'MATUTINO', year: '2026' }
                // fixedLessons não retornado pelo banco (sanitizado pelo trigger)
            }
        };

        const mockInsertChain = {
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockDbData, error: null })
        };

        mockFrom.mockImplementation((table: string) => {
            if (table === 'schedules') {
                return {
                    insert: vi.fn().mockReturnValue(mockInsertChain)
                };
            }
            return {};
        });

        const result = await scheduleService.saveSchedule(inputData);

        expect(result.id).toBe('generated-schedule-uuid');
        // O cliente em memória preserva as fixedLessons geradas para visualização na etapa 8
        expect(result.fixedLessons).toEqual(mockLessons);
    });

    it('getScheduleSolution: deve invocar RPC get_schedule_solution para resgate seguro da grade', async () => {
        const mockSolution: FixedLesson[] = [
            { classId: 'c1', subjectId: 's1', teacherId: 't1', day: 'Segunda', slotIndex: 0 },
            { classId: 'c1', subjectId: 's2', teacherId: 't2', day: 'Segunda', slotIndex: 1 }
        ];

        mockRpc.mockResolvedValue({
            data: mockSolution,
            error: null
        });

        const solution = await scheduleService.getScheduleSolution('schedule-uuid-123');

        expect(mockRpc).toHaveBeenCalledWith('get_schedule_solution', {
            p_schedule_id: 'schedule-uuid-123'
        });
        expect(solution).toEqual(mockSolution);
    });

    it('getSchedules: deve mascarar fixedLessons como vazio quando a grade não for licenciada', async () => {
        const rawSchedule = {
            id: 'unlicensed-id',
            user_id: 'test-user-id',
            is_licensed: false,
            created_at: '2026-09-01T12:00:00Z',
            data: {
                institution: { name: 'Escola Não Licenciada' },
                fixedLessons: [{ classId: 'leak', subjectId: 'leak', teacherId: 'leak', day: 'Segunda', slotIndex: 0 }]
            }
        };

        const mockSchedulesChain = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: [rawSchedule], error: null })
        };

        const mockLicensesChain = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: [], error: null })
        };

        mockFrom.mockImplementation((table: string) => {
            if (table === 'schedules') return mockSchedulesChain;
            if (table === 'licenses') return mockLicensesChain;
            return {};
        });

        const schedules = await scheduleService.getSchedules();

        expect(schedules.length).toBe(1);
        expect(schedules[0].isLicensed).toBe(false);
        // Garante que fixedLessons é mascarado para array vazio
        expect(schedules[0].fixedLessons).toEqual([]);
    });

    it('getSchedules: deve manter fixedLessons quando a grade possuir licença ativa aprovada', async () => {
        const approvedLessons: FixedLesson[] = [
            { classId: 'c1', subjectId: 's1', teacherId: 't1', day: 'Segunda', slotIndex: 0 }
        ];

        const rawSchedule = {
            id: 'licensed-id',
            user_id: 'test-user-id',
            is_licensed: true,
            created_at: '2026-09-01T12:00:00Z',
            data: {
                institution: { name: 'Escola Licenciada' },
                fixedLessons: approvedLessons
            }
        };

        const mockSchedulesChain = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: [rawSchedule], error: null })
        };

        const mockLicensesChain = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
                data: [{ schedule_id: 'licensed-id', payment_status: 'Aprovado', valid_until: '2030-01-01' }],
                error: null
            })
        };

        mockFrom.mockImplementation((table: string) => {
            if (table === 'schedules') return mockSchedulesChain;
            if (table === 'licenses') return mockLicensesChain;
            return {};
        });

        const schedules = await scheduleService.getSchedules();

        expect(schedules.length).toBe(1);
        expect(schedules[0].isLicensed).toBe(true);
        expect(schedules[0].licenseStatus).toBe('Aprovado');
        expect(schedules[0].fixedLessons).toEqual(approvedLessons);
    });

    it('getSchedules: deve liberar a grade quando o administrador aprovou licença global/usuário (schedule_id nulo)', async () => {
        const approvedLessons: FixedLesson[] = [
            { classId: 'c1', subjectId: 's1', teacherId: 't1', day: 'Segunda', slotIndex: 0 }
        ];

        const rawSchedule = {
            id: 'schedule-without-direct-id',
            user_id: 'test-user-id',
            is_licensed: false,
            created_at: '2026-10-02T12:00:00Z',
            data: {
                institution: { name: 'Centro Esperança' },
                fixedLessons: approvedLessons
            }
        };

        const mockSchedulesChain = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: [rawSchedule], error: null })
        };

        const mockLicensesChain = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
                data: [{ schedule_id: null, payment_status: 'Aprovado', valid_until: '2027-04-02' }],
                error: null
            })
        };

        mockFrom.mockImplementation((table: string) => {
            if (table === 'schedules') return mockSchedulesChain;
            if (table === 'licenses') return mockLicensesChain;
            return {};
        });

        const schedules = await scheduleService.getSchedules();

        expect(schedules.length).toBe(1);
        expect(schedules[0].isLicensed).toBe(true);
        expect(schedules[0].licenseStatus).toBe('Aprovado');
        expect(schedules[0].fixedLessons).toEqual(approvedLessons);
    });

    it('getSchedules: deve manter grade bloqueada enquanto aguarda aprovação do administrador', async () => {
        const rawSchedule = {
            id: 'schedule-pending-review',
            user_id: 'test-user-id',
            is_licensed: false,
            created_at: '2026-10-02T12:00:00Z',
            data: {
                institution: { name: 'Centro Esperança' },
                fixedLessons: [{ classId: 'c1', subjectId: 's1', teacherId: 't1', day: 'Segunda', slotIndex: 0 }]
            }
        };

        const mockSchedulesChain = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: [rawSchedule], error: null })
        };

        const mockLicensesChain = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
                data: [{ schedule_id: null, payment_status: 'Aguardando', valid_until: null }],
                error: null
            })
        };

        mockFrom.mockImplementation((table: string) => {
            if (table === 'schedules') return mockSchedulesChain;
            if (table === 'licenses') return mockLicensesChain;
            return {};
        });

        const schedules = await scheduleService.getSchedules();

        expect(schedules.length).toBe(1);
        expect(schedules[0].isLicensed).toBe(false);
        expect(schedules[0].licenseStatus).toBe('Aguardando');
        expect(schedules[0].fixedLessons).toEqual([]);
    });

    it('getSchedules: deve liberar fixedLessons quando o usuário for administrador', async () => {
        mockRpc.mockImplementation((rpcName: string) => {
            if (rpcName === 'is_current_user_admin') {
                return Promise.resolve({ data: true, error: null });
            }
            return Promise.resolve({ data: null, error: null });
        });

        const rawSchedule = {
            id: 'admin-sched-id',
            user_id: 'test-user-id',
            is_licensed: false,
            created_at: '2026-09-01T12:00:00Z',
            data: {
                institution: { name: 'Escola Admin' },
                fixedLessons: [{ classId: 'c1', subjectId: 's1', teacherId: 't1', day: 'Segunda', slotIndex: 0 }]
            }
        };

        const mockSchedulesChain = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: [rawSchedule], error: null })
        };

        mockFrom.mockImplementation((table: string) => {
            if (table === 'schedules') return mockSchedulesChain;
            if (table === 'licenses') return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: [], error: null }) };
            return {};
        });

        const schedules = await scheduleService.getSchedules();

        expect(schedules.length).toBe(1);
        expect(schedules[0].isLicensed).toBe(true);
        expect(schedules[0].licenseStatus).toBe('Aprovado');
        expect(schedules[0].fixedLessons).toHaveLength(1);
    });
});

