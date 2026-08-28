
import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { QRCodeSVG } from 'qrcode.react';
import { generatePixPayload } from '../../utils/pix';
import { supabase } from '../../services/supabaseClient';

interface LicensePurchaseProps {
    onBack: () => void;
    onGoHome: () => void;
    scheduleId?: string;
}

export const LicensePurchase: React.FC<LicensePurchaseProps> = ({ onBack, onGoHome, scheduleId }) => {
    const [step, setStep] = useState<'config' | 'payment'>('config');
    const [numClasses, setNumClasses] = useState(12);
    const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
    const [showPixQR, setShowPixQR] = useState(false);

    // Pix specific states
    const [timeLeft, setTimeLeft] = useState(15 * 60); // 15 minutes
    const [isExpired, setIsExpired] = useState(false);
    const [paymentStatus, setPaymentStatus] = useState<'pending' | 'upload_receipt' | 'verifying' | 'success' | 'under_review'>('pending');
    const [copied, setCopied] = useState(false);
    const [receiptFile, setReceiptFile] = useState<File | null>(null);

    const pricePerClass = 15.0;
    const totalPrice = numClasses * pricePerClass;
    const pixPayload = generatePixPayload('horium.app@gmail.com', totalPrice);

    useEffect(() => {
        if (!showPixQR || paymentStatus === 'success' || paymentStatus === 'verifying' || paymentStatus === 'upload_receipt' || isExpired) return;

        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    setIsExpired(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [showPixQR, paymentStatus, isExpired]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const handleCopyPix = () => {
        navigator.clipboard.writeText(pixPayload);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleGenerateNewPix = () => {
        setTimeLeft(15 * 60);
        setIsExpired(false);
    };

    const handleChooseOtherMethod = () => {
        setShowPixQR(false);
        setSelectedMethod(null);
        setTimeLeft(15 * 60);
        setIsExpired(false);
        setPaymentStatus('pending');
        setReceiptFile(null);
    };

    const handleUploadReceipt = async () => {
        if (!receiptFile) return;

        setPaymentStatus('verifying');

        let currentUser: any = null;
        try {
            const { data: userData, error: userError } = await supabase.auth.getUser();
            if (userError) throw userError;
            currentUser = userData.user;

            if (userData.user) {
                const today = new Date().toISOString().split('T')[0];
                const validUntil = new Date();
                validUntil.setMonth(validUntil.getMonth() + 6);

                const { error: insertError } = await supabase.from('licenses').insert({
                    user_id: userData.user.id,
                    schedule_id: scheduleId,
                    payment_date: today,
                    classes_amount: numClasses,
                    value_paid: totalPrice,
                    payment_method: 'PIX',
                    payment_status: 'Aguardando',
                    valid_until: validUntil.toISOString().split('T')[0],
                    receipt_url: null,
                });

                if (insertError) {
                    console.error("Error inserting license:", insertError);
                    alert("Erro ao registrar a licença no banco de dados.");
                    setPaymentStatus('upload_receipt');
                    return;
                }
            }
        } catch (err) {
            console.error("Auth error:", err);
            alert("Sessão inválida. Por favor, faça login novamente.");
            setPaymentStatus('upload_receipt');
            return;
        }

        try {
            const formData = new FormData();
            formData.append('_subject', `Novo Comprovante PIX - Horium (${numClasses} Turmas)`);
            formData.append('_captcha', 'false');
            formData.append('_template', 'table');
            formData.append('_cc', 'prof.jackison@gmail.com');
            formData.append('Email_Usuario', currentUser?.email || 'Não informado');
            formData.append('ID_Usuario', currentUser?.id || 'Não informado');
            formData.append('ID_Horario', scheduleId || 'Não vinculado');
            formData.append('Total_Pago', `R$ ${totalPrice},00`);
            formData.append('Qtd_Turmas', String(numClasses));
            formData.append('Mensagem', `Um usuário anexou comprovante de PIX para a compra de ${numClasses} turmas (6 meses). Comprovante anexo.`);
            formData.append('attachment', receiptFile);

            await fetch('https://formsubmit.co/ajax/horium.app@gmail.com', {
                method: 'POST',
                body: formData
            });

            setPaymentStatus('under_review');
        } catch (submitErr) {
            console.warn("Erro no envio do formulário via fetch, mantendo status sob revisão:", submitErr);
            setPaymentStatus('under_review');
        }
    };

    const renderConfig = () => (
        <div className="w-full max-w-2xl bg-blue-50 dark:bg-slate-800 rounded-2xl shadow-2xl border border-blue-200 dark:border-slate-700 p-10 space-y-8 animate-in fade-in slide-in-from-bottom-8">
            <div className="text-center space-y-2">
                <h2 className="text-3xl font-black text-gray-800 dark:text-gray-100 tracking-tight">Adquirir Licença</h2>
                <p className="text-gray-700 dark:text-gray-300">Selecione o número de turmas para prosseguir.</p>
            </div>

            <div className="space-y-4">
                <label className="text-xs font-black uppercase text-gray-700 dark:text-gray-300 ml-1">Quantidade de Turmas</label>
                <select
                    value={numClasses}
                    onChange={(e) => setNumClasses(Number(e.target.value))}
                    className="w-full h-14 bg-white dark:bg-gray-900 border-2 border-transparent focus:border-primary rounded-xl text-xl font-black px-6 shadow-xl outline-none transition-all"
                >
                    {Array.from({ length: 50 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n} Turma{n > 1 ? 's' : ''}</option>)}
                </select>
            </div>

            <div className="flex gap-4 pt-4">
                <Button onClick={onBack} variant="ghost" className="flex-1 bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 text-gray-800 dark:text-white">
                    Cancelar
                </Button>
                <Button onClick={() => setStep('payment')} className="flex-1 text-xl shadow-xl">
                    Continuar
                </Button>
            </div>
        </div>
    );

    const renderPayment = () => {
        if (paymentStatus === 'under_review') {
            return (
                <div className="w-full max-w-2xl bg-white dark:bg-gray-900 border border-yellow-200 dark:border-yellow-800/50 rounded-2xl shadow-xl p-10 text-center space-y-6 animate-in fade-in zoom-in-95 mx-auto">
                    <div className="w-20 h-20 bg-yellow-100 dark:bg-yellow-900/40 rounded-full flex items-center justify-center mx-auto mb-4 scale-in-center">
                        <span className="material-symbols-outlined text-5xl text-yellow-600 dark:text-yellow-400">pending_actions</span>
                    </div>
                    <div className="space-y-3">
                        <h2 className="text-4xl font-black text-gray-800 dark:text-gray-100 tracking-tight">Comprovante Recebido!</h2>
                        <p className="text-gray-600 dark:text-gray-400 text-lg max-w-lg mx-auto leading-relaxed">
                            O seu comprovante foi enviado com sucesso e está <strong>em análise</strong> pela nossa equipe. A licença para <strong>{numClasses} Turmas</strong> será liberada assim que o pagamento for confirmado.
                        </p>
                    </div>
                    <div className="pt-8">
                        <Button onClick={onGoHome} className="w-full h-14 text-xl shadow-lg border-2 border-primary/20 hover:border-primary/50">
                            Voltar para o Início
                        </Button>
                    </div>
                </div>
            );
        }

        if (paymentStatus === 'success') {
            return (
                <div className="w-full max-w-2xl bg-white dark:bg-gray-900 border border-green-200 dark:border-green-800/50 rounded-2xl shadow-xl p-10 text-center space-y-6 animate-in fade-in zoom-in-95 mx-auto">
                    <div className="w-20 h-20 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center mx-auto mb-4 scale-in-center">
                        <span className="material-symbols-outlined text-5xl text-green-600 dark:text-green-400">check_circle</span>
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-4xl font-black text-gray-800 dark:text-gray-100 tracking-tight">Pagamento Aprovado!</h2>
                        <p className="text-gray-600 dark:text-gray-400 text-lg">
                            Sua licença para <strong>{numClasses} Turmas</strong> foi liberada com sucesso.
                        </p>
                    </div>
                    <div className="pt-8">
                        <Button onClick={onGoHome} className="w-full h-14 text-xl shadow-lg">
                            Acessar a Plataforma
                        </Button>
                    </div>
                </div>
            );
        }

        if (paymentStatus === 'verifying') {
            return (
                <div className="w-full max-w-2xl bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-800/50 rounded-2xl shadow-xl p-10 text-center space-y-8 animate-in fade-in zoom-in-95 mx-auto">
                    <div className="w-24 h-24 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center mx-auto mb-4 animate-spin-slow">
                        <span className="material-symbols-outlined text-5xl text-blue-600 dark:text-blue-400 animate-pulse">sync</span>
                    </div>
                    <div className="space-y-3">
                        <h2 className="text-3xl font-black text-gray-800 dark:text-gray-100 tracking-tight">Analisando Comprovante</h2>
                        <p className="text-gray-600 dark:text-gray-400 text-lg max-w-md mx-auto">
                            Aguarde um momento enquanto verificamos o envio do seu arquivo...
                        </p>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-800 h-2 rounded-full overflow-hidden">
                        <div className="bg-blue-500 h-full w-1/2 rounded-full animate-progress-indeterminate"></div>
                    </div>
                </div>
            );
        }

        if (paymentStatus === 'upload_receipt') {
            return (
                <div className="w-full max-w-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl p-8 space-y-6 animate-in fade-in zoom-in-95 mx-auto">
                    <div className="flex items-center gap-4 border-b border-gray-100 dark:border-gray-800 pb-6">
                        <button onClick={() => setPaymentStatus('pending')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all">
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <h2 className="text-2xl font-bold">Enviar Comprovante</h2>
                    </div>

                    <div className="w-full border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-primary/50 rounded-2xl p-10 flex flex-col items-center justify-center space-y-4 bg-gray-50/50 dark:bg-gray-800/20 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all relative cursor-pointer group">
                        <input
                            type="file"
                            accept="image/*,application/pdf"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                    setReceiptFile(e.target.files[0]);
                                }
                            }}
                        />
                        <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm ${receiptFile ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-primary/10 text-primary'}`}>
                            <span className="material-symbols-outlined text-4xl">
                                {receiptFile ? 'task' : 'upload_file'}
                            </span>
                        </div>
                        <div className="text-center space-y-1 z-0">
                            <p className={`font-bold text-lg ${receiptFile ? 'text-green-700 dark:text-green-400' : 'text-gray-800 dark:text-gray-200'}`}>
                                {receiptFile ? receiptFile.name : 'Clique para selecionar um arquivo'}
                            </p>
                            <p className="text-sm font-medium text-gray-500">
                                {receiptFile ? 'Arquivo anexado. Clique em Enviar para continuar.' : 'Ou arraste seu PDF/Imagem (Max 5MB)'}
                            </p>
                        </div>
                    </div>

                    <div className="pt-4 flex gap-4">
                        <Button
                            variant="outline"
                            className="flex-1 border-gray-200 dark:border-gray-700 h-14"
                            onClick={() => setPaymentStatus('pending')}
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleUploadReceipt}
                            className="flex-[2] h-14 text-lg shadow-xl"
                            disabled={!receiptFile}
                        >
                            <span className="material-symbols-outlined mr-2">send</span>
                            Enviar para Verificação
                        </Button>
                    </div>
                </div>
            );
        }

        // Show upload button after 30 seconds (15 * 60 - 30 = 870)
        const showUploadOption = timeLeft <= (15 * 60) - 30;

        return (
            <div className="w-full max-w-4xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl p-8 space-y-8 animate-in fade-in slide-in-from-right-8">
                <div className="flex items-center gap-4 border-b border-gray-100 dark:border-gray-800 pb-6">
                    <button onClick={() => setStep('config')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <h2 className="text-2xl font-bold">Resumo do Pedido</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                        <div className="bg-[#ffcc99]/30 dark:bg-orange-900/20 p-8 rounded-2xl border border-orange-200 dark:border-orange-800/50 text-center space-y-2">
                            <span className="text-xs font-black uppercase text-orange-600 tracking-widest">Total a Pagar</span>
                            <p className="text-4xl font-black text-orange-800 dark:text-orange-200">
                                R$ {totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                            <p className="text-sm font-bold text-orange-700/60 dark:text-orange-300/60">Licença: 06 meses</p>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                                <span className="font-bold text-gray-500 text-xs uppercase tracking-wider">Turmas</span>
                                <span className="font-black">{numClasses} Turmas</span>
                            </div>
                            <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                                <span className="font-bold text-gray-500 text-xs uppercase tracking-wider">Plano</span>
                                <span className="font-black flex items-center gap-2">
                                    06 meses
                                    <span className="material-symbols-outlined text-blue-500 text-sm">info</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6 flex flex-col">
                        <h3 className="font-bold text-lg">Método de Pagamento</h3>

                        {!showPixQR ? (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    {['Cartão de Crédito', 'PIX', 'Boleto'].map(method => (
                                        <button
                                            key={method}
                                            onClick={() => setSelectedMethod(method)}
                                            className={`p-4 border-2 rounded-xl font-bold text-sm transition-all flex flex-col items-center justify-center gap-2 ${selectedMethod === method
                                                ? 'border-primary text-primary bg-primary/5'
                                                : 'border-gray-100 dark:border-gray-800 hover:border-primary/50 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'
                                                }`}
                                        >
                                            <span className="material-symbols-outlined text-2xl">
                                                {method === 'PIX' ? 'pix' : method === 'Boleto' ? 'receipt' : 'credit_card'}
                                            </span>
                                            {method}
                                        </button>
                                    ))}
                                </div>
                                <Button
                                    className="w-full h-16 text-xl shadow-xl mt-auto"
                                    disabled={!selectedMethod}
                                    onClick={() => {
                                        if (selectedMethod === 'PIX') {
                                            setShowPixQR(true);
                                            // Reset timer when re-opening
                                            setTimeLeft(15 * 60);
                                            setIsExpired(false);
                                            setPaymentStatus('pending');
                                        } else {
                                            alert('Método em desenvolvimento');
                                        }
                                    }}
                                >
                                    Finalizar Pagamento
                                </Button>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center space-y-6 bg-gray-50 dark:bg-gray-800 p-8 rounded-2xl border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in-95 relative">
                                {!isExpired ? (
                                    <>
                                        <div className="flex items-center gap-2 text-orange-600 font-bold bg-orange-100 dark:bg-orange-900/30 px-4 py-2 rounded-full text-sm mt-4">
                                            <span className="material-symbols-outlined text-sm">timer</span>
                                            Expira em {formatTime(timeLeft)}
                                        </div>

                                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                                            <QRCodeSVG value={pixPayload} size={200} level="M" />
                                        </div>

                                        <div className="text-center w-full">
                                            <p className="font-black text-xl text-gray-800 dark:text-gray-200">Escaneie o QR Code</p>
                                            <p className="text-sm font-medium text-gray-500 mt-1 mb-4">Abra o app do seu banco e escolha pagar via PIX QR Code.</p>

                                            <div className="w-full space-y-2 text-left mb-2">
                                                <label className="text-xs font-bold text-gray-500 uppercase ml-1">Pix Copia e Cola:</label>
                                                <div className="flex gap-2">
                                                    <div className="flex-1 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 text-xs p-3 rounded-xl overflow-hidden text-ellipsis whitespace-nowrap font-mono border-2 border-dashed border-gray-200 dark:border-gray-700">
                                                        {pixPayload}
                                                    </div>
                                                    <Button variant={copied ? 'default' : 'outline'} onClick={handleCopyPix} className={`shrink-0 flex items-center gap-2 ${copied ? 'bg-green-500 hover:bg-green-600 border-green-500 text-white' : ''}`}>
                                                        <span className="material-symbols-outlined text-sm">{copied ? 'check' : 'content_copy'}</span>
                                                        {copied ? 'Copiado!' : 'Copiar'}
                                                    </Button>
                                                </div>
                                            </div>

                                            {showUploadOption && (
                                                <div className="w-full mt-4 pt-4 border-t border-gray-100 dark:border-gray-700/50 animate-in fade-in slide-in-from-bottom-2">
                                                    <div className="bg-blue-50/80 dark:bg-blue-900/10 rounded-xl p-5 border border-blue-100 dark:border-blue-800/30 flex flex-col items-center text-center space-y-3">
                                                        <p className="text-sm font-bold text-blue-800 dark:text-blue-300">
                                                            Já pagou e não atualizou?
                                                        </p>
                                                        <Button
                                                            variant="default"
                                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-md border-0 h-12"
                                                            onClick={() => setPaymentStatus('upload_receipt')}
                                                        >
                                                            <span className="material-symbols-outlined text-lg mr-2">receipt_long</span>
                                                            Envie o comprovante
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-center space-y-4 py-6 w-full mt-4">
                                        <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 animate-in zoom-in">
                                            <span className="material-symbols-outlined text-4xl text-red-600 dark:text-red-400">error</span>
                                        </div>
                                        <p className="font-black text-gray-800 dark:text-gray-200 text-2xl tracking-tight">QR Code Expirado</p>
                                        <p className="text-sm font-medium text-gray-500 max-w-[200px] mx-auto">O tempo limite para pagamento encerrou-se.</p>
                                        <div className="pt-4">
                                            <Button onClick={handleGenerateNewPix} className="w-full shadow-md">
                                                Gerar Novo Código
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                <div className="w-full pt-2">
                                    <Button variant="outline" onClick={handleChooseOtherMethod} className="w-full border-2 border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">
                                        Escolher outro método
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
            {step === 'config' && renderConfig()}
            {step === 'payment' && renderPayment()}
        </div>
    );
};
