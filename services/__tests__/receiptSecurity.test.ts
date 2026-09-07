import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase client
const mockCreateSignedUrl = vi.fn();
const mockFromStorage = vi.fn();

vi.mock('../supabaseClient', () => ({
    supabase: {
        storage: {
            from: (bucket: string) => mockFromStorage(bucket)
        },
        rpc: vi.fn(),
        from: vi.fn()
    }
}));

import {
    adminLicenseService,
    getSafeHttpsUrl,
    isPdfReceipt,
    SAFE_STORAGE_PATH_REGEX
} from '../adminLicenseService';

describe('Receipt Security & XSS Mitigation Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFromStorage.mockReturnValue({
            createSignedUrl: mockCreateSignedUrl
        });
    });

    describe('getSafeHttpsUrl', () => {
        it('deve rejeitar URIs com esquema javascript:', () => {
            expect(getSafeHttpsUrl('javascript:alert(document.domain)//.pdf')).toBeNull();
            expect(getSafeHttpsUrl('JAVASCRIPT:alert(1)')).toBeNull();
            expect(getSafeHttpsUrl('  javascript:void(0)')).toBeNull();
        });

        it('deve rejeitar URIs com esquema data:', () => {
            expect(getSafeHttpsUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
            expect(getSafeHttpsUrl('DATA:image/svg+xml;base64,PHN2Zw==')).toBeNull();
        });

        it('deve rejeitar esquemas inseguros ou desconhecidos (http, vbscript, file, blob)', () => {
            expect(getSafeHttpsUrl('http://insecure-site.com/receipt.pdf')).toBeNull();
            expect(getSafeHttpsUrl('vbscript:msgbox(1)')).toBeNull();
            expect(getSafeHttpsUrl('file:///etc/passwd')).toBeNull();
            expect(getSafeHttpsUrl('blob:http://localhost/uuid')).toBeNull();
        });

        it('deve aceitar URLs que utilizam estritamente o protocolo HTTPS', () => {
            const validUrl = 'https://supabase.project.co/storage/v1/object/sign/receipts/user-1/rec.pdf?token=abc';
            expect(getSafeHttpsUrl(validUrl)).toBe(validUrl);
        });

        it('deve retornar null para strings vazias ou nulas', () => {
            expect(getSafeHttpsUrl('')).toBeNull();
            expect(getSafeHttpsUrl(null)).toBeNull();
            expect(getSafeHttpsUrl(undefined)).toBeNull();
        });
    });

    describe('isPdfReceipt', () => {
        it('deve detectar PDF corretamente a partir do pathname de URLs HTTPS com token', () => {
            const url = 'https://supabase.co/storage/v1/object/sign/receipts/u1/comprovante.pdf?token=secret123&expiry=3600';
            expect(isPdfReceipt(url)).toBe(true);
        });

        it('deve retornar false para URLs com imagens mesmo que terminem com parâmetros', () => {
            const url = 'https://supabase.co/storage/v1/object/sign/receipts/u1/comprovante.png?token=secret123';
            expect(isPdfReceipt(url)).toBe(false);
        });

        it('não deve ser enganado por truques de extensão em esquemas maliciosos', () => {
            // Em javascript:alert(1)//.pdf, new URL falha ou protocolo não é http/https
            expect(isPdfReceipt('javascript:alert(1)//.pdf')).toBe(false);
        });

        it('deve identificar PDF a partir de caminho de storage relativo', () => {
            expect(isPdfReceipt('11111111-1111-1111-1111-111111111111/arquivo.pdf')).toBe(true);
            expect(isPdfReceipt('11111111-1111-1111-1111-111111111111/arquivo.jpeg')).toBe(false);
        });
    });

    describe('SAFE_STORAGE_PATH_REGEX', () => {
        it('deve aceitar caminhos válidos do bucket receipts', () => {
            const valid = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/1725678900_comprovante-01.png';
            expect(SAFE_STORAGE_PATH_REGEX.test(valid)).toBe(true);

            const validPdf = '12345678-1234-1234-1234-123456789abc/doc.pdf';
            expect(SAFE_STORAGE_PATH_REGEX.test(validPdf)).toBe(true);
        });

        it('deve rejeitar caminhos fora do padrão ou com directory traversal', () => {
            expect(SAFE_STORAGE_PATH_REGEX.test('../../etc/passwd')).toBe(false);
            expect(SAFE_STORAGE_PATH_REGEX.test('javascript:alert(1)')).toBe(false);
            expect(SAFE_STORAGE_PATH_REGEX.test('invalid-user/file.exe')).toBe(false);
            expect(SAFE_STORAGE_PATH_REGEX.test('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/file.html')).toBe(false);
        });
    });

    describe('adminLicenseService.getReceiptSignedUrl', () => {
        it('[Critério 1, 2 e 3] Deve bloquear payload de Stored XSS javascript:...//.pdf e retornar string vazia', async () => {
            const maliciousPayload = 'javascript:alert(document.domain)//.pdf';

            const result = await adminLicenseService.getReceiptSignedUrl(maliciousPayload);

            // Não deve chamar o Supabase storage
            expect(mockCreateSignedUrl).not.toHaveBeenCalled();
            // Retorna vazio em vez de repassar a string maliciosa
            expect(result).toBe('');
        });

        it('deve bloquear payload com data: scheme e retornar string vazia', async () => {
            const maliciousData = 'data:text/html,<script>alert(1)</script>';

            const result = await adminLicenseService.getReceiptSignedUrl(maliciousData);

            expect(mockCreateSignedUrl).not.toHaveBeenCalled();
            expect(result).toBe('');
        });

        it('deve gerar URL assinada HTTPS para caminho válido de storage', async () => {
            const validPath = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/comprovante_pix.pdf';
            const generatedSignedUrl = 'https://supabase.co/storage/v1/object/sign/receipts/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/comprovante_pix.pdf?token=abc';

            mockCreateSignedUrl.mockResolvedValue({
                data: { signedUrl: generatedSignedUrl },
                error: null
            });

            const result = await adminLicenseService.getReceiptSignedUrl(validPath);

            expect(mockFromStorage).toHaveBeenCalledWith('receipts');
            expect(mockCreateSignedUrl).toHaveBeenCalledWith(validPath, 3600);
            expect(result).toBe(generatedSignedUrl);
        });

        it('nunca deve repassar o input cru caso a geração de signedUrl falhe', async () => {
            const validPath = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/falha.pdf';

            mockCreateSignedUrl.mockResolvedValue({
                data: null,
                error: new Error('Storage error')
            });

            const result = await adminLicenseService.getReceiptSignedUrl(validPath);

            // Deve retornar string vazia e nunca o path cru
            expect(result).toBe('');
        });
    });
});
