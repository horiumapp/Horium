const RECEIPT_TYPES: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    pdf: 'application/pdf',
};

const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
const MAX_LOGO_LENGTH = 200_000;
const SAFE_LOGO = /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/]+={0,2}$/i;

export const receiptFileProblem = (file: File) => {
    const extension = (file.name.split('.').pop() || '').toLowerCase();
    const expectedType = RECEIPT_TYPES[extension];
    if (!expectedType || file.type !== expectedType) {
        return 'Envie o comprovante em PNG, JPG, WEBP ou PDF.';
    }
    if (file.size > MAX_RECEIPT_BYTES) {
        return 'O comprovante precisa ter no máximo 5 MB.';
    }
    return null;
};

export const receiptContentType = (file: File) => {
    const extension = (file.name.split('.').pop() || '').toLowerCase();
    return RECEIPT_TYPES[extension] || '';
};

export const safeInstitutionLogo = (value: string | null | undefined) => {
    if (!value || value.length > MAX_LOGO_LENGTH) return null;
    return SAFE_LOGO.test(value) ? value : null;
};

export const isSupabaseStorageHost = (url: string) => {
    try {
        const host = new URL(url).hostname.toLowerCase();
        return host === 'supabase.co' || host.endsWith('.supabase.co');
    } catch {
        return false;
    }
};
