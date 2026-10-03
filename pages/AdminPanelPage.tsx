import React, { useState, useEffect } from 'react';
import { adminLicenseService, AdminLicense, getSafeHttpsUrl, isPdfReceipt } from '../services/adminLicenseService';
import { ticketService, TicketData } from '../services/ticketService';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';

interface AdminPanelPageProps {
    onBack: () => void;
}

export const AdminPanelPage: React.FC<AdminPanelPageProps> = ({ onBack }) => {
    const [activeTab, setActiveTab] = useState<'licenses' | 'tickets'>('licenses');

    // Licenses State
    const [licenses, setLicenses] = useState<AdminLicense[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Tickets State
    const [tickets, setTickets] = useState<TicketData[]>([]);
    const [loadingTickets, setLoadingTickets] = useState(false);
    const [updatingTicketId, setUpdatingTicketId] = useState<string | null>(null);

    // Approval Modal States
    const [selectedLicense, setSelectedLicense] = useState<AdminLicense | null>(null);
    const [validUntilInput, setValidUntilInput] = useState(() => {
        const today = new Date();
        today.setMonth(today.getMonth() + 6); // Default +6 months
        return today.toISOString().split('T')[0];
    });
    const [isApproving, setIsApproving] = useState(false);
    const [viewingReceiptUrl, setViewingReceiptUrl] = useState<string | null>(null);

    const fetchLicenses = async () => {
        setLoading(true);
        try {
            const data = await adminLicenseService.getAllLicenses();
            setLicenses(data);
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Falha ao buscar as licenças (Verifique se as permissões do administrador estão corretas).");
        } finally {
            setLoading(false);
        }
    };

    const fetchTickets = async () => {
        setLoadingTickets(true);
        try {
            const data = await ticketService.getAllTickets();
            setTickets(data);
        } catch (err: any) {
            console.error(err);
        } finally {
            setLoadingTickets(false);
        }
    };

    useEffect(() => {
        fetchLicenses();
        fetchTickets();
    }, []);

    const handleApproveSubmit = async () => {
        if (!selectedLicense) return;

        try {
            setIsApproving(true);
            await adminLicenseService.approveLicense(selectedLicense.id, validUntilInput);

            // Update local state without refetching from DB to be faster
            setLicenses(prev => prev.map(lic =>
                lic.id === selectedLicense.id
                    ? { ...lic, payment_status: 'Aprovado', valid_until: validUntilInput }
                    : lic
            ));

            setSelectedLicense(null); // Close modal
        } catch (err: any) {
            alert("Erro ao aprovar licença: " + err.message);
        } finally {
            setIsApproving(false);
        }
    };

    const handleDeleteLicense = async (id: string, email: string) => {
        if (!window.confirm(`Deseja realmente EXCLUIR permanentemente esta licença de ${email}? Esta ação não pode ser desfeita.`)) {
            return;
        }

        try {
            await adminLicenseService.deleteLicense(id);
            setLicenses(prev => prev.filter(lic => lic.id !== id));
        } catch (err: any) {
            alert("Erro ao excluir licença: " + err.message);
        }
    };

    const handleUpdateTicketStatus = async (ticketId: string, status: 'aberto' | 'em_andamento' | 'fechado') => {
        try {
            setUpdatingTicketId(ticketId);
            await ticketService.updateTicketStatus(ticketId, status);
            setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status } : t));
        } catch (err: any) {
            alert("Erro ao atualizar chamado: " + err.message);
        } finally {
            setUpdatingTicketId(null);
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    const formatDate = (dateString: string | null | undefined) => {
        if (!dateString) return '-';
        return new Intl.DateTimeFormat('pt-BR').format(new Date(dateString));
    };

    const handleOpenReceipt = async (urlOrPath: string) => {
        if (!urlOrPath) return;

        try {
            const signedUrl = await adminLicenseService.getReceiptSignedUrl(urlOrPath);
            const safeUrl = getSafeHttpsUrl(signedUrl);

            if (safeUrl) {
                setViewingReceiptUrl(safeUrl);
                return;
            }
        } catch (e) {
            console.error("Erro ao gerar URL segura do comprovante:", e);
        }

        alert("Não foi possível carregar o comprovante com segurança. O caminho ou link é inválido.");
    };

    const handleOpenTicketAttachment = async (urlOrPath: string) => {
        if (!urlOrPath) return;

        try {
            const signedUrl = await ticketService.getAttachmentSignedUrl(urlOrPath);
            const safeUrl = getSafeHttpsUrl(signedUrl);

            if (safeUrl) {
                setViewingReceiptUrl(safeUrl);
                return;
            }
        } catch (e) {
            console.error("Erro ao gerar URL segura do anexo:", e);
        }

        alert("Não foi possível carregar o anexo do chamado com segurança.");
    };

    const pendingLicensesCount = licenses.filter(l => l.payment_status === 'Aguardando' || l.payment_status === 'under_review').length;
    const openTicketsCount = tickets.filter(t => t.status === 'aberto' || t.status === 'em_andamento').length;

    return (
        <div className="flex-1 flex flex-col p-6 min-h-[calc(100vh-64px)] overflow-y-auto academic-gradient">
            <div className="w-full max-w-7xl mx-auto flex flex-col gap-6">

                {/* Header */}
                <div className="bg-white dark:bg-[#1a2634] border border-[#dbe0e6] dark:border-gray-700 p-6 shadow-sm rounded-2xl flex justify-between items-center">
                    <div>
                        <h1 className="text-[#111418] dark:text-white text-3xl font-black flex items-center gap-3">
                            <span className="material-symbols-outlined text-4xl text-primary">admin_panel_settings</span>
                            Área Administrativa
                        </h1>
                        <p className="text-gray-500 mt-1">Gerencie a aprovação de licenças e atendimentos aos chamados de suporte.</p>
                    </div>
                    <Button onClick={onBack} variant="outline" className="flex items-center gap-2">
                        <span className="material-symbols-outlined font-light">arrow_back</span> Voltar
                    </Button>
                </div>

                {/* Navigation Tabs */}
                <div className="flex border-b border-gray-200 dark:border-gray-700 gap-2">
                    <button
                        onClick={() => setActiveTab('licenses')}
                        className={`px-5 py-3 font-bold text-sm border-b-2 flex items-center gap-2 transition-all ${
                            activeTab === 'licenses'
                                ? 'border-primary text-primary dark:text-blue-400 bg-white dark:bg-gray-800 rounded-t-xl'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                    >
                        <span className="material-symbols-outlined text-lg">workspace_premium</span>
                        Solicitações de Licença
                        {pendingLicensesCount > 0 && (
                            <span className="bg-amber-500 text-white text-[11px] font-black px-2 py-0.5 rounded-full">
                                {pendingLicensesCount}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('tickets')}
                        className={`px-5 py-3 font-bold text-sm border-b-2 flex items-center gap-2 transition-all ${
                            activeTab === 'tickets'
                                ? 'border-primary text-primary dark:text-blue-400 bg-white dark:bg-gray-800 rounded-t-xl'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                    >
                        <span className="material-symbols-outlined text-lg">support_agent</span>
                        Chamados de Suporte
                        {openTicketsCount > 0 && (
                            <span className="bg-red-500 text-white text-[11px] font-black px-2 py-0.5 rounded-full">
                                {openTicketsCount}
                            </span>
                        )}
                    </button>
                </div>

                {/* TAB 1: LICENSES */}
                {activeTab === 'licenses' && (
                    <div className="bg-white dark:bg-[#1a2634] border border-[#dbe0e6] dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/30">
                            <h2 className="font-bold text-gray-700 dark:text-gray-200">Solicitações de Licença</h2>
                            <button
                                onClick={fetchLicenses}
                                disabled={loading}
                                className="p-1.5 text-gray-500 hover:text-primary transition-colors flex items-center gap-1 text-xs font-semibold"
                            >
                                <span className={`material-symbols-outlined text-sm ${loading ? 'animate-spin' : ''}`}>refresh</span>
                                Atualizar
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 font-semibold border-b border-gray-200 dark:border-gray-700 uppercase text-[11px] tracking-wider">
                                    <tr>
                                        <th className="px-5 py-3">Usuário</th>
                                        <th className="px-5 py-3">Horário Vinculado</th>
                                        <th className="px-5 py-3 text-center">Data</th>
                                        <th className="px-5 py-3 text-center">Turmas</th>
                                        <th className="px-5 py-3 text-center">Valor / Forma</th>
                                        <th className="px-5 py-3 text-center">Comprovante</th>
                                        <th className="px-5 py-3 text-center">Status</th>
                                        <th className="px-5 py-3 text-center">Validade Atual</th>
                                        <th className="px-5 py-3 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={9} className="text-center py-12 text-gray-400">
                                                <span className="material-symbols-outlined animate-spin text-3xl mb-2 text-primary">progress_activity</span>
                                                <p>Carregando licenças...</p>
                                            </td>
                                        </tr>
                                    ) : licenses.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="text-center py-12 text-gray-400">
                                                <span className="material-symbols-outlined text-4xl mb-2 text-gray-300">inbox</span>
                                                <p>Nenhuma licença encontrada.</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        licenses.map((lic) => {
                                            const isPending = lic.payment_status === 'Aguardando' || lic.payment_status === 'under_review';

                                            return (
                                                <tr key={lic.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors">
                                                    <td className="px-5 py-4 font-medium text-gray-900 dark:text-white">
                                                        {lic.user_email || 'Email não disponível'}
                                                    </td>
                                                    <td className="px-5 py-4 text-gray-600 dark:text-gray-300">
                                                        {lic.schedule_name ? (
                                                            <span className="inline-flex items-center gap-1.5 font-medium">
                                                                <span className="material-symbols-outlined text-xs text-primary">calendar_month</span>
                                                                {lic.schedule_name}
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs text-gray-400 italic">Sem horário vinculado</span>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-4 text-center text-gray-600 dark:text-gray-400">
                                                        {formatDate(lic.payment_date)}
                                                    </td>
                                                    <td className="px-5 py-4 text-center text-lg">{lic.classes_amount}</td>
                                                    <td className="px-5 py-4 text-center">
                                                        <div className="flex flex-col items-center">
                                                            <span className="font-bold text-primary">{formatCurrency(lic.value_paid)}</span>
                                                            <span className="text-xs text-gray-400">{lic.payment_method}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4 text-center">
                                                        {lic.receipt_url ? (
                                                            <button
                                                                onClick={() => handleOpenReceipt(lic.receipt_url)}
                                                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-primary dark:text-blue-300 rounded-lg font-bold text-xs hover:bg-blue-100 transition-colors border border-blue-200 dark:border-blue-700 shadow-sm"
                                                                title="Ver comprovante anexado"
                                                            >
                                                                <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                                                                Ver
                                                            </button>
                                                        ) : (
                                                            <span className="text-xs text-gray-400 italic">Sem anexo</span>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-4 text-center">
                                                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1
                                                            ${isPending ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' : 'bg-green-100 text-green-800 border border-green-200'}
                                                        `}>
                                                            <span className="material-symbols-outlined text-[14px]">
                                                                {isPending ? 'hourglass_empty' : 'check_circle'}
                                                            </span>
                                                            {lic.payment_status}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-4 text-center font-medium text-gray-600 dark:text-gray-400">
                                                        {formatDate(lic.valid_until)}
                                                    </td>
                                                    <td className="px-5 py-4 text-right">
                                                        <div className="flex justify-end items-center gap-2">
                                                            {isPending ? (
                                                                <Button
                                                                    onClick={() => setSelectedLicense(lic)}
                                                                    className="bg-green-600 hover:bg-green-700 text-white shadow-md rounded-xl text-sm"
                                                                >
                                                                    Aprovar
                                                                </Button>
                                                            ) : (
                                                                <span className="text-sm text-gray-400 font-bold">Já Aprovado</span>
                                                            )}
                                                            <button
                                                                onClick={() => handleDeleteLicense(lic.id, lic.user_email)}
                                                                className="bg-red-50 hover:bg-red-100 text-red-600 p-2 rounded-lg transition-colors border border-red-100"
                                                                title="Excluir licença permanentemente"
                                                            >
                                                                <span className="material-symbols-outlined text-xl">delete</span>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {loading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-[#1a2634]/80 backdrop-blur-sm">
                                <div className="flex flex-col items-center gap-3">
                                    <span className="material-symbols-outlined animate-spin text-primary text-5xl">settings</span>
                                    <span className="font-bold text-gray-700 dark:text-gray-200">Buscando banco de dados...</span>
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="p-8 bg-red-50 text-red-600 flex flex-col items-center gap-4 border border-red-200 text-center">
                                <span className="material-symbols-outlined text-5xl">warning</span>
                                <span className="font-bold text-lg">{error}</span>
                                <Button onClick={fetchLicenses} variant="outline" className="border-red-300 text-red-700 mt-4">Tentar novamente</Button>
                            </div>
                        )}
                    </div>
                )}

                {/* TAB 2: SUPPORT TICKETS */}
                {activeTab === 'tickets' && (
                    <div className="bg-white dark:bg-[#1a2634] border border-[#dbe0e6] dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/30">
                            <h2 className="font-bold text-gray-700 dark:text-gray-200">Chamados de Suporte Registrados</h2>
                            <button
                                onClick={fetchTickets}
                                disabled={loadingTickets}
                                className="p-1.5 text-gray-500 hover:text-primary transition-colors flex items-center gap-1 text-xs font-semibold"
                            >
                                <span className={`material-symbols-outlined text-sm ${loadingTickets ? 'animate-spin' : ''}`}>refresh</span>
                                Atualizar
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 font-semibold border-b border-gray-200 dark:border-gray-700 uppercase text-[11px] tracking-wider">
                                    <tr>
                                        <th className="px-5 py-3">Data</th>
                                        <th className="px-5 py-3">Usuário</th>
                                        <th className="px-5 py-3">Assunto</th>
                                        <th className="px-5 py-3">Descrição</th>
                                        <th className="px-5 py-3 text-center">Anexo</th>
                                        <th className="px-5 py-3 text-center">Status</th>
                                        <th className="px-5 py-3 text-right">Gerenciar Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {loadingTickets ? (
                                        <tr>
                                            <td colSpan={7} className="text-center py-12 text-gray-400">
                                                <span className="material-symbols-outlined animate-spin text-3xl mb-2 text-primary">progress_activity</span>
                                                <p>Carregando chamados...</p>
                                            </td>
                                        </tr>
                                    ) : tickets.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="text-center py-12 text-gray-400">
                                                <span className="material-symbols-outlined text-4xl mb-2 text-gray-300">inbox</span>
                                                <p>Nenhum chamado de suporte registrado.</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        tickets.map((t) => {
                                            const isUpdating = updatingTicketId === t.id;

                                            return (
                                                <tr key={t.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors">
                                                    <td className="px-5 py-4 text-gray-600 dark:text-gray-400 text-xs">
                                                        {formatDate(t.createdAt)}
                                                    </td>
                                                    <td className="px-5 py-4 font-medium text-gray-900 dark:text-white">
                                                        {t.userEmail || 'Usuário Autenticado'}
                                                    </td>
                                                    <td className="px-5 py-4 font-bold text-gray-800 dark:text-gray-200">
                                                        {t.subject}
                                                    </td>
                                                    <td className="px-5 py-4 text-gray-600 dark:text-gray-300 max-w-xs break-words text-xs">
                                                        {t.description}
                                                    </td>
                                                    <td className="px-5 py-4 text-center">
                                                        {t.imageUrl ? (
                                                            <button
                                                                onClick={() => handleOpenTicketAttachment(t.imageUrl!)}
                                                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-primary dark:text-blue-300 rounded-lg font-bold text-xs hover:bg-blue-100 transition-colors border border-blue-200 dark:border-blue-700 shadow-sm"
                                                                title="Visualizar anexo seguro"
                                                            >
                                                                <span className="material-symbols-outlined text-[16px]">attach_file</span>
                                                                Ver
                                                            </button>
                                                        ) : (
                                                            <span className="text-xs text-gray-400 italic">Sem anexo</span>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-4 text-center">
                                                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1
                                                            ${t.status === 'aberto' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                                                              t.status === 'em_andamento' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                                                              'bg-green-100 text-green-800 border border-green-200'}
                                                        `}>
                                                            <span className="material-symbols-outlined text-[14px]">
                                                                {t.status === 'aberto' ? 'help_outline' : t.status === 'em_andamento' ? 'hourglass_top' : 'check_circle'}
                                                            </span>
                                                            {t.status === 'aberto' ? 'Aberto' : t.status === 'em_andamento' ? 'Em Andamento' : 'Fechado'}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-4 text-right">
                                                        <select
                                                            disabled={isUpdating}
                                                            value={t.status}
                                                            onChange={(e) => handleUpdateTicketStatus(t.id!, e.target.value as any)}
                                                            className="text-xs font-bold bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 outline-none focus:border-primary"
                                                        >
                                                            <option value="aberto">Aberto</option>
                                                            <option value="em_andamento">Em Andamento</option>
                                                            <option value="fechado">Resolvido / Fechado</option>
                                                        </select>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

            </div>

            {/* Approval Modal */}
            {selectedLicense && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
                        <div className="bg-green-600 p-5 text-white flex justify-between items-center">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <span className="material-symbols-outlined">verified</span>
                                Aprovar Licença
                            </h2>
                            <button onClick={() => setSelectedLicense(null)} className="hover:bg-green-700 rounded-full p-1 transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl text-green-800 dark:text-green-300 border border-green-200">
                                <p className="text-sm">Você está prestes a aprovar a licença de <strong>{selectedLicense.classes_amount} turmas</strong> para o cliente:</p>
                                <p className="font-black text-lg mt-1">{selectedLicense.user_email}</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 ml-1">Válido até (Data de Expiração):</label>
                                <input
                                    type="date"
                                    value={validUntilInput}
                                    onChange={(e) => setValidUntilInput(e.target.value)}
                                    className="w-full h-12 rounded-xl px-4 border-2 border-gray-200 dark:border-gray-700 focus:border-green-500 focus:ring-4 focus:ring-green-500/10 font-bold bg-white dark:bg-gray-800 outline-none transition-all"
                                />
                                <p className="text-xs text-gray-500 italic ml-1 mt-1">* Por padrão sugerimos +6 meses a partir de hoje.</p>
                            </div>
                        </div>

                        <div className="p-5 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3">
                            <Button variant="ghost" onClick={() => setSelectedLicense(null)} className="text-gray-600" disabled={isApproving}>
                                Cancelar
                            </Button>
                            <Button onClick={handleApproveSubmit} className="bg-green-600 hover:bg-green-700 shadow-lg px-6" disabled={isApproving}>
                                {isApproving ? 'Processando...' : 'Confirmar Aprovação'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Receipt / Attachment Preview Modal */}
            <Modal
                isOpen={!!viewingReceiptUrl}
                onClose={() => setViewingReceiptUrl(null)}
                size="lg"
            >
                <div className="p-6 space-y-4">
                    <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-3">
                        <h3 className="text-lg font-bold flex items-center gap-2 text-gray-800 dark:text-white">
                            <span className="material-symbols-outlined text-primary">visibility</span>
                            Visualizador de Documento / Anexo
                        </h3>
                        {viewingReceiptUrl && getSafeHttpsUrl(viewingReceiptUrl) && (
                            <a
                                href={getSafeHttpsUrl(viewingReceiptUrl)!}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary font-bold hover:underline flex items-center gap-1"
                            >
                                Abrir em nova aba
                                <span className="material-symbols-outlined text-xs">open_in_new</span>
                            </a>
                        )}
                    </div>

                    <div className="max-h-[65vh] overflow-auto flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-xl p-2">
                        {(() => {
                            const safeUrl = getSafeHttpsUrl(viewingReceiptUrl);
                            if (!safeUrl) return null;

                            return isPdfReceipt(safeUrl) ? (
                                <iframe
                                    src={safeUrl}
                                    title="Visualização PDF"
                                    className="w-full h-[500px] rounded-lg border-0"
                                    sandbox="allow-scripts-to-close allow-same-origin"
                                />
                            ) : (
                                <img
                                    src={safeUrl}
                                    alt="Anexo"
                                    className="max-h-[500px] w-auto object-contain rounded-lg shadow-md"
                                />
                            );
                        })()}
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button variant="secondary" onClick={() => setViewingReceiptUrl(null)}>
                            Fechar
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default AdminPanelPage;

