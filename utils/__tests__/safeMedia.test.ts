import { describe, expect, it } from 'vitest';
import { isSupabaseStorageHost, receiptFileProblem, safeInstitutionLogo } from '../safeMedia';

const file = (name: string, type: string, size = 1024) => new File([new Uint8Array(size)], name, { type });

describe('safeMedia', () => {
    it('aceita comprovante png, jpg, webp e pdf dentro do limite', () => {
        expect(receiptFileProblem(file('pix.png', 'image/png'))).toBeNull();
        expect(receiptFileProblem(file('pix.jpg', 'image/jpeg'))).toBeNull();
        expect(receiptFileProblem(file('pix.webp', 'image/webp'))).toBeNull();
        expect(receiptFileProblem(file('pix.pdf', 'application/pdf'))).toBeNull();
    });

    it('recusa extensão trocada, tipo vazio e arquivo acima de 5 MB', () => {
        expect(receiptFileProblem(file('pix.png', 'image/svg+xml'))).toMatch(/PNG, JPG, WEBP ou PDF/);
        expect(receiptFileProblem(file('pix.html', 'text/html'))).toMatch(/PNG, JPG, WEBP ou PDF/);
        expect(receiptFileProblem(file('pix.pdf', 'application/pdf', 5 * 1024 * 1024 + 1))).toMatch(/5 MB/);
    });

    it('só libera logo que o app regravou como imagem raster', () => {
        expect(safeInstitutionLogo('data:image/webp;base64,aGVsbG8=')).toBe('data:image/webp;base64,aGVsbG8=');
        expect(safeInstitutionLogo('data:image/svg+xml;base64,PHN2Zy8+')).toBeNull();
        expect(safeInstitutionLogo('javascript:alert(1)')).toBeNull();
        expect(safeInstitutionLogo('https://example.com/logo.png')).toBeNull();
    });

    it('só aceita host de storage do Supabase', () => {
        expect(isSupabaseStorageHost('https://abcd.supabase.co/storage/v1/object/sign/receipts/a.pdf?token=1')).toBe(true);
        expect(isSupabaseStorageHost('https://evil.example/storage/v1/object/sign/receipts/a.pdf')).toBe(false);
        expect(isSupabaseStorageHost('https://supabase.co.evil.example/a.pdf')).toBe(false);
    });
});
