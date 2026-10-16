import React, { useEffect, useState } from 'react';

interface ProcessingPageProps {
  onComplete: () => void;
  isMuted?: boolean;
  progress: number;
  message: string;
}

const ProcessingPage: React.FC<ProcessingPageProps> = ({ onComplete, isMuted = false, progress, message }) => {

  // Remove auto-complete to force a user gesture, which unlocks the AudioContext reliably
  // useEffect(() => {
  //  if (progress >= 100) {
  //    onComplete();
  //  }
  // }, [progress, onComplete]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-5 sm:p-8 bg-background-light dark:bg-background-dark min-h-[calc(100vh-8rem)] relative overflow-hidden">
      <div className="max-w-[640px] w-full flex flex-col items-center">
        <div className="relative flex items-center justify-center mb-7">
          <div className="absolute w-44 h-44 rounded-full border border-primary/20 border-dashed animate-[spin_12s_linear_infinite]"></div>
          <div className="w-36 h-36 rounded-full border-[5px] border-slate-200 dark:border-slate-800 border-t-primary border-r-primary animate-spin"></div>
          <div className="absolute flex flex-col items-center justify-center">
            <span className="material-symbols-outlined text-primary text-4xl">auto_fix_high</span>
            <span className="text-slate-900 dark:text-white font-bold text-lg mt-1">{progress}%</span>
          </div>
        </div>
        <div className="w-full text-center space-y-2">
          <h1 className="text-slate-900 dark:text-white tracking-tight text-2xl sm:text-3xl md:text-4xl font-bold leading-tight">
            Otimizando horários...
          </h1>
          <p className="text-slate-500 dark:text-gray-400 text-sm sm:text-base font-normal max-w-md mx-auto mt-2 leading-relaxed">
            Nosso motor de processamento está balanceando a carga horária e a disponibilidade de salas para encontrar o melhor cronograma.
          </p>
        </div>
        <div className="w-full max-w-[520px] flex flex-col gap-3 py-8">
          <div className="flex gap-6 justify-between items-end">
            <div className="flex flex-col">
              <span className="text-slate-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">Operação atual</span>
              <p aria-live="polite" className="text-slate-900 dark:text-white text-sm sm:text-base font-semibold leading-normal mt-1">
                {message || (progress < 40 ? 'Fase 1: Verificando disponibilidade' : progress < 70 ? 'Fase 2: Resolvendo conflitos de professores' : 'Fase 3: Otimizando janelas (buracos)')}
              </p>
            </div>
            <p className="text-primary text-sm font-semibold leading-normal whitespace-nowrap">{progress}% concluído</p>
          </div>
          <div role="progressbar" aria-label="Progresso da geração do horário" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="h-2.5 w-full rounded-full bg-slate-200 dark:bg-gray-800 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-primary to-teal-500 transition-[width] duration-500" style={{ width: `${progress}%` }}></div>
          </div>
          <div className="flex items-center gap-2 text-[#617289] dark:text-gray-400 text-sm">
            <span className="material-symbols-outlined text-sm">info</span>
            <p>Isso pode levar alguns minutos. Por favor, não feche o navegador.</p>
          </div>
        </div>
        <div className="w-full max-w-[520px]">
          <h4 className="text-slate-500 dark:text-gray-400 text-xs font-semibold leading-normal tracking-wide px-4 py-2 text-center border-t border-slate-200 dark:border-gray-800">
            Etapas do processamento
          </h4>
          <div className="mt-3 bg-white dark:bg-gray-800/50 rounded-2xl p-4 border border-slate-200 dark:border-gray-800 space-y-3 shadow-sm">
            {progress >= 30 && (
              <div className="flex items-center gap-3 text-sm text-[#111418] dark:text-gray-300">
                <span className="material-symbols-outlined text-green-500 text-lg">check_circle</span>
                <span>Matriz de disponibilidade verificada</span>
              </div>
            )}
            {progress >= 60 && (
              <div className="flex items-center gap-3 text-sm text-[#111418] dark:text-gray-300">
                <span className="material-symbols-outlined text-green-500 text-lg">check_circle</span>
                <span>Conflitos de professores resolvidos</span>
              </div>
            )}
            <div className="flex items-center gap-3 text-sm text-[#111418] dark:text-gray-300">
              {progress >= 100 ? (
                <span className="material-symbols-outlined text-green-500 text-lg">check_circle</span>
              ) : (
                <span className="material-symbols-outlined text-primary text-lg animate-pulse">sync</span>
              )}
              <span className="font-medium">
                {progress >= 100 ? 'Otimização concluída!' : 'Otimizando distribuição e reduzindo janelas...'}
              </span>
            </div>
            {progress >= 100 && (
              <button
                onClick={onComplete}
                className="w-full mt-4 bg-primary hover:bg-primary/90 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 animate-in fade-in slide-in-from-bottom-2"
              >
                <span className="material-symbols-outlined text-xl">visibility</span>
                Visualizar Resultado
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProcessingPage;
