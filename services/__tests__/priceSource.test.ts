import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLAN_OPTIONS, PLAN_PRICES } from '../pricingService';

const root = resolve(__dirname, '../..');

describe('preço do PIX e preço gravado no banco', () => {
    it('usa os mesmos 15, 25 e 50 no cliente e no SQL', () => {
        const sources = [
            readFileSync(resolve(root, 'schema.sql'), 'utf8'),
            readFileSync(resolve(root, 'db/migrations/0004_audit_payload_license_revocation.sql'), 'utf8')
        ];

        for (const source of sources) {
            expect(source).toMatch(/v_price_per_class := 15\.00;/);
            expect(source).toMatch(/v_price_per_class := 25\.00;/);
            expect(source).toMatch(/v_price_per_class := 50\.00;/);
        }

        expect(PLAN_PRICES['06 meses']).toBe(15);
        expect(PLAN_PRICES['1 ano']).toBe(25);
        expect(PLAN_PRICES['2 anos']).toBe(50);

        for (const option of PLAN_OPTIONS) {
            expect(option.pricePerClass).toBe(PLAN_PRICES[option.label]);
        }
    });
});
