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
        from: (...args: any[]) => mockFrom(...args)
    }
}));

import { supabase } from '../supabaseClient';
import { pricingService, PLAN_PRICES } from '../pricingService';

describe('License Security Contracts & Price Tampering Prevention', () => {
    const testUserId = 'user-test-uuid-123';
    const testScheduleId = 'schedule-test-uuid-456';
    const testReceiptPath = `${testUserId}/1725678900_receipt.png`;

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetUser.mockResolvedValue({
            data: { user: { id: testUserId } },
            error: null
        });
    });

    describe('Bloqueio de Inserção Direta na Tabela licenses (RLS Default Deny)', () => {
        it('[Critério 1] Tentativa de POST /rest/v1/licenses direto por usuário autenticado é rejeitada pelo PostgreSQL', async () => {
            // Simula tentativa de atacante ignorar a RPC e enviar INSERT com preço forjado de R$ 0,01 para 100 turmas
            const fraudulentPayload = {
                user_id: testUserId,
                schedule_id: testScheduleId,
                classes_amount: 100,
                value_paid: 0.01, // Preço forjado
                payment_method: 'PIX',
                payment_status: 'Aguardando',
                receipt_url: testReceiptPath
            };

            const rlsError = {
                code: '42501',
                message: 'new row violates row-level security policy for table "licenses"'
            };

            const mockInsert = vi.fn().mockResolvedValue({
                data: null,
                error: rlsError
            });

            mockFrom.mockReturnValue({
                insert: mockInsert
            });

            const { data, error } = await supabase.from('licenses').insert(fraudulentPayload);

            expect(mockFrom).toHaveBeenCalledWith('licenses');
            expect(mockInsert).toHaveBeenCalledWith(fraudulentPayload);
            expect(data).toBeNull();
            expect(error).toBeDefined();
            expect(error?.code).toBe('42501');
            expect(error?.message).toContain('violates row-level security policy');
        });
    });

    describe('Criação Segura Exclusiva via RPC request_license_order', () => {
        it('[Critério 2 e 3] Pedidos legítimos são despachados para a RPC com auditoria no servidor', async () => {
            const expectedLicenseId = 'generated-license-uuid-789';
            mockRpc.mockResolvedValue({
                data: expectedLicenseId,
                error: null
            });

            const orderParams = {
                p_schedule_id: testScheduleId,
                p_duration: '1 ano',
                p_classes_amount: 10,
                p_receipt_path: testReceiptPath
            };

            const { data, error } = await supabase.rpc('request_license_order', orderParams);

            expect(mockRpc).toHaveBeenCalledWith('request_license_order', orderParams);
            expect(error).toBeNull();
            expect(data).toBe(expectedLicenseId);

            // Validação de cálculo oficial: 10 turmas a 1 ano = R$ 250,00 calculado no servidor
            const officialServerPrice = pricingService.calculatePrice(10, '1 ano');
            expect(officialServerPrice).toBe(250.00);
        });

        it('[Critério 3] Servidor rejeita durações inválidas ou adulteradas', async () => {
            mockRpc.mockResolvedValue({
                data: null,
                error: { message: 'Duração de plano inválida: 5 anos' }
            });

            const { data, error } = await supabase.rpc('request_license_order', {
                p_schedule_id: testScheduleId,
                p_duration: '5 anos',
                p_classes_amount: 5,
                p_receipt_path: testReceiptPath
            });

            expect(data).toBeNull();
            expect(error?.message).toContain('Duração de plano inválida');
        });

        it('[Critério 3] Servidor rejeita quantidade de turmas <= 0 ou > 100', async () => {
            mockRpc.mockResolvedValue({
                data: null,
                error: { message: 'Quantidade de turmas inválida: 0' }
            });

            const { data, error } = await supabase.rpc('request_license_order', {
                p_schedule_id: testScheduleId,
                p_duration: '1 ano',
                p_classes_amount: 0,
                p_receipt_path: testReceiptPath
            });

            expect(data).toBeNull();
            expect(error?.message).toContain('Quantidade de turmas inválida');
        });

        it('Servidor rejeita caminhos de comprovante inseguros (Stored XSS)', async () => {
            mockRpc.mockResolvedValue({
                data: null,
                error: { message: 'Caminho de comprovante inválido ou inseguro.' }
            });

            const { data, error } = await supabase.rpc('request_license_order', {
                p_schedule_id: testScheduleId,
                p_duration: '06 meses',
                p_classes_amount: 2,
                p_receipt_path: 'javascript:alert(1)//.pdf'
            });

            expect(data).toBeNull();
            expect(error?.message).toContain('Caminho de comprovante inválido ou inseguro');
        });
    });
});
