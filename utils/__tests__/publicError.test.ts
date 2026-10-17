import { describe, expect, it } from 'vitest';
import { toPublicError } from '../publicError';

describe('toPublicError', () => {
    it('esconde detalhe interno do banco', () => {
        expect(toPublicError({
            message: 'new row violates row-level security policy for table "licenses"',
            code: '42501',
        }, 'Não foi possível concluir.')).toBe('Não foi possível concluir.');
    });

    it('mostra a frase fixa de uma regra nossa, sem o valor enviado', () => {
        expect(toPublicError({
            message: 'Duração de plano inválida: 5 anos',
        }, 'Falha')).toBe('Duração de plano inválida.');
    });

    it('mantém uma mensagem nossa já escrita para o usuário', () => {
        expect(toPublicError(
            new Error('Caminho de comprovante inválido ou inseguro.'),
            'Falha'
        )).toBe('Caminho de comprovante inválido ou inseguro.');
    });
});
