import { supabase } from './supabaseClient';
import { audio } from './audioService';

export interface AdminLicense {
    id: string;
    user_email: string;
    payment_date: string;
    classes_amount: number;
    value_paid: number;
    payment_method: string;
    payment_status: string;
    valid_until: string;
    receipt_url: string;
    created_at: string;
    schedule_id?: string;
    schedule_name?: string;
}

/**
 * Expressão regular estrita para validação de caminho seguro de armazenamento no bucket receipts
 * Formato: <uuid>/<timestamp_uuid ou nome seguro>.<extensao permitida>
 */
export const SAFE_STORAGE_PATH_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[a-zA-Z0-9_\.\-]+\.(png|jpe?g|webp|pdf)$/i;

/**
 * Valida se uma URL utiliza estritamente o protocolo HTTPS e bloqueia schemes maliciosos (javascript:, data:, etc.)
 */
export const getSafeHttpsUrl = (url: string | null | undefined): string | null => {
    if (!url || typeof url !== 'string') return null;
    const trimmed = url.trim();
    const lower = trimmed.toLowerCase();

    // Rejeição imediata de esquemas perigosos
    if (
        lower.startsWith('javascript:') ||
        lower.startsWith('data:') ||
        lower.startsWith('vbscript:') ||
        lower.startsWith('file:') ||
        lower.startsWith('blob:')
    ) {
        return null;
    }

    // Deve iniciar estritamente com https://
    if (!lower.startsWith('https://')) {
        return null;
    }

    try {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== 'https:') {
            return null;
        }
        return trimmed;
    } catch {
        return null;
    }
};

/**
 * Valida se a URL ou caminho aponta para um arquivo PDF seguro com base no pathname da URL ou regex de storage
 */
export const isPdfReceipt = (urlOrPath: string | null | undefined): boolean => {
    if (!urlOrPath) return false;
    const lower = urlOrPath.trim().toLowerCase();

    // Rejeição de esquemas perigosos
    if (
        lower.startsWith('javascript:') ||
        lower.startsWith('data:') ||
        lower.startsWith('vbscript:') ||
        lower.startsWith('file:') ||
        lower.startsWith('blob:')
    ) {
        return false;
    }

    try {
        if (lower.startsWith('http://') || lower.startsWith('https://')) {
            const parsed = new URL(urlOrPath);
            return parsed.pathname.toLowerCase().endsWith('.pdf');
        }
        // Se for um caminho relativo, deve atender ao padrão de storage e terminar com .pdf
        if (SAFE_STORAGE_PATH_REGEX.test(urlOrPath)) {
            const cleanPath = urlOrPath.split('?')[0].split('#')[0];
            return cleanPath.toLowerCase().endsWith('.pdf');
        }
        return false;
    } catch {
        return false;
    }
};

export const adminLicenseService = {
    /**
     * Fetch all licenses with user emails for the admin panel
     */
    async getAllLicenses(): Promise<AdminLicense[]> {
        try {
            // Calls the secure RPC function created in the database
            const { data, error } = await supabase.rpc('get_admin_licenses');

            if (error) {
                console.error("Error fetching admin licenses (RPC):", error);
                throw new Error(error.message);
            }

            return (data || []).map((item: any) => ({
                id: item.id,
                user_email: item.user_email || 'Email não disponível',
                payment_date: item.payment_date,
                classes_amount: item.classes_amount || 0,
                value_paid: Number(item.value_paid) || 0,
                payment_method: item.payment_method || 'PIX',
                payment_status: item.payment_status || 'Aguardando',
                valid_until: item.valid_until,
                receipt_url: item.receipt_url || '',
                created_at: item.created_at,
                schedule_id: item.schedule_id,
                schedule_name: item.schedule_name || 'Sem nome'
            }));
        } catch (err: any) {
            console.error("Error in getAllLicenses:", err);
            throw err;
        }
    },

    /**
     * Update payment status of a license (Approve/Reject)
     */
    async updatePaymentStatus(
        licenseId: string,
        newStatus: 'Aprovado' | 'Rejeitado' | 'Aguardando',
        validUntilDate?: string
    ): Promise<void> {
        try {
            const updatePayload: Record<string, any> = {
                payment_status: newStatus
            };

            if (newStatus === 'Aprovado') {
                if (validUntilDate) {
                    updatePayload.valid_until = validUntilDate;
                } else {
                    const oneYear = new Date();
                    oneYear.setFullYear(oneYear.getFullYear() + 1);
                    updatePayload.valid_until = oneYear.toISOString().split('T')[0];
                }
            } else if (newStatus === 'Rejeitado') {
                updatePayload.valid_until = null;
            }

            const { error } = await supabase
                .from('licenses')
                .update(updatePayload)
                .eq('id', licenseId);

            if (error) {
                console.error("Error updating license status:", error);
                throw new Error(error.message);
            }

            if (newStatus === 'Aprovado') {
                audio.playSuccess();
            } else {
                audio.playPop();
            }
        } catch (err: any) {
            console.error("Error in updatePaymentStatus:", err);
            throw err;
        }
    },

    /**
     * Get pending licenses count for badge
     */
    async getPendingCount(): Promise<number> {
        try {
            const { count, error } = await supabase
                .from('licenses')
                .select('*', { count: 'exact', head: true })
                .eq('payment_status', 'Aguardando');

            if (error) throw error;
            return count || 0;
        } catch (err) {
            console.error("Error fetching pending count:", err);
            return 0;
        }
    },

    /**
     * Consulta o status de administrador do usuário autenticado através da RPC oficial segura
     */
    async isCurrentUserAdmin(): Promise<boolean> {
        try {
            const { data, error } = await supabase.rpc('is_current_user_admin');
            if (error) {
                console.warn("RPC is_current_user_admin falhou:", error);
                return false;
            }
            return !!data;
        } catch (err) {
            console.error("Erro ao verificar status de administrador via RPC:", err);
            return false;
        }
    },

    /**
     * Retorna a contagem de licenças pendentes de aprovação
     */
    async getPendingLicensesCount(): Promise<number> {
        return this.getPendingCount();
    },

    /**
     * Gera uma URL assinada temporária (1 hora) para visualização segura de comprovante.
     * Retorna string vazia caso o caminho seja inválido ou ocorra qualquer erro, prevenindo Stored XSS.
     */
    async getReceiptSignedUrl(receiptUrlOrPath: string): Promise<string> {
        if (!receiptUrlOrPath || typeof receiptUrlOrPath !== 'string') return '';
        const trimmed = receiptUrlOrPath.trim();
        const lower = trimmed.toLowerCase();

        // 1. Bloqueia esquemas perigosos
        if (
            lower.startsWith('javascript:') ||
            lower.startsWith('data:') ||
            lower.startsWith('vbscript:') ||
            lower.startsWith('file:') ||
            lower.startsWith('blob:')
        ) {
            console.warn("Tentativa de uso de esquema de URL perigoso bloqueada:", receiptUrlOrPath);
            return '';
        }

        // 2. Se já for uma URL HTTPS completa e assinada (com token)
        if (lower.startsWith('https://') && trimmed.includes('token=')) {
            const safe = getSafeHttpsUrl(trimmed);
            return safe || '';
        }

        // 3. Extrai o caminho relativo no bucket receipts
        let path = trimmed;
        if (path.includes('/receipts/')) {
            path = path.split('/receipts/').pop()?.split('?')[0] || path;
        }

        // 4. Valida se o caminho segue a regex estrita de storage
        if (!SAFE_STORAGE_PATH_REGEX.test(path)) {
            console.warn("Caminho de comprovante não atende ao padrão seguro de armazenamento:", path);
            return '';
        }

        try {
            const { data, error } = await supabase.storage
                .from('receipts')
                .createSignedUrl(path, 3600); // 1 hora de TTL

            if (error || !data?.signedUrl) {
                console.error("Erro ao gerar signed URL para comprovante:", error);
                return '';
            }

            // 5. Garante que a URL gerada é HTTPS válida
            const safeSigned = getSafeHttpsUrl(data.signedUrl);
            return safeSigned || '';
        } catch (e) {
            console.error("Exceção ao criar signed URL para comprovante:", e);
            return '';
        }
    }
};
