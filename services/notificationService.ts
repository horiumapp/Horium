import { supabase } from './supabaseClient';

export interface AppNotification {
    id: string;
    user_id: string;
    title: string;
    message: string;
    is_read: boolean;
    created_at: string;
}

export const notificationService = {
    async getNotifications(userId: string): Promise<AppNotification[]> {
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) {
                console.warn('Could not fetch notifications:', error.message);
                return [];
            }
            return data || [];
        } catch (e) {
            return [];
        }
    },

    async getUnreadCount(userId: string): Promise<number> {
        const { count, error } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('is_read', false);

        if (error) {
            console.error('Error counting notifications:', error);
            return 0;
        }
        return count || 0;
    },

    async markAsRead(notificationId: string): Promise<boolean> {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', notificationId);

        if (error) {
            console.error('Error marking notification as read:', error);
            return false;
        }
        return true;
    },

    async markAllAsRead(userId: string): Promise<boolean> {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', userId)
            .eq('is_read', false);

        if (error) {
            console.error('Error marking all as read:', error);
            return false;
        }
        return true;
    },

    async createNotification(userId: string, title: string, message: string): Promise<boolean> {
        const { error } = await supabase
            .from('notifications')
            .insert({
                user_id: userId,
                title,
                message,
                is_read: false,
            });

        if (error) {
            console.error('Error creating notification:', error);
            return false;
        }
        return true;
    }
};
