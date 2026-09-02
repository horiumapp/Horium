import { supabase } from './supabaseClient';

export interface TicketData {
    id?: string;
    createdAt?: string;
    userId?: string;
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
    }
};
