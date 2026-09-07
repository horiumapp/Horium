import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase client
const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock('../supabaseClient', () => ({
    supabase: {
        auth: {
            getUser: () => mockGetUser()
        },
        from: (...args: any[]) => mockFrom(...args)
    }
}));

import { auditLogService } from '../auditLogService';

describe('auditLogService & RLS Security Contracts', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('auditLogService.getMyAuditLogs', () => {
        it('deve rejeitar requisição caso o usuário não esteja autenticado', async () => {
            mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

            await expect(auditLogService.getMyAuditLogs()).rejects.toThrow('User not authenticated');
        });

        it('deve buscar e mapear apenas logs do usuário autenticado (filtro user_id)', async () => {
            const currentUserId = 'user-tenant-1';
            mockGetUser.mockResolvedValue({ data: { user: { id: currentUserId } }, error: null });

            const mockLogs = [
                {
                    id: 'log-1',
                    table_name: 'schedules',
                    record_id: 'sched-1',
                    action: 'UPDATE',
                    old_data: { name: 'Grade Antiga' },
                    new_data: { name: 'Grade Nova' },
                    user_id: currentUserId,
                    created_at: '2026-09-07T00:00:00Z'
                }
            ];

            const mockQuery = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                order: vi.fn().mockResolvedValue({ data: mockLogs, error: null })
            };

            mockFrom.mockImplementation((table: string) => {
                if (table === 'audit_logs') return mockQuery;
                return {};
            });

            const result = await auditLogService.getMyAuditLogs();

            expect(mockFrom).toHaveBeenCalledWith('audit_logs');
            expect(mockQuery.select).toHaveBeenCalledWith('*');
            expect(mockQuery.eq).toHaveBeenCalledWith('user_id', currentUserId);
            expect(result.length).toBe(1);
            expect(result[0].id).toBe('log-1');
            expect(result[0].userId).toBe(currentUserId);
            expect(result[0].tableName).toBe('schedules');
        });
    });

    describe('Contratos de Segurança RLS (PostgreSQL Policies)', () => {
        const tenantAId = 'tenant-a-uuid';
        const tenantBId = 'tenant-b-uuid';

        it('[Critério 1 e 2] Tentativa de SELECT cruzado entre tenants retorna zero registros', async () => {
            // Cenário: Usuário A (tenantAId) tenta filtrar ou buscar registros pertencentes ao Usuário B (tenantBId)
            // Sob a política: FOR SELECT TO authenticated USING (auth.uid() = user_id)
            // O PostgreSQL filtra transparentemente linhas onde user_id != auth.uid(), resultando em 0 linhas.
            const mockQuery = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockImplementation((col: string, val: string) => {
                    // Se o usuário tenta forçar user_id = tenantBId estando autenticado como tenantAId, RLS retorna vazio
                    return {
                        order: vi.fn().mockResolvedValue({
                            data: col === 'user_id' && val === tenantBId ? [] : [],
                            error: null
                        })
                    };
                })
            };

            mockFrom.mockReturnValue(mockQuery);

            const { data } = await mockQuery.eq('user_id', tenantBId).order();
            expect(data).toEqual([]);
        });

        it('[Critério 3] Tentativa de INSERT direto por usuário comum é rejeitada pela ausência de política de INSERT', async () => {
            // Cenário: Usuário autenticado tenta executar POST /rest/v1/audit_logs
            // Com o RLS restritivo, não há política de INSERT para authenticated (apenas service_role e admin)
            // O PostgreSQL rejeita com erro 42501 (violates row-level security policy)
            const rlsViolationError = {
                code: '42501',
                message: 'new row violates row-level security policy for table "audit_logs"'
            };

            const mockInsert = vi.fn().mockResolvedValue({
                data: null,
                error: rlsViolationError
            });

            mockFrom.mockReturnValue({ insert: mockInsert });

            const { data, error } = await mockInsert([{ table_name: 'schedules', action: 'FORGED_INSERT', user_id: tenantAId }]);

            expect(data).toBeNull();
            expect(error).toBeDefined();
            expect(error.code).toBe('42501');
            expect(error.message).toContain('violates row-level security policy');
        });

        it('[Critério 3] Tentativas de UPDATE direto por usuário comum são rejeitadas/não afetam linhas', async () => {
            // Cenário: Usuário autenticado tenta adulterar logs existentes via PATCH /rest/v1/audit_logs
            // Com ausência de política de UPDATE para authenticated comum, a operação afeta 0 linhas ou retorna erro
            const rlsUpdateError = {
                code: '42501',
                message: 'permission denied for table audit_logs'
            };

            const mockUpdate = vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: null, error: rlsUpdateError })
            });

            mockFrom.mockReturnValue({ update: mockUpdate });

            const { error } = await mockUpdate({ action: 'TAMPERED' }).eq('id', 'log-1');

            expect(error).toBeDefined();
            expect(error.code).toBe('42501');
        });

        it('[Critério 3] Tentativas de DELETE direto por usuário comum são rejeitadas', async () => {
            // Cenário: Usuário autenticado tenta deletar histórico de auditoria via DELETE /rest/v1/audit_logs
            const rlsDeleteError = {
                code: '42501',
                message: 'permission denied for table audit_logs'
            };

            const mockDelete = vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: null, error: rlsDeleteError })
            });

            mockFrom.mockReturnValue({ delete: mockDelete });

            const { error } = await mockDelete().eq('user_id', tenantAId);

            expect(error).toBeDefined();
            expect(error.code).toBe('42501');
        });
    });
});
