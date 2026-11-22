import { describe, expect, it } from 'vitest';
import { runGeneratorEngine } from '../timetableWorker';
import { generateTimetable } from '../timetableGenerator';
import { SetupData } from '../../types';

const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];

function heavySetup(): SetupData {
  return {
    institution: { name: 'Escola', year: '2026', shift: 'Manhã', additionalInfo: '', logo: null },
    weekConfig: {
      activeDays: days,
      startHour: 7,
      startMinute: 0,
      durationMinute: 50,
      lessonsPerDayGlobal: 5,
      intervals: [],
    },
    schedule: days.map(day => ({
      day,
      slots: Array.from({ length: 5 }, (_, i) => ({
        id: `${day}-${i}`,
        start: `${7 + i}:00`,
        end: `${7 + i}:50`,
        type: 'AULA' as const,
      })),
    })),
    subjects: [
      { id: 's1', name: 'Matemática', shortName: 'MAT', color: '#1259bd', category: 'Exatas' },
      { id: 's2', name: 'Português', shortName: 'POR', color: '#0d9488', category: 'Humanas' },
      { id: 's3', name: 'História', shortName: 'HIS', color: '#b45309', category: 'Humanas' },
      { id: 's4', name: 'Geografia', shortName: 'GEO', color: '#047857', category: 'Humanas' },
    ],
    classes: [
      {
        id: 'c1',
        name: '8º A',
        students: 30,
        room: '1',
        subjects: ['s1', 's2', 's3', 's4'],
        lessonsPerSubject: { s1: 5, s2: 5, s3: 4, s4: 4 },
      },
      {
        id: 'c2',
        name: '8º B',
        students: 28,
        room: '2',
        subjects: ['s1', 's2', 's3', 's4'],
        lessonsPerSubject: { s1: 5, s2: 5, s3: 4, s4: 4 },
      },
    ],
    teachers: [
      {
        id: 't1',
        name: 'Ana',
        department: '',
        subjects: ['s1', 's2'],
        shifts: ['Manhã'],
        classAssignments: {
          s1: { c1: 'OBRIGATORIAMENTE', c2: 'PODERÁ' },
          s2: { c1: 'PODERÁ', c2: 'OBRIGATORIAMENTE' },
        },
      },
      {
        id: 't2',
        name: 'Bruno',
        department: '',
        subjects: ['s3', 's4'],
        shifts: ['Manhã'],
        classAssignments: {
          s3: { c1: 'OBRIGATORIAMENTE', c2: 'PODERÁ' },
          s4: { c1: 'PODERÁ', c2: 'OBRIGATORIAMENTE' },
        },
      },
      {
        id: 't3',
        name: 'Carla',
        department: '',
        subjects: ['s1', 's3'],
        shifts: ['Manhã'],
        classAssignments: {
          s1: { c1: 'PODERÁ', c2: 'PODERÁ' },
          s3: { c1: 'PODERÁ', c2: 'PODERÁ' },
        },
      },
    ],
    groupingOptions: {
      minimizeMovement: true,
      clusterLessons: true,
      distributionType: 'consecutive',
      doubleLessons: 'allowed',
      maxWindows: 2,
      syncLunch: false,
    },
    generalGrouping: 'Agrupar no máximo 2 aulas por dia SEGUIDAS',
    fixedLessons: [],
  } as unknown as SetupData;
}

async function expectAbort(promise: Promise<unknown>): Promise<void> {
  try {
    await promise;
    expect.unreachable('deveria ter abortado');
  } catch (err) {
    expect(err).toBeInstanceOf(DOMException);
    expect((err as DOMException).name).toBe('AbortError');
  }
}

describe('engine cancellation', () => {
  it('1. cancela antes do início', async () => {
    const ac = new AbortController();
    ac.abort();
    await expectAbort(runGeneratorEngine(heavySetup(), undefined, { signal: ac.signal, yieldEvery: 2 }));
  });

  it('2. cancela durante a geração (fallback cooperativo)', async () => {
    const ac = new AbortController();
    const progressCalls: number[] = [];
    setTimeout(() => ac.abort(), 30);

    await expectAbort(runGeneratorEngine(
        heavySetup(),
        (p) => { progressCalls.push(p); },
        { signal: ac.signal, yieldEvery: 1 }
      ));

    expect(progressCalls.length).toBeGreaterThan(0);
  });

  it('3. cancela durante iterações de busca/backtracking', async () => {
    const ac = new AbortController();
    let iters = 0;
    const promise = runGeneratorEngine(
      heavySetup(),
      () => {
        iters++;
        if (iters >= 3) ac.abort();
      },
      { signal: ac.signal, yieldEvery: 1 }
    );

    await expectAbort(promise);
    expect(iters).toBeGreaterThanOrEqual(3);
  });

  it('4. cancela durante otimização (após progresso avançado)', async () => {
    const ac = new AbortController();
    let sawHighProgress = false;
    const promise = runGeneratorEngine(
      heavySetup(),
      (p) => {
        if (p >= 5) {
          sawHighProgress = true;
          ac.abort();
        }
      },
      { signal: ac.signal, yieldEvery: 1 }
    );

    await expectAbort(promise);
    expect(sawHighProgress).toBe(true);
  });

  it('5. cancelamento no caminho generateTimetable (fallback forçado)', async () => {
    const OriginalWorker = globalThis.Worker;
    // Force fallback path
    (globalThis as { Worker?: typeof Worker }).Worker = undefined;

    try {
      const ac = new AbortController();
      setTimeout(() => ac.abort(), 40);
      await expectAbort(generateTimetable(heavySetup(), undefined, { signal: ac.signal }));
    } finally {
      globalThis.Worker = OriginalWorker;
    }
  });

  it('6. abort pré-existente após “timeout” simulado não retorna resultado', async () => {
    const ac = new AbortController();
    ac.abort();
    await expectAbort(generateTimetable(heavySetup(), undefined, { signal: ac.signal }));
  });

  it('7. cancelamento seguido de nova geração bem-sucedida', async () => {
    const ac1 = new AbortController();
    setTimeout(() => ac1.abort(), 20);
    await expectAbort(runGeneratorEngine(heavySetup(), undefined, { signal: ac1.signal, yieldEvery: 1 }));

    const result = await runGeneratorEngine(heavySetup(), undefined, { yieldEvery: 0 });
    expect(result.fixedLessons.length).toBeGreaterThan(0);
  });

  it('8. resultado antigo não sobrescreve geração nova (token de corrida)', async () => {
    let appliedRun = 0;
    let latestRun = 0;

    const apply = (runId: number, lessons: number) => {
      if (runId !== latestRun) return;
      appliedRun = runId;
      void lessons;
    };

    latestRun = 1;
    const ac1 = new AbortController();
    const p1 = runGeneratorEngine(heavySetup(), undefined, { signal: ac1.signal, yieldEvery: 1 })
      .then(r => apply(1, r.fixedLessons.length))
      .catch(() => undefined);

    latestRun = 2;
    ac1.abort();

    const r2 = await runGeneratorEngine(heavySetup());
    apply(2, r2.fixedLessons.length);
    await p1;

    expect(appliedRun).toBe(2);
  });

  it('9. nenhum callback de progresso após cancelamento', async () => {
    const ac = new AbortController();
    const progressAfterAbort: number[] = [];
    let aborted = false;

    const promise = runGeneratorEngine(
      heavySetup(),
      (p) => {
        if (aborted) progressAfterAbort.push(p);
        if (p >= 5 && !aborted) {
          aborted = true;
          ac.abort();
        }
      },
      { signal: ac.signal, yieldEvery: 1 }
    );

    await expectAbort(promise);
    expect(progressAfterAbort).toHaveLength(0);
  });

  it('10. resources: abort no generateTimetable rejeita e não resolve depois', async () => {
    const OriginalWorker = globalThis.Worker;
    (globalThis as { Worker?: typeof Worker }).Worker = undefined;

    try {
      const ac = new AbortController();
      let settled: 'resolve' | 'reject' | null = null;
      const p = generateTimetable(heavySetup(), undefined, { signal: ac.signal })
        .then(() => { settled = 'resolve'; })
        .catch(() => { settled = 'reject'; });

      await new Promise(r => setTimeout(r, 25));
      ac.abort();
      await p;

      expect(settled).toBe('reject');
      await new Promise(r => setTimeout(r, 50));
      expect(settled).toBe('reject');
    } finally {
      globalThis.Worker = OriginalWorker;
    }
  });
});
