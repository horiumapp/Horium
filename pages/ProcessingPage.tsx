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
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-background-light dark:bg-background-dark min-h-screen">
      <div className="max-w-[640px] w-full flex flex-col items-center">
        <div className="relative flex items-center justify-center mb-8">
          <div className="absolute w-48 h-48 rounded-full border-4 border-primary/10 border-dashed animate-[spin_3s_linear_infinite]"></div>
          <div className="w-40 h-40 rounded-full border-4 border-t-primary border-r-primary border-b-transparent border-l-transparent animate-spin"></div>
          <div className="absolute flex flex-col items-center justify-center">
            <span className="material-symbols-outlined text-primary text-5xl">auto_fix_high</span>
            <span className="text-primary font-bold text-lg mt-1">{progress}%</span>
          </div>
        </div>
        <div className="w-full text-center space-y-2">
          <h1 className="text-[#111418] dark:text-white tracking-tight text-[32px] md:text-[40px] font-bold leading-tight">
            Otimizando horários...
          </h1>
          <p className="text-[#617289] dark:text-gray-400 text-lg font-normal max-w-md mx-auto">
            Nosso motor de processamento está balanceando a carga horária e a disponibilidade de salas para encontrar o melhor cronograma.
          </p>
        </div>
        <div className="w-full max-w-[480px] flex flex-col gap-3 py-10">
          <div className="flex gap-6 justify-between items-end">
            <div className="flex flex-col">
              <span className="text-[#617289] dark:text-gray-400 text-xs font-bold uppercase tracking-wider">Operação Atual</span>
              <p className="text-[#111418] dark:text-white text-base font-semibold leading-normal">
                {message || (progress < 40 ? 'Fase 1: Verificando disponibilidade' : progress < 70 ? 'Fase 2: Resolvendo conflitos de professores' : 'Fase 3: Otimizando janelas (buracos)')}
              </p>
            </div>
            <p className="text-primary text-sm font-bold leading-normal">{progress}% Concluído</p>
          </div>
          <div className="h-3 w-full rounded-full bg-[#dbe0e6] dark:bg-gray-800 overflow-hidden">
            <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }}></div>
          </div>
          <div className="flex items-center gap-2 text-[#617289] dark:text-gray-400 text-sm">
            <span className="material-symbols-outlined text-sm">info</span>
            <p>Isso pode levar alguns minutos. Por favor, não feche o navegador.</p>
          </div>
        </div>
        <div className="w-full max-w-[480px]">
          <h4 className="text-[#617289] dark:text-gray-500 text-xs font-bold leading-normal tracking-[0.05em] uppercase px-4 py-2 text-center border-t border-[#f0f2f4] dark:border-gray-800">
            Tarefas em Segundo Plano
          </h4>
          <div className="mt-4 bg-white dark:bg-gray-800/50 rounded-xl p-4 border border-[#f0f2f4] dark:border-gray-800 space-y-3">
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