import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSignUp = vi.fn();
const mockUpdateUser = vi.fn();

vi.mock('../supabaseClient', () => ({
    supabase: {
        auth: {
            signUp: (...args: unknown[]) => mockSignUp(...args),
            updateUser: (...args: unknown[]) => mockUpdateUser(...args),
        }
    },
    setRememberSession: vi.fn(),
}));

import { authService } from '../authService';

describe('authService defensive contracts', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('não devolve a mensagem crua de um erro desconhecido', () => {
        expect(authService.translateError({
            message: 'duplicate key value violates unique constraint "admin_users_email_key"',
            code: '23505'
        })).toBe('Ocorreu um erro inesperado.');
    });

    it('continua traduzindo erros de autenticação conhecidos', () => {
        expect(authService.translateError({ message: 'Invalid login credentials' }))
            .toBe('E-mail ou senha inválidos.');
    });

    it('recusa cadastro com senha menor que 8 caracteres antes de chamar o Auth', async () => {
        await expect(authService.signUp('a@b.com', 'curta', 'female')).rejects.toThrow(
            'Password should be at least 8 characters'
        );
        expect(mockSignUp).not.toHaveBeenCalled();
    });

    it('recusa troca de senha com menos de 8 caracteres antes de chamar o Auth', async () => {
        await expect(authService.updatePassword('1234567')).rejects.toThrow(
            'Password should be at least 8 characters'
        );
        expect(mockUpdateUser).not.toHaveBeenCalled();
    });
});
