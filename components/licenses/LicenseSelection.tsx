import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';

interface LicenseSelectionProps {
    onSelectPurchase: () => void;
    onSelectBudget: () => void;
    onStartTestMode: () => void;
    onBack: () => void;
}

export const LicenseSelection: React.FC<LicenseSelectionProps> = ({
    onSelectPurchase,
    onStartTestMode,
    onBack
}) => {
    const [licenses, setLicenses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchLicenses = async () => {
            try {
                const { data: userData, error: userError } = await supabase.auth.getUser();
                if (userError) throw userError;

                if (userData.user) {
                    const { data, error } = await supabase
                        .from('licenses')
                        .select('*')
                        .eq('user_id', userData.user.id)
                        .order('payment_date', { ascending: false });

                    if (error) throw error;
                    setLicenses(data || []);
                }
            } catch (err: any) {
                console.error("Erro ao buscar licenças:", err);
                setError(err.message || 'Erro ao carregar as licenças');
            } finally {
                setLoading(false);
            }
        };

        fetchLicenses();
    }, []);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('pt-BR').format(date);
    };

    const handleOpenReceipt = async (urlOrPath: string) => {
        if (!urlOrPath) return;
        if (urlOrPath.includes('token=')) {
            window.open(urlOrPath, '_blank');
            return;
        }

        try {
            let path = urlOrPath;
            if (urlOrPath.includes('/receipts/')) {
                path = urlOrPath.split('/receipts/').pop()?.split('?')[0] || urlOrPath;
            }
            const { data } = await supabase.storage.from('receipts').createSignedUrl(path, 3600);
            if (data?.signedUrl) {
                window.open(data.signedUrl, '_blank');
                return;
            }
        } catch (e) {
            console.warn("Erro ao gerar URL assinada para visualização:", e);
        }

        window.open(urlOrPath, '_blank');
    };

    return (
        <div className="flex-1 flex flex-col p-6 min-h-[500px] animate-in fade-in duration-500">
            <div className="w-full max-w-7xl mx-auto flex flex-col gap-6">

                {/* Header title */}
                <div className="bg-white dark:bg-[#1a2634] border border-[#dbe0e6] dark:border-gray-700 py-4 px-6 text-center shadow-sm">
                    <h2 className="text-[#111418] dark:text-white text-xl font-medium tracking-wide">
                        Licenças Adquiridas
                    </h2>
                </div>

                {/* Table container */}
                <div className="bg-white dark:bg-[#1a2634] border border-[#dbe0e6] dark:border-gray-700 overflow-x-auto shadow-sm min-h-[200px] relative">
                    <table className="w-full text-sm text-left border-collapse min-w-[800px]">
                        <thead className="text-xs text-[#111418] dark:text-gray-300 uppercase bg-gray-50 dark:bg-gray-800/50">
                            <tr>
                                <th scope="col" className="px-4 py-3 border border-[#dbe0e6] dark:border-gray-700 text-center font-semibold">Data do<br />Pagamento</th>
                                <th scope="col" className="px-4 py-3 border border-[#dbe0e6] dark:border-gray-700 text-center font-semibold">Número de<br />turmas</th>
                                <th scope="col" className="px-4 py-3 border border-[#dbe0e6] dark:border-gray-700 text-center font-semibold">Valor</th>
                                <th scope="col" className="px-4 py-3 border border-[#dbe0e6] dark:border-gray-700 text-center font-semibold">Forma de<br />pagamento</th>
                                <th scope="col" className="px-4 py-3 border border-[#dbe0e6] dark:border-gray-700 text-center font-semibold">Status / Confirmação do<br />Pagamento</th>
                                <th scope="col" className="px-4 py-3 border border-[#dbe0e6] dark:border-gray-700 text-center font-semibold">Válido até</th>
                                <th scope="col" className="px-4 py-3 border border-[#dbe0e6] dark:border-gray-700 text-center font-semibold">Nota<br />Fiscal</th>
                                <th scope="col" className="px-4 py-3 border border-[#dbe0e6] dark:border-gray-700 text-center font-semibold">Opções</th>
                                <th scope="col" className="px-4 py-3 border border-[#dbe0e6] dark:border-gray-700 text-center font-semibold">Filtros da<br />Licença</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!loading && !error && licenses.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400 font-medium border border-[#dbe0e6] dark:border-gray-700">
                                        Nenhuma licença foi habilitada para a sua conta ainda.
                                    </td>
                                </tr>
                            )}

                            {!loading && !error && licenses.map((license, idx) => (
                                <tr key={license.id} className={`${idx % 2 === 0 ? 'bg-white dark:bg-[#1a2634]' : 'bg-[#f4f7fa] dark:bg-gray-800/20'} hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors`}>
                                    <td className="px-4 py-4 border border-[#dbe0e6] dark:border-gray-700 text-center font-medium">{formatDate(license.payment_date)}</td>
                                    <td className="px-4 py-4 border border-[#dbe0e6] dark:border-gray-700 text-center">{license.classes_amount}</td>
                                    <td className="px-4 py-4 border border-[#dbe0e6] dark:border-gray-700 text-center">
                                        <div className="flex justify-center gap-1 font-medium text-primary dark:text-blue-400">
                                            <span>{formatCurrency(Number(license.value_paid))}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 border border-[#dbe0e6] dark:border-gray-700 text-center text-gray-600 dark:text-gray-400">{license.payment_method}</td>
                                    <td className="px-4 py-4 border border-[#dbe0e6] dark:border-gray-700 text-center">
                                        <div className="flex flex-col justify-center items-center">
                                            {license.payment_status === 'Aprovado' ? (
                                                <span className="material-symbols-outlined text-green-500 text-3xl font-black drop-shadow-sm">check</span>
                                            ) : license.payment_status === 'Aguardando' ? (
                                                <span className="material-symbols-outlined text-yellow-500 text-2xl font-black drop-shadow-sm">pending</span>
                                            ) : (
                                                <span className="material-symbols-outlined text-red-500 text-2xl font-black drop-shadow-sm">close</span>
                                            )}
                                            <span className="text-xs text-gray-500 font-bold mt-1 uppercase">{license.payment_status}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 border border-[#dbe0e6] dark:border-gray-700 text-center font-medium">{formatDate(license.valid_until)}</td>
                                    <td className="px-4 py-4 border border-[#dbe0e6] dark:border-gray-700 text-center">
                                        {license.receipt_url && (
                                            <div className="flex justify-center cursor-pointer hover:scale-110 transition-transform" onClick={() => handleOpenReceipt(license.receipt_url)}>
                                                <div className="relative">
                                                    <span className="material-symbols-outlined text-gray-500 text-2xl">receipt_long</span>
                                                    <span className="absolute -bottom-1 -right-1 text-[10px] font-black text-white bg-blue-500 rounded-full w-4 h-4 flex items-center justify-center border border-white">e</span>
                                                </div>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-4 border border-[#dbe0e6] dark:border-gray-700 text-center"></td>
                                    <td className="px-4 py-4 border border-[#dbe0e6] dark:border-gray-700 text-center"></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {loading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-[2px]">
                            <div className="flex flex-col items-center gap-2">
                                <span className="material-symbols-outlined animate-spin text-primary text-4xl">sync</span>
                                <span className="text-sm font-bold text-gray-600 dark:text-gray-300">Carregando licenças...</span>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-[2px]">
                            <div className="bg-red-50 text-red-600 px-6 py-4 rounded-lg flex items-center gap-3 border border-red-200 shadow-lg">
                                <span className="material-symbols-outlined">error</span>
                                <span className="font-medium">{error}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Primary Action Buttons */}
                <div className="flex flex-col gap-3 max-w-lg mt-4 w-full">
                    <button
                        onClick={onSelectPurchase}
                        className="group flex items-center justify-between bg-primary text-white border border-blue-600 px-6 py-3 rounded-lg font-bold text-base shadow-md hover:bg-blue-600 transition-all active:scale-[0.98]"
                    >
                        <span className="flex-1 text-center">Adquirir Nova Licença</span>
                        <div className="bg-white/20 rounded-full w-8 h-8 flex items-center justify-center group-hover:bg-white/30 transition-colors">
                            <span className="material-symbols-outlined text-sm">play_arrow</span>
                        </div>
                    </button>
                    <button
                        onClick={onStartTestMode}
                        className="group flex items-center justify-between bg-primary text-white border border-blue-600 px-6 py-3 rounded-lg font-bold text-base shadow-md hover:bg-blue-600 transition-all active:scale-[0.98]"
                    >
                        <span className="flex-1 text-center">Fazer um novo horário em modo teste</span>
                        <div className="bg-white/20 rounded-full w-8 h-8 flex items-center justify-center group-hover:bg-white/30 transition-colors">
                            <span className="material-symbols-outlined text-sm">play_arrow</span>
                        </div>
                    </button>
                    <button
                        onClick={onBack}
                        className="group flex items-center justify-between bg-primary text-white border border-blue-600 px-6 py-3 rounded-lg font-bold text-base shadow-md hover:bg-blue-600 transition-all active:scale-[0.98]"
                    >
                        <span className="flex-1 text-center">Voltar para tela principal</span>
                        <div className="bg-white/20 rounded-full w-8 h-8 flex items-center justify-center group-hover:bg-white/30 transition-colors">
                            <span className="material-symbols-outlined text-sm">play_arrow</span>
                        </div>
                    </button>
                </div>

            </div>
        </div>
    );
};
