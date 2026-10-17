import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRpc = vi.fn();
const mockFrom = vi.fn();
const mockCreateSignedUrl = vi.fn();

vi.mock('../supabaseClient', () => ({
    supabase: {
        auth: { getUser: vi.fn() },
        rpc: (...args: unknown[]) => mockRpc(...args),
        from: (...args: unknown[]) => mockFrom(...args),
        storage: {
            from: () => ({ createSignedUrl: (...args: unknown[]) => mockCreateSignedUrl(...args) })
        }
    }
}));

import { ticketService } from '../ticketService';

const validPath = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/anexo.pdf';

describe('ticketService defensive contracts', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('descarta URL assinada de anexo fora do Supabase', async () => {
        mockCreateSignedUrl.mockResolvedValue({
            data: { signedUrl: 'https://evil.example/storage/v1/object/sign/tickets-attachments/a.pdf?token=1' },
            error: null
        });

        await expect(ticketService.getAttachmentSignedUrl(validPath)).resolves.toBe('');
    });

    it('não faz update direto quando a RPC de status recusa o acesso', async () => {
        mockRpc.mockResolvedValue({
            data: null,
            error: { message: 'Acesso negado. Apenas administradores podem atualizar chamados.', code: 'P0001' }
        });

        await expect(ticketService.updateTicketStatus('ticket-1', 'fechado')).rejects.toMatchObject({
            message: 'Acesso negado. Apenas administradores podem atualizar chamados.'
        });
        expect(mockFrom).not.toHaveBeenCalled();
    });

    it('não lista a tabela direta quando a RPC administrativa recusa o acesso', async () => {
        mockRpc.mockResolvedValue({
            data: null,
            error: { message: 'Acesso negado. Apenas administradores podem acessar esta função.', code: 'P0001' }
        });

        await expect(ticketService.getAllTickets()).rejects.toMatchObject({
            message: 'Acesso negado. Apenas administradores podem acessar esta função.'
        });
        expect(mockFrom).not.toHaveBeenCalled();
    });
});
