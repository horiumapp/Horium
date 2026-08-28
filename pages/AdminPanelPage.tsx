import React, { useState, useEffect } from 'react';
import { adminLicenseService, AdminLicense } from '../services/adminLicenseService';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';

interface AdminPanelPageProps {
    onBack: () => void;
}

export const AdminPanelPage: React.FC<AdminPanelPageProps> = ({ onBack }) => {
    const [licenses, setLicenses] = useState<AdminLicense[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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

    useEffect(() => {
        fetchLicenses();
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

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return '-';
        return new Intl.DateTimeFormat('pt-BR').format(new Date(dateString));
    };

    return (
        <div className="flex-1 flex flex-col p-6 min-h-[calc(100vh-64px)] overflow-y-auto academic-gradient">
            <div className="w-full max-w-7xl mx-auto flex flex-col gap-6">

                {/* Header */}
                <div className="bg-white dark:bg-[#1a2634] border border-[#dbe0e6] dark:border-gray-700 p-6 shadow-sm rounded-lg flex justify-between items-center">
                    <div>
                        <h1 className="text-[#111418] dark:text-white text-3xl font-black flex items-center gap-3">
                            <span className="material-symbols-outlined text-4xl text-primary">admin_panel_settings</span>
                            Área Administrativa
                        </h1>
                        <p className="text-gray-500 mt-1">Gerencie a aprovação de licenças pendentes dos usuários.</p>
                    </div>
                    <Button onClick={onBack} variant="outline" className="flex items-center gap-2">
                        <span className="material-symbols-outlined font-light">arrow_back</span> Voltar
                    </Button>
                </div>

                {/* Action Bar */}
                <div className="flex justify-end mb-2">
                    <Button onClick={fetchLicenses} variant="secondary" className="flex items-center gap-2 shadow-sm text-sm">
                        <span className="material-symbols-outlined text-sm">refresh</span> Recarregar Tabela
                    </Button>
                </div>

                {/* Table */}
                <div className="bg-white dark:bg-[#1a2634] border border-[#dbe0e6] dark:border-gray-700 overflow-x-auto shadow-xl rounded-lg min-h-[400px] relative">
                    <table className="w-full text-sm text-left border-collapse min-w-[1000px]">
                        <thead className="text-sm text-[#111418] dark:text-gray-300 uppercase bg-gray-50 dark:bg-gray-800/80">
                            <tr>
                                <th scope="col" className="px-5 py-4 border-b border-[#dbe0e6] dark:border-gray-700">DATA CRIAÇÃO</th>
                                <th scope="col" className="px-5 py-4 border-b border-[#dbe0e6] dark:border-gray-700">Cliente (E-mail)</th>
                                <th scope="col" className="px-5 py-4 border-b border-[#dbe0e6] dark:border-gray-700">Horário</th>
                                <th scope="col" className="px-5 py-4 border-b border-[#dbe0e6] dark:border-gray-700 text-center">Turmas</th>
                                <th scope="col" className="px-5 py-4 border-b border-[#dbe0e6] dark:border-gray-700 text-center">Pagamento</th>
                                <th scope="col" className="px-5 py-4 border-b border-[#dbe0e6] dark:border-gray-700 text-center">Comprovante</th>
                                <th scope="col" className="px-5 py-4 border-b border-[#dbe0e6] dark:border-gray-700 text-center">Status</th>
                                <th scope="col" className="px-5 py-4 border-b border-[#dbe0e6] dark:border-gray-700 text-center">Vencimento</th>
                                <th scope="col" className="px-5 py-4 border-b border-[#dbe0e6] dark:border-gray-700 text-right">Ação</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!loading && !error && licenses.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="px-4 py-16 text-center text-gray-500 text-lg">
                                        Nenhuma licença foi localizada no banco de dados.
                                    </td>
                                </tr>
                            )}

                            {!loading && !error && licenses.map((lic) => {
                                const isPending = lic.payment_status === 'Aguardando' || lic.payment_status === 'under_review';

                                return (
                                    <tr key={lic.id} className="hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors border-b border-[#dbe0e6]/50 dark:border-gray-700/50">
                                        <td className="px-5 py-4 font-medium text-gray-500 whitespace-nowrap">
                                            {formatDate(lic.created_at)}
                                        </td>
                                        <td className="px-5 py-4 font-bold text-gray-800 dark:text-gray-200">
                                            {lic.user_email}
                                        </td>
                                        <td className="px-5 py-4 text-gray-600 dark:text-gray-400">
                                            {lic.schedule_name || <span className="italic text-gray-400">Não associado</span>}
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
                                                    onClick={() => setViewingReceiptUrl(lic.receipt_url)}
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
                            })}
                        </tbody>
                    </table>

                    {loading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-[#1a2634]/80 backdrop-blur-sm">
                            <div className="flex flex-col items-center gap-3">
                                <span className="material-symbols-outlined animate-spin text-primary text-5xl">settings</span>
                                <span className="font-bold text-gray-700 dark:text-gray-200">Buscando banco de dados...</span>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/90 dark:bg-gray-900/90 backdrop-blur-md">
                            <div className="bg-red-50 text-red-600 p-8 rounded-xl flex flex-col items-center gap-4 border border-red-200 max-w-lg text-center shadow-2xl">
                                <span className="material-symbols-outlined text-5xl">warning</span>
                                <span className="font-bold text-lg">{error}</span>
                                <Button onClick={fetchLicenses} variant="outline" className="border-red-300 text-red-700 mt-4">Tentar novamente</Button>
                            </div>
                        </div>
                    )}
                </div>

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

            {/* Receipt Preview Modal */}
            <Modal
                isOpen={!!viewingReceiptUrl}
                onClose={() => setViewingReceiptUrl(null)}
                size="lg"
            >
                <div className="p-6 space-y-4">
                    <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-3">
                        <h3 className="text-lg font-bold flex items-center gap-2 text-gray-800 dark:text-white">
                            <span className="material-symbols-outlined text-primary">receipt_long</span>
                            Comprovante de Pagamento
                        </h3>
                        {viewingReceiptUrl && (
                            <a
                                href={viewingReceiptUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-primary font-bold hover:underline flex items-center gap-1"
                            >
                                Abrir em nova aba
                                <span className="material-symbols-outlined text-xs">open_in_new</span>
                            </a>
                        )}
                    </div>

                    <div className="max-h-[65vh] overflow-auto flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-xl p-2">
                        {viewingReceiptUrl ? (
                            viewingReceiptUrl.endsWith('.pdf') ? (
                                <iframe
                                    src={viewingReceiptUrl}
                                    title="Comprovante PDF"
                                    className="w-full h-[500px] rounded-lg border-0"
                                />
                            ) : (
                                <img
                                    src={viewingReceiptUrl}
                                    alt="Comprovante"
                                    className="max-h-[500px] w-auto object-contain rounded-lg shadow-md"
                                />
                            )
                        ) : null}
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
