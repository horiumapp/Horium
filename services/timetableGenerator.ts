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
                    console.warn("Web Worker não respondeu a tempo (timeout de 8s). Executando diretamente...");
                    try {
                        const fallbackResult = runGeneratorEngine(normalizedData, onProgress);
                        resolve(fallbackResult);
                    } catch (fallbackErr) {
                        reject(fallbackErr);
                    }
                }, 8000);

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
                        console.warn("Worker retornou erro, executando fallback direto:", msg.error);
                        try {
                            const fallbackResult = runGeneratorEngine(normalizedData, onProgress);
                            resolve(fallbackResult);
                        } catch (fallbackErr) {
                            reject(fallbackErr);
                        }
                    }
                };

                worker.onerror = (err) => {
                    if (isResolved) return;
                    isResolved = true;
                    clearTimeout(timeoutId);
                    worker.terminate();
                    console.warn("Worker error, executando fallback direto:", err);
                    try {
                        const fallbackResult = runGeneratorEngine(normalizedData, onProgress);
                        resolve(fallbackResult);
                    } catch (fallbackErr) {
                        reject(fallbackErr);
                    }
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
