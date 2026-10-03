import { SetupData, FixedLesson, SchedulingFailure } from '../types';
import { runGeneratorEngine } from './timetableWorker';
import { ensureScheduleSlots } from '../utils/scheduleUtils';

export const generateTimetable = async (
    data: SetupData,
    onProgress?: (progress: number, message: string) => void
): Promise<{ fixedLessons: FixedLesson[]; failures: SchedulingFailure[] }> => {
    const normalizedData = ensureScheduleSlots(data);

    if (onProgress) {
        onProgress(1, 'Iniciando alocação inteligente...');
    }

    // Se suportar Web Workers no navegador, executa em thread separada
    if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
        try {
            return await new Promise<{ fixedLessons: FixedLesson[]; failures: SchedulingFailure[] }>((resolve, reject) => {
                let isResolved = false;
                const worker = new Worker(new URL('./timetableWorker.ts', import.meta.url), { type: 'module' });

                const timeoutId = setTimeout(() => {
                    if (isResolved) return;
                    isResolved = true;
                    worker.terminate();
                    console.warn("Web Worker não respondeu a tempo (timeout de 30s).");
                    reject(new Error("O tempo limite de processamento de 30 segundos foi excedido. Tente simplificar restrições de professores ou horários fixos."));
                }, 30000);

                worker.onmessage = (e: MessageEvent) => {
                    const msg = e.data;
                    if (msg.type === 'PROGRESS') {
                        if (onProgress) onProgress(msg.progress, msg.message);
                    } else if (msg.type === 'SUCCESS') {
                        if (isResolved) return;
                        isResolved = true;
                        clearTimeout(timeoutId);
                        worker.terminate();
                        resolve(msg.result);
                    } else if (msg.type === 'ERROR') {
                        if (isResolved) return;
                        isResolved = true;
                        clearTimeout(timeoutId);
                        worker.terminate();
                        console.error("Worker retornou erro:", msg.error);
                        reject(new Error(msg.error || "Erro durante o processamento do horário."));
                    }
                };

                worker.onerror = (err) => {
                    if (isResolved) return;
                    isResolved = true;
                    clearTimeout(timeoutId);
                    worker.terminate();
                    console.error("Worker error:", err);
                    reject(new Error("Falha no worker de processamento do horário."));
                };

                worker.postMessage({ setupData: normalizedData });
            });
        } catch (workerInitErr) {
            console.warn("Could not start Web Worker, using main thread fallback:", workerInitErr);
        }
    }

    // Fallback síncrono/in-thread
    return runGeneratorEngine(normalizedData, onProgress);
};
