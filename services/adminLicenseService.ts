import { supabase } from './supabaseClient';
import { notificationService } from './notificationService';
import { audio } from './audioService';

export interface AdminLicense {
    id: string;
    user_email: string;
    payment_date: string;
    classes_amount: number;
    value_paid: number;
    payment_method: string;
    payment_status: string;
    valid_until: string;
    receipt_url: string;
    created_at: string;
    schedule_id?: string;
    schedule_name?: string;
}

export const adminLicenseService = {
    /**
     * Fetch all licenses with user emails for the admin panel
     */
    async getAllLicenses(): Promise<AdminLicense[]> {
        try {
            // Calls the secure RPC function created in the database
            const { data, error } = await supabase.rpc('get_admin_licenses');

            if (error) {
                console.error("Error fetching admin licenses (RPC):", error);
                throw new Error(error.message);
            }
            return data || [];
        } catch (err: any) {
            console.error("Erro no adminLicenseService.getAllLicenses:", err);
            throw err;
        }
    },

    /**
     * Approve a license, setting it to 'Aprovado' and assigning an expiration date
     */
    /**
     * Approve a license, setting it to 'Aprovado' and assigning an expiration date
     */
    async approveLicense(licenseId: string, validUntilDate: string): Promise<void> {
        try {
            // Tenta primeiro através da RPC segura com SECURITY DEFINER (atômica e autorizada)
            const { error: rpcError } = await supabase.rpc('approve_license_rpc', {
                p_license_id: licenseId,
                p_valid_until: validUntilDate
            });

            if (!rpcError) {
                audio.playChaChing();
                return;
            }

            console.warn("RPC approve_license_rpc falhou ou não existe, tentando atualização client-side direta:", rpcError);

            // Fallback direto via cliente caso a RPC ainda não tenha sido criada no Supabase
            const { error } = await supabase
                .from('licenses')
                .update({
                    payment_status: 'Aprovado',
                    valid_until: validUntilDate
                })
                .eq('id', licenseId);

            if (error) {
                console.error("Error approving license:", error);
                throw new Error(error.message);
            }

            // After approving, fetch the user_id and schedule_id from the license to send a notification and update schedule
            const { data: licenseData } = await supabase
                .from('licenses')
                .select('user_id, id, schedule_id')
                .eq('id', licenseId)
                .single();

            // Play the cha-ching sound for the admin!
            audio.playChaChing();

            if (licenseData?.user_id) {
                await notificationService.createNotification(
                    licenseData.user_id,
                    'Licença Aprovada! 🎊',
                    `Seu pagamento foi confirmado. Sua licença ficará ativa até ${new Date(validUntilDate).toLocaleDateString('pt-BR')}.`
                );
            }

            // Sync with schedules table if schedule_id exists
            if (licenseData?.schedule_id) {
                const { error: scheduleError } = await supabase
                    .from('schedules')
                    .update({ is_licensed: true })
                    .eq('id', licenseData.schedule_id);

                if (scheduleError) {
                    console.error("Error syncing license to schedule:", scheduleError);
                } else {
                    console.log(`Schedule ${licenseData.schedule_id} successfully licensed!`);
                }
            }

        } catch (err: any) {
            console.error("Erro no adminLicenseService.approveLicense:", err);
            throw err;
        }
    },

    /**
     * Delete a license entry permanentely
     */
    async deleteLicense(licenseId: string): Promise<void> {
        try {
            const { error } = await supabase
                .from('licenses')
                .delete()
                .eq('id', licenseId);

            if (error) {
                console.error("Error deleting license:", error);
                throw new Error(error.message);
            }
        } catch (err: any) {
            console.error("Erro no adminLicenseService.deleteLicense:", err);
            throw err;
        }
    },

    /**
     * Get the count of pending license requests
     */
    async getPendingLicensesCount(): Promise<number> {
        try {
            const { count, error } = await supabase
                .from('licenses')
                .select('*', { count: 'exact', head: true })
                .or('payment_status.eq.Aguardando,payment_status.eq.under_review');

            if (error) {
                console.error("Error fetching pending licenses count:", error);
                throw new Error(error.message);
            }

            return count || 0;
        } catch (err: any) {
            console.error("Erro no adminLicenseService.getPendingLicensesCount:", err);
            return 0;
        }
    }
};
