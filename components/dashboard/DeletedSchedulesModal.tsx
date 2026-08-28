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
            <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="bg-red-100 text-red-600 p-2 rounded-lg">
                            <span className="material-symbols-outlined text-2xl">restore_from_trash</span>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white">Horários Excluídos</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Itens excluídos nos últimos 30 dias.
                            </p>
                        </div>
                    </div>
                    {deletedSchedules.length > 0 && (
                        <button
                            onClick={handleClearTrash}
                            className="bg-red-50 hover:bg-red-100 text-red-600 p-2 rounded-xl transition-all flex items-center justify-center group border border-red-100 active:scale-95"
                            title="Limpar toda a lixeira"
                        >
                            <span className="material-symbols-outlined text-2xl">delete_forever</span>
                        </button>
                    )}
                </div>

                {isLoading ? (
                    <div className="flex justify-center items-center py-12">
                        <span className="material-symbols-outlined animate-spin text-primary text-3xl">refresh</span>
                    </div>
                ) : deletedSchedules.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                        <span className="material-symbols-outlined text-4xl mb-2 opacity-50">auto_delete</span>
                        <p>Nenhum horário na lixeira no momento.</p>
                    </div>
                ) : (
                    <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
                        {deletedSchedules.map((schedule) => (
                            <div
                                key={schedule.id}
                                className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-primary/30 transition-colors"
                            >
                                <div>
                                    <h3 className="font-bold text-gray-800 dark:text-white">
                                        {schedule.institution?.name || 'Nova Grade'}
                                    </h3>
                                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-1">
                                        <span className="flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                                            Atualizado em {formatDate(schedule.updatedAt || schedule.createdAt)}
                                        </span>
                                        <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">
                                            {mapStatusText(schedule.status)}
                                        </span>
                                    </div>
                                </div>

                                <Button
                                    variant="secondary"
                                    onClick={() => schedule.id && handleRestore(schedule.id)}
                                    disabled={restoringId === schedule.id}
                                    className="flex items-center gap-2 whitespace-nowrap"
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

                <div className="flex justify-end mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <Button variant="secondary" onClick={onClose}>
                        Fechar
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
