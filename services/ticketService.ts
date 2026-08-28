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

export const ticketService = {
    async createTicket(ticket: Omit<TicketData, 'id' | 'createdAt' | 'userId' | 'status'>, imageFile?: File): Promise<TicketData> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        let imageUrl = '';

        if (imageFile) {
            const rawExt = imageFile.name.split('.').pop() || 'png';
            const fileExt = rawExt.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 5);
            const fileName = `${Date.now()}_${crypto.randomUUID()}.${fileExt}`;
            const filePath = `${user.id}/${fileName}`;

            // Assuming we create a bucket called 'tickets-attachments'
            const { error: uploadError } = await supabase.storage
                .from('tickets-attachments')
                .upload(filePath, imageFile);

            if (uploadError) {
                console.error('Error uploading image:', uploadError);
                throw uploadError;
            }

            const { data } = supabase.storage
                .from('tickets-attachments')
                .getPublicUrl(filePath);

            imageUrl = data.publicUrl;
        }

        const payload = {
            user_id: user.id,
            subject: ticket.subject,
            description: ticket.description,
            image_url: imageUrl || null,
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
    }
};
