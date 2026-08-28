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
}

const DashboardPage: React.FC<DashboardPageProps> = ({
  onNewSchedule,
  onOpenLicenses,
  schedules,
  onEditSchedule,
  onDeleteSchedule,
  onDuplicateSchedule,
  onViewSolutions,
  activeLicenseStatus
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
    <div className="flex-1 academic-gradient flex flex-col p-6 relative min-h-[calc(100vh-64px)] overflow-hidden">
      <div className="flex justify-between items-start w-full mb-8">
        <div className="flex flex-wrap gap-4">
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={action.onClick}
              className={`flex flex-col items-center justify-center gap-1 w-24 h-24 rounded-xl transition-all hover:scale-105 active:scale-95 group ${action.primary
                ? 'bg-primary text-white shadow-lg shadow-primary/30'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-primary/50'
                }`}
            >
              <span className="material-symbols-outlined text-3xl group-hover:animate-pulse">
                {action.icon}
              </span>
              <span className="text-[10px] font-bold text-center leading-tight px-2 uppercase tracking-tight">
                {action.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-visible">
        {!hasSchedules ? (
          <div className="flex-1 flex flex-col items-center justify-center mt-20">
            <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border border-gray-200 dark:border-gray-800 p-10 rounded-3xl shadow-2xl text-center max-w-lg animate-in fade-in zoom-in duration-500">
              <div className="bg-primary/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="material-symbols-outlined text-primary text-4xl">calendar_today</span>
              </div>
              <p className="text-gray-600 dark:text-gray-300 text-lg font-medium mb-8">
                Não há horários cadastrados. <br />Clique abaixo para iniciar um novo horário.
              </p>
              <button
                onClick={onNewSchedule}
                className="group flex flex-col items-center gap-4 mx-auto"
              >
                <div className="w-24 h-24 bg-primary text-white rounded-2xl flex items-center justify-center shadow-xl shadow-primary/40 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-5xl">add</span>
                </div>
                <span className="text-sm font-bold text-primary uppercase tracking-widest group-hover:underline">
                  Novo Horário
                </span>
              </button>
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-gray-500 font-bold uppercase tracking-widest text-sm">Meus Horários</h2>
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
          // You might need a way to trigger a refresh here if `schedules` isn't reactive to changes.
          // To keep it simple for now, we assume reloading the page or the parent component
          // handles the data refetching. A full reload is a brute force but safe way:
          window.location.reload();
        }}
      />

      <div className="absolute bottom-[-100px] left-[-100px] w-[400px] h-[400px] bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute top-[20%] right-[-100px] w-[300px] h-[300px] bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
    </div>
  );
};

export default DashboardPage;