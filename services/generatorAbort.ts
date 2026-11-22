/** Erro padrão de cancelamento cooperativo do motor de geração. */
export function createGeneratorAbortError(): DOMException {
  return new DOMException('Geração cancelada.', 'AbortError');
}

export function isGeneratorAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

export function throwIfGeneratorAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw createGeneratorAbortError();
  }
}
