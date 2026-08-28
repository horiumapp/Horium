import { supabase } from './supabaseClient';
import { SetupData } from '../types';

export const scheduleService = {
    async getSchedules(): Promise<SetupData[]> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        // Fetch schedules
        const { data: schedulesData, error: schedulesError } = await supabase
            .from('schedules')
            .select('*')
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

        if (schedulesError) {
            console.error('Error fetching schedules:', schedulesError);
            throw schedulesError;
        }

        // Fetch licenses for this user
        const { data: licensesData, error: licensesError } = await supabase
            .from('licenses')
            .select('schedule_id, payment_status')
            .eq('user_id', user.id);

        if (licensesError) {
            console.error('Error fetching licenses:', licensesError);
        }

        return (schedulesData || []).map(item => {
            const scheduleLicense = (licensesData || []).find(l => l.schedule_id === item.id);
            const isApproved = scheduleLicense?.payment_status === 'Aprovado' || item.is_licensed === true;

            return {
                ...item.data,
                id: item.id,
                createdAt: item.created_at,
                status: item.data.status || 'Em andamento',
                isLicensed: isApproved,
                licenseStatus: scheduleLicense?.payment_status || (item.is_licensed ? 'Aprovado' : 'Sem Licença')
            };
        });
    },

    async saveSchedule(scheduleData: SetupData): Promise<SetupData> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        // Extract ID if it exists and remove it from the data object to avoid redundancy
        const { id, ...rest } = scheduleData;

        const payload = {
            user_id: user.id,
            name: rest.institution.name || 'Nova Grade',
            data: rest,
            updated_at: new Date().toISOString()
        };

        if (id && id.length > 30) { // UUID check
            const { data, error } = await supabase
                .from('schedules')
                .update(payload)
                .eq('id', id)
                .select()
                .single();

            if (error) {
                console.error('Error updating schedule:', error);
                throw error;
            }
            return { ...data.data, id: data.id, createdAt: data.created_at };
        } else {
            const { data, error } = await supabase
                .from('schedules')
                .insert([payload])
                .select()
                .single();

            if (error) {
                console.error('Error inserting schedule:', error);
                throw error;
            }
            return { ...data.data, id: data.id, createdAt: data.created_at };
        }
    },

    async deleteSchedule(id: string): Promise<void> {
        const { error } = await supabase
            .from('schedules')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id);

        if (error) {
            console.error('Error deleting schedule:', error);
            throw error;
        }
    },

    async getDeletedSchedules(): Promise<SetupData[]> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data, error } = await supabase
            .from('schedules')
            .select('*')
            .not('deleted_at', 'is', null)
            .gte('deleted_at', thirtyDaysAgo.toISOString())
            .order('deleted_at', { ascending: false });

        if (error) {
            console.error('Error fetching deleted schedules:', error);
            throw error;
        }

        return (data || []).map(item => ({
            ...item.data,
            id: item.id,
            createdAt: item.created_at,
            deletedAt: item.deleted_at,
            status: item.data.status || 'Em andamento',
            isLicensed: item.is_licensed ?? false
        }));
    },

    async restoreSchedule(id: string): Promise<void> {
        const { error } = await supabase
            .from('schedules')
            .update({ deleted_at: null })
            .eq('id', id);

        if (error) {
            console.error('Error restoring schedule:', error);
            throw error;
        }
    },

    async permanentlyDeleteSchedule(id: string): Promise<void> {
        const { error } = await supabase
            .from('schedules')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error permanently deleting schedule:', error);
            throw error;
        }
    },

    async clearTrash(): Promise<void> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const { error } = await supabase
            .from('schedules')
            .delete()
            .eq('user_id', user.id)
            .not('deleted_at', 'is', null);

        if (error) {
            console.error('Error clearing trash:', error);
            throw error;
        }
    }
};
