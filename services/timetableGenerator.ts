import { SetupData, FixedLesson, SchedulingFailure } from '../types';
import { runGeneratorEngine } from './timetableWorker';
import { ensureScheduleSlots } from './scheduleService';

export const generateTimetable = async (
    data: SetupData,
    onProgress?: (progress: number, message: string) => void
): Promise<{ fixedLessons: FixedLesson[]; failures: SchedulingFailure[] }> => {
    const normalizedData = ensureScheduleSlots(data);

    // Se suportar Web Workers no navegador, executa em thread separada
    if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
        try {
            return await new Promise<{ fixedLessons: FixedLesson[]; failures: SchedulingFailure[] }>((resolve, reject) => {
                const worker = new Worker(new URL('./timetableWorker.ts', import.meta.url), { type: 'module' });

                worker.onmessage = (e: MessageEvent) => {
                    const msg = e.data;
                    if (msg.type === 'PROGRESS') {
                        if (onProgress) onProgress(msg.progress, msg.message);
                    } else if (msg.type === 'SUCCESS') {
                        worker.terminate();
                        resolve(msg.result);
                    } else if (msg.type === 'ERROR') {
                        worker.terminate();
                        reject(new Error(msg.error));
                    }
                };

                worker.onerror = (err) => {
                    worker.terminate();
                    console.warn("Worker error, running in-thread fallback:", err);
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
