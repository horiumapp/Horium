import { describe, expect, it } from 'vitest';
import { runGeneratorEngine } from '../timetableWorker';
import { FixedLesson, SetupData } from '../../types';

const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];

function assertNoDoubleBooking(lessons: FixedLesson[]) {
  const classSlots = new Set<string>();
  const teacherSlots = new Set<string>();
  for (const lesson of lessons) {
    const classKey = `${lesson.classId}|${lesson.day}|${lesson.slotIndex}`;
    const teacherKey = `${lesson.teacherId}|${lesson.day}|${lesson.slotIndex}`;
    expect(classSlots.has(classKey)).toBe(false);
    expect(teacherSlots.has(teacherKey)).toBe(false);
    classSlots.add(classKey);
    teacherSlots.add(teacherKey);
  }
}

function makeSetup(overrides: Record<string, unknown> = {}): SetupData {
  return {
    institution: { name: 'Escola Soft', logo: null },
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
    ],
    classes: [
      {
        id: 'c1',
        name: '8º A',
        students: 30,
        room: '1',
        subjects: ['s1'],
        lessonsPerSubject: { s1: 4 },
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
    groupingOptions: {
      minimizeMovement: true,
      clusterLessons: true,
      distributionType: 'consecutive',
      doubleLessons: 'allowed',
      maxWindows: 1,
      syncLunch: false,
    },
    generalGrouping: 'Agrupar no máximo 2 aulas por dia SEGUIDAS',
    fixedLessons: [],
    ...overrides,
  } as unknown as SetupData;
}

describe('Soft constraints (qualidade sem quebrar hard)', () => {
  it('hard constraints continuam válidas com soft ligadas', async () => {
    const result = await runGeneratorEngine(makeSetup());
    assertNoDoubleBooking(result.fixedLessons);
    expect(result.failures.length).toBe(0);
    expect(result.fixedLessons.length).toBe(4);
  });

  it('prefere slots D e evita IN quando há alternativa', async () => {
    const availability: Record<string, 'D' | 'IN' | 'ND'> = {};
    // Segunda: slots 0-1 = D, 2-4 = IN. Outros dias todos ND.
    for (let d = 0; d < 5; d++) {
      for (let s = 0; s < 5; s++) {
        if (d === 0 && s < 2) availability[`${d}-${s}`] = 'D';
        else if (d === 0) availability[`${d}-${s}`] = 'IN';
        else availability[`${d}-${s}`] = 'ND';
      }
    }

    const result = await runGeneratorEngine(makeSetup({
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
          lessonsPerSubject: { s1: 2 },
        },
      ],
    }));

    expect(result.failures.length).toBe(0);
    expect(result.fixedLessons.length).toBe(2);
    for (const lesson of result.fixedLessons) {
      expect(lesson.day).toBe('Segunda');
      expect(lesson.slotIndex).toBeLessThan(2);
    }
    assertNoDoubleBooking(result.fixedLessons);
  });

  it('ainda usa IN se for a única forma de completar a carga (hard > soft)', async () => {
    const availability: Record<string, 'D' | 'IN' | 'ND'> = {};
    for (let d = 0; d < 5; d++) {
      for (let s = 0; s < 5; s++) {
        // Só 1 slot D e 3 IN na Segunda; resto ND. Precisa de 4 aulas.
        if (d === 0 && s === 0) availability[`${d}-${s}`] = 'D';
        else if (d === 0 && s < 4) availability[`${d}-${s}`] = 'IN';
        else availability[`${d}-${s}`] = 'ND';
      }
    }

    const result = await runGeneratorEngine(makeSetup({
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
          lessonsPerSubject: { s1: 4 },
        },
      ],
      generalGrouping: 'Agrupamento Livre',
    }));

    expect(result.fixedLessons.length).toBe(4);
    expect(result.failures.length).toBe(0);
    const inUsed = result.fixedLessons.filter(l => l.slotIndex > 0).length;
    expect(inUsed).toBeGreaterThan(0);
    assertNoDoubleBooking(result.fixedLessons);
  });

  it('distribui matéria em múltiplos dias no modo consecutive', async () => {
    const result = await runGeneratorEngine(makeSetup({
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
      groupingOptions: {
        minimizeMovement: true,
        clusterLessons: true,
        distributionType: 'consecutive',
        doubleLessons: 'allowed',
        maxWindows: 2,
        syncLunch: false,
      },
    }));

    expect(result.failures.length).toBe(0);
    const daysUsed = new Set(result.fixedLessons.map(l => l.day));
    expect(daysUsed.size).toBeGreaterThanOrEqual(3);
    assertNoDoubleBooking(result.fixedLessons);
  });
});
