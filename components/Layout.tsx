
import React, { useState, useEffect } from 'react';
import { LOGO_SVG } from '../constants';
import { AppView } from '../types';
import { notificationService, AppNotification } from '../services/notificationService';
import { adminLicenseService } from '../services/adminLicenseService';
import { supabase } from '../services/supabaseClient';

interface LayoutProps {
  children: React.ReactNode;
  currentView: AppView;
  setView: (view: AppView) => void;
  hideNav?: boolean;
  onLogout?: () => void;
  isMuted?: boolean;
  setIsMuted?: (muted: boolean) => void;
}

const NAV_ITEMS = [
  { view: AppView.DASHBOARD, label: 'Início', icon: 'home' },
  { view: AppView.SETUP, label: 'Gerador', icon: 'settings_suggest' },
  { view: AppView.PLANS, label: 'Licença', icon: 'workspace_premium' },
];

const Layout: React.FC<LayoutProps> = ({ children, currentView, setView, hideNav = false, onLogout, isMuted, setIsMuted }) => {
  const [gender, setGender] = useState<'male' | 'female'>('female');
  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState<string>('Usuário Horium');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem('horium-theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);

  const handleMarkAsRead = async (id: string) => {
    await notificationService.markAsRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const handleMarkAllAsRead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await notificationService.markAllAsRead(user.id);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  useEffect(() => {
    if (hideNav || currentView === AppView.LOGIN) {
      setIsAdmin(false);
      setUserEmail('Usuário Horium');
      setNotifications([]);
      setPendingApprovalsCount(0);
      return;
    }

    const fetchUser = async (sessionUser?: any) => {
      try {
        let user = sessionUser;
        if (!user) {
          const { data } = await supabase.auth.getUser();
          user = data.user;
        }

        if (user) {
          const isUserAdmin = await adminLicenseService.isCurrentUserAdmin();
          setIsAdmin(isUserAdmin);
          setUserEmail(user.email || 'Usuário Horium');

          // Fetch notifications
          try {
            const fetched = await notificationService.getNotifications(user.id);
            setNotifications(fetched);
          } catch (e) {
            setNotifications([]);
          }

          // If user is admin, fetch pending licenses
          if (isUserAdmin) {
            try {
              const count = await adminLicenseService.getPendingLicensesCount();
              setPendingApprovalsCount(count);
            } catch (e) {
              setPendingApprovalsCount(0);
            }
          }

          if (user?.user_metadata?.gender) {
            setGender(user.user_metadata.gender as 'male' | 'female');
            localStorage.setItem('horium_user_gender', user.user_metadata.gender);
          } else {
            const saved = localStorage.getItem('horium_user_gender');
            if (saved) setGender(saved as 'male' | 'female');
          }
        } else {
          setIsAdmin(false);
          setUserEmail('Usuário Horium');
          setNotifications([]);
          setPendingApprovalsCount(0);
        }
      } catch (e) {
        setIsAdmin(false);
        setUserEmail('Usuário Horium');
        setNotifications([]);
        setPendingApprovalsCount(0);
      }
    };

    fetchUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!hideNav && currentView !== AppView.LOGIN) {
        fetchUser(session?.user);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [hideNav, currentView]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('horium-theme');
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = (dark: boolean) => {
      setIsDarkMode(dark);
      if (dark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    if (savedTheme) {
      applyTheme(savedTheme === 'dark');
    } else {
      applyTheme(mediaQuery.matches);
    }

    const handleChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('horium-theme')) {
        applyTheme(e.matches);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const toggleTheme = () => {
    const nextTheme = !isDarkMode;
    setIsDarkMode(nextTheme);
    if (nextTheme) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('horium-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('horium-theme', 'light');
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans text-slate-900 dark:text-gray-100 bg-background-light dark:bg-background-dark transition-colors duration-300">
      <header className="no-print sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl transition-colors dark:border-slate-800 dark:bg-[#101822]/90">
        <div className="mx-auto flex min-h-[72px] w-full max-w-[1600px] items-center gap-5 px-4 sm:px-6 xl:px-8">
        <div
          className={`flex shrink-0 items-center gap-3 ${hideNav || currentView === AppView.LOGIN ? 'cursor-default' : 'cursor-pointer hover:opacity-80 transition-opacity'}`}
          onClick={hideNav || currentView === AppView.LOGIN ? undefined : () => setView(AppView.DASHBOARD)}
        >
          <div className="size-10 rounded-xl border border-blue-100 bg-white p-1.5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            {LOGO_SVG}
          </div>
          <div className="hidden leading-tight sm:block">
            <h2 className="text-[17px] font-extrabold tracking-tight text-slate-900 dark:text-white">Horium</h2>
            <p className="mt-0.5 text-[10px] font-medium tracking-wide text-slate-500 dark:text-slate-400">GESTÃO DE HORÁRIOS</p>
          </div>
        </div>

        {!hideNav && (
          <div className="flex min-w-0 flex-1 items-center justify-end gap-3 lg:justify-between">
            <nav aria-label="Navegação principal" className="hidden lg:flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const isActive = currentView === item.view;
                return (
                  <button
                    key={item.label}
                    onClick={() => setView(item.view)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`relative flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition-all duration-200 ${isActive
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                      }`}
                  >
                    <span className={`material-symbols-outlined text-[18px] ${isActive ? 'filled' : ''}`}>{item.icon}</span>
                    {item.label}
                  </button>
                );
              })}

              {isAdmin && (
                <button
                  onClick={() => setView(AppView.ADMIN)}
                  aria-current={currentView === AppView.ADMIN ? 'page' : undefined}
                  className={`ml-2 flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition-all duration-200 relative ${currentView === AppView.ADMIN
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'border border-emerald-200 bg-emerald-50/70 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/40'
                    }`}
                >
                  <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
                  Área Admin
                  {pendingApprovalsCount > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full border-2 border-white bg-rose-500 text-[10px] text-white dark:border-slate-900">
                      {pendingApprovalsCount}
                    </span>
                  )}
                </button>
              )}
            </nav>
            <div className="flex items-center gap-0.5 rounded-2xl border border-slate-200/80 bg-slate-50/90 p-1 dark:border-slate-700 dark:bg-slate-900/80 sm:gap-1">
              <button
                aria-label={isMuted ? "Ativar som" : "Silenciar som"}
                className="hidden size-10 items-center justify-center rounded-xl bg-transparent text-slate-500 transition-colors hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white sm:flex"
                title={isMuted ? "Ativar Som" : "Mudar para Mudo"}
                onClick={() => setIsMuted?.(!isMuted)}
              >
                <span className="material-symbols-outlined text-[20px]">
                  {isMuted ? 'volume_off' : 'volume_up'}
                </span>
              </button>
              {/* Settings Dropdown */}
              <div className="relative group">
                <button
                  aria-label="Configurações"
                  className="flex size-10 items-center justify-center rounded-xl bg-transparent text-slate-500 transition-colors hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                  title="Configurações"
                >
                  <span className="material-symbols-outlined text-[20px]">settings</span>
                </button>

                {/* Dropdown Card */}
                <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-100 dark:border-gray-800 p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all transform origin-top-right scale-95 group-hover:scale-100 group-focus-within:scale-100 z-50">
                  <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 mb-2">
                    <p className="text-sm font-bold truncate">Opções do Sistema</p>
                  </div>

                  {/* Theme Toggle */}
                  <button
                    onClick={toggleTheme}
                    className="w-full flex justify-between items-center px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 text-gray-700 dark:text-gray-300 text-sm font-medium transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px]">
                        {isDarkMode ? 'dark_mode' : 'light_mode'}
                      </span>
                      Tema {isDarkMode ? 'Escuro' : 'Claro'}
                    </div>
                    {/* Switch Indicator */}
                    <div className={`w-8 h-4 rounded-full flex items-center p-0.5 transition-colors duration-300 ${isDarkMode ? 'bg-primary' : 'bg-gray-300'}`}>
                      <div className={`w-3 h-3 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${isDarkMode ? 'translate-x-4' : 'translate-x-0'}`}></div>
                    </div>
                  </button>
                </div>
              </div>
              {/* Notification Dropdown */}
              <div className="relative group">
                <button
                  aria-label="Notificações"
                  className="relative flex size-10 items-center justify-center rounded-xl bg-transparent text-slate-500 transition-colors hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                  title="Notificações"
                >
                  <span className="material-symbols-outlined text-[20px]">notifications</span>
                  {(unreadCount > 0 || (isAdmin && pendingApprovalsCount > 0)) && (
                    <span className="absolute top-2 right-2 size-2.5 bg-red-500 rounded-full border-2 border-white dark:border-[#101822]"></span>
                  )}
                </button>

                {/* Dropdown Card */}
                <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-1.5rem)] bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-100 dark:border-gray-800 p-0 opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all transform origin-top-right scale-95 group-hover:scale-100 group-focus-within:scale-100 z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                    <p className="text-sm font-bold">Notificações</p>
                    {unreadCount > 0 && (
                      <button onClick={handleMarkAllAsRead} className="text-[10px] font-bold text-primary hover:underline">
                        Marcar todas como lidas
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {isAdmin && pendingApprovalsCount > 0 && (
                      <div
                        onClick={() => setView(AppView.ADMIN)}
                        className="p-4 border-b border-yellow-100 dark:border-yellow-900/30 bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="material-symbols-outlined text-yellow-600 dark:text-yellow-400 text-xs">pending_actions</span>
                          <h4 className="text-xs font-black text-yellow-800 dark:text-yellow-300">Pendências de Licença</h4>
                        </div>
                        <p className="text-[11px] text-yellow-700 dark:text-yellow-400 leading-relaxed font-medium">
                          Existem <strong>{pendingApprovalsCount}</strong> pedidos de licença aguardando sua aprovação.
                        </p>
                      </div>
                    )}
                    {notifications.length === 0 && (!isAdmin || pendingApprovalsCount === 0) ? (
                      <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                        Nenhuma notificação nova.
                      </div>
                    ) : (
                      notifications.map(notif => (
                        <div
                          key={notif.id}
                          onClick={() => !notif.is_read && handleMarkAsRead(notif.id)}
                          className={`p-4 border-b border-gray-50 dark:border-gray-800/50 last:border-b-0 transition-colors cursor-pointer ${notif.is_read ? 'opacity-60 bg-white dark:bg-gray-900' : 'bg-primary/5 hover:bg-primary/10 dark:bg-primary/10 dark:hover:bg-primary/20'}`}
                        >
                          <div className="flex justify-between items-start mb-1 gap-2">
                            <h4 className={`text-xs ${notif.is_read ? 'font-bold' : 'font-black'} text-gray-900 dark:text-gray-100`}>{notif.title}</h4>
                            <span className="text-[9px] text-gray-400 whitespace-nowrap">
                              {new Date(notif.created_at).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed">
                            {notif.message}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
              <div className="group relative ml-1 border-l border-slate-200 pl-2 dark:border-slate-700">
                <button type="button" aria-label={`Conta de ${userEmail}`} className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-cyan-500 p-[2px] shadow-sm transition-shadow hover:shadow-md hover:shadow-primary/25">
                  <img
                    src={gender === 'female'
                      ? "https://api.dicebear.com/7.x/notionists/svg?seed=Jasmine&backgroundColor=f8f9fa"
                      : "https://api.dicebear.com/7.x/notionists/svg?seed=Leo&backgroundColor=f8f9fa"}
                    alt=""
                    className="size-full rounded-full bg-white dark:bg-gray-900 object-cover"
                  />
                </button>

                <div className="invisible absolute right-0 top-full z-50 mt-2 w-64 max-w-[calc(100vw-1.5rem)] origin-top-right scale-95 rounded-2xl border border-slate-200 bg-white p-2 opacity-0 shadow-xl shadow-slate-900/10 transition-all group-hover:visible group-hover:scale-100 group-hover:opacity-100 group-focus-within:visible group-focus-within:scale-100 group-focus-within:opacity-100 dark:border-slate-700 dark:bg-slate-900">
                  <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 mb-2">
                    <p className="text-sm font-bold truncate" title={userEmail}>{userEmail}</p>
                    <p className="text-xs text-gray-500 truncate">Sessão Ativa</p>
                  </div>

                  <button
                    onClick={onLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 text-xs font-bold uppercase transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">logout</span>
                    Sair da Conta
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {hideNav && (
          <div className="flex items-center gap-4">
            <button className="text-xs font-bold text-gray-500 hover:text-primary transition-colors flex items-center gap-1">
              <span className="material-symbols-outlined text-base">help</span>
              Ajuda
            </button>
          </div>
        )}
        </div>
      </header>
      <main className={`flex-1 flex flex-col relative ${hideNav ? '' : 'pb-24 lg:pb-0'} print:pt-0 print:pb-0`}>
        {children}
      </main>
      {!hideNav && (
        <nav aria-label="Navegação móvel" className="no-print lg:hidden fixed bottom-3 left-3 right-3 z-40 flex items-stretch gap-1 rounded-2xl border border-slate-200 bg-white/95 p-1.5 shadow-xl shadow-slate-900/10 backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/95">
          {[...NAV_ITEMS, ...(isAdmin ? [{ view: AppView.ADMIN, label: 'Admin', icon: 'admin_panel_settings' }] : [])].map((item) => {
            const isActive = currentView === item.view;
            return (
              <button
                key={item.view}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => setView(item.view)}
                className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[10px] font-semibold transition-colors ${isActive ? 'bg-primary/10 text-primary dark:bg-primary/20' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'}`}
              >
                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      )}
      <footer className="no-print py-6 md:py-8 bg-white dark:bg-[#101822]/80 border-t border-gray-200 dark:border-gray-900 mt-auto">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4 opacity-60 hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-2 grayscale hover:grayscale-0 transition-all">
            <div className="text-primary size-5">{LOGO_SVG}</div>
            <p className="text-xs font-bold text-gray-400">© 2026 Horium</p>
          </div>
          <div className="flex gap-6 text-[10px] font-black uppercase tracking-widest text-gray-400">
            <a className="hover:text-primary transition-colors" href="#">Privacidade</a>
            <a className="hover:text-primary transition-colors" href="#">Termos</a>
            <a className="hover:text-primary transition-colors" href="#">Suporte</a>
          </div>
        </div>
      </footer>
    </div >
  );
};

export default Layout;
