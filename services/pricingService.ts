/**
 * Serviço Centralizado de Precificação e Planos do Horium
 * Fonte única da verdade para regras comerciais e financeiras.
 */

export type PlanDuration = '06 meses' | '1 ano' | '2 anos';

export interface PlanOption {
    label: PlanDuration;
    sub: string;
    pricePerClass: number;
    description: string;
}

export const PLAN_PRICES: Record<PlanDuration, number> = {
    '06 meses': 15.00,
    '1 ano': 25.00,
    '2 anos': 50.00
};

export const PLAN_OPTIONS: PlanOption[] = [
    { label: '06 meses', sub: 'SEM REAJUSTE', pricePerClass: 15.00, description: 'Acesso completo por 6 meses' },
    { label: '1 ano', sub: 'MAIS POPULAR', pricePerClass: 25.00, description: 'Ano letivo completo com atualizações' },
    { label: '2 anos', sub: 'MELHOR CUSTO-BENEFÍCIO', pricePerClass: 50.00, description: 'Dois anos com congelamento de valor' }
];

export const pricingService = {
    /**
     * Calcula o preço oficial de acordo com a quantidade de turmas e duração
     */
    calculatePrice(classesCount: number, duration: PlanDuration): number {
        const count = Math.max(1, Math.min(100, Math.floor(classesCount || 1)));
        const unitPrice = PLAN_PRICES[duration] || 15.00;
        return count * unitPrice;
    },

    /**
     * Formata valores para a moeda Real Brasileiro (BRL)
     */
    formatCurrency(value: number): string {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    },

    /**
     * Gera a tabela completa para o modal informativo de preços
     */
    generatePriceTable() {
        const table: Array<{ classes: string; type: PlanDuration; value: string }> = [];
        for (let i = 1; i <= 10; i++) {
            const label = i < 10 ? `0${i} Turma${i > 1 ? 's' : ''}` : `${i} Turmas`;
            (Object.keys(PLAN_PRICES) as PlanDuration[]).forEach(duration => {
                table.push({
                    classes: label,
                    type: duration,
                    value: this.formatCurrency(i * PLAN_PRICES[duration])
                });
            });
        }
        return table;
    }
};
