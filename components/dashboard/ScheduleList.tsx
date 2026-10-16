import React from 'react';
import { SetupData } from '../../types';

interface ScheduleListProps {
    schedules: SetupData[];
    onEdit: (schedule: SetupData) => void;
    onDelete: (id: string) => void;
    onDuplicate: (schedule: SetupData) => void;
    onViewSolutions: (schedule: SetupData) => void;
    activeLicenseStatus?: string;
}

export const ScheduleList: React.FC<ScheduleListProps> = ({
    schedules,
    onEdit,
    onDelete,
    onDuplicate,
    onViewSolutions,
    activeLicenseStatus = 'Sem Licença'
}) => {
    const formatDate = (isoString?: string) => {
        if (!isoString) return 'Data não disponível';
        const date = new Date(isoString);
        if (Number.isNaN(date.getTime())) return 'Data não disponível';
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
            + ' às '
            + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };

    const singleCard = schedules.length === 1;

    return (
        <div className={`grid gap-5 ${singleCard ? '' : 'xl:grid-cols-2'}`}>
            {schedules.map((schedule, index) => {
                const isLicensed = schedule.isLicensed || activeLicenseStatus === 'Aprovado';
                const status = schedule.licenseStatus || activeLicenseStatus || 'Sem Licença';
                const isPending = !isLicensed && (
                    status === 'Aguardando'
                    || status === 'under_review'
                    || activeLicenseStatus === 'Aguardando'
                    || activeLicenseStatus === 'under_review'
                );
                const licenseLabel = isLicensed ? 'Acesso liberado' : isPending ? 'Licença em análise' : 'Sem licença ativa';
                const statusLabel = schedule.status || 'Em andamento';

                return (
                    <article
                        key={schedule.id || `${schedule.institution.name}-${index}`}
                        className={`group w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900 ${singleCard ? 'min-h-[220px]' : ''}`}
                    >
                        <div className="h-1.5 bg-gradient-to-r from-primary via-blue-400 to-teal-400"></div>
                        <div className={singleCard ? 'p-6 sm:p-8' : 'p-4 sm:p-5'}>
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div className="flex min-w-0 items-start gap-4">
                                    <div className={`flex shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-primary dark:bg-blue-500/10 dark:text-blue-300 ${singleCard ? 'size-16' : 'size-12'}`}>
                                        <span className={`material-symbols-outlined ${singleCard ? 'text-[32px]' : 'text-[24px]'}`}>school</span>
                                    </div>
                                    <div className="min-w-0 pt-0.5">
                                        <button
                                            type="button"
                                            onClick={() => onEdit(schedule)}
                                            className={`block max-w-full truncate text-left font-bold text-slate-900 transition hover:text-primary focus-visible:rounded dark:text-white dark:hover:text-blue-300 ${singleCard ? 'text-2xl sm:text-3xl' : 'text-base sm:text-lg'}`}
                                            title={`Abrir ${schedule.institution.name || 'horário sem nome'}`}
                                        >
                                            {schedule.institution.name || 'Instituição sem nome'}
                                        </button>
                                        <p className={`mt-1 text-slate-500 dark:text-slate-400 ${singleCard ? 'text-base' : 'text-sm'}`}>
                                            Ano letivo {schedule.institution.year} <span aria-hidden="true">·</span> Turno {schedule.institution.shift}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2 sm:justify-end">
                                    <span className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${isLicensed
                                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300'
                                        : isPending
                                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/25 dark:text-amber-300'
                                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                        }`}>
                                        <span className="material-symbols-outlined text-[15px]">{isLicensed ? 'verified' : isPending ? 'hourglass_top' : 'lock'}</span>
                                        {licenseLabel}
                                    </span>
                                    <span className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${schedule.status === 'Finalizado'
                                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/25 dark:text-blue-300'
                                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                        }`}>
                                        <span className="size-1.5 rounded-full bg-current"></span>
                                        {statusLabel}
                                    </span>
                                </div>
                            </div>

                            <div className={`mt-6 flex flex-col gap-3 border-t border-slate-100 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between ${singleCard ? 'pt-6' : 'pt-4'}`}>
                                <div className={`flex items-start gap-2 text-slate-500 dark:text-slate-400 ${singleCard ? 'text-sm' : 'text-xs'}`}>
                                    <span className="material-symbols-outlined text-lg text-slate-400">schedule</span>
                                    <span><span className="font-semibold text-slate-700 dark:text-slate-300">Criado em</span> {formatDate(schedule.createdAt)}</span>
                                </div>
                                {schedule.status === 'Finalizado' && (
                                    <p className={`flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-300 ${singleCard ? 'text-sm' : 'text-xs'}`}>
                                        <span className="material-symbols-outlined text-lg">check_circle</span>
                                        Grade processada
                                    </p>
                                )}
                            </div>

                            <div className={`mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 ${singleCard ? 'sm:gap-4' : 'gap-2'}`}>
                                <button
                                    type="button"
                                    onClick={() => onEdit(schedule)}
                                    aria-label={`Editar ${schedule.institution.name || 'horário sem nome'}`}
                                    className={`inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-semibold text-white transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 ${singleCard ? 'min-h-14 text-sm sm:text-base' : 'min-h-10 text-xs'}`}
                                >
                                    <span className="material-symbols-outlined text-base">edit</span>
                                    Editar horário
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onDuplicate(schedule)}
                                    aria-label={`Duplicar ${schedule.institution.name || 'horário sem nome'}`}
                                    className={`inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-semibold text-slate-600 transition hover:border-primary/30 hover:bg-blue-50/60 hover:text-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 ${singleCard ? 'min-h-14 text-sm sm:text-base' : 'min-h-10 text-xs'}`}
                                >
                                    <span className="material-symbols-outlined text-base">content_copy</span>
                                    Duplicar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => isLicensed && onViewSolutions(schedule)}
                                    disabled={!isLicensed}
                                    aria-label={`${isLicensed ? 'Ver soluções de' : 'Soluções bloqueadas para'} ${schedule.institution.name || 'horário sem nome'}`}
                                    title={!isLicensed ? 'É necessária uma licença ativa para ver as soluções' : 'Ver grade de horários'}
                                    className={`inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-semibold text-slate-600 transition hover:border-primary/30 hover:bg-blue-50/60 hover:text-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 ${singleCard ? 'min-h-14 text-sm sm:text-base' : 'min-h-10 text-xs'}`}
                                >
                                    <span className="material-symbols-outlined text-base">calendar_view_week</span>
                                    Ver soluções
                                </button>
                                <button
                                    type="button"
                                    onClick={() => schedule.id && onDelete(schedule.id)}
                                    aria-label={`Excluir ${schedule.institution.name || 'horário sem nome'}`}
                                    className={`inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-red-900 dark:hover:bg-red-950/30 dark:hover:text-red-300 ${singleCard ? 'min-h-14 text-sm sm:text-base' : 'min-h-10 text-xs'}`}
                                >
                                    <span className="material-symbols-outlined text-base">delete</span>
                                    Excluir
                                </button>
                            </div>
                        </div>
                    </article>
                );
            })}
        </div>
    );
};
