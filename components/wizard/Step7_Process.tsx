
import React, { useEffect, useState } from 'react';

interface Step7ProcessProps {
    progress: number;
    message?: string;
}

export const Step7Process: React.FC<Step7ProcessProps> = ({ progress, message }) => {

    return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-900/50 min-h-[500px] animate-in fade-in duration-500">
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
                    <h1 className="text-[#111418] dark:text-white tracking-tight text-[32px] md:text-[40px] font-black leading-tight uppercase">
                        Otimizando horários...
                    </h1>
                    <p className="text-[#617289] dark:text-gray-400 text-lg font-medium max-w-md mx-auto italic">
                        Nosso motor de IA está balanceando a carga horária e a disponibilidade de salas...
                    </p>
                </div>
                <div className="w-full max-w-[480px] flex flex-col gap-3 py-10">
                    <div className="flex gap-6 justify-between items-end">
                        <div className="flex flex-col">
                            <span className="text-[#617289] dark:text-gray-400 text-[10px] font-black uppercase tracking-wider">Operação Atual</span>
                            <p className="text-[#111418] dark:text-white text-base font-bold leading-normal">
                                {message || 'Otimizando alocação...'}
                            </p>
                        </div>
                        <p className="text-primary text-sm font-black leading-normal">{progress}%</p>
                    </div>
                    <div className="h-3 w-full rounded-full bg-[#dbe0e6] dark:bg-gray-800 overflow-hidden shadow-inner">
                        <div className="h-full rounded-full bg-primary transition-all duration-300 shadow-lg shadow-primary/40" style={{ width: `${progress}%` }}></div>
                    </div>
                </div>
            </div>
        </div>
    );
};
