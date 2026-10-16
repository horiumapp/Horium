import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SetupData } from '../../types';
import { scheduleService } from '../../services/scheduleService';

interface DeletedSchedulesModalProps {
    isOpen: boolean;
    onClose: () => void;
    onRestore: () => void;
}

export const DeletedSchedulesModal: React.FC<DeletedSchedulesModalProps> = ({
    isOpen,
    onClose,
    onRestore
}) => {
    const [deletedSchedules, setDeletedSchedules] = useState<SetupData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [restoringId, setRestoringId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            loadDeletedSchedules();
        }
    }, [isOpen]);

    const loadDeletedSchedules = async () => {
        setIsLoading(true);
        try {
            const data = await scheduleService.getDeletedSchedules();
            setDeletedSchedules(data);
        } catch (error) {
            console.error('Failed to load deleted schedules', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRestore = async (id: string) => {
        setRestoringId(id);
        try {
            await scheduleService.restoreSchedule(id);
            // Remove from local list
            setDeletedSchedules(prev => prev.filter(s => s.id !== id));
            // Notify parent to refresh main list
            onRestore();
        } catch (error) {
            console.error('Failed to restore schedule', error);
        } finally {
            setRestoringId(null);
        }
    };

    const handleClearTrash = async () => {
        if (!window.confirm('Tem certeza que deseja limpar toda a lixeira? Todos os horários excluídos serão removidos permanentemente.')) {
            return;
        }

        setIsLoading(true);
        try {
            await scheduleService.clearTrash();
            setDeletedSchedules([]);
        } catch (error) {
            console.error('Failed to clear trash', error);
            alert('Erro ao limpar lixeira.');
        } finally {
            setIsLoading(false);
        }
    };

    const mapStatusText = (status?: string) => {
        if (!status) return 'Em andamento';
        switch (status) {
            case 'DRAFT': return 'Em andamento';
            case 'PROCESSING': return 'Processando';
            case 'COMPLETED': return 'Excluído'; // Was completed before delete
            default: return status;
        }
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="lg">
            <div className="p-6 sm:p-7">
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3.5">
                        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-900/25 dark:text-rose-300">
                            <span className="material-symbols-outlined text-2xl">restore_from_trash</span>
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.12em] text-rose-600 dark:text-rose-300">Lixeira</p>
                            <h2 className="mt-0.5 text-xl font-bold tracking-tight text-slate-900 dark:text-white">Horários excluídos</h2>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                Itens excluídos nos últimos 30 dias.
                            </p>
                        </div>
                    </div>
                    {deletedSchedules.length > 0 && (
                        <button
                            onClick={handleClearTrash}
                            className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-xl border border-rose-200 bg-white px-3.5 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 active:scale-[0.98] dark:border-rose-900/60 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-900/20 sm:self-auto"
                            title="Limpar toda a lixeira"
                        >
                            <span className="material-symbols-outlined text-lg">delete_sweep</span>
                            Limpar lixeira
                        </button>
                    )}
                </div>

                {isLoading ? (
                    <div role="status" className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 py-14 dark:border-slate-700 dark:bg-slate-800/50">
                        <span className="material-symbols-outlined animate-spin text-3xl text-primary">refresh</span>
                        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Carregando horários excluídos...</span>
                    </div>
                ) : deletedSchedules.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-5 py-10 text-center dark:border-slate-700 dark:bg-slate-800/40 sm:py-12">
                        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm dark:bg-slate-900 dark:text-slate-500">
                            <span className="material-symbols-outlined text-2xl">auto_delete</span>
                        </div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Tudo em ordem</h3>
                        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-slate-500 dark:text-slate-400">Nenhum horário na lixeira no momento. Os itens excluídos aparecerão aqui para que você possa restaurá-los.</p>
                    </div>
                ) : (
                    <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1 custom-scrollbar">
                        {deletedSchedules.map((schedule) => (
                            <div
                                key={schedule.id}
                                className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-primary/30 dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between sm:p-5"
                            >
                                <div className="min-w-0">
                                    <h3 className="truncate font-bold text-slate-900 dark:text-white">
                                        {schedule.institution?.name || 'Nova Grade'}
                                    </h3>
                                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
                                        <span className="flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                                            Atualizado em {formatDate(schedule.updatedAt || schedule.createdAt)}
                                        </span>
                                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                            {mapStatusText(schedule.status)}
                                        </span>
                                    </div>
                                </div>

                                <Button
                                    variant="secondary"
                                    onClick={() => schedule.id && handleRestore(schedule.id)}
                                    disabled={restoringId === schedule.id}
                                    className="flex w-full items-center gap-2 whitespace-nowrap sm:w-auto"
                                >
                                    {restoringId === schedule.id ? (
                                        <span className="material-symbols-outlined animate-spin text-[18px]">refresh</span>
                                    ) : (
                                        <span className="material-symbols-outlined text-[18px]">restore</span>
                                    )}
                                    Restaurar
                                </Button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="mt-6 flex justify-end border-t border-slate-200 pt-4 dark:border-slate-700">
                    <Button variant="secondary" onClick={onClose}>
                        Fechar
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
