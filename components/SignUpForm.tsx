
import React, { useState } from 'react';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { authService } from '../services/authService';
import { TermsModal } from './TermsModal';

interface SignUpFormProps {
    onSuccess: (email: string) => void;
    onBackToLogin: () => void;
}

export const SignUpForm: React.FC<SignUpFormProps> = ({ onSuccess, onBackToLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [gender, setGender] = useState<'male' | 'female'>('female');
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [showTerms, setShowTerms] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password !== confirmPassword) {
            setError('As senhas não coincidem.');
            return;
        }

        if (!acceptedTerms) {
            setError('Você precisa aceitar os termos de serviço para continuar.');
            return;
        }

        setLoading(true);
        try {
            await authService.signUp(email, password, gender);
            onSuccess(email);
        } catch (err: any) {
            console.error('Signup error:', err);
            setError(authService.translateError(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-[#111418] dark:text-white text-2xl font-black mb-6">Criar nova conta</h2>

            {error && (
                <div className="mb-6 p-4 rounded-lg bg-red-100 text-red-700 text-sm font-medium border border-red-200">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                    label="E-mail"
                    placeholder="exemplo@escola.com"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    helperText="Este campo será sua identificação"
                />

                <Input
                    label="Senha"
                    placeholder="Sua senha secreta"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />

                <Input
                    label="Confirmar Senha"
                    placeholder="Repita sua senha"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                />

                <div className="flex flex-col gap-2 pt-2 px-1">
                    <p className="text-[#111418] dark:text-white text-sm font-semibold leading-normal">
                        Como prefere que seu perfil seja representado?
                    </p>
                    <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-full relative z-0">
                        <button
                            type="button"
                            onClick={() => setGender('female')}
                            className={`flex flex-1 items-center justify-center gap-2 text-sm py-2.5 px-3 rounded-md font-medium transition-all duration-300 relative ${gender === 'female' ? 'text-primary shadow-sm bg-white dark:bg-gray-700' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        >
                            <span className="material-symbols-outlined text-[20px]">woman</span>
                            Mulher
                        </button>
                        <button
                            type="button"
                            onClick={() => setGender('male')}
                            className={`flex flex-1 items-center justify-center gap-2 text-sm py-2.5 px-3 rounded-md font-medium transition-all duration-300 relative ${gender === 'male' ? 'text-primary shadow-sm bg-white dark:bg-gray-700' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        >
                            <span className="material-symbols-outlined text-[20px]">man</span>
                            Homem
                        </button>
                    </div>
                </div>

                <div className="pt-2 px-1">
                    <label className="flex items-start gap-3 cursor-pointer group">
                        <div className="relative flex items-center mt-1">
                            <input
                                type="checkbox"
                                className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border-2 border-[#dbe0e6] dark:border-gray-600 transition-all checked:bg-primary checked:border-primary"
                                checked={acceptedTerms}
                                onChange={(e) => setAcceptedTerms(e.target.checked)}
                            />
                            <span className="material-symbols-outlined absolute text-white opacity-0 peer-checked:opacity-100 left-1/2 -translate-x-1/2 pointer-events-none text-sm font-black">
                                check
                            </span>
                        </div>
                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors">
                            Declaro que li e estou de acordo com os{' '}
                            <button
                                type="button"
                                onClick={() => setShowTerms(true)}
                                className="text-primary hover:underline font-black"
                            >
                                TERMOS DE PRESTAÇÃO DE SERVIÇO
                            </button>
                        </span>
                    </label>
                </div>

                <div className="pt-4 flex flex-col gap-3">
                    <Button
                        type="submit"
                        isLoading={loading}
                        size="lg"
                        className="w-full"
                    >
                        Próximo
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={onBackToLogin}
                        className="w-full"
                    >
                        Já possuo uma conta
                    </Button>
                </div>
            </form>

            <TermsModal
                isOpen={showTerms}
                onClose={() => setShowTerms(false)}
                onAccept={() => {
                    setAcceptedTerms(true);
                    setShowTerms(false);
                }}
                onDecline={() => {
                    setAcceptedTerms(false);
                    setShowTerms(false);
                }}
            />
        </div>
    );
};
