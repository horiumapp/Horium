import { describe, it, expect } from 'vitest';
import { generatePixPayload } from '../pix';

describe('Pix EMV Payload Generator', () => {
    it('deve gerar payload Pix válido conforme especificações do Banco Central (BR Code)', () => {
        const payload = generatePixPayload('horium.app@gmail.com', 15.00);

        // Deve iniciar com o indicador de formato padrão EMV
        expect(payload.startsWith('000201')).toBe(true);

        // Deve conter a GUI do Banco Central
        expect(payload).toContain('br.gov.bcb.pix');

        // Deve conter a chave Pix
        expect(payload).toContain('horium.app@gmail.com');

        // Deve conter a moeda Real (código 986)
        expect(payload).toContain('5303986');

        // Deve conter o valor formatado com 2 casas decimais
        expect(payload).toContain('540515.00');

        // Deve conter o código do país BR
        expect(payload).toContain('5802BR');

        // Deve conter o campo de checksum CRC16 (6304 seguido de 4 caracteres hexadecimais)
        expect(payload).toMatch(/6304[0-9A-F]{4}$/);
    });

    it('deve sanitizar caracteres especiais e acentos no nome e cidade do recebedor', () => {
        const payload = generatePixPayload(
            'chave@teste.com',
            60.00,
            'Escola São Cristóvão & Cia',
            'Ribeirão Preto'
        );

        // Caracteres acentuados devem ser convertidos para ASCII normal
        expect(payload).not.toContain('ã');
        expect(payload).not.toContain('ó');
        expect(payload).toContain('Escola Sao Cristovao');
        expect(payload).toContain('Ribeirao Preto');
    });
});
