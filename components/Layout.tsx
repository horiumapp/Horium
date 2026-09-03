
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
    <div className="min-h-screen flex flex-col font-sans text-[#111418] dark:text-gray-100 bg-[#f8f9fa] dark:bg-[#1a2634] transition-colors duration-300">
      <header className="no-print flex items-center justify-between whitespace-nowrap border-b border-solid border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-[#101822]/80 backdrop-blur-md px-6 lg:px-10 py-3 sticky top-0 z-50 transition-all">
        <div
          className={`flex items-center gap-4 ${hideNav || currentView === AppView.LOGIN ? 'cursor-default' : 'cursor-pointer hover:opacity-80 transition-opacity'}`}
          onClick={hideNav || currentView === AppView.LOGIN ? undefined : () => setView(AppView.DASHBOARD)}
        >
          <div className="size-8 text-primary animate-in spin-in-180 duration-700">
            {LOGO_SVG}
          </div>
          <h2 className="text-xl font-black leading-tight tracking-tight hidden sm:block">Horium</h2>
        </div>

        {!hideNav && (
          <div className="flex flex-1 justify-end gap-6 items-center">
            <nav className="hidden md:flex items-center gap-1 mr-4 bg-gray-100 dark:bg-gray-900/50 p-1 rounded-xl">
              {NAV_ITEMS.map((item) => {
                const isActive = currentView === item.view;
                return (
                  <button
                    key={item.label}
                    onClick={() => setView(item.view)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-300 ${isActive
                      ? 'bg-white dark:bg-gray-800 text-primary shadow-sm scale-105'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-800/50'
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
                  className={`ml-2 flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-300 relative ${currentView === AppView.ADMIN
                    ? 'bg-green-600 text-white shadow-md scale-105'
                    : 'text-green-600 bg-green-50 hover:bg-green-100 hover:text-green-700 dark:bg-green-900/20 dark:hover:bg-green-900/40 dark:text-green-400'
                    }`}
                >
                  <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
                  Área Admin
                  {pendingApprovalsCount > 0 && (
                    <span className="absolute -top-1 -right-1 size-5 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-white dark:border-gray-900 animate-bounce">
                      {pendingApprovalsCount}
                    </span>
                  )}
                </button>
              )}
            </nav>
            <div className="flex gap-2 items-center pl-4 border-l border-gray-200 dark:border-gray-700">
              <button
                className="size-10 flex items-center justify-center rounded-full bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-all"
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
                  className="size-10 flex items-center justify-center rounded-full bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-all cursor-pointer"
                  title="Configurações"
                >
                  <span className="material-symbols-outlined text-[20px]">settings</span>
                </button>

                {/* Dropdown Card */}
                <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-100 dark:border-gray-800 p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all transform origin-top-right scale-95 group-hover:scale-100 z-50">
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
                  className="size-10 flex items-center justify-center rounded-full bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-all relative"
                  title="Notificações"
                >
                  <span className="material-symbols-outlined text-[20px]">notifications</span>
                  {(unreadCount > 0 || (isAdmin && pendingApprovalsCount > 0)) && (
                    <span className="absolute top-2 right-2 size-2.5 bg-red-500 rounded-full border-2 border-white dark:border-[#101822]"></span>
                  )}
                </button>

                {/* Dropdown Card */}
                <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-100 dark:border-gray-800 p-0 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all transform origin-top-right scale-95 group-hover:scale-100 z-50 overflow-hidden">
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
              <div className="relative group ml-2">
                <div className="size-10 bg-gradient-to-br from-primary to-primary/60 rounded-full p-[2px] cursor-pointer shadow-md hover:shadow-primary/30 transition-shadow">
                  <img
                    src={gender === 'female'
                      ? "https://api.dicebear.com/7.x/notionists/svg?seed=Jasmine&backgroundColor=f8f9fa"
                      : "https://api.dicebear.com/7.x/notionists/svg?seed=Leo&backgroundColor=f8f9fa"}
                    alt="User Avatar"
                    className="size-full rounded-full bg-white dark:bg-gray-900 object-cover"
                  />
                </div>

                <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-100 dark:border-gray-800 p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all transform origin-top-right scale-95 group-hover:scale-100 z-50">
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
      </header>
      <main className="flex-1 flex flex-col relative pt-16 print:pt-0">
        {children}
      </main>
      <footer className="no-print py-8 bg-white dark:bg-[#101822]/80 border-t border-gray-200 dark:border-gray-900 mt-auto">
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
