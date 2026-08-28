import { supabase } from './supabaseClient';

export const authService = {
    async signUp(email: string, password: string, gender: string) {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    gender: gender,
                }
            }
        });
        if (error) throw error;
        return data;
    },

    async signIn(email: string, password: string) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error) throw error;
        return data;
    },

    async signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    },

    async resetPassword(email: string) {
        const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/reset-password',
        });
        if (error) throw error;
        return data;
    },

    async getCurrentUser() {
        const { data: { user } } = await supabase.auth.getUser();
        return user;
    },

    async getSession() {
        const { data: { session } } = await supabase.auth.getSession();
        return session;
    },

    async verifyOTP(email: string, token: string) {
        const { data, error } = await supabase.auth.verifyOtp({
            email,
            token,
            type: 'signup'
        });
        if (error) throw error;
        return data;
    },

    async resendOTP(email: string) {
        const { data, error } = await supabase.auth.resend({
            type: 'signup',
            email: email,
        });
        if (error) throw error;
        return data;
    },

    translateError(error: any): string {
        const message = typeof error === 'string' ? error : error?.message || '';
        const code = error?.code || '';

        const errorMap: Record<string, string> = {
            'Invalid login credentials': 'E-mail ou senha inválidos.',
            'Email not confirmed': 'E-mail ainda não confirmado. Verifique sua caixa de entrada.',
            'User already registered': 'Este e-mail já está cadastrado.',
            'Password should be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres.',
            'Invalid email': 'E-mail inválido.',
            'Network request failed': 'Erro de rede. Verifique sua conexão.',
            'Token has expired': 'O código de confirmação expirou. Solicite um novo.',
            'Invalid token': 'Código de confirmação inválido.',
            'email rate limit exceeded': 'Limite de envios de e-mail excedido. Tente novamente mais tarde.',
            'over_email_send_rate_limit': 'Limite de envios de e-mail excedido. Tente novamente mais tarde.',
            'Too many requests': 'Muitas solicitações simultâneas. Tente novamente em alguns minutos.',
        };

        return errorMap[message] || errorMap[code] || message || 'Ocorreu um erro inesperado.';
    }
};
