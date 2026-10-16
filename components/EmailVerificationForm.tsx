import React, { useState } from 'react';
import { authService } from '../services/authService';

interface EmailVerificationFormProps {
    email: string;
    onSuccess?: () => void;
    onBack: () => void;
}

export const EmailVerificationForm: React.FC<EmailVerificationFormProps> = ({ email, onBack }) => {
    const [resending, setResending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const handleResend = async () => {
        setError(null);
        setResending(true);
        try {
            await authService.resendOTP(email);
            setMessage('E-mail reenviado com sucesso!');
            setTimeout(() => setMessage(null), 5000);
        } catch (err: any) {
            setError(authService.translateError(err));
        } finally {
            setResending(false);
        }
    };

    return (
        <div className="w-full flex flex-col items-center animate-in fade-in zoom-in-95 duration-300">
            <div className="mb-7 text-center">
                <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <span className="material-symbols-outlined text-3xl">mark_email_read</span>
                </div>
                <h2 className="text-slate-900 dark:text-white text-2xl font-bold">Confirme seu e-mail</h2>
                <p className="mt-2 text-slate-600 dark:text-gray-300 text-sm sm:text-base">
                    Enviamos um link de verificação para <span className="font-semibold text-primary">{email}</span>.
                </p>
                <p className="text-slate-500 dark:text-gray-400 text-sm mt-2">
                    Por favor, verifique sua caixa de entrada e clique no link de ativação para confirmar sua conta.
                </p>
            </div>

            <div className="w-full max-w-[500px] border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
                <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-5 py-3 text-center">
                    <h3 className="text-slate-900 dark:text-white text-sm font-semibold">Aguardando confirmação</h3>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/70 p-5 sm:p-6 space-y-5 flex flex-col items-center">
                    <p className="text-slate-600 dark:text-slate-300 text-center text-sm leading-relaxed">
                        Após clicar no link enviado para o seu e-mail, você poderá retornar aqui e fazer login normalmente.
                    </p>

                    {/* Feedback messages */}
                    {(error || message) && (
                        <div role="status" className={`w-full p-3 rounded-xl text-sm font-medium text-center ${error ? 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300' : 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300'}`}>
                            {error || message}
                        </div>
                    )}

                    <div className="flex justify-center w-full pt-2">
                        <button
                            type="button"
                            onClick={handleResend}
                            disabled={resending}
                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold hover:border-primary/40 hover:text-primary transition-colors disabled:opacity-50 w-full max-w-[220px]"
                        >
                            {resending ? 'Reenviando...' : 'Reenviar E-mail'}
                        </button>
                    </div>
                </div>
            </div>

            <button
                onClick={onBack}
                className="mt-7 text-sm text-gray-500 hover:text-primary font-semibold flex items-center gap-1 group"
            >
                <span className="material-symbols-outlined text-[18px] group-hover:-translate-x-1 transition-transform">arrow_back</span>
                Voltar para o login
            </button>
        </div>
    );
};
