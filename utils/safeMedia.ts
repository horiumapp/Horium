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

const matchesMagic = (bytes: Uint8Array, extension: string): boolean => {
    if (extension === 'png') {
        return bytes.length >= 8
            && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    }
    if (extension === 'jpg' || extension === 'jpeg') {
        return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    }
    if (extension === 'webp') {
        return bytes.length >= 12
            && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
            && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
    }
    if (extension === 'pdf') {
        return bytes.length >= 5
            && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;
    }
    return false;
};

export const receiptFileProblem = (file: File, label = 'comprovante') => {
    const extension = (file.name.split('.').pop() || '').toLowerCase();
    const expectedType = RECEIPT_TYPES[extension];
    if (!expectedType || file.type !== expectedType) {
        return `Envie o ${label} em PNG, JPG, WEBP ou PDF.`;
    }
    if (file.size > MAX_RECEIPT_BYTES) {
        return `O ${label} precisa ter no máximo 5 MB.`;
    }
    return null;
};

/** Valida extensão/MIME e magic bytes reais do arquivo (conteúdo). */
export const receiptFileProblemAsync = async (file: File, label = 'comprovante') => {
    const syncProblem = receiptFileProblem(file, label);
    if (syncProblem) return syncProblem;

    const extension = (file.name.split('.').pop() || '').toLowerCase();
    const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    if (!matchesMagic(header, extension)) {
        return `O conteúdo do ${label} não corresponde a um arquivo ${extension.toUpperCase()} válido.`;
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
