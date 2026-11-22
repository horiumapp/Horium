import { AvailabilityStatus, FixedLesson, SchedulingFailure, SetupData } from '../types';
import { ensureScheduleSlots } from '../utils/scheduleUtils';

type Demand = {
  teacherId: string;
  classId: string;
  subjectId: string;
  lessons: number;
};

/**
 * Checagem barata e conservadora: só reporta impossibilidade clara.
 * Nunca deve bloquear um cenário que o motor ainda conseguiria resolver.
 */
export function runPreflightFeasibility(raw: SetupData): {
  failures: SchedulingFailure[];
  pinnedLessons: FixedLesson[];
} {
  const data = ensureScheduleSlots(raw);
  const days = (data.weekConfig?.activeDays && data.weekConfig.activeDays.length > 0)
    ? data.weekConfig.activeDays
    : (data.schedule?.map(s => s.day).filter(Boolean) || ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta']);
  const nDays = days.length;
  const slotsPerDay = (data.schedule?.[0]?.slots?.filter(s => s.type === 'AULA').length)
    || data.weekConfig?.lessonsPerDayGlobal
    || 5;

  const teacherById = new Map(data.teachers.map(t => [t.id, t]));
  const classById = new Map(data.classes.map(c => [c.id, c]));
  const subjectById = new Map(data.subjects.map(s => [s.id, s]));

  const pinnedSource = (data.pinnedLessons && data.pinnedLessons.length > 0)
    ? data.pinnedLessons
    : (data.fixedLessons || []).filter(fl => fl.isManual);
  const pinnedLessons = pinnedSource.filter(fl =>
    classById.has(fl.classId) && teacherById.has(fl.teacherId) && subjectById.has(fl.subjectId)
  );

  const isBlocked = (
    availability: Record<string, AvailabilityStatus> | undefined,
    dayIdx: number,
    slot: number
  ) => availability?.[`${dayIdx}-${slot}`] === 'ND';

  const teacherCapacity = (teacherId: string): number => {
    const teacher = teacherById.get(teacherId);
    if (!teacher) return 0;
    let cap = 0;
    for (let d = 0; d < nDays; d++) {
      let free = 0;
      for (let s = 0; s < slotsPerDay; s++) {
        if (!isBlocked(teacher.availability, d, s)) free++;
      }
      const dailyLimit = teacher.dailyLimits?.[`${d}`];
      const limit = dailyLimit !== undefined ? dailyLimit : slotsPerDay;
      cap += Math.min(free, Math.max(0, limit));
    }
    return cap;
  };

  const classCapacity = (classId: string): number => {
    const classroom = classById.get(classId);
    if (!classroom) return 0;
    let cap = 0;
    for (let d = 0; d < nDays; d++) {
      for (let s = 0; s < slotsPerDay; s++) {
        if (!isBlocked(classroom.timeConstraints, d, s)) cap++;
      }
    }
    return cap;
  };

  // Demanda por atribuição (mesma prioridade do motor: OBRIGATORIAMENTE primeiro)
  const demands: Demand[] = [];
  const covered = new Set<string>();

  data.teachers.forEach(teacher => {
    Object.entries(teacher.classAssignments || {}).forEach(([subjectId, classes]) => {
      Object.entries(classes).forEach(([classId, status]) => {
        if (status !== 'OBRIGATORIAMENTE') return;
        const classroom = classById.get(classId);
        const lessons = classroom?.lessonsPerSubject?.[subjectId] || 0;
        if (lessons <= 0) return;
        const key = `${classId}|${subjectId}`;
        if (covered.has(key)) return;
        covered.add(key);
        demands.push({ teacherId: teacher.id, classId, subjectId, lessons });
      });
    });
  });

  const failures: SchedulingFailure[] = [];

  data.classes.forEach(classroom => {
    Object.entries(classroom.lessonsPerSubject || {}).forEach(([subjectId, lessonCount]) => {
      if (lessonCount <= 0) return;
      const key = `${classroom.id}|${subjectId}`;
      if (covered.has(key)) return;

      const eligible = data.teachers.filter(t =>
        t.classAssignments?.[subjectId]?.[classroom.id] === 'PODERÁ' ||
        (t.subjects?.includes(subjectId) && t.classAssignments?.[subjectId]?.[classroom.id] !== 'NÃO')
      );

      if (eligible.length === 0) {
        const subjectName = subjectById.get(subjectId)?.name || 'disciplina';
        failures.push({
          teacherId: '',
          classId: classroom.id,
          subjectId,
          reason: 'NO_TEACHER',
          details: `Pré-checagem: não há professor elegível para ${subjectName} na turma ${classroom.name}. São necessárias ${lessonCount} aula(s).`,
          suggestions: [
            'Atribua um professor como OBRIGATORIAMENTE ou PODERÁ.',
            'Verifique se a disciplina não está marcada como NÃO para todos.',
          ],
        });
        return;
      }

      // Conservador: assume o professor elegível com MAIOR capacidade (melhor caso)
      const best = [...eligible].sort((a, b) => teacherCapacity(b.id) - teacherCapacity(a.id))[0];
      covered.add(key);
      demands.push({
        teacherId: best.id,
        classId: classroom.id,
        subjectId,
        lessons: lessonCount,
      });
    });
  });

  // Capacidade da turma vs carga total
  data.classes.forEach(classroom => {
    const needed = Object.values(classroom.lessonsPerSubject || {}).reduce((a, b) => a + b, 0);
    if (needed <= 0) return;
    const free = classCapacity(classroom.id);
    const pinnedHere = pinnedLessons.filter(p => p.classId === classroom.id).length;
    const remainingNeed = Math.max(0, needed - pinnedHere);
    const remainingFree = Math.max(0, free - pinnedHere);
    if (remainingNeed > remainingFree) {
      failures.push({
        teacherId: '',
        classId: classroom.id,
        subjectId: Object.keys(classroom.lessonsPerSubject || {})[0] || '',
        reason: 'CLASS_LIMIT',
        details: `Pré-checagem: a turma ${classroom.name} precisa de ${needed} aula(s), mas só há ${free} período(s) livre(s) na semana.`,
        suggestions: [
          'Reduza a carga horária total da turma.',
          'Libere horários bloqueados (ND) da turma.',
          'Aumente o número de aulas/dia ou dias ativos.',
        ],
      });
    }
  });

  // Capacidade do professor vs soma das demandas atribuídas a ele
  const loadByTeacher = new Map<string, number>();
  demands.forEach(d => {
    loadByTeacher.set(d.teacherId, (loadByTeacher.get(d.teacherId) || 0) + d.lessons);
  });

  loadByTeacher.forEach((needed, teacherId) => {
    const cap = teacherCapacity(teacherId);
    const pinnedHere = pinnedLessons.filter(p => p.teacherId === teacherId).length;
    const remainingNeed = Math.max(0, needed - pinnedHere);
    const remainingCap = Math.max(0, cap - pinnedHere);
    if (remainingNeed > remainingCap) {
      const teacher = teacherById.get(teacherId);
      const related = demands.filter(d => d.teacherId === teacherId);
      const sample = related[0];
      failures.push({
        teacherId,
        classId: sample?.classId || '',
        subjectId: sample?.subjectId || '',
        reason: 'TEACHER_LIMIT',
        details: `Pré-checagem: ${teacher?.name || 'o professor'} tem capacidade de ${cap} período(s) (disponibilidade + limite diário), mas a carga atribuída é ${needed}.`,
        suggestions: [
          'Liberar horários ND do professor.',
          'Aumentar o limite diário, se estiver restritivo.',
          'Redistribuir disciplinas entre professores.',
        ],
      });
    }
  });

  // Demanda individual professor×turma×disciplina vs slots comuns livres
  demands.forEach(demand => {
    const teacher = teacherById.get(demand.teacherId);
    const classroom = classById.get(demand.classId);
    if (!teacher || !classroom) return;

    let commonFree = 0;
    for (let d = 0; d < nDays; d++) {
      let dayFree = 0;
      for (let s = 0; s < slotsPerDay; s++) {
        if (isBlocked(teacher.availability, d, s)) continue;
        if (isBlocked(classroom.timeConstraints, d, s)) continue;
        dayFree++;
      }
      const dailyLimit = teacher.dailyLimits?.[`${d}`];
      const limit = dailyLimit !== undefined ? dailyLimit : slotsPerDay;
      commonFree += Math.min(dayFree, Math.max(0, limit));
    }

    const pinnedPair = pinnedLessons.filter(p =>
      p.teacherId === demand.teacherId &&
      p.classId === demand.classId &&
      p.subjectId === demand.subjectId
    ).length;
    const remaining = Math.max(0, demand.lessons - pinnedPair);
    if (remaining > commonFree) {
      failures.push({
        teacherId: demand.teacherId,
        classId: demand.classId,
        subjectId: demand.subjectId,
        reason: 'NO_AVAILABILITY',
        details: `Pré-checagem: ${subjectById.get(demand.subjectId)?.name || 'disciplina'} da turma ${classroom.name} precisa de ${demand.lessons} aula(s) com ${teacher.name}, mas só há ${commonFree} período(s) em comum livres.`,
        suggestions: [
          'Alinhar disponibilidade do professor com a da turma.',
          'Reduzir a carga desta disciplina.',
          'Revisar bloqueios ND de ambos.',
        ],
      });
    }
  });

  return { failures, pinnedLessons };
}
