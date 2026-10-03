import React, { useState, Suspense, lazy, useEffect } from 'react';
import { AppView, SetupData } from './types';
import { INITIAL_SETUP } from './constants';
import Layout from './components/Layout';
import { scheduleService } from './services/scheduleService';
import { generateTimetable } from './services/timetableGenerator';
import { authService } from './services/authService';
import { supabase } from './services/supabaseClient';
import { audio } from './services/audioService';
import { Modal } from './components/ui/Modal';
import { Button } from './components/ui/Button';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const SetupWizard = lazy(() => import('./pages/SetupWizard'));
const ProcessingPage = lazy(() => import('./pages/ProcessingPage'));
const TimetableResult = lazy(() => import('./pages/TimetableResultNew'));
const PlansPage = lazy(() => import('./pages/PlansPage'));
const LicensesPage = lazy(() => import('./pages/LicensesPage'));
const TestModeStartPage = lazy(() => import('./pages/TestModeStartPage'));
const AdminPanelPage = lazy(() => import('./pages/AdminPanelPage'));

const PageLoader = () => (
  <div className="flex-1 flex items-center justify-center min-h-[60vh]">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      <p className="text-gray-500 font-medium animate-pulse">Carregando...</p>
    </div>
  </div>
);

const App: React.FC = () => {
  const [currentView, setView] = useState<AppView>(AppView.LOGIN);
  const [setupData, setSetupData] = useState<SetupData>(INITIAL_SETUP);
  const [schedules, setSchedules] = useState<SetupData[]>([]);
  const [activeLicenseStatus, setActiveLicenseStatus] = useState<string>('Sem Licença');
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(() => {
    const saved = localStorage.getItem('horium_muted');
    return saved === 'true';
  });
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationMessage, setGenerationMessage] = useState('');
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetPasswordFeedback, setResetPasswordFeedback] = useState<string | null>(null);

  const handleSetMuted = (muted: boolean) => {
    setIsMuted(muted);
    audio.setMuted(muted);
  };

  // Sync initial state with audio service
  useEffect(() => {
    audio.setMuted(isMuted);
  }, []);

  const latestSaveSeq = React.useRef(0);

  // Debounced Auto-save com proteção contra race conditions e backup local
  useEffect(() => {
    if (!setupData.id || loading || currentView === AppView.PROCESSING || currentView === AppView.LOGIN || !session) return;

    // Backup local imediato para não perder dados digitados mesmo com erro no banco
    try {
      localStorage.setItem(`horium_draft_${setupData.id}`, JSON.stringify(setupData));
    } catch (e) {
      console.warn('Erro ao salvar rascunho local:', e);
    }

    const currentSeq = ++latestSaveSeq.current;
    const timer = setTimeout(async () => {
      try {
        setIsSaving(true);
        setSaveError(null);
        const saved = await scheduleService.saveSchedule(setupData);

        // Update the schedules list in background se ainda for a requisição mais recente
        if (currentSeq === latestSaveSeq.current) {
          setSchedules(prev => prev.map(s => s.id === saved.id ? saved : s));
          console.log('Auto-save successful');
        }
      } catch (err: any) {
        if (currentSeq === latestSaveSeq.current) {
          console.error('Auto-save failed:', err);
          if (session && currentView !== AppView.LOGIN) {
            setSaveError(
              err?.message?.includes('audit_logs')
                ? 'Erro no Supabase (tabela audit_logs ausente). Seus dados estão preservados localmente.'
                : 'Erro ao salvar automaticamente. Verifique sua conexão.'
            );
          }
        }
      } finally {
        if (currentSeq === latestSaveSeq.current) {
          setIsSaving(false);
        }
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [setupData, loading, currentView, session]);

  const loadLicenseStatus = async (userId?: string) => {
    if (!userId) {
      setActiveLicenseStatus('Sem Licença');
      return;
    }
    try {
      const { data: userLicenses, error: licenseError } = await supabase
        .from('licenses')
        .select('payment_status, valid_until')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (!licenseError && userLicenses && userLicenses.length > 0) {
        const todayStr = new Date().toISOString().split('T')[0];
        const activeApproved = userLicenses.filter(l => {
          if (l.payment_status !== 'Aprovado') return false;
          if (l.valid_until && l.valid_until < todayStr) return false;
          return true;
        });

        const hasPending = userLicenses.some(l => l.payment_status === 'Aguardando' || l.payment_status === 'under_review');
        const hasExpired = userLicenses.some(l => l.payment_status === 'Aprovado' && l.valid_until && l.valid_until < todayStr);

        if (activeApproved.length > 0) {
          setActiveLicenseStatus('Aprovado');
        } else if (hasPending) {
          setActiveLicenseStatus('Aguardando');
        } else if (hasExpired) {
          setActiveLicenseStatus('Expirada');
        } else {
          setActiveLicenseStatus(userLicenses[0].payment_status || 'Sem Licença');
        }
      } else {
        setActiveLicenseStatus('Sem Licença');
      }
    } catch {
      setActiveLicenseStatus('Sem Licença');
    }
  };

  useEffect(() => {
    // Initial session check
    const checkSession = async () => {
      try {
        const currentSession = await authService.getSession();
        setSession(currentSession);
        if (currentSession) {
          const savedView = localStorage.getItem('horium_last_view') as AppView;
          const savedScheduleId = localStorage.getItem('horium_last_schedule_id');

          const fetchedSchedules = await scheduleService.getSchedules();
          setSchedules(fetchedSchedules);

          await loadLicenseStatus(currentSession.user.id);

          if (savedView && Object.values(AppView).includes(savedView) && savedView !== AppView.LOGIN) {
            if (savedScheduleId) {
              const lastSchedule = fetchedSchedules.find(s => s.id === savedScheduleId);
              let draftData = null;
              try {
                const localDraft = localStorage.getItem(`horium_draft_${savedScheduleId}`);
                if (localDraft) draftData = JSON.parse(localDraft);
              } catch (e) {
                console.warn('Erro ao recuperar rascunho local:', e);
              }

              const finalSchedule = draftData || lastSchedule;
              if (finalSchedule) {
                setSetupData(finalSchedule);
                setView(savedView);
              } else {
                setView(AppView.DASHBOARD);
              }
            } else {
              setView(savedView);
            }
          } else {
            setView(AppView.DASHBOARD);
          }
        } else {
          setView(AppView.LOGIN);
          setSetupData(INITIAL_SETUP);
          setSaveError(null);
          setIsSaving(false);
        }
      } catch (err) {
        console.error('Error during session check:', err);
        setView(AppView.LOGIN);
      } finally {
        setLoading(false);
      }
    };

    // Detect password recovery directly from URL hash or path
    if (
      window.location.hash.includes('type=recovery') ||
      window.location.search.includes('type=recovery') ||
      window.location.pathname.includes('reset-password')
    ) {
      setShowResetPasswordModal(true);
    }

    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === 'PASSWORD_RECOVERY') {
        setShowResetPasswordModal(true);
      }
      if (newSession) {
        loadLicenseStatus(newSession.user.id);
        scheduleService.getSchedules()
          .then(setSchedules)
          .catch(err => console.error('Error loading schedules:', err));
      } else {
        setView(AppView.LOGIN);
        setSchedules([]);
        setSetupData(INITIAL_SETUP);
        setSaveError(null);
        setIsSaving(false);
        setActiveLicenseStatus('Sem Licença');
        localStorage.removeItem('horium_last_view');
        localStorage.removeItem('horium_last_schedule_id');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Refresh data when returning to Dashboard from other views
  const prevViewRef = React.useRef<AppView>(currentView);
  useEffect(() => {
    if (currentView === AppView.DASHBOARD && prevViewRef.current !== AppView.LOGIN && prevViewRef.current !== AppView.DASHBOARD && session) {
      scheduleService.getSchedules().then(setSchedules).catch(console.error);
      loadLicenseStatus(session.user?.id);
    }
    prevViewRef.current = currentView;
  }, [currentView, session]);

  const handleLogin = () => {
    audio.playClick();
    setView(AppView.DASHBOARD);
  };

  const handleLogout = async () => {
    try {
      await authService.signOut();
      setSession(null);
      setSetupData(INITIAL_SETUP);
      setSaveError(null);
      setIsSaving(false);
      localStorage.removeItem('horium_last_view');
      localStorage.removeItem('horium_last_schedule_id');

      // VULN-04: Limpar todos os rascunhos locais sensíveis para evitar persistência pós-logout
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('horium_draft_')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
      } catch (e) {
        console.warn('Erro ao limpar rascunhos locais:', e);
      }

      setView(AppView.LOGIN);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleNewSchedule = async () => {
    try {
      const newSchedule = { ...INITIAL_SETUP, createdAt: new Date().toISOString() };
      const saved = await scheduleService.saveSchedule(newSchedule);
      setSchedules(prev => [saved, ...prev]);
      setSetupData(saved);
      setView(AppView.SETUP);
    } catch (err) {
      console.error('Error creating schedule:', err);
      alert('Erro ao criar novo horário. Tente novamente.');
    }
  };

  const handleOpenLicenses = () => {
    audio.playClick();
    setView(AppView.LICENSES);
  };

  const handleSetupComplete = async () => {
    audio.playClick();
    setView(AppView.PROCESSING);
    setGenerationProgress(0);
    setGenerationMessage('Iniciando motor de IA...');

    try {
      const manualFixed = (setupData.pinnedLessons && setupData.pinnedLessons.length > 0)
        ? setupData.pinnedLessons
        : (setupData.fixedLessons || []).filter(fl => fl.isManual);

      const dataToGenerate = {
        ...setupData,
        fixedLessons: manualFixed,
        status: 'Processando'
      };

      const result = await generateTimetable(dataToGenerate, (progress, message) => {
        setGenerationProgress(progress);
        setGenerationMessage(message);
      });

      // We only update the data here. The actual transition to the RESULT view
      // and the "playSuccess" audio will happen when the user clicks the 
      // "Visualizar Resultado" button in the ProcessingPage 
      // (which calls handleProcessingComplete).
      setSetupData(prev => ({
        ...prev,
        fixedLessons: result.fixedLessons,
        failures: result.failures
      }));
    } catch (err) {
      console.error('Erro na geração de horários:', err);
      alert('Ocorreu um erro ao gerar os horários. Tente novamente.');
      setView(AppView.SETUP);
    }
  };

  const handleProcessingComplete = async () => {
    // Play the success sound IMMEDIATELY on click to preserve the user-gesture context.
    // If we wait for the saveSchedule Promise, the browser might block the AudioContext.
    audio.playSuccess();
    try {
      setIsSaving(true);
      const finalData = { ...setupData, status: 'Finalizado' };
      const saved = await scheduleService.saveSchedule(finalData);
      setSchedules(prev => prev.map(s => s.id === saved.id ? saved : s));
      setSetupData(saved);

      if (activeLicenseStatus !== 'Aprovado') {
        alert('Grade otimizada com sucesso!\n\nPara visualizar as tabelas e exportar os resultados dos professores, você precisa ter uma licença ativa para as turmas. Você será redirecionado para o pagamento.');
        setView(AppView.PLANS);
      } else {
        setView(AppView.RESULT);
      }
    } catch (err) {
      console.error('Error finalizing schedule:', err);
      // alert('Erro ao salvar finalização do horário.'); // Removido alert para evitar interrupção brusca
      setSaveError('Erro ao finalizar o horário. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartTestModeLanding = () => {
    setView(AppView.TEST_MODE_START);
  };

  const handleActualStartTest = async () => {
    try {
      const newSchedule = { ...INITIAL_SETUP, createdAt: new Date().toISOString() };
      const saved = await scheduleService.saveSchedule(newSchedule);
      setSchedules(prev => [saved, ...prev]);
      setSetupData(saved);
      setView(AppView.SETUP);
    } catch (err) {
      console.error('Error starting test mode:', err);
    }
  };

  const handleEditSchedule = (schedule: SetupData) => {
    setSetupData(schedule);
    setView(AppView.SETUP);
  };

  const handleDeleteSchedule = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este horário?')) {
      try {
        await scheduleService.deleteSchedule(id);
        setSchedules(prev => prev.filter(s => s.id !== id));
      } catch (err) {
        console.error('Error deleting schedule:', err);
        alert('Erro ao excluir horário.');
      }
    }
  };

  const handleDuplicateSchedule = async (schedule: SetupData) => {
    try {
      setIsSaving(true);
      // Create a deep copy and prepare for new insert
      const { id, createdAt, updatedAt, ...rest } = schedule;

      const duplicatedData: SetupData = {
        ...rest,
        institution: {
          ...rest.institution,
          name: `${rest.institution.name} (Cópia)`
        },
        createdAt: new Date().toISOString(),
        status: 'Em andamento', // Resets status
        isLicensed: false // Copied schedules are NOT licensed by default
      };

      const saved = await scheduleService.saveSchedule(duplicatedData);
      setSchedules(prev => [saved, ...prev]);
      audio.playClick();
    } catch (err) {
      console.error('Error duplicating schedule:', err);
      alert('Erro ao duplicar horário.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleViewSolutions = (schedule: SetupData) => {
    setSetupData(schedule);
    const isLicensed = schedule.isLicensed || activeLicenseStatus === 'Aprovado';
    if (!isLicensed) {
      alert('Para visualizar as tabelas e exportar esta grade de horários, é necessário possuir uma licença ativa. Você será redirecionado para a página de planos.');
      setView(AppView.PLANS);
      return;
    }
    setView(AppView.RESULT);
    audio.playClick();
  };

  const handleUpdateData = React.useCallback((newData: SetupData | ((prev: SetupData) => SetupData)) => {
    setSetupData(prev => {
      const updated = typeof newData === 'function' ? newData(prev) : newData;
      if (updated.id) {
        localStorage.setItem('horium_last_schedule_id', updated.id);
      }
      return updated;
    });
  }, []);

  useEffect(() => {
    if (currentView !== AppView.LOGIN) {
      localStorage.setItem('horium_last_view', currentView);
    }
  }, [currentView]);

  useEffect(() => {
    localStorage.setItem('horium_muted', String(isMuted));
  }, [isMuted]);

  const renderContent = () => {
    if (loading) return <PageLoader />;

    if (!session || currentView === AppView.LOGIN) {
      return <LoginPage onLogin={handleLogin} />;
    }

    switch (currentView) {
      case AppView.LOGIN:
        return <LoginPage onLogin={handleLogin} />;
      case AppView.DASHBOARD:
        return (
          <DashboardPage
            onNewSchedule={handleNewSchedule}
            onOpenLicenses={handleOpenLicenses}
            schedules={schedules}
            onEditSchedule={handleEditSchedule}
            onDeleteSchedule={handleDeleteSchedule}
            onDuplicateSchedule={handleDuplicateSchedule}
            onViewSolutions={handleViewSolutions}
            activeLicenseStatus={activeLicenseStatus}
            onRefreshSchedules={() => scheduleService.getSchedules().then(setSchedules)}
          />
        );
      case AppView.ADMIN:
        return <AdminPanelPage onBack={() => setView(AppView.DASHBOARD)} />;
      case AppView.LICENSES:
        return <LicensesPage onBack={() => setView(AppView.DASHBOARD)} onStartTestMode={handleStartTestModeLanding} scheduleId={setupData.id} />;
      case AppView.TEST_MODE_START:
        return <TestModeStartPage onStart={handleActualStartTest} />;
      case AppView.SETUP:
        return <SetupWizard
          data={setupData}
          setData={handleUpdateData}
          activeLicenseStatus={activeLicenseStatus}
          onLicenseNeeded={() => setView(AppView.PLANS)}
          onComplete={handleSetupComplete}
        />;
      case AppView.PROCESSING:
        return (
          <ProcessingPage
            onComplete={handleProcessingComplete}
            isMuted={isMuted}
            progress={generationProgress}
            message={generationMessage}
          />
        );
      case AppView.RESULT:
        return (
          <TimetableResult
            data={setupData}
            setData={handleUpdateData}
            onReprocess={() => {
              handleSetupComplete();
            }}
            onLicenseNeeded={() => setView(AppView.PLANS)}
            activeLicenseStatus={activeLicenseStatus}
          />
        );
      case AppView.PLANS:
        return <PlansPage
          initialClasses={setupData.classes?.length || 4}
          scheduleId={setupData.id}
          lockClasses={true}
          onBackToStart={() => {
            audio.playClick();
            setView(AppView.DASHBOARD);
          }}
        />;
      default:
        return <LoginPage onLogin={handleLogin} />;
    }
  };

  return (
    <Layout
      currentView={currentView}
      setView={(v) => {
        if (!session && v !== AppView.LOGIN) return;
        audio.playClick();
        setView(v);
      }}
      hideNav={!session || currentView === AppView.LOGIN}
      onLogout={handleLogout}
      isMuted={isMuted}
      setIsMuted={handleSetMuted}
    >
      <Suspense fallback={<PageLoader />}>
        {renderContent()}
      </Suspense>

      {/* Persistence Notifications */}
      {session && currentView !== AppView.LOGIN && (
        <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-[9999] pointer-events-none">
          {isSaving && (
            <div className="bg-primary/95 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-bottom-2 pointer-events-auto">
              <div className="size-1.5 bg-white rounded-full animate-pulse"></div>
              Sincronizando...
            </div>
          )}
          {saveError && (
            <div className="bg-red-500 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-xs font-bold animate-in slide-in-from-right pointer-events-auto">
              <span className="material-symbols-outlined text-lg">error</span>
              <div>
                <p>{saveError}</p>
                <button
                  onClick={() => setSetupData({ ...setupData })}
                  className="underline mt-1 hover:text-white/80"
                >
                  Tentar novamente
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal de Redefinição de Senha (Password Recovery) */}
      <Modal
        isOpen={showResetPasswordModal}
        onClose={() => setShowResetPasswordModal(false)}
        size="md"
      >
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="size-12 bg-primary/10 text-primary rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">lock_reset</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Redefinir Senha</h2>
              <p className="text-xs text-gray-500">Crie uma nova senha para sua conta Horium.</p>
            </div>
          </div>

          {resetPasswordFeedback && (
            <div className={`p-3 rounded-lg text-xs font-bold ${resetPasswordFeedback.includes('sucesso') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {resetPasswordFeedback}
            </div>
          )}

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (newPasswordInput.length < 6) {
                setResetPasswordFeedback('A nova senha deve ter pelo menos 6 caracteres.');
                return;
              }
              setIsResettingPassword(true);
              setResetPasswordFeedback(null);
              try {
                await authService.updatePassword(newPasswordInput);
                setResetPasswordFeedback('Senha redefinida com sucesso! Redirecionando...');
                setTimeout(() => {
                  setShowResetPasswordModal(false);
                  setNewPasswordInput('');
                  setResetPasswordFeedback(null);
                  if (window.location.hash || window.location.pathname.includes('reset-password')) {
                    window.history.replaceState(null, '', window.location.origin);
                  }
                  setView(AppView.DASHBOARD);
                }, 1500);
              } catch (err: any) {
                setResetPasswordFeedback(authService.translateError(err));
              } finally {
                setIsResettingPassword(false);
              }
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">Nova Senha</label>
              <input
                type="password"
                required
                minLength={6}
                value={newPasswordInput}
                onChange={(e) => setNewPasswordInput(e.target.value)}
                placeholder="Mínimo de 6 caracteres"
                className="w-full h-11 px-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowResetPasswordModal(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                isLoading={isResettingPassword}
              >
                Salvar Nova Senha
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </Layout>
  );
};

export default App;