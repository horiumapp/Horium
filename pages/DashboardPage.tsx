import React, { useState } from 'react';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { SetupData } from '../types';
import { ScheduleList } from '../components/dashboard/ScheduleList';
import { TicketModal } from '../components/dashboard/TicketModal';
import { DeletedSchedulesModal } from '../components/dashboard/DeletedSchedulesModal';

interface DashboardPageProps {
  onNewSchedule: () => void;
  onOpenLicenses: () => void;
  schedules: SetupData[];
  onEditSchedule: (schedule: SetupData) => void;
  onDeleteSchedule: (id: string) => void;
  onDuplicateSchedule: (schedule: SetupData) => void;
  onViewSolutions: (schedule: SetupData) => void;
  activeLicenseStatus: string;
  onRefreshSchedules?: () => void;
}

const DashboardPage: React.FC<DashboardPageProps> = ({
  onNewSchedule,
  onOpenLicenses,
  schedules,
  onEditSchedule,
  onDeleteSchedule,
  onDuplicateSchedule,
  onViewSolutions,
  activeLicenseStatus,
  onRefreshSchedules
}) => {
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [isDeletedModalOpen, setIsDeletedModalOpen] = useState(false);

  const quickActions = [
    { icon: 'confirmation_number', label: 'Abrir chamado', onClick: () => setIsTicketModalOpen(true) },
    { icon: 'chat', label: 'Suporte via WhatsApp', onClick: () => setIsWhatsAppModalOpen(true) },
    { icon: 'workspace_premium', label: 'Gerenciar licenças', onClick: onOpenLicenses },
    { icon: 'restore_from_trash', label: 'Horários excluídos', onClick: () => setIsDeletedModalOpen(true) },
  ];

  const completedSchedules = schedules.filter(schedule => schedule.status === 'Finalizado').length;
  const isLicenseApproved = activeLicenseStatus === 'Aprovado';
  const licenseTone = isLicenseApproved
    ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20'
    : activeLicenseStatus === 'Aguardando' || activeLicenseStatus === 'under_review'
      ? 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20'
      : 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800';

  const metrics = [
    {
      label: 'Grades cadastradas',
      value: schedules.length,
      detail: schedules.length === 1 ? '1 planejamento escolar' : 'Planejamentos da sua escola',
      icon: 'calendar_month',
      tone: 'bg-blue-50 text-primary dark:bg-blue-500/10 dark:text-blue-300',
    },
    {
      label: 'Grades finalizadas',
      value: completedSchedules,
      detail: 'Prontas para consulta',
      icon: 'task_alt',
      tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    },
    {
      label: 'Licença da conta',
      value: activeLicenseStatus || 'Sem Licença',
      detail: isLicenseApproved ? 'Acesso liberado' : 'Consulte suas opções de acesso',
      icon: 'workspace_premium',
      tone: licenseTone,
      isStatus: true,
    },
  ];

  return (
    <div className="flex-1 academic-gradient relative min-h-[calc(100vh-64px)] overflow-hidden px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
      <div className="relative z-10 mx-auto w-full max-w-[1400px]">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              <span className="size-2 rounded-full bg-teal-500"></span>
              Painel de planejamento
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              Olá! Vamos organizar sua semana?
            </h1>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 sm:text-base">
              Acompanhe suas grades e continue de onde parou.
            </p>
          </div>
          <button
            type="button"
            onClick={onNewSchedule}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-md shadow-primary/20 transition hover:-translate-y-0.5 hover:brightness-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
          >
            <span className="material-symbols-outlined text-xl">add</span>
            Criar novo horário
          </button>
        </header>

        <section aria-label="Ações rápidas" className="mt-5 flex flex-wrap gap-2">
          {quickActions.map(action => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white/85 px-3.5 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-primary/30 hover:bg-white hover:text-primary dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-blue-300 sm:text-sm"
            >
              <span className="material-symbols-outlined text-[18px] text-primary">{action.icon}</span>
              {action.label}
            </button>
          ))}
        </section>

        <section aria-label="Resumo da conta" className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {metrics.map(metric => (
            <article key={metric.label} className="flex min-h-[96px] items-center gap-4 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 sm:p-5">
              <div className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${metric.tone}`}>
                <span className="material-symbols-outlined text-[23px]">{metric.icon}</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{metric.label}</p>
                {metric.isStatus ? (
                  <p className={`mt-1 inline-flex max-w-full rounded-full px-2.5 py-1 text-xs font-semibold ${metric.tone}`}>
                    <span className="truncate">{metric.value}</span>
                  </p>
                ) : (
                  <p className="mt-0.5 text-2xl font-bold leading-none tracking-tight text-slate-900 dark:text-white">{metric.value}</p>
                )}
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{metric.detail}</p>
              </div>
            </article>
          ))}
        </section>

        <section aria-labelledby="schedules-heading" className="mt-7 sm:mt-8">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="schedules-heading" className="text-lg font-bold text-slate-900 dark:text-white sm:text-xl">Grades da escola</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Acesse, edite ou consulte cada planejamento.</p>
            </div>
            {schedules.length > 0 && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {schedules.length} {schedules.length === 1 ? 'grade' : 'grades'}
              </span>
            )}
          </div>

          {schedules.length > 0 ? (
            <ScheduleList
              schedules={schedules}
              onEdit={onEditSchedule}
              onDelete={onDeleteSchedule}
              onDuplicate={onDuplicateSchedule}
              onViewSolutions={onViewSolutions}
              activeLicenseStatus={activeLicenseStatus}
            />
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white/75 px-6 py-10 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900/70 sm:px-10">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <span className="material-symbols-outlined text-3xl">calendar_add_on</span>
              </div>
              <h3 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">Sua primeira grade começa aqui</h3>
              <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                Cadastre os horários da semana, as turmas e os professores em um fluxo guiado.
              </p>
              <button
                type="button"
                onClick={onNewSchedule}
                className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
              >
                <span className="material-symbols-outlined text-lg">add</span>
                Criar primeiro horário
              </button>
            </div>
          )}
        </section>
      </div>

      <Modal isOpen={isWhatsAppModalOpen} onClose={() => setIsWhatsAppModalOpen(false)} size="md">
        <div className="p-6">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-primary dark:text-blue-400 text-xl font-semibold">Horium · Suporte</h3>
          </div>
          <div className="flex flex-col items-center gap-5 py-5 sm:flex-row">
            <div className="relative shrink-0">
              <div className="size-16 rounded-2xl bg-teal-500 flex items-center justify-center shadow-sm">
                <span className="material-symbols-outlined text-white text-3xl">chat</span>
              </div>
            </div>
            <div className="text-center text-sm leading-relaxed text-slate-600 dark:text-slate-300 sm:text-left">
              Fale com a equipe pelo WhatsApp no número<br />
              <span className="font-bold text-slate-900 dark:text-white">(97) 99957-2377</span>
            </div>
          </div>
          <div className="flex justify-end mt-2">
            <Button variant="secondary" onClick={() => setIsWhatsAppModalOpen(false)}>Fechar</Button>
          </div>
        </div>
      </Modal>

      <TicketModal isOpen={isTicketModalOpen} onClose={() => setIsTicketModalOpen(false)} />

      <DeletedSchedulesModal
        isOpen={isDeletedModalOpen}
        onClose={() => setIsDeletedModalOpen(false)}
        onRestore={() => onRefreshSchedules?.()}
      />
    </div>
  );
};

export default DashboardPage;
