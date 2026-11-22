/** Timezone civil usado pelo negócio (licenças, validade, pedidos). */
export const BUSINESS_TIMEZONE = 'America/Sao_Paulo';

/**
 * Retorna a data civil de hoje em Brasília no formato YYYY-MM-DD.
 * Evita o bug de UTC em que, após 21h em Brasília, toISOString() já é o dia seguinte.
 */
export function businessToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Soma meses a uma data civil YYYY-MM-DD preservando o calendário (sem UTC drift).
 */
export function addBusinessMonths(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCMonth(base.getUTCMonth() + months);
  const yy = base.getUTCFullYear();
  const mm = String(base.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(base.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/** Infere duração do plano a partir do preço unitário oficial (R$ 15 / 25 / 50). */
export function inferPlanDurationMonths(valuePaid: number, classesAmount: number): number {
  if (!classesAmount || classesAmount <= 0) return 6;
  const unit = valuePaid / classesAmount;
  if (Math.abs(unit - 50) < 0.01) return 24;
  if (Math.abs(unit - 25) < 0.01) return 12;
  return 6;
}

export function isBusinessDateExpired(validUntil: string | null | undefined, today = businessToday()): boolean {
  if (!validUntil) return false;
  return validUntil < today;
}
