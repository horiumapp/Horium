import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { saveAs } from 'file-saver';
import { supabase } from '../../services/supabaseClient';
import { createDanfePdf, getDanfeMarkup } from './danfeDocument';
import { toPublicError } from '../../utils/publicError';

interface LicenseSelectionProps {
    onSelectPurchase: () => void;
    onSelectBudget: () => void;
    onStartTestMode: () => void;
    onBack: () => void;
}

export const LicenseSelection: React.FC<LicenseSelectionProps> = ({
    onSelectPurchase,
    onSelectBudget,
    onStartTestMode,
    onBack
}) => {
    const [licenses, setLicenses] = useState<any[]>([]);
    const [recipientName, setRecipientName] = useState('Destinatário da licença');
    const [danfeLicense, setDanfeLicense] = useState<any | null>(null);
    const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
    const [preparingPdf, setPreparingPdf] = useState(false);
    const [pdfError, setPdfError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const danfePreviewRef = useRef<HTMLDivElement>(null);
    const danfeMarkup = useMemo(
        () => (danfeLicense ? getDanfeMarkup(danfeLicense, recipientName) : null),
        [danfeLicense, recipientName]
    );

    useEffect(() => {
        const fetchLicenses = async () => {
            try {
                const { data: userData, error: userError } = await supabase.auth.getUser();
                if (userError) throw userError;

                if (userData.user) {
                    const meta = userData.user.user_metadata || {};
                    const name = [meta.full_name, meta.name, userData.user.email].find((value) => typeof value === 'string' && value.trim());
                    if (name) setRecipientName(name);

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
                setError(toPublicError(err, 'Erro ao carregar as licenças.'));
            } finally {
                setLoading(false);
            }
        };

        fetchLicenses();
    }, []);

    useEffect(() => {
        if (!danfeLicense) return;

        let cancelled = false;
        setPdfBlob(null);
        setPdfError(null);
        setPreparingPdf(true);

        const waitForLaidOutPage = async () => {
            for (let attempt = 0; attempt < 30; attempt += 1) {
                const found = danfePreviewRef.current?.querySelector('.danfe-page');
                if (found instanceof HTMLElement && found.offsetWidth > 0 && found.offsetHeight > 0) return found;
                await new Promise((resolve) => setTimeout(resolve, 50));
            }
            return null;
        };

        waitForLaidOutPage()
            .then((laidOutPage) => {
                if (cancelled) return null;
                if (!laidOutPage) throw new Error('A nota ainda não está pronta para o PDF.');
                return createDanfePdf(laidOutPage);
            })
            .then((blob) => {
                if (!cancelled && blob) setPdfBlob(blob);
            })
            .catch((previewError) => {
                console.error('Erro ao montar a visualização da nota:', previewError);
                if (!cancelled) setPdfError('Não foi possível montar o PDF da nota.');
            })
            .finally(() => {
                if (!cancelled) setPreparingPdf(false);
            });

        return () => {
            cancelled = true;
        };
    }, [danfeLicense, danfeMarkup]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('pt-BR').format(date);
    };

    return (
        <div className="min-h-[500px] flex-1 animate-in fade-in duration-500">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">

                {/* Header title */}
                <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white px-5 py-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <div className="flex items-center gap-3.5">
                        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-primary dark:bg-blue-500/15 dark:text-blue-300">
                            <span className="material-symbols-outlined text-2xl">workspace_premium</span>
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary dark:text-blue-300">Conta e pagamentos</p>
                            <h2 className="mt-0.5 text-xl font-bold tracking-tight text-slate-900 dark:text-white">Licenças adquiridas</h2>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Consulte validade, pagamento e comprovantes da sua instituição.</p>
                        </div>
                    </div>
                    <span className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        <span className="size-1.5 rounded-full bg-emerald-500" />
                        {loading ? 'Atualizando licenças' : `${licenses.length} ${licenses.length === 1 ? 'licença' : 'licenças'}`}
                    </span>
                </div>

                {/* Table container */}
                <div className="relative min-h-[200px] overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                    <table className="w-full min-w-[980px] border-collapse text-left text-sm">
                        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/70 dark:text-slate-300">
                            <tr>
                                <th scope="col" className="border-b border-slate-200 px-4 py-4 text-center font-bold dark:border-slate-700">Data do<br />pagamento</th>
                                <th scope="col" className="border-b border-slate-200 px-4 py-4 text-center font-bold dark:border-slate-700">Número de<br />turmas</th>
                                <th scope="col" className="border-b border-slate-200 px-4 py-4 text-center font-bold dark:border-slate-700">Valor</th>
                                <th scope="col" className="border-b border-slate-200 px-4 py-4 text-center font-bold dark:border-slate-700">Forma de<br />pagamento</th>
                                <th scope="col" className="border-b border-slate-200 px-4 py-4 text-center font-bold dark:border-slate-700">Status / confirmação do<br />pagamento</th>
                                <th scope="col" className="border-b border-slate-200 px-4 py-4 text-center font-bold dark:border-slate-700">Válido até</th>
                                <th scope="col" className="border-b border-slate-200 px-4 py-4 text-center font-bold dark:border-slate-700">Nota<br />fiscal</th>
                                <th scope="col" className="border-b border-slate-200 px-4 py-4 text-center font-bold dark:border-slate-700">Opções</th>
                                <th scope="col" className="border-b border-slate-200 px-4 py-4 text-center font-bold dark:border-slate-700">Filtros da<br />licença</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!loading && !error && licenses.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="px-4 py-16 text-center text-sm font-medium text-slate-500 dark:text-slate-400">
                                        <span className="material-symbols-outlined mb-2 block text-3xl text-slate-300 dark:text-slate-600">workspace_premium</span>
                                        Nenhuma licença foi habilitada para a sua conta ainda.
                                    </td>
                                </tr>
                            )}

                            {!loading && !error && licenses.map((license, idx) => (
                                <tr key={license.id} className={`${idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/70 dark:bg-slate-800/30'} transition-colors hover:bg-blue-50/70 dark:hover:bg-blue-900/10`}>
                                    <td className="px-4 py-4 border border-[#dbe0e6] dark:border-gray-700 text-center font-medium">{formatDate(license.payment_date)}</td>
                                    <td className="px-4 py-4 border border-[#dbe0e6] dark:border-gray-700 text-center">{license.classes_amount}</td>
                                    <td className="px-4 py-4 border border-[#dbe0e6] dark:border-gray-700 text-center">
                                        <div className="flex justify-center gap-1 font-medium text-primary dark:text-blue-400">
                                            <span>{formatCurrency(Number(license.value_paid))}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 border border-[#dbe0e6] dark:border-gray-700 text-center text-gray-600 dark:text-gray-400">{license.payment_method}</td>
                                    <td className="border border-[#dbe0e6] px-4 py-4 text-center dark:border-gray-700">
                                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${license.payment_status === 'Aprovado'
                                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300'
                                            : license.payment_status === 'Aguardando'
                                                ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/25 dark:text-amber-300'
                                                : 'bg-rose-50 text-rose-700 dark:bg-rose-900/25 dark:text-rose-300'
                                            }`}>
                                            <span className="material-symbols-outlined text-base">
                                                {license.payment_status === 'Aprovado' ? 'check_circle' : license.payment_status === 'Aguardando' ? 'schedule' : 'cancel'}
                                            </span>
                                            {license.payment_status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 border border-[#dbe0e6] dark:border-gray-700 text-center font-medium">{formatDate(license.valid_until)}</td>
                                    <td className="px-4 py-4 border border-[#dbe0e6] dark:border-gray-700 text-center">
                                        {license.payment_status === 'Aprovado' ? (
                                            <button type="button" aria-label="Abrir nota fiscal" className="mx-auto flex size-10 cursor-pointer items-center justify-center rounded-xl text-slate-500 transition hover:bg-blue-50 hover:text-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 dark:text-slate-300 dark:hover:bg-blue-900/20" onClick={() => setDanfeLicense(license)}>
                                                <span className="material-symbols-outlined text-xl">receipt_long</span>
                                            </button>
                                        ) : (
                                            <span className="text-slate-300 dark:text-slate-600">—</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-4 border border-[#dbe0e6] dark:border-gray-700 text-center"><span className="text-slate-300 dark:text-slate-600">—</span></td>
                                    <td className="px-4 py-4 border border-[#dbe0e6] dark:border-gray-700 text-center"><span className="text-slate-300 dark:text-slate-600">—</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {loading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-[2px]">
                            <div className="flex flex-col items-center gap-2">
                                <span className="material-symbols-outlined animate-spin text-primary text-3xl">sync</span>
                                <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Carregando licenças...</span>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-[2px]">
                            <div role="alert" className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-rose-700 shadow-lg dark:border-rose-900/60 dark:bg-rose-900/20 dark:text-rose-200">
                                <span className="material-symbols-outlined">error</span>
                                <span className="font-medium">{error}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Primary Action Buttons */}
                <div className="grid w-full max-w-4xl grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
                    <button
                        onClick={onSelectPurchase}
                        className="group flex min-h-14 items-center gap-3 rounded-2xl border border-blue-600 bg-primary px-5 py-3 text-left text-sm font-bold text-white shadow-md shadow-primary/15 transition hover:bg-blue-600 active:scale-[0.99]"
                    >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/15"><span className="material-symbols-outlined text-lg">add_card</span></span>
                        <span className="min-w-0 flex-1">Adquirir nova licença</span>
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/15 transition-colors group-hover:bg-white/25">
                            <span className="material-symbols-outlined text-base">arrow_forward</span>
                        </div>
                    </button>
                    <button
                        onClick={onSelectBudget}
                        className="group flex min-h-14 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-left text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-900 dark:hover:bg-blue-900/10 active:scale-[0.99]"
                    >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-primary dark:bg-blue-500/15 dark:text-blue-300"><span className="material-symbols-outlined text-lg">request_quote</span></span>
                        <span className="min-w-0 flex-1">Gerar orçamento / proposta</span>
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition group-hover:bg-white dark:bg-slate-800 dark:text-slate-300">
                            <span className="material-symbols-outlined text-base">arrow_forward</span>
                        </div>
                    </button>
                    <button
                        onClick={onStartTestMode}
                        className="group flex min-h-14 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-left text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-900 dark:hover:bg-blue-900/10 active:scale-[0.99]"
                    >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-primary dark:bg-blue-500/15 dark:text-blue-300"><span className="material-symbols-outlined text-lg">science</span></span>
                        <span className="min-w-0 flex-1">Fazer um novo horário em modo teste</span>
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition group-hover:bg-white dark:bg-slate-800 dark:text-slate-300">
                            <span className="material-symbols-outlined text-base">arrow_forward</span>
                        </div>
                    </button>
                    <button
                        onClick={onBack}
                        className="group flex min-h-14 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-left text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 active:scale-[0.99]"
                    >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"><span className="material-symbols-outlined text-lg">arrow_back</span></span>
                        <span className="min-w-0 flex-1">Voltar para a tela principal</span>
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition group-hover:bg-white dark:bg-slate-800 dark:text-slate-300">
                            <span className="material-symbols-outlined text-base">arrow_forward</span>
                        </div>
                    </button>
                </div>

            </div>

            {danfeLicense && createPortal(
                <div className="fixed inset-0 flex flex-col bg-slate-900 p-3 sm:p-6" style={{ zIndex: 2147483646 }} role="dialog" aria-modal="true" aria-label="Visualização da nota fiscal">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold text-white">Visualização da nota fiscal</p>
                            <p className="text-xs text-slate-200">Confira o documento aqui. Para imprimir, baixe o PDF e abra no leitor do computador.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                                disabled={!pdfBlob || preparingPdf}
                                onClick={() => pdfBlob && saveAs(pdfBlob, 'nota-fiscal-horium.pdf')}
                            >
                                Baixar PDF
                            </button>
                            <button
                                type="button"
                                className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-800"
                                onClick={() => setDanfeLicense(null)}
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                    {preparingPdf && (
                        <p className="mb-2 text-sm font-medium text-white">Preparando o PDF para download...</p>
                    )}
                    {pdfError && (
                        <p className="mb-2 text-sm font-medium text-rose-200" role="alert">{pdfError}</p>
                    )}
                    <div className="min-h-0 w-full flex-1 overflow-auto rounded-xl bg-slate-200">
                        {danfeMarkup && <style>{danfeMarkup.css}</style>}
                        <div
                            ref={danfePreviewRef}
                            dangerouslySetInnerHTML={{ __html: danfeMarkup?.body ?? '' }}
                        />
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
