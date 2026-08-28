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
            <div className="mb-8 text-center">
                <p className="text-[#111418] dark:text-gray-300 text-lg font-medium">
                    Um e-mail de verificação foi encaminhado para <span className="font-black text-primary">{email}</span>.
                </p>
                <p className="text-[#111418] dark:text-gray-300 text-base mt-2">
                    Por favor, verifique sua caixa de entrada e clique no link de ativação para confirmar sua conta.
                </p>
            </div>

            <div className="w-full max-w-[500px] border-2 border-gray-100 dark:border-gray-800 rounded-lg overflow-hidden shadow-sm">
                <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 py-2 text-center">
                    <h3 className="text-[#111418] dark:text-white text-lg font-medium">Aguardando Confirmação</h3>
                </div>

                <div className="bg-[#9bb08c] dark:bg-[#4a5d40] p-6 space-y-6 flex flex-col items-center">
                    <div className="size-16 mb-2 bg-white/20 text-white rounded-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-4xl">mark_email_read</span>
                    </div>

                    <p className="text-white text-center text-sm font-medium">
                        Após clicar no link enviado para o seu e-mail, você poderá retornar aqui e fazer login normalmente.
                    </p>

                    {/* Feedback messages */}
                    {(error || message) && (
                        <div className={`w-full p-3 rounded text-sm font-bold text-center ${error ? 'bg-red-100/90 text-red-700' : 'bg-green-100/90 text-green-700'}`}>
                            {error || message}
                        </div>
                    )}

                    <div className="flex justify-center w-full pt-2">
                        <button
                            type="button"
                            onClick={handleResend}
                            disabled={resending}
                            className="bg-white/10 border border-white/30 text-white rounded px-4 py-2 text-sm font-medium hover:bg-white/20 transition-colors disabled:opacity-50 w-full max-w-[200px]"
                        >
                            {resending ? 'Reenviando...' : 'Reenviar E-mail'}
                        </button>
                    </div>
                </div>
            </div>

            <button
                onClick={onBack}
                className="mt-8 text-sm text-gray-500 hover:text-primary font-bold flex items-center gap-1 group"
            >
                <span className="material-symbols-outlined text-[18px] group-hover:-translate-x-1 transition-transform">arrow_back</span>
                Voltar para o login
            </button>
        </div>
    );
};
