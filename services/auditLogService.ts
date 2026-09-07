import { supabase } from './supabaseClient';

export interface AuditLogEntry {
    id: string;
    tableName: string;
    recordId?: string;
    action: string;
    oldData?: any;
    newData?: any;
    userId?: string;
    createdAt: string;
}

export const auditLogService = {
    /**
     * Busca os registros de auditoria do usuário autenticado.
     * A política RLS no PostgreSQL garante que apenas registros onde auth.uid() = user_id sejam retornados.
     */
    async getMyAuditLogs(): Promise<AuditLogEntry[]> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const { data, error } = await supabase
            .from('audit_logs')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching audit logs:', error);
            throw error;
        }

        return (data || []).map(item => ({
            id: item.id,
            tableName: item.table_name,
            recordId: item.record_id,
            action: item.action,
            oldData: item.old_data,
            newData: item.new_data,
            userId: item.user_id,
            createdAt: item.created_at
        }));
    }
};
