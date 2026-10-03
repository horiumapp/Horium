import React, { useState } from 'react';
import { authService } from '../services/authService';
import { isSupabaseConfigured } from '../services/supabaseClient';
import { SignUpForm } from '../components/SignUpForm';
import { LOGO_SVG } from '../constants';
import { EmailVerificationForm } from '../components/EmailVerificationForm';

interface LoginPageProps {
  onLogin: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      setError('O Supabase ainda não foi configurado. Adicione suas credenciais no arquivo .env.local para continuar.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await authService.signIn(email, password);
      onLogin();

    } catch (err: any) {
      console.error('Login error:', err);
      // If email not confirmed, we could automatically show verification
      if (err.message === 'Email not confirmed') {
        setPendingEmail(email);
        setShowVerification(true);
        return;
      }
      setError(authService.translateError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Por favor, digite seu e-mail para recuperar a senha.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await authService.resetPassword(email);
      setError('E-mail de recuperação enviado com sucesso! Verifique sua caixa de entrada.');
      setShowForgotPassword(false);
    } catch (err: any) {
      console.error('Reset password error:', err);
      setError(authService.translateError(err));
    } finally {
      setLoading(false);
    }
  };

  const onSuccessSignUp = (registeredEmail: string) => {
    setPendingEmail(registeredEmail);
    setIsRegistering(false);
    setShowVerification(true);
  };

  const onSuccessVerification = () => {
    setShowVerification(false);
    setError('E-mail confirmado com sucesso! Agora você pode entrar.');
  };

  return (
    <div className="flex-1 academic-gradient flex items-center justify-center px-4 py-12">
      <div className={`w-full ${showVerification ? 'max-w-[800px]' : 'max-w-[480px]'} bg-white dark:bg-[#1a2634] rounded-2xl shadow-2xl p-8 md:p-10 border border-[#dbe0e6] dark:border-gray-700 transition-all duration-500 overflow-hidden`}>
        {!showVerification && !showForgotPassword && (
          <div className="flex flex-col items-center mb-8 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="size-20 mb-4 animate-in zoom-in-50 duration-500">
              {LOGO_SVG}
            </div>
            <h1 className="text-[#111418] dark:text-white tracking-tight text-3xl font-bold leading-tight text-center">Horium</h1>
            <h2 className="text-gray-500 dark:text-gray-400 text-base font-medium leading-normal text-center mt-1">Gestão de Horários Escolares</h2>
          </div>
        )}

        {showVerification ? (
          <EmailVerificationForm
            email={pendingEmail}
            onSuccess={onSuccessVerification}
            onBack={() => setShowVerification(false)}
          />
        ) : isRegistering ? (
          <SignUpForm
            onSuccess={(email) => onSuccessSignUp(email)}
            onBackToLogin={() => setIsRegistering(false)}
          />
        ) : showForgotPassword ? (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex flex-col items-center mb-8">
              <div className="size-16 mb-4 bg-primary/10 text-primary rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl">key</span>
              </div>
              <h1 className="text-[#111418] dark:text-white tracking-tight text-2xl font-bold leading-tight text-center">Recuperar Senha</h1>
              <h2 className="text-gray-500 dark:text-gray-400 text-sm font-medium leading-normal text-center mt-2 max-w-[300px]">Digite seu e-mail cadastrado e enviaremos um link de recuperação.</h2>
            </div>

            {error && (
              <div className="mb-6 bg-red-100 text-red-700 border-red-200 p-4 rounded-lg text-sm font-medium border">
                {error}
              </div>
            )}

            <form className="space-y-6" onSubmit={handleForgotPassword}>
              <label className="flex flex-col w-full">
                <p className="text-[#111418] dark:text-white text-sm font-semibold leading-normal pb-2">E-mail</p>
                <input
                  className="form-input flex w-full rounded-lg text-[#111418] dark:text-white focus:ring-2 focus:ring-primary/20 border border-[#dbe0e6] dark:border-gray-600 bg-white dark:bg-background-dark focus:border-primary h-14 placeholder:text-[#617289] px-4 text-base font-normal"
                  placeholder="Digite seu e-mail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>

              <div className="flex flex-col gap-3">
                <button
                  className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-lg transition-all shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? 'Enviando...' : 'Enviar Link de Recuperação'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setShowForgotPassword(false);
                  }}
                  className="w-full py-4 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 font-bold text-sm transition-colors"
                  disabled={loading}
                >
                  Voltar para o Login
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-left-4 duration-300">
            {!isSupabaseConfigured && (
              <div className="mb-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs">
                <div className="flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-xl shrink-0 mt-0.5">warning</span>
                  <div className="space-y-1.5 w-full">
                    <p className="font-bold text-amber-900 dark:text-amber-100 text-sm">Configuração do Supabase pendente</p>
                    <p className="leading-relaxed">
                      Para autenticação e salvamento no banco de dados, preencha o arquivo <code className="font-mono bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5 rounded text-amber-900 dark:text-amber-200">.env.local</code> na raiz do projeto:
                    </p>
                    <div className="font-mono text-[11px] bg-white/80 dark:bg-black/50 p-2.5 rounded border border-amber-200 dark:border-amber-800/60 select-all leading-snug">
                      VITE_SUPABASE_URL=https://seu-projeto.supabase.co<br />
                      VITE_SUPABASE_ANON_KEY=sua-chave-anon
                    </div>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className={`mb-6 p-4 rounded-lg text-sm font-medium border ${error.includes('sucesso') ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                {error}
              </div>
            )}

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="flex flex-col w-full">
                <label className="flex flex-col w-full">
                  <p className="text-[#111418] dark:text-white text-sm font-semibold leading-normal pb-2">E-mail</p>
                  <input
                    className="form-input flex w-full rounded-lg text-[#111418] dark:text-white focus:ring-2 focus:ring-primary/20 border border-[#dbe0e6] dark:border-gray-600 bg-white dark:bg-background-dark focus:border-primary h-14 placeholder:text-[#617289] px-4 text-base font-normal"
                    placeholder="Digite seu e-mail"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </label>
              </div>
              <div className="flex flex-col w-full">
                <label className="flex flex-col w-full">
                  <div className="flex justify-between items-center pb-2">
                    <p className="text-[#111418] dark:text-white text-sm font-semibold leading-normal">Senha</p>
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-primary text-xs font-bold hover:underline"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                  <div className="flex w-full items-stretch relative">
                    <input
                      className="form-input flex w-full rounded-lg text-[#111418] dark:text-white focus:ring-2 focus:ring-primary/20 border border-[#dbe0e6] dark:border-gray-600 bg-white dark:bg-background-dark focus:border-primary h-14 placeholder:text-[#617289] px-4 text-base font-normal pr-12"
                      placeholder="Digite sua senha"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </label>
              </div>
              <div className="flex items-center gap-2 px-1">
                <input className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary" id="remember" type="checkbox" />
                <label className="text-sm text-gray-600 dark:text-gray-400" htmlFor="remember">Mantenha-me conectado</label>
              </div>
              <button
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-lg transition-all shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                type="submit"
                disabled={loading}
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>

            <div className="mt-10 text-center border-t border-gray-100 dark:border-gray-700 pt-6">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Não possui uma conta?
                <button
                  onClick={() => setIsRegistering(true)}
                  className="text-primary font-bold hover:underline ml-1"
                  disabled={loading}
                >
                  Criar conta
                </button>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginPage;