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
  const [showPassword, setShowPassword] = useState(false);
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

  const showBrandPanel = !showVerification && !showForgotPassword && !isRegistering;

  return (
    <div className="relative isolate flex-1 academic-gradient flex items-center justify-center px-4 py-8 sm:py-12">
      <div className={`relative z-10 mx-auto grid min-h-[min(760px,calc(100vh-140px))] w-full items-center gap-6 lg:gap-12 ${showBrandPanel ? 'max-w-6xl lg:grid-cols-[minmax(0,1fr)_minmax(390px,480px)]' : 'max-w-3xl grid-cols-1'}`}>
        {showBrandPanel && (
          <aside className="hidden lg:flex flex-col justify-center py-8 pr-6">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-white/70 px-3 py-1.5 text-xs font-semibold text-primary shadow-sm dark:border-primary/25 dark:bg-slate-900/50">
              <span className="size-2 rounded-full bg-teal-500"></span>
              Planejamento escolar em um só lugar
            </div>
            <h2 className="mt-6 max-w-xl text-4xl xl:text-5xl font-bold leading-[1.12] tracking-tight text-slate-900 dark:text-white">
              Uma semana bem planejada começa com uma grade clara.
            </h2>
            <p className="mt-4 max-w-lg text-base leading-7 text-slate-600 dark:text-slate-300">
              Organize disciplinas, turmas e professores. Configure as regras da escola e acompanhe a criação dos horários em cada etapa.
            </p>

            <div aria-hidden="true" className="mt-8 max-w-xl rounded-3xl border border-white/80 bg-white/85 p-5 shadow-xl shadow-slate-900/5 backdrop-blur dark:border-slate-700 dark:bg-slate-900/75">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-white">Visão da semana</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Organização em cada aula</p>
                </div>
                <span className="material-symbols-outlined rounded-xl bg-primary/10 p-2 text-primary">calendar_view_week</span>
              </div>
              <div className="grid grid-cols-[54px_repeat(5,minmax(0,1fr))] gap-2 text-center text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                <span></span><span>SEG</span><span>TER</span><span>QUA</span><span>QUI</span><span>SEX</span>
                {['07:00', '07:45', '08:45'].map((time, row) => (
                  <React.Fragment key={time}>
                    <span className="flex items-center">{time}</span>
                    {[0, 1, 2, 3, 4].map((day) => (
                      <span key={`${time}-${day}`} className={`h-8 rounded-lg ${((row + day) % 4 === 0) ? 'bg-teal-100 dark:bg-teal-500/20' : ((row * 2 + day) % 3 === 0) ? 'bg-indigo-100 dark:bg-indigo-500/20' : 'bg-blue-100 dark:bg-blue-500/20'}`}></span>
                    ))}
                  </React.Fragment>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-4 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-blue-400"></span>Disciplinas</span>
                <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-teal-400"></span>Disponibilidade</span>
                <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-indigo-400"></span>Turmas</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3 text-xs font-medium text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-2"><span className="material-symbols-outlined text-base text-primary">check_circle</span>Configuração guiada</div>
              <div className="flex items-center gap-2"><span className="material-symbols-outlined text-base text-primary">check_circle</span>Regras por turma</div>
              <div className="flex items-center gap-2"><span className="material-symbols-outlined text-base text-primary">check_circle</span>Grade exportável</div>
            </div>
          </aside>
        )}

      <div className={`w-full ${showVerification ? 'max-w-[800px] mx-auto' : 'max-w-[480px] mx-auto'} bg-white/95 dark:bg-[#1a2634] rounded-3xl shadow-xl shadow-slate-900/10 p-6 sm:p-8 md:p-10 border border-slate-200/80 dark:border-gray-700 transition-all duration-300 overflow-hidden`}>
        {!showVerification && !showForgotPassword && (
          <div className="flex flex-col items-center mb-8 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="size-16 mb-4 rounded-2xl bg-primary/5 p-2.5">
              {LOGO_SVG}
            </div>
            <h1 className="text-slate-900 dark:text-white tracking-tight text-2xl font-bold leading-tight text-center">Horium</h1>
            <h2 className="text-slate-500 dark:text-gray-400 text-sm font-medium leading-normal text-center mt-1">Gestão de horários escolares</h2>
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
                  className="form-input flex w-full rounded-xl text-slate-900 dark:text-white focus:ring-4 focus:ring-primary/10 border border-slate-200 dark:border-gray-600 bg-white dark:bg-slate-900 focus:border-primary min-h-12 placeholder:text-slate-400 px-4 text-sm font-normal outline-none transition"
                  placeholder="Digite seu e-mail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>

              <div className="flex flex-col gap-3">
                <button
                  className="w-full bg-primary hover:brightness-95 text-white font-semibold min-h-12 py-3 rounded-xl transition-all shadow-sm active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
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
                    className="form-input flex w-full rounded-xl text-slate-900 dark:text-white focus:ring-4 focus:ring-primary/10 border border-slate-200 dark:border-gray-600 bg-white dark:bg-slate-900 focus:border-primary min-h-12 placeholder:text-slate-400 px-4 text-sm font-normal outline-none transition"
                    placeholder="Digite seu e-mail"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </label>
              </div>
              <div className="flex flex-col w-full">
                <label className="text-[#111418] dark:text-white text-sm font-semibold leading-normal pb-2" htmlFor="login-password">Senha</label>
                <div className="relative w-full">
                  <input
                    id="login-password"
                    className="form-input flex w-full rounded-xl text-slate-900 dark:text-white focus:ring-4 focus:ring-primary/10 border border-slate-200 dark:border-gray-600 bg-white dark:bg-slate-900 focus:border-primary min-h-12 placeholder:text-slate-400 px-4 pr-12 text-sm font-normal outline-none transition"
                    placeholder="Digite sua senha"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(current => !current)}
                    aria-label={showPassword ? 'Ocultar senha' : 'Visualizar senha'}
                    aria-pressed={showPassword}
                    className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  >
                    <span className="material-symbols-outlined text-[22px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-primary text-xs font-bold hover:underline"
                  >
                    Esqueci minha senha
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 px-1">
                <input className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary" id="remember" type="checkbox" />
                <label className="text-sm text-gray-600 dark:text-gray-400" htmlFor="remember">Mantenha-me conectado</label>
              </div>
              <button
                className="w-full bg-primary hover:brightness-95 text-white font-semibold min-h-12 py-3 rounded-xl transition-all shadow-sm active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
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
    </div>
  );
};

export default LoginPage;
