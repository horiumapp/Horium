import { supabase } from './supabaseClient';
import { SetupData, TimeSlot, DaySchedule, FixedLesson } from '../types';

export { formatTime, ensureScheduleSlots } from '../utils/scheduleUtils';
import { ensureScheduleSlots } from '../utils/scheduleUtils';
import { adminLicenseService } from './adminLicenseService';

export const scheduleService = {
    async getSchedules(): Promise<SetupData[]> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        // Fetch schedules (filtrando explicitamente por user_id como defesa em profundidade)
        const { data: schedulesData, error: schedulesError } = await supabase
            .from('schedules')
            .select('*')
            .eq('user_id', user.id)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

        if (schedulesError) {
            console.error('Error fetching schedules:', schedulesError);
            throw schedulesError;
        }

        // Fetch licenses for this user
        const { data: licensesData, error: licensesError } = await supabase
            .from('licenses')
            .select('schedule_id, payment_status, valid_until, classes_amount, created_at')
            .eq('user_id', user.id);

        if (licensesError) {
            console.error('Error fetching licenses:', licensesError);
        }

        const todayStr = new Date().toISOString().split('T')[0];

        // Licenças ativas devidamente validadas e aprovadas pelo administrador
        const activeApprovedUserLicenses = (licensesData || []).filter(l => {
            const isNotExpired = !l.valid_until || l.valid_until >= todayStr;
            return l.payment_status === 'Aprovado' && isNotExpired;
        });

        // Licenças pendentes aguardando validação do administrador
        const pendingUserLicenses = (licensesData || []).filter(l => {
            return l.payment_status === 'Aguardando' || l.payment_status === 'under_review';
        });

        const isAdmin = await adminLicenseService.isCurrentUserAdmin().catch(() => false);

        return (schedulesData || []).map(item => {
            // 1. Licença vinculada diretamente por schedule_id
            const specificLicense = (licensesData || []).find(l => l.schedule_id === item.id);

            let isApproved = false;
            let licenseStatus = 'Sem Licença';

            if (isAdmin) {
                isApproved = true;
                licenseStatus = 'Aprovado';
            } else if (specificLicense) {
                const isNotExpired = !specificLicense.valid_until || specificLicense.valid_until >= todayStr;
                if (specificLicense.payment_status === 'Aprovado') {
                    if (isNotExpired) {
                        isApproved = true;
                        licenseStatus = 'Aprovado';
                    } else {
                        isApproved = false;
                        licenseStatus = 'Expirada';
                    }
                } else {
                    licenseStatus = specificLicense.payment_status || 'Sem Licença';
                }
            } else if (item.is_licensed === true) {
                isApproved = true;
                licenseStatus = 'Aprovado';
            } else if (activeApprovedUserLicenses.length > 0) {
                // Administrador já verificou e aprovou a licença do usuário
                isApproved = true;
                licenseStatus = 'Aprovado';
            } else if (pendingUserLicenses.length > 0) {
                // Pagamento enviado, mas ainda aguardando validação pelo administrador
                isApproved = false;
                licenseStatus = 'Aguardando';
            }

            const normalizedData = ensureScheduleSlots(item.data || {});

            // Defesa de paywall: grades sem licença ativa não têm a solução exposta na memória
            const safeData = isApproved ? normalizedData : {
                ...normalizedData,
                fixedLessons: []
            };

            return {
                ...safeData,
                id: item.id,
                createdAt: item.created_at,
                status: item.data?.status || 'Em andamento',
                isLicensed: isApproved,
                licenseStatus: licenseStatus
            };
        });
    },

    /**
     * Busca a solução detalhada (fixedLessons) protegida por paywall server-side
     */
    async getScheduleSolution(scheduleId: string): Promise<FixedLesson[]> {
        try {
            const { data, error } = await supabase.rpc('get_schedule_solution', {
                p_schedule_id: scheduleId
            });

            if (!error && data && Array.isArray(data) && data.length > 0) {
                return data as FixedLesson[];
            }
        } catch (rpcErr) {
            console.warn('RPC get_schedule_solution falhou:', rpcErr);
        }

        // Fallback resiliente: se a RPC ou tabela schedule_solutions ainda não existir no Supabase,
        // busca diretamente do campo data na tabela schedules para não perder as aulas salvas
        try {
            const { data: schedItem } = await supabase
                .from('schedules')
                .select('data')
                .eq('id', scheduleId)
                .single();

            if (schedItem?.data?.fixedLessons && Array.isArray(schedItem.data.fixedLessons) && schedItem.data.fixedLessons.length > 0) {
                return schedItem.data.fixedLessons as FixedLesson[];
            }
        } catch (fallbackErr) {
            console.warn("Fallback de fixedLessons da tabela schedules falhou:", fallbackErr);
        }

        return [];
    },

    async saveSchedule(scheduleData: SetupData): Promise<SetupData> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const normalized = ensureScheduleSlots(scheduleData);

        let fixedLessonsToSave = rest.fixedLessons;
        if (id && id.length > 30) { // UUID check
            if (!fixedLessonsToSave || fixedLessonsToSave.length === 0) {
                try {
                    const { data: existing } = await supabase
                        .from('schedules')
                        .select('data')
                        .eq('id', id)
                        .single();
                    if (existing?.data?.fixedLessons && Array.isArray(existing.data.fixedLessons) && existing.data.fixedLessons.length > 0) {
                        fixedLessonsToSave = existing.data.fixedLessons;
                    }
                } catch (e) {
                    console.warn('Erro ao verificar fixedLessons existentes no salvamento:', e);
                }
            }
        }

        const payload = {
            user_id: user.id,
            name: rest.institution?.name || 'Nova Grade',
            data: {
                ...rest,
                fixedLessons: fixedLessonsToSave || []
            },
            updated_at: new Date().toISOString()
        };

        if (id && id.length > 30) { // UUID check
            const { data, error } = await supabase
                .from('schedules')
                .update(payload)
                .eq('id', id)
                .eq('user_id', user.id)
                .select()
                .single();

            if (error) {
                console.error('Error updating schedule:', error);
                throw error;
            }
            return {
                ...data.data,
                id: data.id,
                createdAt: data.created_at,
                fixedLessons: scheduleData.fixedLessons || data.data?.fixedLessons || []
            };
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
            return {
                ...data.data,
                id: data.id,
                createdAt: data.created_at,
                fixedLessons: scheduleData.fixedLessons || data.data?.fixedLessons || []
            };
        }
    },

    async deleteSchedule(id: string): Promise<void> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const { error } = await supabase
            .from('schedules')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id)
            .eq('user_id', user.id);

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
            .eq('user_id', user.id)
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
            status: item.data?.status || 'Em andamento',
            isLicensed: item.is_licensed ?? false
        }));
    },

    async restoreSchedule(id: string): Promise<void> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const { error } = await supabase
            .from('schedules')
            .update({ deleted_at: null })
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) {
            console.error('Error restoring schedule:', error);
            throw error;
        }
    },

    async permanentlyDeleteSchedule(id: string): Promise<void> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const { error } = await supabase
            .from('schedules')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);

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
