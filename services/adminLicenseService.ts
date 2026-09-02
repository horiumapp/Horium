import { supabase } from './supabaseClient';
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
    async approveLicense(licenseId: string, validUntilDate: string): Promise<void> {
        try {
            const { error: rpcError } = await supabase.rpc('approve_license_rpc', {
                p_license_id: licenseId,
                p_valid_until: validUntilDate
            });

            if (rpcError) {
                console.error("RPC approve_license_rpc falhou:", rpcError);
                throw new Error(rpcError.message);
            }

            audio.playChaChing();
        } catch (err: any) {
            console.error("Erro no adminLicenseService.approveLicense:", err);
            throw err;
        }
    },

    /**
     * Delete a license entry permanently (via secure RPC)
     */
    async deleteLicense(licenseId: string): Promise<void> {
        try {
            const { error: rpcError } = await supabase.rpc('delete_license_rpc', {
                p_license_id: licenseId
            });

            if (rpcError) {
                console.error("RPC delete_license_rpc falhou:", rpcError);
                throw new Error(rpcError.message);
            }
        } catch (err: any) {
            console.error("Erro no adminLicenseService.deleteLicense:", err);
            throw err;
        }
    },

    /**
     * Check if the current logged-in user is an administrator via secure RPC
     */
    async isCurrentUserAdmin(): Promise<boolean> {
        try {
            const { data, error } = await supabase.rpc('is_current_user_admin');
            if (error) {
                console.warn("RPC is_current_user_admin falhou:", error);
                return false;
            }
            return !!data;
        } catch (err) {
            console.error("Erro ao verificar status de admin:", err);
            return false;
        }
    },

    /**
     * Get the count of pending license requests (via secure RPC)
     */
    async getPendingLicensesCount(): Promise<number> {
        try {
            const { data, error } = await supabase.rpc('get_pending_licenses_count_rpc');

            if (error) {
                return 0;
            }

            return typeof data === 'number' ? data : 0;
        } catch (err: any) {
            return 0;
        }
    }
};
