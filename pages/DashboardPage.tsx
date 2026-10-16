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

  const actions = [
    { icon: 'add_box', label: 'Novo Horário', onClick: onNewSchedule, primary: true },
    { icon: 'confirmation_number', label: 'Ticket Suporte', onClick: () => setIsTicketModalOpen(true) },
    { icon: 'chat', label: 'WhatsApp', onClick: () => setIsWhatsAppModalOpen(true) },
    { icon: 'badge', label: 'Licenças', onClick: onOpenLicenses },
    { icon: 'restore_from_trash', label: 'Horários Excluídos', onClick: () => setIsDeletedModalOpen(true) },
  ];

  const hasSchedules = schedules && schedules.length > 0;

  return (
    <div className="flex-1 academic-gradient flex flex-col p-4 sm:p-6 lg:p-8 relative min-h-[calc(100vh-64px)] overflow-hidden">
      <div className="relative z-10 w-full max-w-7xl mx-auto">
      <div className="flex flex-col gap-6 w-full mb-8">
        <div>
          <p className="text-sm font-semibold text-primary mb-2">Painel de planejamento</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Organize os horários da sua escola</h1>
          <p className="mt-2 text-sm sm:text-base text-slate-500 dark:text-slate-400">Acesse suas grades e continue de onde parou.</p>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3">
          {actions.map((action) => (
            <button
              key={action.label}
              onClick={action.onClick}
              className={`flex min-h-[88px] sm:min-h-[104px] sm:w-[132px] flex-col items-start justify-center gap-3 rounded-2xl p-4 text-left transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 group ${action.primary
                ? 'bg-primary text-white shadow-lg shadow-primary/20 hover:brightness-95'
                : 'bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-primary/40 hover:shadow-md'
                }`}
            >
              <span className={`material-symbols-outlined text-2xl ${action.primary ? 'text-white' : 'text-primary'}`}>
                {action.icon}
              </span>
              <span className="text-xs sm:text-sm font-semibold leading-tight">
                {action.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-visible">
        {!hasSchedules ? (
          <div className="flex-1 flex flex-col items-center justify-center py-8 sm:py-14">
            <div className="w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 p-7 sm:p-10 rounded-3xl shadow-sm text-center max-w-2xl animate-in fade-in zoom-in duration-500">
              <div className="bg-primary/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <span className="material-symbols-outlined text-primary text-3xl">calendar_today</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Seu próximo horário começa aqui</h2>
              <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 mt-2 mb-7">
                Ainda não há horários cadastrados. Crie uma grade para começar a organizar a semana da sua escola.
              </p>
              <button
                onClick={onNewSchedule}
                className="group inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-primary/20 transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
              >
                <span className="material-symbols-outlined text-xl">add</span>
                Criar primeiro horário
              </button>
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Meus horários</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">{schedules.length} {schedules.length === 1 ? 'grade cadastrada' : 'grades cadastradas'}</p>
              </div>
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800"></div>
            </div>
            <ScheduleList
              schedules={schedules}
              onEdit={onEditSchedule}
              onDelete={onDeleteSchedule}
              onDuplicate={onDuplicateSchedule}
              onViewSolutions={onViewSolutions}
              activeLicenseStatus={activeLicenseStatus}
            />
          </div>
        )}
      </div>
      </div>

      <Modal
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
        size="md"
      >
        <div className="p-6">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-[#003366] dark:text-blue-400 text-xl font-medium uppercase tracking-wide border-b-2 border-[#003366] dark:border-blue-400 pb-1 pr-12 inline-block">
              Horium - Suporte
            </h3>
          </div>
          <div className="flex items-center gap-6 py-6">
            <div className="relative shrink-0">
              <div className="size-20 rounded-full bg-gradient-to-b from-[#70c5ce] to-[#36a5b5] flex items-center justify-center shadow-inner">
                <span className="text-white font-serif text-5xl font-bold italic">i</span>
              </div>
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-16 h-1.5 bg-black/10 blur-[2px] rounded-full"></div>
            </div>
            <div className="text-[#003366] dark:text-blue-100 text-base leading-relaxed font-medium">
              Nos adicione no WhatsApp pelo número <br />
              <span className="font-bold text-lg">(97) 99957-2377</span> e envie sua dúvida.
            </div>
          </div>
          <div className="flex justify-end mt-2">
            <Button
              variant="secondary"
              onClick={() => setIsWhatsAppModalOpen(false)}
            >
              Fechar
            </Button>
          </div>
        </div>
      </Modal>

      <TicketModal
        isOpen={isTicketModalOpen}
        onClose={() => setIsTicketModalOpen(false)}
      />

      <DeletedSchedulesModal
        isOpen={isDeletedModalOpen}
        onClose={() => setIsDeletedModalOpen(false)}
        onRestore={() => {
          onRefreshSchedules?.();
        }}
      />

      <div className="absolute bottom-[-100px] left-[-100px] w-[400px] h-[400px] bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute top-[20%] right-[-100px] w-[300px] h-[300px] bg-teal-500/5 rounded-full blur-3xl pointer-events-none"></div>
    </div>
  );
};

export default DashboardPage;
