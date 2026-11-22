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
    const { failures } = runPreflightFeasibility(base());
    expect(failures.length).toBe(0);
  });

  it('detecta turma com carga maior que slots disponíveis', () => {
    const { failures } = runPreflightFeasibility(base({
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
    expect(failures[0].details).toMatch(/Pré-checagem/i);
  });

  it('detecta professor sem capacidade suficiente', () => {
    const availability: Record<string, 'ND'> = {};
    for (let d = 0; d < 5; d++) {
      for (let s = 0; s < 5; s++) {
        if (!(d === 0 && s < 2)) availability[`${d}-${s}`] = 'ND';
      }
    }

    const { failures } = runPreflightFeasibility(base({
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
  });

  it('motor aborta cedo em sobrecarga de turma (sem gastar o budget longo)', () => {
    const start = Date.now();
    const result = runGeneratorEngine(base({
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

  it('cenário viável ainda gera grade completa pelo motor', () => {
    const result = runGeneratorEngine(base());
    expect(result.failures.length).toBe(0);
    expect(result.fixedLessons.length).toBe(7);
  });
});
