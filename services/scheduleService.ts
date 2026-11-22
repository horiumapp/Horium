import { supabase } from './supabaseClient';
import { SetupData, TimeSlot, DaySchedule, FixedLesson } from '../types';

export { formatTime, ensureScheduleSlots } from '../utils/scheduleUtils';
import { ensureScheduleSlots } from '../utils/scheduleUtils';
import { adminLicenseService } from './adminLicenseService';
import { businessToday, isBusinessDateExpired } from '../utils/businessDate';

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

        const todayStr = businessToday();

        // Licenças ativas devidamente validadas e aprovadas pelo administrador
        const activeApprovedUserLicenses = (licensesData || []).filter(l => {
            return l.payment_status === 'Aprovado' && !isBusinessDateExpired(l.valid_until, todayStr);
        });

        // Licenças pendentes aguardando validação do administrador
        const pendingUserLicenses = (licensesData || []).filter(l => {
            return l.payment_status === 'Aguardando' || l.payment_status === 'under_review';
        });

        const isAdmin = await adminLicenseService.isCurrentUserAdmin().catch(() => false);

        return (schedulesData || []).map(item => {
            // 1. Licença vinculada diretamente por schedule_id
            const specificLicense = (licensesData || []).find(l => l.schedule_id === item.id);
            const classCount = Array.isArray(item.data?.classes) ? item.data.classes.length : 0;

            // Licença legada sem schedule_id só cobre grades cujo nº de turmas cabe no cupo contratado
            const legacyCoveringLicense = activeApprovedUserLicenses.find(l =>
                l.schedule_id == null &&
                typeof l.classes_amount === 'number' &&
                l.classes_amount >= classCount
            );

            let isApproved = false;
            let licenseStatus = 'Sem Licença';

            if (isAdmin) {
                isApproved = true;
                licenseStatus = 'Aprovado';
            } else if (specificLicense) {
                if (specificLicense.payment_status === 'Aprovado') {
                    if (!isBusinessDateExpired(specificLicense.valid_until, todayStr)) {
                        const licensedClasses = typeof specificLicense.classes_amount === 'number'
                            ? specificLicense.classes_amount
                            : Number.POSITIVE_INFINITY;
                        if (classCount <= licensedClasses) {
                            isApproved = true;
                            licenseStatus = 'Aprovado';
                        } else {
                            isApproved = false;
                            licenseStatus = 'Limite de turmas excedido';
                        }
                    } else {
                        isApproved = false;
                        licenseStatus = 'Expirada';
                    }
                } else {
                    licenseStatus = specificLicense.payment_status || 'Sem Licença';
                }
            } else if (legacyCoveringLicense) {
                isApproved = true;
                licenseStatus = 'Aprovado';
            } else if (item.is_licensed === true && activeApprovedUserLicenses.some(l => l.schedule_id === item.id || l.schedule_id == null)) {
                // Flag server-side só vale se ainda existir licença aprovada relacionada
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
                updatedAt: item.updated_at,
                version: typeof item.version === 'number' ? item.version : 1,
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

        if (error || !Array.isArray(data)) {
            if (error) {
                console.warn('RPC get_schedule_solution recusou a leitura:', error.message);
            }
            return [];
        }

        return data as FixedLesson[];
    },

    async saveSchedule(scheduleData: SetupData): Promise<SetupData> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const normalized = ensureScheduleSlots(scheduleData);

        const { id, version: clientVersion, updatedAt: _updatedAt, createdAt: _createdAt, ...rest } = normalized;

        let fixedLessonsToSave = rest.fixedLessons;
        let storedLogo: string | null = null;
        let expectedVersion = typeof clientVersion === 'number' ? clientVersion : undefined;
        if (id && id.length > 30) { // UUID check
            try {
                const { data: existing } = await supabase
                    .from('schedules')
                    .select('data, version')
                    .eq('id', id)
                    .eq('user_id', user.id)
                    .single();
                const existingLogo = existing?.data?.institution?.logo;
                if (typeof existingLogo === 'string' && existingLogo.length > 0) {
                    storedLogo = existingLogo;
                }
                if ((!fixedLessonsToSave || fixedLessonsToSave.length === 0)
                    && existing?.data?.fixedLessons
                    && Array.isArray(existing.data.fixedLessons)
                    && existing.data.fixedLessons.length > 0) {
                    fixedLessonsToSave = existing.data.fixedLessons;
                }
                const dbVersion = typeof existing?.version === 'number' ? existing.version : 1;
                if (expectedVersion !== undefined && expectedVersion !== dbVersion) {
                    throw new Error('CONFLICT: A grade foi alterada em outra aba ou dispositivo. Recarregue antes de salvar.');
                }
                expectedVersion = expectedVersion ?? dbVersion;
            } catch (e) {
                if (e instanceof Error && e.message.startsWith('CONFLICT:')) throw e;
                console.warn('Erro ao ler a grade existente no salvamento:', e);
                expectedVersion = expectedVersion ?? 1;
            }
        }

        const incomingLogo = rest.institution?.logo;
        const logoToSave = incomingLogo === undefined ? storedLogo : (incomingLogo || null);
        const nextVersion = (expectedVersion ?? 0) + 1;

        const payload = {
            user_id: user.id,
            name: rest.institution?.name || 'Nova Grade',
            data: {
                ...rest,
                institution: {
                    ...rest.institution,
                    logo: logoToSave
                },
                fixedLessons: fixedLessonsToSave || []
            },
            updated_at: new Date().toISOString(),
            version: nextVersion
        };

        if (id && id.length > 30) { // UUID check
            let query = supabase
                .from('schedules')
                .update(payload)
                .eq('id', id)
                .eq('user_id', user.id);

            if (expectedVersion !== undefined) {
                query = query.eq('version', expectedVersion);
            }

            const { data, error } = await query.select().maybeSingle();

            if (error) {
                console.error('Error updating schedule:', error);
                throw error;
            }
            if (!data) {
                throw new Error('CONFLICT: A grade foi alterada em outra aba ou dispositivo. Recarregue antes de salvar.');
            }
            return {
                ...data.data,
                id: data.id,
                createdAt: data.created_at,
                updatedAt: data.updated_at,
                version: typeof data.version === 'number' ? data.version : nextVersion,
                fixedLessons: scheduleData.fixedLessons || data.data?.fixedLessons || []
            };
        } else {
            const { data, error } = await supabase
                .from('schedules')
                .insert([{ ...payload, version: 1 }])
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
                updatedAt: data.updated_at,
                version: typeof data.version === 'number' ? data.version : 1,
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
