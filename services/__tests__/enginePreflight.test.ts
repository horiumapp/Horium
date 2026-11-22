import { describe, expect, it } from 'vitest';
import { runPreflightFeasibility } from '../enginePreflight';
import { runGeneratorEngine } from '../timetableWorker';
import { SetupData } from '../../types';

const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];

function base(overrides: Record<string, unknown> = {}): SetupData {
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
    ],
    classes: [
      {
        id: 'c1',
        name: '8º A',
        students: 30,
        room: '1',
        subjects: ['s1', 's2'],
        lessonsPerSubject: { s1: 4, s2: 3 },
      },
    ],
    teachers: [
      {
        id: 't1',
        name: 'Ana',
        department: '',
        subjects: ['s1'],
        shifts: ['Manhã'],
        classAssignments: { s1: { c1: 'OBRIGATORIAMENTE' } },
      },
      {
        id: 't2',
        name: 'Bruno',
        department: '',
        subjects: ['s2'],
        shifts: ['Manhã'],
        classAssignments: { s2: { c1: 'OBRIGATORIAMENTE' } },
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
    ...overrides,
  } as unknown as SetupData;
}

describe('enginePreflight', () => {
  it('não gera falso positivo em cenário viável', () => {
    const { failures, status } = runPreflightFeasibility(base());
    expect(failures.length).toBe(0);
    expect(status).toBe('unknown');
  });

  it('detecta turma com carga maior que slots disponíveis', () => {
    const { failures, status } = runPreflightFeasibility(base({
      classes: [
        {
          id: 'c1',
          name: '8º A',
          students: 30,
          room: '1',
          subjects: ['s1'],
          lessonsPerSubject: { s1: 30 },
        },
      ],
      teachers: [
        {
          id: 't1',
          name: 'Ana',
          department: '',
          subjects: ['s1'],
          shifts: ['Manhã'],
          classAssignments: { s1: { c1: 'OBRIGATORIAMENTE' } },
        },
      ],
      subjects: [{ id: 's1', name: 'Matemática', shortName: 'MAT', color: '#1259bd', category: 'Exatas' }],
    }));

    expect(failures.some(f => f.reason === 'CLASS_LIMIT')).toBe(true);
    expect(status).toBe('infeasible');
    expect(failures[0].details).toMatch(/Pré-checagem/i);
  });

  it('detecta professor obrigatório sem capacidade suficiente', () => {
    const availability: Record<string, 'ND'> = {};
    for (let d = 0; d < 5; d++) {
      for (let s = 0; s < 5; s++) {
        if (!(d === 0 && s < 2)) availability[`${d}-${s}`] = 'ND';
      }
    }

    const { failures, status } = runPreflightFeasibility(base({
      teachers: [
        {
          id: 't1',
          name: 'Ana',
          department: '',
          subjects: ['s1'],
          shifts: ['Manhã'],
          availability,
          classAssignments: { s1: { c1: 'OBRIGATORIAMENTE' } },
        },
      ],
      classes: [
        {
          id: 'c1',
          name: '8º A',
          students: 30,
          room: '1',
          subjects: ['s1'],
          lessonsPerSubject: { s1: 5 },
        },
      ],
      subjects: [{ id: 's1', name: 'Matemática', shortName: 'MAT', color: '#1259bd', category: 'Exatas' }],
    }));

    expect(failures.some(f => f.reason === 'TEACHER_LIMIT' || f.reason === 'NO_AVAILABILITY')).toBe(true);
    expect(status).toBe('infeasible');
  });

  it('cenário 1 — professor compartilhado: greedy sobrecarregaria A, mas B+C resolvem', () => {
    // A é o de maior capacidade em CADA disciplina isolada (18), mas 10+10=20 > 18.
    // B e C têm 12 cada — o suficiente para uma disciplina, porém menos que A,
    // então um greedy "melhor elegível" acumularia tudo em A e bloquearia indevidamente.
    const avail = (free: number): Record<string, 'ND'> => {
      const map: Record<string, 'ND'> = {};
      let kept = 0;
      for (let d = 0; d < 5; d++) {
        for (let s = 0; s < 5; s++) {
          if (kept < free) kept++;
          else map[`${d}-${s}`] = 'ND';
        }
      }
      return map;
    };

    const { failures, status } = runPreflightFeasibility(base({
      subjects: [
        { id: 'mat', name: 'Matemática', shortName: 'MAT', color: '#1259bd', category: 'Exatas' },
        { id: 'cie', name: 'Ciências', shortName: 'CIE', color: '#16a34a', category: 'Exatas' },
      ],
      classes: [
        {
          id: 'c1',
          name: '8º A',
          students: 30,
          room: '1',
          subjects: ['mat', 'cie'],
          lessonsPerSubject: { mat: 10, cie: 10 },
        },
      ],
      teachers: [
        {
          id: 'A',
          name: 'Professor A',
          department: '',
          subjects: ['mat', 'cie'],
          shifts: ['Manhã'],
          availability: avail(18),
          classAssignments: {
            mat: { c1: 'PODERÁ' },
            cie: { c1: 'PODERÁ' },
          },
        },
        {
          id: 'B',
          name: 'Professor B',
          department: '',
          subjects: ['mat'],
          shifts: ['Manhã'],
          availability: avail(12),
          classAssignments: { mat: { c1: 'PODERÁ' } },
        },
        {
          id: 'C',
          name: 'Professor C',
          department: '',
          subjects: ['cie'],
          shifts: ['Manhã'],
          availability: avail(12),
          classAssignments: { cie: { c1: 'PODERÁ' } },
        },
      ],
    }));

    expect(failures.filter(f => f.reason === 'TEACHER_LIMIT' || f.reason === 'NO_AVAILABILITY')).toHaveLength(0);
    expect(status).toBe('unknown');
  });

  it('cenário 2 — carga distribuível entre múltiplos elegíveis', () => {
    const { failures, status } = runPreflightFeasibility(base({
      subjects: [{ id: 's1', name: 'Matemática', shortName: 'MAT', color: '#1259bd', category: 'Exatas' }],
      classes: [
        {
          id: 'c1',
          name: '8º A',
          students: 30,
          room: '1',
          subjects: ['s1'],
          lessonsPerSubject: { s1: 8 },
        },
      ],
      teachers: [
        {
          id: 't1',
          name: 'Ana',
          department: '',
          subjects: ['s1'],
          shifts: ['Manhã'],
          dailyLimits: { '0': 2, '1': 2, '2': 2, '3': 2, '4': 2 },
          classAssignments: { s1: { c1: 'PODERÁ' } },
        },
        {
          id: 't2',
          name: 'Bruno',
          department: '',
          subjects: ['s1'],
          shifts: ['Manhã'],
          dailyLimits: { '0': 2, '1': 2, '2': 2, '3': 2, '4': 2 },
          classAssignments: { s1: { c1: 'PODERÁ' } },
        },
      ],
    }));

    // Cada um tem 10 de capacidade; 8 aulas cabem em qualquer um — não bloquear
    expect(failures.length).toBe(0);
    expect(status).toBe('unknown');
  });

  it('cenário 3 — impossibilidade real: nenhum elegível tem capacidade', () => {
    const tight: Record<string, 'ND'> = {};
    for (let d = 0; d < 5; d++) {
      for (let s = 0; s < 5; s++) {
        if (!(d === 0 && s === 0)) tight[`${d}-${s}`] = 'ND';
      }
    }

    const { failures, status } = runPreflightFeasibility(base({
      subjects: [{ id: 's1', name: 'Matemática', shortName: 'MAT', color: '#1259bd', category: 'Exatas' }],
      classes: [
        {
          id: 'c1',
          name: '8º A',
          students: 30,
          room: '1',
          subjects: ['s1'],
          lessonsPerSubject: { s1: 5 },
        },
      ],
      teachers: [
        {
          id: 't1',
          name: 'Ana',
          department: '',
          subjects: ['s1'],
          shifts: ['Manhã'],
          availability: tight,
          classAssignments: { s1: { c1: 'PODERÁ' } },
        },
        {
          id: 't2',
          name: 'Bruno',
          department: '',
          subjects: ['s1'],
          shifts: ['Manhã'],
          availability: tight,
          classAssignments: { s1: { c1: 'PODERÁ' } },
        },
      ],
    }));

    expect(failures.some(f => f.reason === 'TEACHER_LIMIT' || f.reason === 'NO_AVAILABILITY')).toBe(true);
    expect(status).toBe('infeasible');
  });

  it('cenário 4 — disponibilidade limitada com carga total aparentemente suficiente', () => {
    // Capacidade “bruta” enganosa: professor livre em poucos slots reais
    const availability: Record<string, 'ND'> = {};
    for (let d = 0; d < 5; d++) {
      for (let s = 0; s < 5; s++) {
        if (!(d < 2 && s < 2)) availability[`${d}-${s}`] = 'ND';
      }
    }

    const { failures, status } = runPreflightFeasibility(base({
      teachers: [
        {
          id: 't1',
          name: 'Ana',
          department: '',
          subjects: ['s1'],
          shifts: ['Manhã'],
          availability,
          classAssignments: { s1: { c1: 'OBRIGATORIAMENTE' } },
        },
      ],
      classes: [
        {
          id: 'c1',
          name: '8º A',
          students: 30,
          room: '1',
          subjects: ['s1'],
          lessonsPerSubject: { s1: 6 },
        },
      ],
      subjects: [{ id: 's1', name: 'Matemática', shortName: 'MAT', color: '#1259bd', category: 'Exatas' }],
    }));

    expect(failures.some(f => f.reason === 'TEACHER_LIMIT' || f.reason === 'NO_AVAILABILITY')).toBe(true);
    expect(status).toBe('infeasible');
  });

  it('cenário 5 — aulas fixas consomem capacidade', () => {
    const availability: Record<string, 'ND'> = {};
    for (let d = 0; d < 5; d++) {
      for (let s = 0; s < 5; s++) {
        if (!(d === 0 && s < 3)) availability[`${d}-${s}`] = 'ND';
      }
    }

    const { failures, status } = runPreflightFeasibility(base({
      teachers: [
        {
          id: 't1',
          name: 'Ana',
          department: '',
          subjects: ['s1'],
          shifts: ['Manhã'],
          availability,
          classAssignments: { s1: { c1: 'OBRIGATORIAMENTE' } },
        },
      ],
      classes: [
        {
          id: 'c1',
          name: '8º A',
          students: 30,
          room: '1',
          subjects: ['s1'],
          lessonsPerSubject: { s1: 3 },
        },
      ],
      subjects: [{ id: 's1', name: 'Matemática', shortName: 'MAT', color: '#1259bd', category: 'Exatas' }],
      pinnedLessons: [
        { classId: 'c1', subjectId: 's1', teacherId: 't1', day: 'Segunda', slotIndex: 0, isManual: true },
        { classId: 'c1', subjectId: 's1', teacherId: 't1', day: 'Segunda', slotIndex: 1, isManual: true },
      ],
    }));

    // Cap 3, demanda 3, 2 pinned — restante 1 cabe; não deve bloquear
    expect(failures.filter(f => f.reason === 'TEACHER_LIMIT' || f.reason === 'NO_AVAILABILITY')).toHaveLength(0);
    expect(status).toBe('unknown');
  });

  it('cenário 6 — múltiplas turmas/professores compartilhados sem rejeição prematura', () => {
    const { failures, status } = runPreflightFeasibility(base({
      subjects: [
        { id: 'mat', name: 'Matemática', shortName: 'MAT', color: '#1259bd', category: 'Exatas' },
        { id: 'por', name: 'Português', shortName: 'POR', color: '#0d9488', category: 'Humanas' },
      ],
      classes: [
        {
          id: 'c1',
          name: '8º A',
          students: 30,
          room: '1',
          subjects: ['mat', 'por'],
          lessonsPerSubject: { mat: 4, por: 4 },
        },
        {
          id: 'c2',
          name: '8º B',
          students: 28,
          room: '2',
          subjects: ['mat', 'por'],
          lessonsPerSubject: { mat: 4, por: 4 },
        },
      ],
      teachers: [
        {
          id: 'A',
          name: 'Ana',
          department: '',
          subjects: ['mat', 'por'],
          shifts: ['Manhã'],
          classAssignments: {
            mat: { c1: 'PODERÁ', c2: 'PODERÁ' },
            por: { c1: 'PODERÁ', c2: 'PODERÁ' },
          },
        },
        {
          id: 'B',
          name: 'Bruno',
          department: '',
          subjects: ['mat'],
          shifts: ['Manhã'],
          classAssignments: { mat: { c1: 'PODERÁ', c2: 'PODERÁ' } },
        },
        {
          id: 'C',
          name: 'Carla',
          department: '',
          subjects: ['por'],
          shifts: ['Manhã'],
          classAssignments: { por: { c1: 'PODERÁ', c2: 'PODERÁ' } },
        },
      ],
    }));

    expect(failures.length).toBe(0);
    expect(status).toBe('unknown');
  });

  it('cenário 7 — inconclusivo permite seguir (status unknown)', () => {
    const result = runPreflightFeasibility(base());
    expect(result.status).toBe('unknown');
    expect(result.failures.length).toBe(0);
  });

  it('motor aborta cedo em sobrecarga de turma (sem gastar o budget longo)', async () => {
    const start = Date.now();
    const result = await runGeneratorEngine(base({
      classes: [
        {
          id: 'c1',
          name: '8º A',
          students: 30,
          room: '1',
          subjects: ['s1'],
          lessonsPerSubject: { s1: 30 },
        },
      ],
      teachers: [
        {
          id: 't1',
          name: 'Ana',
          department: '',
          subjects: ['s1'],
          shifts: ['Manhã'],
          classAssignments: { s1: { c1: 'OBRIGATORIAMENTE' } },
        },
      ],
      subjects: [{ id: 's1', name: 'Matemática', shortName: 'MAT', color: '#1259bd', category: 'Exatas' }],
    }));
    const elapsed = Date.now() - start;

    expect(result.failures.length).toBeGreaterThan(0);
    expect(result.failures.some(f => f.details?.includes('Pré-checagem'))).toBe(true);
    expect(elapsed).toBeLessThan(1500);
  });

  it('cenário viável ainda gera grade completa pelo motor', async () => {
    const result = await runGeneratorEngine(base());
    expect(result.failures.length).toBe(0);
    expect(result.fixedLessons.length).toBe(7);
  });

  it('cenário 1 integrado: motor gera grade viável que greedy bloquearia', async () => {
    const setup = base({
      subjects: [
        { id: 'mat', name: 'Matemática', shortName: 'MAT', color: '#1259bd', category: 'Exatas' },
        { id: 'cie', name: 'Ciências', shortName: 'CIE', color: '#16a34a', category: 'Exatas' },
      ],
      classes: [
        {
          id: 'c1',
          name: '8º A',
          students: 30,
          room: '1',
          subjects: ['mat', 'cie'],
          lessonsPerSubject: { mat: 5, cie: 5 },
        },
      ],
      teachers: [
        {
          id: 'A',
          name: 'Professor A',
          department: '',
          subjects: ['mat', 'cie'],
          shifts: ['Manhã'],
          classAssignments: {
            mat: { c1: 'PODERÁ' },
            cie: { c1: 'PODERÁ' },
          },
        },
        {
          id: 'B',
          name: 'Professor B',
          department: '',
          subjects: ['mat'],
          shifts: ['Manhã'],
          classAssignments: { mat: { c1: 'PODERÁ' } },
        },
        {
          id: 'C',
          name: 'Professor C',
          department: '',
          subjects: ['cie'],
          shifts: ['Manhã'],
          classAssignments: { cie: { c1: 'PODERÁ' } },
        },
      ],
    });

    const pre = runPreflightFeasibility(setup);
    expect(pre.status).toBe('unknown');

    const result = await runGeneratorEngine(setup);
    expect(result.failures.length).toBe(0);
    expect(result.fixedLessons.length).toBe(10);
  });
});
