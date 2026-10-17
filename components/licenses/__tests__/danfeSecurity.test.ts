import { describe, expect, it } from 'vitest';
import { getDanfeMarkup } from '../danfeDocument';

describe('getDanfeMarkup', () => {
    it('escapa o nome do destinatário e não injeta marcação', () => {
        const markup = getDanfeMarkup(
            { id: 'licenca-1', classes_amount: 4, value_paid: 60 },
            '<script>alert(1)</script>'
        );

        expect(markup.body).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
        expect(markup.body).not.toMatch(/<script/i);
    });

    it('trata quantidade de turmas adulterada como número', () => {
        const markup = getDanfeMarkup(
            { id: 'licenca-2', classes_amount: '<img src=x onerror=alert(1)>' as unknown as number, value_paid: 10 },
            'Escola'
        );

        expect(markup.body).toContain('0 turmas');
        expect(markup.body).not.toMatch(/onerror/i);
    });
});
