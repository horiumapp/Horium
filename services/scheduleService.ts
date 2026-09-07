import { supabase } from './supabaseClient';
import { SetupData, TimeSlot, DaySchedule, FixedLesson } from '../types';

const formatTime = (totalMinutes: number) => {
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

export const ensureScheduleSlots = (data: SetupData): SetupData => {
    const week = data.weekConfig || {
        activeDays: ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'],
        startHour: 7,
        startMinute: 0,
        durationMinute: 45,
        lessonsPerDayGlobal: 5,
        intervals: [{ id: 'int-1', afterLesson: 2, durationMinutes: 15 }]
    };

    const activeDays = week.activeDays && week.activeDays.length > 0
        ? week.activeDays
        : ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];

    const hasValidSlots = data.schedule &&
        data.schedule.length > 0 &&
        data.schedule[0]?.slots &&
        data.schedule[0].slots.length > 0;

    if (hasValidSlots) {
        return data;
    }

    let currentTotalMinutes = (week.startHour ?? 7) * 60 + (week.startMinute ?? 0);
    const slots: TimeSlot[] = [];

    for (let i = 1; i <= (week.lessonsPerDayGlobal ?? 5); i++) {
        const startTime = currentTotalMinutes;
        const endTime = startTime + (week.durationMinute ?? 45);
        slots.push({
            id: `slot-aula-${i}`,
            type: 'AULA',
            start: formatTime(startTime),
            end: formatTime(endTime)
        });
        currentTotalMinutes = endTime;

        const afterThis = (week.intervals || []).filter(int => int.afterLesson === i);
        afterThis.forEach(int => {
            slots.push({
                id: int.id || `slot-int-${i}`,
                type: 'INTERVALO',
                start: formatTime(currentTotalMinutes),
                end: formatTime(currentTotalMinutes + int.durationMinutes)
            });
            currentTotalMinutes += int.durationMinutes;
        });
    }

    const generatedSchedule: DaySchedule[] = activeDays.map(day => ({
        day,
        slots: slots.map(s => ({ ...s, id: crypto.randomUUID() }))
    }));

    return {
        ...data,
        schedule: generatedSchedule
    };
};

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
            .select('schedule_id, payment_status, valid_until')
            .eq('user_id', user.id);

        if (licensesError) {
            console.error('Error fetching licenses:', licensesError);
        }

        const todayStr = new Date().toISOString().split('T')[0];

        return (schedulesData || []).map(item => {
            const scheduleLicense = (licensesData || []).find(l => l.schedule_id === item.id);

            let isApproved = false;
            let licenseStatus = 'Sem Licença';

            if (scheduleLicense) {
                const isNotExpired = !scheduleLicense.valid_until || scheduleLicense.valid_until >= todayStr;
                if (scheduleLicense.payment_status === 'Aprovado') {
                    if (isNotExpired) {
                        isApproved = true;
                        licenseStatus = 'Aprovado';
                    } else {
                        isApproved = false;
                        licenseStatus = 'Expirada';
                    }
                } else {
                    licenseStatus = scheduleLicense.payment_status || 'Sem Licença';
                }
            } else if (item.is_licensed === true) {
                isApproved = true;
                licenseStatus = 'Aprovado';
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
        const { data, error } = await supabase.rpc('get_schedule_solution', {
            p_schedule_id: scheduleId
        });

        if (error) {
            console.error('Error fetching schedule solution (RPC):', error);
            throw new Error(error.message);
        }

        return (data as FixedLesson[]) || [];
    },

    async saveSchedule(scheduleData: SetupData): Promise<SetupData> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const normalized = ensureScheduleSlots(scheduleData);

        // Extract ID if it exists and remove it from the data object to avoid redundancy
        const { id, ...rest } = normalized;

        const payload = {
            user_id: user.id,
            name: rest.institution?.name || 'Nova Grade',
            data: rest,
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
