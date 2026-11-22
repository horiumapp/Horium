import { describe, expect, it } from 'vitest';
import {
  addBusinessMonths,
  businessToday,
  inferPlanDurationMonths,
  isBusinessDateExpired,
} from '../businessDate';

describe('businessDate (America/Sao_Paulo)', () => {
  it('businessToday retorna YYYY-MM-DD', () => {
    expect(businessToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('addBusinessMonths atravessa virada de mês e ano', () => {
    expect(addBusinessMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addBusinessMonths('2026-11-21', 2)).toBe('2027-01-21');
    expect(addBusinessMonths('2026-12-15', 1)).toBe('2027-01-15');
  });

  it('inferPlanDurationMonths usa preço unitário oficial', () => {
    expect(inferPlanDurationMonths(15, 1)).toBe(6);
    expect(inferPlanDurationMonths(25, 1)).toBe(12);
    expect(inferPlanDurationMonths(50, 1)).toBe(24);
    expect(inferPlanDurationMonths(150, 10)).toBe(6);
  });

  it('isBusinessDateExpired compara datas civis sem UTC drift', () => {
    expect(isBusinessDateExpired('2026-11-20', '2026-11-21')).toBe(true);
    expect(isBusinessDateExpired('2026-11-21', '2026-11-21')).toBe(false);
    expect(isBusinessDateExpired(null, '2026-11-21')).toBe(false);
  });
});
