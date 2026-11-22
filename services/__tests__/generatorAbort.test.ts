import { describe, expect, it } from 'vitest';
import {
  createGeneratorAbortError,
  isGeneratorAbortError,
  throwIfGeneratorAborted,
} from '../generatorAbort';

describe('generatorAbort', () => {
  it('cria AbortError padrão do motor', () => {
    const err = createGeneratorAbortError();
    expect(err).toBeInstanceOf(DOMException);
    expect(err.name).toBe('AbortError');
    expect(err.message).toMatch(/cancelada/i);
  });

  it('reconhece AbortError do motor', () => {
    expect(isGeneratorAbortError(createGeneratorAbortError())).toBe(true);
    expect(isGeneratorAbortError(new Error('outro'))).toBe(false);
    expect(isGeneratorAbortError(null)).toBe(false);
  });

  it('throwIfGeneratorAborted só lança quando aborted', () => {
    const live = new AbortController();
    expect(() => throwIfGeneratorAborted(live.signal)).not.toThrow();
    expect(() => throwIfGeneratorAborted(undefined)).not.toThrow();

    live.abort();
    expect(() => throwIfGeneratorAborted(live.signal)).toThrow(DOMException);
  });
});
