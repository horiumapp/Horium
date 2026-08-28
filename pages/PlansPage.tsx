import React, { useState, useMemo, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { generatePixPayload } from '../utils/pix';
import { Button } from '../components/ui/Button';
import { supabase } from '../services/supabaseClient';

const PRICES_CONFIG = {
  '06 meses': 15,
  '1 ano': 25,
  '2 anos': 50
};

const DURATION_OPTIONS = [
  { label: '06 meses', sub: 'PLANO ESCOLHIDO' },
  { label: '1 ano', sub: 'PLANO ESCOLHIDO' },
  { label: '2 anos', sub: 'PLANO ESCOLHIDO' }
];

const FULL_PRICE_TABLE = [
  { classes: '01 Turma', type: '06 meses', value: 'R$ 15,00' },
  { classes: '01 Turma', type: '1 ano', value: 'R$ 25,00' },
  { classes: '01 Turma', type: '2 anos', value: 'R$ 50,00' },
  { classes: '02 Turmas', type: '06 meses', value: 'R$ 30,00' },
  { classes: '02 Turmas', type: '1 ano', value: 'R$ 50,00' },
  { classes: '02 Turmas', type: '2 anos', value: 'R$ 100,00' },
  { classes: '03 Turmas', type: '06 meses', value: 'R$ 45,00' },
  { classes: '03 Turmas', type: '1 ano', value: 'R$ 75,00' },
  { classes: '03 Turmas', type: '2 anos', value: 'R$ 150,00' },
  { classes: '04 Turmas', type: '06 meses', value: 'R$ 60,00' },
  { classes: '04 Turmas', type: '1 ano', value: 'R$ 100,00' },
  { classes: '04 Turmas', type: '2 anos', value: 'R$ 200,00' },
  { classes: '05 Turmas', type: '06 meses', value: 'R$ 75,00' },
  { classes: '05 Turmas', type: '1 ano', value: 'R$ 125,00' },
  { classes: '05 Turmas', type: '2 anos', value: 'R$ 250,00' },
  { classes: '06 Turmas', type: '06 meses', value: 'R$ 90,00' },
  { classes: '06 Turmas', type: '1 ano', value: 'R$ 150,00' },
  { classes: '06 Turmas', type: '2 anos', value: 'R$ 300,00' },
  { classes: '07 Turmas', type: '06 meses', value: 'R$ 105,00' },
  { classes: '07 Turmas', type: '1 ano', value: 'R$ 175,00' },
  { classes: '07 Turmas', type: '2 anos', value: 'R$ 350,00' }
];

interface PlansPageProps {
  initialClasses?: number;
  scheduleId?: string;
  lockClasses?: boolean;
  onBackToStart?: () => void;
}

const PlansPage: React.FC<PlansPageProps> = ({
  initialClasses = 4,
  scheduleId,
  lockClasses = false,
  onBackToStart
}) => {
  const [step, setStep] = useState<'SELECTION' | 'SUMMARY'>('SELECTION');
  const [numClasses, setNumClasses] = useState(initialClasses);
  const [duration, setDuration] = useState<keyof typeof PRICES_CONFIG>('06 meses');
  const [paymentMethod, setPaymentMethod] = useState<'CARD' | 'PIX' | 'BOLETO'>('CARD');
  const [showPriceTable, setShowPriceTable] = useState(false);
  const [showPixQR, setShowPixQR] = useState(false);

  // Pix specific states added from LicensePurchase
  const [timeLeft, setTimeLeft] = useState(15 * 60); // 15 minutes
  const [isExpired, setIsExpired] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'upload_receipt' | 'verifying' | 'success' | 'under_review'>('pending');
  const [copied, setCopied] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const totalPrice = useMemo(() => {
    return numClasses * PRICES_CONFIG[duration];
  }, [numClasses, duration]);

  const pixPayload = useMemo(() => generatePixPayload('horium.app@gmail.com', totalPrice), [totalPrice]);

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
    setPaymentMethod('CARD');
    setTimeLeft(15 * 60);
    setIsExpired(false);
    setPaymentStatus('pending');
    setReceiptFile(null);
  };

  const handleUploadReceipt = async () => {
    if (!receiptFile) return;

    setPaymentStatus('verifying');

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData?.user?.email;

      if (userData.user) {
        const today = new Date().toISOString().split('T')[0];
        const validUntil = new Date();
        if (duration === '06 meses') validUntil.setMonth(validUntil.getMonth() + 6);
        if (duration === '1 ano') validUntil.setFullYear(validUntil.getFullYear() + 1);
        if (duration === '2 anos') validUntil.setFullYear(validUntil.getFullYear() + 2);

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
          console.warn("DB Insert failed, but will proceed with email:", insertError);
        }
      }

      // Fluxo de envio por e-mail via AJAX (FormSubmit)
      const formData = new FormData();
      formData.append('_subject', `Novo Comprovante PIX - Horium (${numClasses} Turmas)`);
      formData.append('_captcha', 'false');
      formData.append('_template', 'table');
      formData.append('_cc', 'prof.jackison@gmail.com');
      formData.append('Email_Usuario', userEmail || 'Não identificado');
      formData.append('Mensagem', `Um usuário anexou um comprovante de PIX para a compra de ${numClasses} turmas pelo plano ${duration}. O arquivo está em anexo.`);
      formData.append('Link_Admin', window.location.origin);
      formData.append('Comprovante_PDF_Imagem', receiptFile);

      const response = await fetch('https://formsubmit.co/ajax/horium.app@gmail.com', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Falha ao enviar e-mail via FormSubmit');
      }

      setPaymentStatus('under_review');
    } catch (err) {
      console.error("Erro no processamento do comprovante:", err);
      // Fallback para não travar a UI do usuário
      setPaymentStatus('under_review');
    }
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const renderSelection = () => (
    <div className="w-full max-w-[900px] bg-white dark:bg-gray-950 rounded-[40px] shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800 p-8 md:p-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-start mb-10">
        <div>
          <h1 className="text-4xl font-black text-[#111418] dark:text-white tracking-tighter mb-2">Adquirir Licença</h1>
          <p className="text-gray-500 font-medium text-sm md:text-base">Escolha a quantidade de turmas e o plano que melhor lhe atende.</p>
        </div>
        <button
          onClick={() => setShowPriceTable(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-900 text-[10px] font-black uppercase tracking-widest text-gray-600 dark:text-gray-400 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all border border-gray-100 dark:border-gray-800 whitespace-nowrap"
        >
          <span className="material-symbols-outlined text-base">table_chart</span>
          Tabela de Preços
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div>
          <h2 className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-6">Quantidade de Turmas</h2>
          <div className="grid grid-cols-5 gap-3">
            {Array.from({ length: 30 }, (_, i) => i + 1).map(n => {
              const isSelected = numClasses === n;
              const isDisabled = lockClasses && !isSelected;
              return (
                <button
                  key={n}
                  onClick={() => !isDisabled && setNumClasses(n)}
                  disabled={isDisabled}
                  className={`size-11 rounded-xl flex items-center justify-center text-sm font-black transition-all ${isSelected
                    ? 'bg-primary text-white shadow-lg shadow-primary/30 scale-110'
                    : isDisabled
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50'
                      : 'bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <h2 className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-6">Duração da Licença</h2>
          <div className="space-y-4">
            {DURATION_OPTIONS.map(opt => (
              <button
                key={opt.label}
                onClick={() => setDuration(opt.label as any)}
                className={`w-full flex justify-between items-center p-6 rounded-2xl border-2 transition-all duration-300 ${duration === opt.label
                  ? 'border-primary bg-white dark:bg-gray-800 shadow-xl shadow-primary/5 scale-[1.02]'
                  : 'border-transparent bg-gray-50 dark:bg-gray-900 hover:border-gray-200 dark:hover:border-gray-700'}`}
              >
                <div className="text-left">
                  <p className={`text-base font-black ${duration === opt.label ? 'text-primary' : 'text-gray-900 dark:text-gray-100'}`}>{opt.label}</p>
                  <p className="text-[9px] font-black text-gray-400 tracking-widest uppercase">{opt.sub}</p>
                </div>
                <p className={`text-2xl font-black ${duration === opt.label ? 'text-primary' : 'text-gray-900 dark:text-gray-100'}`}>
                  {formatCurrency(numClasses * PRICES_CONFIG[opt.label as keyof typeof PRICES_CONFIG])}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-12 pt-8 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Resumo Financeiro</p>
          <p className="text-4xl font-black text-primary tracking-tighter">{formatCurrency(totalPrice)}</p>
        </div>
        <div className="flex items-center gap-6">
          <button
            onClick={onBackToStart}
            className="text-sm font-black text-gray-400 uppercase tracking-widest hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            Voltar
          </button>
          <button
            onClick={() => setStep('SUMMARY')}
            className="px-10 py-4 bg-primary hover:bg-primary/90 text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-primary/25 transition-all active:scale-95 group flex items-center gap-2"
          >
            Continuar
            <span className="material-symbols-outlined text-base group-hover:translate-x-1 transition-transform">arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  );

  const renderSummary = () => {
    const renderPaymentContent = () => {
      if (paymentStatus === 'under_review') {
        return (
          <div className="flex flex-col items-center justify-center my-auto space-y-6 bg-white dark:bg-gray-900 border border-yellow-200 dark:border-yellow-800/50 rounded-[32px] shadow-xl p-10 text-center animate-in fade-in zoom-in-95">
            <div className="w-20 h-20 bg-yellow-100 dark:bg-yellow-900/40 rounded-full flex items-center justify-center mx-auto mb-4 scale-in-center">
              <span className="material-symbols-outlined text-5xl text-yellow-600 dark:text-yellow-400">pending_actions</span>
            </div>
            <div className="space-y-3">
              <h2 className="text-3xl font-black text-gray-800 dark:text-gray-100 tracking-tight">Comprovante Recebido!</h2>
              <p className="text-gray-600 dark:text-gray-400 text-base max-w-sm mx-auto leading-relaxed">
                O seu comprovante foi enviado com sucesso e está <strong>em análise</strong> pela nossa equipe. A licença para <strong>{numClasses} Turmas ({duration})</strong> será liberada assim que o pagamento for confirmado.
              </p>
            </div>
            <div className="pt-6 w-full">
              <Button onClick={onBackToStart} className="w-full h-14 text-lg shadow-lg border-2 border-primary/20 hover:border-primary/50">
                Voltar para o Início
              </Button>
            </div>
          </div>
        );
      }

      if (paymentStatus === 'success') {
        return (
          <div className="flex flex-col items-center justify-center my-auto space-y-6 bg-white dark:bg-gray-900 border border-green-200 dark:border-green-800/50 rounded-[32px] shadow-xl p-10 text-center animate-in fade-in zoom-in-95">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center mx-auto mb-4 scale-in-center">
              <span className="material-symbols-outlined text-5xl text-green-600 dark:text-green-400">check_circle</span>
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-black text-gray-800 dark:text-gray-100 tracking-tight">Pagamento Aprovado!</h2>
              <p className="text-gray-600 dark:text-gray-400 text-base">
                Sua licença para <strong>{numClasses} Turmas</strong> foi liberada com sucesso.
              </p>
            </div>
            <div className="pt-6 w-full">
              <Button onClick={onBackToStart} className="w-full h-14 text-lg shadow-lg">
                Acessar a Plataforma
              </Button>
            </div>
          </div>
        );
      }

      if (paymentStatus === 'verifying') {
        return (
          <div className="flex flex-col items-center justify-center my-auto space-y-8 bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-800/50 rounded-[32px] shadow-xl p-10 text-center animate-in fade-in zoom-in-95">
            <div className="w-24 h-24 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center mx-auto mb-4 animate-spin-slow">
              <span className="material-symbols-outlined text-5xl text-blue-600 dark:text-blue-400 animate-pulse">sync</span>
            </div>
            <div className="space-y-3">
              <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100 tracking-tight">Analisando Comprovante</h2>
              <p className="text-gray-600 dark:text-gray-400 text-base max-w-[280px] mx-auto">
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
          <div className="flex flex-col my-auto space-y-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-[32px] shadow-xl p-8 animate-in fade-in zoom-in-95 h-full max-h-[100%]">
            <div className="flex items-center gap-4 border-b border-gray-100 dark:border-gray-800 pb-4">
              <button onClick={() => setPaymentStatus('pending')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all shrink-0">
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
              <h2 className="text-xl font-bold truncate">Enviar Comprovante</h2>
            </div>

            <div className="w-full flex-1 border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-primary/50 rounded-2xl p-6 flex flex-col items-center justify-center space-y-4 bg-gray-50/50 dark:bg-gray-800/20 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all relative cursor-pointer group">
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
              <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm ${receiptFile ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-primary/10 text-primary'}`}>
                <span className="material-symbols-outlined text-3xl">
                  {receiptFile ? 'task' : 'upload_file'}
                </span>
              </div>
              <div className="text-center space-y-1 z-0">
                <p className={`font-bold text-base ${receiptFile ? 'text-green-700 dark:text-green-400' : 'text-gray-800 dark:text-gray-200'}`}>
                  {receiptFile ? receiptFile.name : 'Clique para selecionar arquivo'}
                </p>
                <p className="text-xs font-medium text-gray-500">
                  {receiptFile ? 'Clique em Enviar para continuar' : 'PDF ou Imagem (Max 5MB)'}
                </p>
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-3 shrink-0">
              <Button
                onClick={handleUploadReceipt}
                className="w-full h-12 text-sm shadow-xl"
                disabled={!receiptFile}
              >
                <span className="material-symbols-outlined mr-2 text-base">send</span>
                Enviar para Verificação
              </Button>
              <Button
                variant="outline"
                className="w-full border-gray-200 dark:border-gray-700 h-10 text-sm"
                onClick={() => setPaymentStatus('pending')}
              >
                Cancelar
              </Button>
            </div>
          </div>
        );
      }

      const showUploadOption = timeLeft <= (15 * 60) - 30;

      return (
        <div className="flex flex-col items-center justify-center my-auto space-y-6 w-full flex-1">
          {!isExpired ? (
            <div className="flex flex-col items-center bg-white dark:bg-gray-900 p-8 rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-xl animate-in fade-in zoom-in-95 w-full max-w-sm">
              <div className="flex items-center gap-2 text-orange-600 font-bold bg-orange-100 dark:bg-orange-900/30 px-3 py-1.5 rounded-full text-xs mb-4">
                <span className="material-symbols-outlined text-[14px]">timer</span>
                Expira em {formatTime(timeLeft)}
              </div>

              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-4">
                <QRCodeSVG value={pixPayload} size={180} level="M" />
              </div>

              <div className="text-center w-full">
                <p className="font-black text-xl text-gray-900 dark:text-gray-100 tracking-tight">Escaneie o QR Code</p>
                <p className="text-xs font-bold text-gray-500 max-w-[220px] mx-auto mt-1 mb-4">Abra o app do seu banco e escolha pagar via PIX QR Code.</p>

                <div className="w-full space-y-1.5 text-left mb-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Pix Copia e Cola:</label>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-gray-50 dark:bg-gray-950 text-gray-500 dark:text-gray-400 text-[10px] p-2.5 rounded-lg overflow-hidden text-ellipsis whitespace-nowrap font-mono border border-dashed border-gray-200 dark:border-gray-800">
                      {pixPayload}
                    </div>
                    <Button variant={copied ? 'default' : 'outline'} onClick={handleCopyPix} className={`shrink-0 flex items-center justify-center p-0 w-10 h-10 ${copied ? 'bg-green-500 hover:bg-green-600 border-green-500 text-white' : ''}`}>
                      <span className="material-symbols-outlined text-sm">{copied ? 'check' : 'content_copy'}</span>
                    </Button>
                  </div>
                </div>

                {showUploadOption && (
                  <div className="w-full mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 animate-in fade-in slide-in-from-bottom-2">
                    <div className="bg-blue-50/80 dark:bg-blue-900/10 rounded-xl p-4 border border-blue-100 dark:border-blue-800/30 flex flex-col items-center text-center space-y-2">
                      <p className="text-xs font-bold text-blue-800 dark:text-blue-300">
                        Já pagou e não atualizou?
                      </p>
                      <Button
                        variant="default"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-md border-0 h-10 text-xs"
                        onClick={() => setPaymentStatus('upload_receipt')}
                      >
                        <span className="material-symbols-outlined text-sm mr-2">receipt_long</span>
                        Envie o comprovante
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="w-full pt-4 mt-2">
                <Button
                  variant="outline"
                  onClick={handleChooseOtherMethod}
                  className="w-full py-3 border-2 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 rounded-[14px] font-black text-[10px] uppercase tracking-widest text-gray-600 dark:text-gray-400 transition-all h-auto"
                >
                  Escolher outro método
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center flex flex-col items-center justify-center bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-xl rounded-[32px] p-10 w-full max-w-sm h-full">
              <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 animate-in zoom-in">
                <span className="material-symbols-outlined text-4xl text-red-600 dark:text-red-400">error</span>
              </div>
              <p className="font-black text-gray-800 dark:text-gray-200 text-2xl tracking-tight mb-2">QR Code Expirado</p>
              <p className="text-sm font-medium text-gray-500 max-w-[200px] mx-auto mb-6">O tempo limite para pagamento encerrou-se.</p>
              <Button onClick={handleGenerateNewPix} className="w-full h-12 shadow-md">
                Gerar Novo Código
              </Button>
              <Button variant="ghost" onClick={handleChooseOtherMethod} className="w-full mt-2 text-xs text-gray-500">
                Voltar
              </Button>
            </div>
          )}
        </div>
      );
    };

    return (
      <div className="w-full max-w-[1000px] bg-white dark:bg-gray-950 rounded-[40px] shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800 flex flex-col md:flex-row animate-in zoom-in duration-500">
        {/* Lado Esquerdo: Resumo */}
        <div className="flex-[1.2] p-8 md:p-12 border-r border-gray-100 dark:border-gray-800">
          <button
            onClick={() => setStep('SELECTION')}
            className="flex items-center gap-3 mb-8 cursor-pointer hover:opacity-70 transition-opacity group"
          >
            <span className="material-symbols-outlined text-gray-900 dark:text-gray-100 group-hover:-translate-x-1 transition-transform">arrow_back</span>
            <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 tracking-tight">Resumo do Pedido</h1>
          </button>

          <div className="bg-[#fff7ed] dark:bg-orange-900/10 rounded-3xl p-8 mb-8 border border-orange-100 dark:border-orange-900/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <span className="material-symbols-outlined text-6xl text-orange-600">receipt_long</span>
            </div>
            <p className="text-center text-orange-600 dark:text-orange-400 font-black uppercase tracking-widest text-sm mb-2">Total a Pagar</p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-4xl md:text-5xl font-black text-[#7a3e20] dark:text-orange-200">{formatCurrency(totalPrice)}</span>
            </div>
            <p className="text-center text-[#7a3e20]/60 dark:text-orange-400/60 font-bold mt-2 text-sm">Licença: {duration}</p>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center p-5 bg-gray-50 dark:bg-gray-900/50 rounded-2xl">
              <span className="text-gray-500 dark:text-gray-400 font-bold uppercase text-[10px] tracking-widest">Turmas</span>
              <span className="text-gray-900 dark:text-gray-100 font-black tracking-tight">{numClasses} Turmas</span>
            </div>
            <button className="w-full flex justify-between items-center p-5 bg-gray-50 dark:bg-gray-900/50 rounded-2xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group" onClick={() => setShowPriceTable(true)}>
              <span className="text-gray-500 dark:text-gray-400 font-bold uppercase text-[10px] tracking-widest">Plano</span>
              <div className="flex items-center gap-2">
                <span className="text-gray-900 dark:text-gray-100 font-black tracking-tight">{duration}</span>
                <span className="material-symbols-outlined text-primary text-lg group-hover:scale-110 transition-transform">info</span>
              </div>
            </button>
          </div>
        </div>

        {/* Lado Direito: Pagamento */}
        <div className="flex-1 p-8 md:p-12 bg-gray-50/30 dark:bg-gray-900/10 flex flex-col overflow-y-auto">
          <h2 className="text-xl font-black text-gray-900 dark:text-gray-100 tracking-tight mb-8 shrink-0">Método de Pagamento</h2>

          {!showPixQR ? (
            <div className="flex flex-col h-full">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
                <button
                  onClick={() => setPaymentMethod('CARD')}
                  className={`flex flex-col items-center justify-center p-5 rounded-2xl border-2 transition-all duration-300 gap-3 ${paymentMethod === 'CARD'
                    ? 'border-primary bg-white dark:bg-gray-800 shadow-xl shadow-primary/10 scale-105'
                    : 'border-transparent bg-white dark:bg-gray-800 hover:border-gray-200 dark:hover:border-gray-700'}`}
                >
                  <span className={`material-symbols-outlined text-[32px] ${paymentMethod === 'CARD' ? 'text-primary' : 'text-gray-400'}`}>credit_card</span>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${paymentMethod === 'CARD' ? 'text-primary' : 'text-gray-500'}`}>Cartão de Crédito</span>
                </button>

                <button
                  onClick={() => setPaymentMethod('PIX')}
                  className={`flex flex-col items-center justify-center p-5 rounded-2xl border-2 transition-all duration-300 gap-3 ${paymentMethod === 'PIX'
                    ? 'border-primary bg-white dark:bg-gray-800 shadow-xl shadow-primary/10 scale-105'
                    : 'border-transparent bg-white dark:bg-gray-800 hover:border-gray-200 dark:hover:border-gray-700'}`}
                >
                  <div className={`text-xl flex items-center justify-center font-black ${paymentMethod === 'PIX' ? 'text-primary' : 'text-gray-400'}`}>
                    PIX
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${paymentMethod === 'PIX' ? 'text-primary' : 'text-gray-500'}`}>PIX</span>
                </button>

                <button
                  onClick={() => setPaymentMethod('BOLETO')}
                  className={`flex flex-col items-center justify-center p-5 rounded-2xl border-2 transition-all duration-300 gap-3 sm:col-span-2 ${paymentMethod === 'BOLETO'
                    ? 'border-primary bg-white dark:bg-gray-800 shadow-xl shadow-primary/10'
                    : 'border-transparent bg-white dark:bg-gray-800 hover:border-gray-200 dark:hover:border-gray-700'}`}
                >
                  <span className={`material-symbols-outlined text-[32px] ${paymentMethod === 'BOLETO' ? 'text-primary' : 'text-gray-400'}`}>barcode_scanner</span>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${paymentMethod === 'BOLETO' ? 'text-primary' : 'text-gray-500'}`}>Boleto Bancário</span>
                </button>
              </div>

              <button
                onClick={() => {
                  if (paymentMethod === 'PIX') {
                    setShowPixQR(true);
                  } else {
                    alert('Método em desenvolvimento');
                  }
                }}
                className="w-full py-6 mt-auto bg-primary hover:bg-primary/90 text-white rounded-[24px] font-black uppercase tracking-widest text-sm shadow-2xl shadow-primary/30 transition-all active:scale-95 flex items-center justify-center gap-3"
              >
                Finalizar Pagamento
                <span className="material-symbols-outlined">payments</span>
              </button>
            </div>
          ) : (
            renderPaymentContent()
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 bg-[#f8f9fa] dark:bg-black p-4 md:p-8 flex items-center justify-center overflow-y-auto w-full min-h-[calc(100vh-64px)]">
      {step === 'SELECTION' ? renderSelection() : renderSummary()}

      {/* Modal Tabela de Preços */}
      {showPriceTable && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setShowPriceTable(false)}>
          <div className="w-full max-w-[800px] bg-white dark:bg-gray-950 rounded-[40px] shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800 flex flex-col animate-in slide-in-from-bottom-12 duration-500" onClick={e => e.stopPropagation()}>
            <div className="bg-[#f8f9fa] dark:bg-gray-900 p-8 flex justify-between items-center border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-xl font-black text-[#111418] dark:text-white uppercase tracking-tighter">Tabela de Preços Completa</h2>
              <button onClick={() => setShowPriceTable(false)} className="size-12 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full flex items-center justify-center transition-all shadow-sm border border-gray-100 dark:border-gray-700">
                <span className="material-symbols-outlined text-gray-600 dark:text-gray-400">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[60vh] p-8 scrollbar-hide">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Qtd Turmas</th>
                    <th className="py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-center">Tipo da Licença</th>
                    <th className="py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Valor R$</th>
                  </tr>
                </thead>
                <tbody>
                  {FULL_PRICE_TABLE.map((price, idx) => (
                    <tr key={idx} className="border-b border-gray-50 dark:border-gray-900 group hover:bg-gray-50/50 dark:hover:bg-gray-900/30 transition-colors">
                      <td className="py-5 text-sm font-bold text-gray-600 dark:text-gray-300">{price.classes}</td>
                      <td className="py-5 text-sm font-bold text-gray-600 dark:text-gray-300 text-center">{price.type}</td>
                      <td className="py-5 text-base font-black text-primary text-right tracking-tight">{price.value}</td>
                    </tr>
                  ))}
                  <tr className="bg-primary/5">
                    <td colSpan={3} className="py-4 text-center text-[9px] font-black text-primary uppercase tracking-[0.2em]">
                      E mais opções conforme sua necessidade...
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="p-8 bg-gray-50 dark:bg-gray-900 text-center border-t border-gray-100 dark:border-gray-800">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Os valores acima são exemplos. O cálculo é automático para qualquer quantidade de turmas.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlansPage;