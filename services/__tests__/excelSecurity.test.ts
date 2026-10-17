import { describe, expect, it } from 'vitest';
import { excelText } from '../excelService';

describe('excelText', () => {
    it('mantém texto comum', () => {
        expect(excelText('Matemática')).toBe('Matemática');
    });

    it('impede que nome de turma vire fórmula na planilha', () => {
        expect(excelText('=1+1')).toBe("'=1+1");
        expect(excelText('+turma')).toBe("'+turma");
        expect(excelText('@cmd')).toBe("'@cmd");
    });
});
