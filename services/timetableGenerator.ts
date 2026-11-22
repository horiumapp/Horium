import { SetupData, FixedLesson, SchedulingFailure } from '../types';
import { runGeneratorEngine } from './timetableWorker';
import { ensureScheduleSlots } from '../utils/scheduleUtils';
import { createGeneratorAbortError, isGeneratorAbortError } from './generatorAbort';

export type GenerateTimetableResult = { fixedLessons: FixedLesson[]; failures: SchedulingFailure[] };

export type GenerateTimetableOptions = {
    signal?: AbortSignal;
};

/**
 * Gera a grade. Preferencialmente em Web Worker; fallback cooperativo na main thread.
 * Aceita AbortSignal para cancelar (terminate do worker / abort cooperativo do fallback).
 */
export const generateTimetable = async (
    data: SetupData,
    onProgress?: (progress: number, message: string) => void,
    options?: GenerateTimetableOptions
): Promise<GenerateTimetableResult> => {
    const normalizedData = ensureScheduleSlots(data);
    const signal = options?.signal;

    if (signal?.aborted) {
        throw createGeneratorAbortError();
    }

    if (onProgress) {
        onProgress(1, 'Iniciando alocação inteligente...');
    }

    const throwIfAborted = () => {
        if (signal?.aborted) {
            throw createGeneratorAbortError();
        }
    };

    // Se suportar Web Workers no navegador, executa em thread separada
    if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
        try {
            return await new Promise<GenerateTimetableResult>((resolve, reject) => {
                let isResolved = false;
                const worker = new Worker(new URL('./timetableWorker.ts', import.meta.url), { type: 'module' });

                const cleanup = () => {
                    signal?.removeEventListener('abort', onAbort);
                    clearTimeout(timeoutId);
                    try { worker.terminate(); } catch { /* already dead */ }
                };

                const finish = (fn: () => void) => {
                    if (isResolved) return;
                    isResolved = true;
                    cleanup();
                    fn();
                };

                const onAbort = () => {
                    finish(() => reject(createGeneratorAbortError()));
                };

                const timeoutId = setTimeout(() => {
                    finish(() => {
                        console.warn('Web Worker não respondeu a tempo (timeout de 45s).');
                        reject(new Error('O tempo limite de processamento de 45 segundos foi excedido. Tente simplificar restrições de professores ou horários fixos.'));
                    });
                }, 45000);

                signal?.addEventListener('abort', onAbort, { once: true });

                worker.onmessage = (e: MessageEvent) => {
                    if (isResolved) return;
                    const msg = e.data;
                    if (msg.type === 'PROGRESS') {
                        if (signal?.aborted) return;
                        if (onProgress) onProgress(msg.progress, msg.message);
                    } else if (msg.type === 'SUCCESS') {
                        finish(() => resolve(msg.result));
                    } else if (msg.type === 'ERROR') {
                        finish(() => {
                            console.error('Worker retornou erro:', msg.error);
                            reject(new Error(msg.error || 'Erro durante o processamento do horário.'));
                        });
                    }
                };

                worker.onerror = (err) => {
                    finish(() => {
                        console.error('Worker error:', err);
                        reject(new Error('Falha no worker de processamento do horário.'));
                    });
                };

                throwIfAborted();
                worker.postMessage({ setupData: normalizedData });
            });
        } catch (workerInitErr) {
            if (isGeneratorAbortError(workerInitErr)) {
                throw workerInitErr;
            }
            console.warn('Could not start Web Worker, using main thread fallback:', workerInitErr);
        }
    }

    // Fallback cooperativo: yield periódico para o AbortSignal poder cancelar sem congelar a UI
    throwIfAborted();
    await new Promise(resolve => setTimeout(resolve, 0));
    throwIfAborted();
    return runGeneratorEngine(normalizedData, onProgress, { signal, yieldEvery: 2 });
};
