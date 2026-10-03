import { supabase } from './supabaseClient';

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

const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'pdf'];
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];

export const ticketService = {
    async createTicket(ticket: Omit<TicketData, 'id' | 'createdAt' | 'userId' | 'status'>, imageFile?: File): Promise<TicketData> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        let storedPath = '';

        if (imageFile) {
            const rawExt = (imageFile.name.split('.').pop() || '').toLowerCase();
            if (!ALLOWED_EXTENSIONS.includes(rawExt) || !ALLOWED_MIME_TYPES.includes(imageFile.type)) {
                throw new Error('Tipo de arquivo não permitido. Apenas imagens (PNG, JPG, WEBP) e PDF são aceitos.');
            }

            if (imageFile.size > 5 * 1024 * 1024) {
                throw new Error('O arquivo excede o limite máximo de 5MB.');
            }

            const fileName = `${Date.now()}_${crypto.randomUUID()}.${rawExt}`;
            const filePath = `${user.id}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('tickets-attachments')
                .upload(filePath, imageFile, {
                    cacheControl: '3600',
                    upsert: false
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
        if (!pathOrUrl) return '';
        if (pathOrUrl.startsWith('http') && pathOrUrl.includes('token=')) {
            return pathOrUrl; // Mantém compatibilidade com URLs antigas já salvas
        }

        let path = pathOrUrl;
        if (path.includes('/tickets-attachments/')) {
            path = path.split('/tickets-attachments/').pop()?.split('?')[0] || path;
        }

        const { data, error } = await supabase.storage
            .from('tickets-attachments')
            .createSignedUrl(path, 3600); // 1 hora de TTL

        if (error) {
            console.error('Error generating signed URL for ticket:', error);
            return '';
        }

        return data?.signedUrl || '';
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

        // Fallback para select direto na tabela tickets
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

        // Se a RPC não existir ou falhar, tenta o update direto na tabela como fallback
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
