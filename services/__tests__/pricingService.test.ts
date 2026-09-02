import { describe, it, expect } from 'vitest';
import { pricingService, PLAN_PRICES } from '../pricingService';

describe('pricingService', () => {
    it('deve calcular corretamente os valores para 1 turma em todas as durações', () => {
        expect(pricingService.calculatePrice(1, '06 meses')).toBe(15.00);
        expect(pricingService.calculatePrice(1, '1 ano')).toBe(25.00);
        expect(pricingService.calculatePrice(1, '2 anos')).toBe(50.00);
    });

    it('deve calcular corretamente os valores para múltiplas turmas', () => {
        expect(pricingService.calculatePrice(4, '06 meses')).toBe(60.00);
        expect(pricingService.calculatePrice(10, '1 ano')).toBe(250.00);
        expect(pricingService.calculatePrice(6, '2 anos')).toBe(300.00);
    });

    it('deve sanitizar quantidades inválidas, zero ou negativas para no mínimo 1 turma', () => {
        expect(pricingService.calculatePrice(0, '06 meses')).toBe(15.00);
        expect(pricingService.calculatePrice(-5, '1 ano')).toBe(25.00);
        expect(pricingService.calculatePrice(NaN, '2 anos')).toBe(50.00);
    });

    it('deve limitar a quantidade máxima a 100 turmas', () => {
        expect(pricingService.calculatePrice(250, '1 ano')).toBe(100 * 25.00);
    });

    it('deve formatar valores para moeda brasileira BRL', () => {
        const formatted = pricingService.formatCurrency(150);
        expect(formatted).toContain('150,00');
        expect(formatted).toContain('R$');
    });

    it('deve gerar tabela completa de preços até 10 turmas para os 3 planos', () => {
        const table = pricingService.generatePriceTable();
        expect(table.length).toBe(30); // 10 turmas * 3 planos
        expect(table[0].classes).toBe('01 Turma');
        expect(table[0].type).toBe('06 meses');
        expect(table[0].value).toContain('15,00');
    });
});
