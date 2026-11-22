import { describe, expect, it } from 'vitest';
import { runGeneratorEngine } from '../timetableWorker';
import { FixedLesson, SetupData } from '../../types';

const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];

function baseSetup(overrides: Partial<SetupData> = {}): SetupData {
  return {
    institution: { name: 'Escola Teste', logo: null },
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
      { id: 's1', name: 'Matemática', shortName: 'MAT', color: '#1259bd' },
      { id: 's2', name: 'Português', shortName: 'POR', color: '#0d9488' },
    ],
    classes: [
      {
        id: 'c1',
        name: '8º A',
        subjects: ['s1', 's2'],
        lessonsPerSubject: { s1: 4, s2: 3 },
      },
    ],
    teachers: [
      {
        id: 't1',
        name: 'Ana',
        subjects: ['s1'],
        classAssignments: { s1: { c1: 'OBRIGATORIAMENTE' } },
      },
      {
        id: 't2',
        name: 'Bruno',
        subjects: ['s2'],
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
  } as SetupData;
}

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

describe('Engine invariants', () => {
  it('não aloca o mesmo professor ou turma no mesmo horário', () => {
    const result = runGeneratorEngine(baseSetup());
    assertNoDoubleBooking(result.fixedLessons);
    expect(result.failures.length).toBe(0);
    expect(result.fixedLessons.length).toBe(7);
  });

  it('respeita disponibilidade ND do professor', () => {
    const availability: Record<string, 'ND'> = {};
    for (let d = 0; d < 5; d++) {
      for (let s = 0; s < 5; s++) {
        if (!(d === 0 && s < 2)) availability[`${d}-${s}`] = 'ND';
      }
    }
    const result = runGeneratorEngine(baseSetup({
      teachers: [
        {
          id: 't1',
          name: 'Ana',
          subjects: ['s1'],
          classAssignments: { s1: { c1: 'OBRIGATORIAMENTE' } },
          availability,
        },
        {
          id: 't2',
          name: 'Bruno',
          subjects: ['s2'],
          classAssignments: { s2: { c1: 'OBRIGATORIAMENTE' } },
        },
      ],
      classes: [
        {
          id: 'c1',
          name: '8º A',
          subjects: ['s1', 's2'],
          lessonsPerSubject: { s1: 2, s2: 2 },
        },
      ],
    } as any));

    const anaLessons = result.fixedLessons.filter(l => l.teacherId === 't1');
    for (const lesson of anaLessons) {
      expect(lesson.day).toBe('Segunda');
      expect(lesson.slotIndex).toBeLessThan(2);
    }
    assertNoDoubleBooking(result.fixedLessons);
  });

  it('preserva aulas pinadas (isManual)', () => {
    const pinned = {
      classId: 'c1',
      subjectId: 's1',
      teacherId: 't1',
      day: 'Quarta',
      slotIndex: 2,
      isManual: true,
    };
    const result = runGeneratorEngine(baseSetup({
      pinnedLessons: [pinned],
      fixedLessons: [pinned],
    }));

    const kept = result.fixedLessons.find(l =>
      l.classId === 'c1' && l.day === 'Quarta' && l.slotIndex === 2 && l.teacherId === 't1' && l.subjectId === 's1'
    );
    expect(kept).toBeTruthy();
    assertNoDoubleBooking(result.fixedLessons);
  });

  it('cenário sem professor elegível gera diagnóstico NO_TEACHER', () => {
    const result = runGeneratorEngine(baseSetup({
      teachers: [
        {
          id: 't2',
          name: 'Bruno',
          subjects: ['s2'],
          classAssignments: { s2: { c1: 'OBRIGATORIAMENTE' } },
        },
      ],
      classes: [
        {
          id: 'c1',
          name: '8º A',
          subjects: ['s1', 's2'],
          lessonsPerSubject: { s1: 3, s2: 2 },
        },
      ],
    } as any));

    const noTeacher = result.failures.filter(f => f.reason === 'NO_TEACHER' && f.subjectId === 's1');
    expect(noTeacher.length).toBeGreaterThan(0);
    expect(noTeacher[0].details).toMatch(/professor elegível|Matemática/i);
    expect(noTeacher[0].suggestions?.length).toBeGreaterThan(0);
  });

  it('cenário impossível (carga > slots) identifica incompleto com diagnóstico', () => {
    const result = runGeneratorEngine(baseSetup({
      classes: [
        {
          id: 'c1',
          name: '8º A',
          subjects: ['s1'],
          lessonsPerSubject: { s1: 30 },
        },
      ],
      teachers: [
        {
          id: 't1',
          name: 'Ana',
          subjects: ['s1'],
          classAssignments: { s1: { c1: 'OBRIGATORIAMENTE' } },
        },
      ],
      subjects: [{ id: 's1', name: 'Matemática', shortName: 'MAT', color: '#1259bd' }],
    } as any));

    expect(result.fixedLessons.length).toBeLessThan(30);
    expect(result.failures.length).toBeGreaterThan(0);
    expect(result.failures.some(f => f.details && f.details.length > 20)).toBe(true);
    assertNoDoubleBooking(result.fixedLessons);
  });
});
