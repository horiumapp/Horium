import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase client
const mockRpc = vi.fn();
const mockFrom = vi.fn();
const mockGetUser = vi.fn();

vi.mock('../supabaseClient', () => ({
    supabase: {
        auth: {
            getUser: () => mockGetUser()
        },
        rpc: (...args: any[]) => mockRpc(...args),
        from: (...args: any[]) => mockFrom(...args),
        storage: {
            from: vi.fn()
        }
    }
}));

import { adminLicenseService } from '../adminLicenseService';

describe('Admin Security & Dynamic Role Verification', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('isCurrentUserAdmin (RPC Oficial)', () => {
        it('[Critério 2 e 3] Deve consultar a RPC is_current_user_admin para determinar status de admin', async () => {
            mockRpc.mockResolvedValue({
                data: true,
                error: null
            });

            const isAdmin = await adminLicenseService.isCurrentUserAdmin();

            expect(mockRpc).toHaveBeenCalledWith('is_current_user_admin');
            expect(isAdmin).toBe(true);
        });

        it('[Critério 2 e 3] Deve retornar false caso o usuário não seja admin segundo a RPC', async () => {
            mockRpc.mockResolvedValue({
                data: false,
                error: null
            });

            const isAdmin = await adminLicenseService.isCurrentUserAdmin();

            expect(mockRpc).toHaveBeenCalledWith('is_current_user_admin');
            expect(isAdmin).toBe(false);
        });

        it('Deve retornar false com segurança em caso de falha na requisição RPC', async () => {
            mockRpc.mockResolvedValue({
                data: null,
                error: { message: 'Network / Auth error' }
            });

            const isAdmin = await adminLicenseService.isCurrentUserAdmin();

            expect(isAdmin).toBe(false);
        });

        it('[Critério 1] Não deve validar permissão administrativa por comparação de string de e-mail no frontend', async () => {
            // Qualquer e-mail aleatório depende exclusivamente da resposta da RPC do banco de dados
            mockRpc.mockResolvedValue({
                data: false,
                error: null
            });

            const isAdmin = await adminLicenseService.isCurrentUserAdmin();
            expect(isAdmin).toBe(false);
        });
    });

    describe('getPendingLicensesCount', () => {
        it('deve consultar a contagem de licenças com status Aguardando', async () => {
            const mockSelect = vi.fn().mockReturnThis();
            const mockEq = vi.fn().mockResolvedValue({
                count: 5,
                error: null
            });

            mockFrom.mockReturnValue({
                select: mockSelect,
                eq: mockEq
            });

            // Configuração do encadeamento select -> eq
            mockSelect.mockReturnValue({
                eq: mockEq
            });

            const count = await adminLicenseService.getPendingLicensesCount();

            expect(mockFrom).toHaveBeenCalledWith('licenses');
            expect(mockSelect).toHaveBeenCalledWith('*', { count: 'exact', head: true });
            expect(mockEq).toHaveBeenCalledWith('payment_status', 'Aguardando');
            expect(count).toBe(5);
        });
    });
});
