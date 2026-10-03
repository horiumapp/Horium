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

export const ScheduleList: React.FC<ScheduleListProps> = ({ schedules, onEdit, onDelete, onDuplicate, onViewSolutions, activeLicenseStatus = 'Sem Licença' }) => {
    const formatDate = (isoString?: string) => {
        if (!isoString) return '-';
        const date = new Date(isoString);
        return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="w-full overflow-x-auto bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-[#5c92b1] text-white uppercase text-[10px] font-bold tracking-wider">
                        <th className="px-4 py-3 border-r border-white/20">Acesso</th>
                        <th className="px-4 py-3 border-r border-white/20">Instituição</th>
                        <th className="px-4 py-3 border-r border-white/20 text-center">Status / Pendências</th>
                        <th className="px-4 py-3 border-r border-white/20">Histórico do Horário</th>
                        <th className="px-4 py-3 text-center">Opções</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {schedules.map((schedule) => {
                        const isLicensed = schedule.isLicensed || activeLicenseStatus === 'Aprovado';
                        const status = schedule.licenseStatus || activeLicenseStatus || 'Sem Licença';
                        const isPending = !isLicensed && (status === 'Aguardando' || status === 'under_review' || activeLicenseStatus === 'Aguardando' || activeLicenseStatus === 'under_review');

                        return (
                            <tr key={schedule.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                <td className="px-4 py-4 align-top text-center">
                                    {isLicensed ? (
                                        <div className="flex flex-col items-center gap-1">
                                            <div className="size-10 bg-green-500/10 rounded-xl flex items-center justify-center">
                                                <span className="material-symbols-outlined text-green-500 text-xl font-bold">check_circle</span>
                                            </div>
                                            <span className="text-[10px] font-black text-green-600 uppercase tracking-tighter">Liberado</span>
                                        </div>
                                    ) : isPending ? (
                                        <div className="flex flex-col items-center gap-1">
                                            <div className="size-10 bg-amber-500/10 rounded-xl flex items-center justify-center animate-pulse">
                                                <span className="material-symbols-outlined text-amber-500 text-xl font-bold">hourglass_empty</span>
                                            </div>
                                            <span className="text-[9px] font-black text-amber-600 uppercase tracking-tight leading-none text-center">Aguardando<br />Liberação</span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-1">
                                            <div className="size-10 bg-gray-100 dark:bg-gray-800 text-gray-400 rounded-xl flex items-center justify-center">
                                                <span className="material-symbols-outlined text-2xl font-bold">lock</span>
                                            </div>
                                            <span className="text-[10px] text-gray-400 uppercase font-black text-center leading-tight">Sem<br />Licença</span>
                                        </div>
                                    )}
                                </td>
                            <td className="px-4 py-4 align-top">
                                <div className="flex flex-col">
                                    <button
                                        onClick={() => onEdit(schedule)}
                                        className="text-blue-700 dark:text-blue-400 font-bold hover:underline text-left"
                                    >
                                        {schedule.institution.name || 'Sem Nome'} - {schedule.institution.year} - {schedule.institution.shift}
                                    </button>
                                </div>
                            </td>
                            <td className="px-4 py-4 align-top text-center">
                                <div className="flex flex-col items-center gap-1">
                                    <span className="font-bold text-gray-700 dark:text-gray-200">{schedule.status || 'Etapa Final'}</span>
                                    {schedule.status === 'Finalizado' && (
                                        <p className="text-[10px] text-gray-500 max-w-[200px]">
                                            Processamento Finalizado. Veja o histórico ao lado. Se precisar, edite, faça ajustes e coloque em processamento novamente.
                                        </p>
                                    )}
                                </div>
                            </td>
                            <td className="px-4 py-4 align-top">
                                <div className="flex flex-col gap-2">
                                    <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700 text-[10px] text-gray-600 dark:text-gray-400 min-h-[60px] max-h-[100px] overflow-y-auto">
                                        <div className="font-bold mb-1">{formatDate(schedule.createdAt)} - Horário criado</div>
                                        {/* Aqui poderiam entrar logs de processamento futuramente */}
                                    </div>
                                    <button className="flex items-center gap-1 text-[10px] font-bold text-gray-500 hover:text-primary">
                                        <span className="material-symbols-outlined text-sm">mail</span> Suporte
                                    </button>
                                </div>
                            </td>
                            <td className="px-4 py-4 align-top">
                                <div className="flex justify-center gap-2">
                                    <button
                                        onClick={() => onEdit(schedule)}
                                        className="flex flex-col items-center gap-1 group"
                                    >
                                        <div className="size-12 bg-white border border-gray-300 rounded flex items-center justify-center group-hover:bg-yellow-50 transition-colors">
                                            <span className="material-symbols-outlined text-2xl text-yellow-600">edit</span>
                                        </div>
                                        <span className="text-[9px] font-bold uppercase text-gray-600">Editar</span>
                                    </button>
                                    <button
                                        onClick={() => onDuplicate(schedule)}
                                        className="flex flex-col items-center gap-1 group"
                                    >
                                        <div className="size-12 bg-white border border-gray-300 rounded flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                                            <span className="material-symbols-outlined text-2xl text-blue-400">content_copy</span>
                                        </div>
                                        <span className="text-[9px] font-bold uppercase text-gray-600">Duplicar</span>
                                    </button>
                                    <button
                                        onClick={() => isLicensed && onViewSolutions(schedule)}
                                        className={`flex flex-col items-center gap-1 group ${!isLicensed ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        title={!isLicensed ? 'Liberação pendente para ver soluções' : ''}
                                    >
                                        <div className={`size-12 bg-white border border-gray-300 rounded flex items-center justify-center ${isLicensed ? 'group-hover:bg-purple-50' : ''} transition-colors`}>
                                            <span className={`material-symbols-outlined text-2xl ${isLicensed ? 'text-purple-400' : 'text-gray-400'}`}>grid_view</span>
                                        </div>
                                        <span className="text-[9px] font-bold uppercase text-gray-600 text-center leading-none">Ver<br />Soluções</span>
                                    </button>
                                    <button
                                        onClick={() => schedule.id && onDelete(schedule.id)}
                                        className="flex flex-col items-center gap-1 group"
                                    >
                                        <div className="size-12 bg-white border border-gray-300 rounded flex items-center justify-center group-hover:bg-red-50 transition-colors">
                                            <span className="material-symbols-outlined text-2xl text-red-500">cancel</span>
                                        </div>
                                        <span className="text-[9px] font-bold uppercase text-gray-600">Excluir</span>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div >
    );
};
