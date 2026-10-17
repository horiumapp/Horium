import { supabase } from './supabaseClient';
import { SAFE_STORAGE_PATH_REGEX, getSafeHttpsUrl } from './adminLicenseService';
import { isSupabaseStorageHost, receiptContentType, receiptFileProblem } from '../utils/safeMedia';

export interface TicketData {
    id?: string;
    createdAt?: string;
    userId?: string;
    userEmail?: string;
    subject: string;
    description: string;
    imageUrl?: string;
    status: 'aberto' | 'em_andamento' | 'fechado';
}

const missingRpc = (error: { code?: string; message?: string } | null) =>
    error?.code === 'PGRST202' || /could not find the function/i.test(error?.message || '');

export const ticketService = {
    async createTicket(ticket: Omit<TicketData, 'id' | 'createdAt' | 'userId' | 'status'>, imageFile?: File): Promise<TicketData> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        let storedPath = '';

        if (imageFile) {
            const fileProblem = receiptFileProblem(imageFile, 'anexo');
            if (fileProblem) throw new Error(fileProblem);

            const rawExt = (imageFile.name.split('.').pop() || '').toLowerCase();

            const fileName = `${Date.now()}_${crypto.randomUUID()}.${rawExt}`;
            const filePath = `${user.id}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('tickets-attachments')
                .upload(filePath, imageFile, {
                    cacheControl: '3600',
                    upsert: false,
                    contentType: receiptContentType(imageFile)
                });

            if (uploadError) {
                console.error('Error uploading ticket attachment:', uploadError);
                throw uploadError;
            }

            // Armazenamos o filePath relativo seguro
            storedPath = filePath;
        }

        const payload = {
            user_id: user.id,
            subject: ticket.subject,
            description: ticket.description,
            image_url: storedPath || null,
            status: 'aberto'
        };

        const { data, error } = await supabase
            .from('tickets')
            .insert([payload])
            .select()
            .single();

        if (error) {
            console.error('Error creating ticket:', error);
            throw error;
        }

        return {
            id: data.id,
            createdAt: data.created_at,
            userId: data.user_id,
            subject: data.subject,
            description: data.description,
            imageUrl: data.image_url,
            status: data.status
        };
    },

    /**
     * Gera uma URL pré-assinada temporária (1 hora) para visualização segura do anexo
     */
    async getAttachmentSignedUrl(pathOrUrl: string): Promise<string> {
        if (!pathOrUrl || typeof pathOrUrl !== 'string') return '';
        const trimmed = pathOrUrl.trim();
        const lower = trimmed.toLowerCase();

        if (
            lower.startsWith('javascript:') ||
            lower.startsWith('data:') ||
            lower.startsWith('vbscript:') ||
            lower.startsWith('file:') ||
            lower.startsWith('blob:')
        ) {
            return '';
        }

        let path = trimmed;
        if (path.includes('/tickets-attachments/')) {
            path = path.split('/tickets-attachments/').pop()?.split('?')[0] || '';
        }
        if (path.includes('://') || path.includes('..') || !SAFE_STORAGE_PATH_REGEX.test(path)) {
            return '';
        }

        const { data, error } = await supabase.storage
            .from('tickets-attachments')
            .createSignedUrl(path, 3600);

        if (error || !data?.signedUrl) {
            console.error('Error generating signed URL for ticket:', error);
            return '';
        }

        const safeSigned = getSafeHttpsUrl(data.signedUrl);
        if (!safeSigned || !isSupabaseStorageHost(safeSigned)) return '';
        return safeSigned;
    },

    /**
     * Busca todos os chamados com e-mail do solicitante para a Área Administrativa
     */
    async getAllTickets(): Promise<TicketData[]> {
        // Tenta buscar via RPC segura get_admin_tickets
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_admin_tickets');

        if (!rpcError && rpcData) {
            return rpcData.map((d: any) => ({
                id: d.id,
                createdAt: d.created_at,
                userId: d.user_id,
                userEmail: d.user_email || 'Email não disponível',
                subject: d.subject,
                description: d.description,
                imageUrl: d.image_url,
                status: d.status
            }));
        }

        if (rpcError && !missingRpc(rpcError)) {
            console.error('Error fetching tickets:', rpcError);
            throw rpcError;
        }

        // A tabela direta só entra se a RPC ainda não existir neste projeto.
        const { data, error } = await supabase
            .from('tickets')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching tickets:', error);
            throw error;
        }

        return (data || []).map((d: any) => ({
            id: d.id,
            createdAt: d.created_at,
            userId: d.user_id,
            userEmail: 'Email não disponível',
            subject: d.subject,
            description: d.description,
            imageUrl: d.image_url,
            status: d.status
        }));
    },

    /**
     * Busca chamados do usuário logado
     */
    async getUserTickets(): Promise<TicketData[]> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('tickets')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching user tickets:', error);
            throw error;
        }

        return (data || []).map((d: any) => ({
            id: d.id,
            createdAt: d.created_at,
            userId: d.user_id,
            subject: d.subject,
            description: d.description,
            imageUrl: d.image_url,
            status: d.status
        }));
    },

    /**
     * Atualiza o status do chamado (Apenas Admin)
     */
    async updateTicketStatus(ticketId: string, status: 'aberto' | 'em_andamento' | 'fechado'): Promise<void> {
        // Tenta primeiro via RPC dedicada (Security Definer) para contornar políticas RLS legadas
        const { error: rpcError } = await supabase.rpc('update_ticket_status_rpc', {
            p_ticket_id: ticketId,
            p_status: status
        });

        if (!rpcError) {
            return;
        }

        if (!missingRpc(rpcError)) {
            console.error('Error updating ticket status:', rpcError);
            throw rpcError;
        }

        // Update direto só se a RPC ainda não existir neste projeto.
        const { error } = await supabase
            .from('tickets')
            .update({ status })
            .eq('id', ticketId);

        if (error) {
            console.error('Error updating ticket status:', error);
            throw error;
        }
    }
};
