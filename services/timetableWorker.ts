import { SetupData, FixedLesson, SchedulingFailure } from '../types';
import { ensureScheduleSlots } from '../utils/scheduleUtils';

export interface GroupingRule {
    maxDaily: number;
    maxConsecutive: number;
    allowConsecutive: boolean;
    requireDouble: boolean;
}

export function parseGroupingRule(rawGrouping?: string): GroupingRule {
    const g = (rawGrouping || '').toLowerCase().trim();

    // 1. No máximo 1 aula por dia / apenas avulsas
    if (g.includes('no máximo 1') || g.includes('1 aula por dia')) {
        return { maxDaily: 1, maxConsecutive: 1, allowConsecutive: false, requireDouble: false };
    }

    // 2. Aulas estritamente intercaladas (não permite tempos seguidos)
    // ATENÇÃO: NÃO acionar se for opção de aulas LIVRES (ex: 'LIVRES (Intercaladas ou Seguidas)')
    if (g.includes('intercalad') && !g.includes('livre') && !g.includes('ou seguidas') && !g.includes('seguidas')) {
        let maxD = 2;
        if (g.includes('3 aulas') || g.includes('máximo 3')) maxD = 3;
        else if (g.includes('4 aulas') || g.includes('máximo 4')) maxD = 4;
        else if (g.includes('5 aulas') || g.includes('máximo 5')) maxD = 5;
        return { maxDaily: maxD, maxConsecutive: 1, allowConsecutive: false, requireDouble: false };
    }

    // 3. Agrupamento Livre -> Sem limite artificial de aulas diárias ou consecutivas
    if (g.includes('agrupamento livre')) {
        return { maxDaily: 99, maxConsecutive: 99, allowConsecutive: true, requireDouble: false };
    }

    // 4. Aulas até 5 por dia (seguidas ou livres)
    if (g.includes('5 aulas') || g.includes('máximo 5') || g.includes('até 5')) {
        return { maxDaily: 5, maxConsecutive: 5, allowConsecutive: true, requireDouble: false };
    }

    // 5. Aulas até 4 por dia (seguidas ou livres)
    if (g.includes('4 aulas') || g.includes('máximo 4') || g.includes('até 4')) {
        return { maxDaily: 4, maxConsecutive: 4, allowConsecutive: true, requireDouble: false };
    }

    // 6. Aulas triplas / até 3 aulas por dia (seguidas ou livres)
    if (g.includes('tripla') || g.includes('3 aulas') || g.includes('máximo 3') || g.includes('até 3') || g.includes('3-2') || g.includes('3-1')) {
        return { maxDaily: 3, maxConsecutive: 3, allowConsecutive: true, requireDouble: false };
    }

    // 7. Aulas duplas obrigatórias
    if (g.includes('somente permitirá aulas duplas')) {
        return { maxDaily: 2, maxConsecutive: 2, allowConsecutive: true, requireDouble: true };
    }

    // 8. Padrão Horium e Escolas (No máximo 2 aulas por dia seguidas)
    return { maxDaily: 2, maxConsecutive: 2, allowConsecutive: true, requireDouble: false };
}

export function getMaxConsecutiveStreak(slots: number[]): number {
    if (slots.length === 0) return 0;
    const sorted = [...slots].sort((a, b) => a - b);
    let currentStreak = 1;
    let maxStreak = 1;
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === sorted[i - 1] + 1) {
            currentStreak++;
            if (currentStreak > maxStreak) maxStreak = currentStreak;
        } else if (sorted[i] !== sorted[i - 1]) {
            currentStreak = 1;
        }
    }
    return maxStreak;
}

function popcount(n: number): number {
    let c = 0;
    while (n) {
        n &= n - 1;
        c++;
    }
    return c;
}

function maxStreakFromMask(mask: number, slotCount: number): number {
    let best = 0;
    let cur = 0;
    for (let i = 0; i < slotCount; i++) {
        if (mask & (1 << i)) {
            cur++;
            if (cur > best) best = cur;
        } else {
            cur = 0;
        }
    }
    return best;
}

interface Assignment {
    teacherId: string;
    classId: string;
    subjectId: string;
    lessons: number;
    grouping: string;
    rule: GroupingRule;
}

interface Block {
    assignment: Assignment;
    size: number;
    consecutive: boolean;
}

export function runGeneratorEngine(
    rawSetupData: SetupData,
    onProgress?: (progress: number, message: string) => void
): { fixedLessons: FixedLesson[]; failures: SchedulingFailure[] } {
    const data = ensureScheduleSlots(rawSetupData);

    const originalDays = (data.weekConfig?.activeDays && data.weekConfig.activeDays.length > 0)
        ? data.weekConfig.activeDays
        : (data.schedule && data.schedule.length > 0 && data.schedule[0]?.day ? data.schedule.map(s => s.day) : ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta']);

    const slotsPerDay = (data.schedule && data.schedule[0]?.slots?.filter(s => s.type === 'AULA').length) ||
        data.weekConfig?.lessonsPerDayGlobal || 5;

    const failedAssignmentWeights: Record<string, number> = {};
    const nDays = originalDays.length;
    const dayIndex = new Map<string, number>(originalDays.map((day, index) => [day, index]));
    const teacherById = new Map(data.teachers.map(teacher => [teacher.id, teacher]));
    const classById = new Map(data.classes.map(classroom => [classroom.id, classroom]));
    const subjectById = new Map(data.subjects.map(subject => [subject.id, subject]));
    const teacherIdx = new Map<string, number>(data.teachers.map((teacher, index) => [teacher.id, index]));
    const classIdx = new Map<string, number>(data.classes.map((classroom, index) => [classroom.id, index]));
    const nTeachers = data.teachers.length;
    const nClasses = data.classes.length;

    const teacherNd = new Uint32Array(Math.max(1, nTeachers * nDays));
    const classNd = new Uint32Array(Math.max(1, nClasses * nDays));
    const teacherLimit = new Uint16Array(Math.max(1, nTeachers * nDays));

    data.teachers.forEach((teacher, ti) => {
        for (let dIdx = 0; dIdx < nDays; dIdx++) {
            const limit = teacher.dailyLimits?.[`${dIdx}`];
            teacherLimit[ti * nDays + dIdx] = limit !== undefined ? limit : slotsPerDay;
            for (let sIdx = 0; sIdx < slotsPerDay && sIdx < 31; sIdx++) {
                if (teacher.availability?.[`${dIdx}-${sIdx}`] === 'ND') {
                    teacherNd[ti * nDays + dIdx] |= 1 << sIdx;
                }
            }
        }
    });
    data.classes.forEach((classroom, ci) => {
        for (let dIdx = 0; dIdx < nDays; dIdx++) {
            for (let sIdx = 0; sIdx < slotsPerDay && sIdx < 31; sIdx++) {
                if (classroom.timeConstraints?.[`${dIdx}-${sIdx}`] === 'ND') {
                    classNd[ci * nDays + dIdx] |= 1 << sIdx;
                }
            }
        }
    });

    const availableDaysMemo = new Map<string, number>();
    const effectiveRuleMemo = new Map<string, GroupingRule>();

    const getGroupingRuleFor = (teacherId: string, classId: string, subjectId: string): GroupingRule => {
        const raw = data.assignmentGroupings?.[`${teacherId}|${classId}|${subjectId}`] ||
            data.teacherGroupings?.[teacherId] ||
            data.subjectGroupings?.[subjectId] ||
            data.generalGrouping ||
            'Agrupar no máximo 2 aulas por dia SEGUIDAS';
        return parseGroupingRule(raw);
    };

    const getAvailableDaysCount = (teacherId: string, classId: string): number => {
        const key = `${teacherId}|${classId}`;
        const cached = availableDaysMemo.get(key);
        if (cached !== undefined) return cached;

        const ti = teacherIdx.get(teacherId);
        const ci = classIdx.get(classId);
        let viable = 0;
        if (ti !== undefined && ci !== undefined) {
            for (let dIdx = 0; dIdx < nDays; dIdx++) {
                if (teacherLimit[ti * nDays + dIdx] <= 0) continue;
                const blocked = teacherNd[ti * nDays + dIdx] | classNd[ci * nDays + dIdx];
                const allSlots = slotsPerDay >= 31 ? 0x7fffffff : (1 << slotsPerDay) - 1;
                if ((blocked & allSlots) !== allSlots) viable++;
            }
        }
        const count = Math.max(1, viable);
        availableDaysMemo.set(key, count);
        return count;
    };

    const getEffectiveGroupingRule = (teacherId: string, classId: string, subjectId: string): GroupingRule => {
        const key = `${teacherId}|${classId}|${subjectId}`;
        const cached = effectiveRuleMemo.get(key);
        if (cached) return cached;

        const baseRule = getGroupingRuleFor(teacherId, classId, subjectId);
        const classroom = classById.get(classId);
        const totalSubjectLessons = classroom?.lessonsPerSubject?.[subjectId] || 1;
        const availableDaysCount = getAvailableDaysCount(teacherId, classId);

        // Se o professor/turma só tem X dias disponíveis, a matéria PRECISA de pelo menos ceil(total / X) aulas por dia
        const minDailyNeeded = Math.ceil(totalSubjectLessons / availableDaysCount);
        const effectiveMaxDaily = Math.max(baseRule.maxDaily, minDailyNeeded);
        const effectiveMaxConsecutive = Math.max(baseRule.maxConsecutive, minDailyNeeded > baseRule.maxDaily ? minDailyNeeded : baseRule.maxConsecutive);

        const rule = {
            maxDaily: effectiveMaxDaily,
            maxConsecutive: effectiveMaxConsecutive,
            allowConsecutive: baseRule.allowConsecutive || minDailyNeeded > 1,
            requireDouble: baseRule.requireDouble
        };
        effectiveRuleMemo.set(key, rule);
        return rule;
    };

    const calculateScore = (fixed: FixedLesson[], fails: SchedulingFailure[]) => {
        // Falhas não alocadas têm penalidade massiva: a prioridade absoluta é garantir 100% da carga horária!
        let score = (data.classes.length * 100) - (fails.reduce((acc, f) => acc + (data.classes.find(c => c.id === f.classId)?.lessonsPerSubject[f.subjectId] || 1), 0) * 100000);
        score += fixed.length * 500;

        const teacherLessons: Record<string, FixedLesson[]> = {};
        const classLessons: Record<string, FixedLesson[]> = {};
        const teacherClassDayLessons: Record<string, FixedLesson[]> = {};

        fixed.forEach(f => {
            const tKey = `${f.teacherId}|${f.day}`;
            const cKey = `${f.classId}|${f.day}|${f.subjectId}`;
            const tcKey = `${f.teacherId}|${f.classId}|${f.day}`;

            if (!teacherLessons[tKey]) teacherLessons[tKey] = [];
            if (!classLessons[cKey]) classLessons[cKey] = [];
            if (!teacherClassDayLessons[tcKey]) teacherClassDayLessons[tcKey] = [];

            teacherLessons[tKey].push(f);
            classLessons[cKey].push(f);
            teacherClassDayLessons[tcKey].push(f);
        });

        // Penalidade por janelas (gaps) nos professores
        Object.values(teacherLessons).forEach(lessons => {
            lessons.sort((a, b) => a.slotIndex - b.slotIndex);
            for (let i = 1; i < lessons.length; i++) {
                const gap = lessons[i].slotIndex - lessons[i - 1].slotIndex - 1;
                if (gap > 0) score -= (gap * 400);
            }
        });

        // Validação e penalização estrita de limites de agrupamento e tempos seguidos
        Object.entries(classLessons).forEach(([cKey, lessons]) => {
            if (lessons.length === 0) return;
            const [classId, , subjectId] = cKey.split('|');
            const rule = getEffectiveGroupingRule(lessons[0].teacherId, classId, subjectId);

            // 1. Violação de limite diário da matéria na turma
            if (lessons.length > rule.maxDaily) {
                score -= (lessons.length - rule.maxDaily) * 60000;
            }

            const streak = getMaxConsecutiveStreak(lessons.map(l => l.slotIndex));

            // 2. Violação grave: Mais tempos seguidos do que o permitido
            if (streak > rule.maxConsecutive) {
                score -= (streak - rule.maxConsecutive) * 80000;
            }

            // 3. Violação de aulas intercaladas
            if (!rule.allowConsecutive && streak > 1) {
                score -= streak * 50000;
            }

            // 4. Bônus para agrupamento perfeito (aulas duplas quando permitidas)
            if (rule.allowConsecutive && rule.maxConsecutive === 2 && lessons.length === 2 && streak === 2) {
                score += 500;
            }
        });

        // Penalidade por professor ter mais de 2 tempos seguidos na mesma turma (a menos que a matéria permita mais)
        Object.entries(teacherClassDayLessons).forEach(([tcKey, lessons]) => {
            if (lessons.length > 2) {
                const [teacherId, classId] = tcKey.split('|');
                const streak = getMaxConsecutiveStreak(lessons.map(l => l.slotIndex));
                const maxAllowedConsec = lessons.reduce((max, l) => {
                    const r = getEffectiveGroupingRule(teacherId, classId, l.subjectId);
                    return Math.max(max, r.maxConsecutive);
                }, 2);
                if (streak > maxAllowedConsec) {
                    score -= (streak - maxAllowedConsec) * 70000;
                }
            }
        });

        // Penalidade por sair e voltar para a mesma sala no mesmo dia
        Object.values(teacherClassDayLessons).forEach(lessons => {
            if (lessons.length > 1) {
                lessons.sort((a, b) => a.slotIndex - b.slotIndex);
                for (let i = 1; i < lessons.length; i++) {
                    const gap = lessons[i].slotIndex - lessons[i - 1].slotIndex - 1;
                    if (gap > 0) {
                        score -= (gap * 1500);
                    }
                }
            }
        });

        return score;
    };

    const runAttempt = (): { fixedLessons: FixedLesson[]; failures: SchedulingFailure[]; score: number } => {
        // Distingue aulas manualmente fixadas pelo usuário do resultado de uma execução anterior
        const totalRequestedLessons = data.classes.reduce(
            (sum, c) => sum + Object.values(c.lessonsPerSubject || {}).reduce((a, b) => a + b, 0),
            0
        );

        let candidateFixed: FixedLesson[] = (data.pinnedLessons && data.pinnedLessons.length > 0)
            ? data.pinnedLessons
            : (data.fixedLessons || []);

        if (candidateFixed.some(fl => fl.isManual)) {
            candidateFixed = candidateFixed.filter(fl => fl.isManual);
        } else if (data.status === 'Finalizado' || candidateFixed.length >= Math.max(10, totalRequestedLessons * 0.8)) {
            // Se o status já estiver Finalizado ou a quantidade de aulas for a grade completa,
            // trata-se do resultado da rodada anterior. Ao reprocessar, a grade deve ser reconstruída do zero!
            candidateFixed = [];
        }

        const initialFixed: FixedLesson[] = candidateFixed.filter(fl =>
            data.classes.some(c => c.id === fl.classId) &&
            data.teachers.some(t => t.id === fl.teacherId) &&
            data.subjects.some(s => s.id === fl.subjectId)
        );
        let currentFixed: FixedLesson[] = [...initialFixed];
        const failures: SchedulingFailure[] = [];
        const assignments: Assignment[] = [];

        // 1. Coletar todas as atribuições obrigatórias
        data.teachers.forEach(teacher => {
            if (teacher.classAssignments) {
                Object.entries(teacher.classAssignments).forEach(([subjectId, classes]) => {
                    Object.entries(classes).forEach(([classId, status]) => {
                        if (status === 'OBRIGATORIAMENTE') {
                            const classroom = data.classes.find(c => c.id === classId);
                            if (classroom) {
                                if (!assignments.some(a => a.classId === classId && a.subjectId === subjectId)) {
                                    const rule = getEffectiveGroupingRule(teacher.id, classId, subjectId);
                                    assignments.push({
                                        teacherId: teacher.id,
                                        classId,
                                        subjectId,
                                        lessons: classroom.lessonsPerSubject?.[subjectId] || 0,
                                        grouping: data.assignmentGroupings?.[`${teacher.id}|${classId}|${subjectId}`] ||
                                            data.teacherGroupings?.[teacher.id] ||
                                            data.subjectGroupings?.[subjectId] ||
                                            data.generalGrouping ||
                                            'Não Especificado',
                                        rule
                                    });
                                }
                            }
                        }
                    });
                });
            }
        });

        // 1.1 Coletar matérias de turmas sem atribuição OBRIGATÓRIA (PODERÁ) com balanceamento de carga docente
        data.classes.forEach(classroom => {
            Object.entries(classroom.lessonsPerSubject || {}).forEach(([subjectId, lessonCount]) => {
                if (lessonCount <= 0) return;
                const alreadyAssigned = assignments.some(a => a.classId === classroom.id && a.subjectId === subjectId);
                if (!alreadyAssigned) {
                    const eligibleTeachers = data.teachers.filter(t =>
                        t.classAssignments?.[subjectId]?.[classroom.id] === 'PODERÁ' ||
                        (t.subjects?.includes(subjectId) && t.classAssignments?.[subjectId]?.[classroom.id] !== 'NÃO')
                    );

                    if (eligibleTeachers.length > 0) {
                        // Equilibra a carga docente entre todos os professores aptos
                        const sortedEligibles = [...eligibleTeachers].sort((tA, tB) => {
                            const isPoderaA = tA.classAssignments?.[subjectId]?.[classroom.id] === 'PODERÁ' ? 1 : 0;
                            const isPoderaB = tB.classAssignments?.[subjectId]?.[classroom.id] === 'PODERÁ' ? 1 : 0;
                            if (isPoderaA !== isPoderaB) return isPoderaB - isPoderaA;

                            const loadA = assignments.filter(a => a.teacherId === tA.id).reduce((sum, a) => sum + a.lessons, 0);
                            const loadB = assignments.filter(a => a.teacherId === tB.id).reduce((sum, a) => sum + a.lessons, 0);
                            return loadA - loadB;
                        });

                        const minLoad = assignments.filter(a => a.teacherId === sortedEligibles[0].id).reduce((sum, a) => sum + a.lessons, 0);
                        const candidates = sortedEligibles.filter(t => {
                            const l = assignments.filter(a => a.teacherId === t.id).reduce((sum, a) => sum + a.lessons, 0);
                            return l <= minLoad + 2;
                        });

                        const chosenTeacher = candidates[Math.floor(Math.random() * candidates.length)];
                        const rule = getEffectiveGroupingRule(chosenTeacher.id, classroom.id, subjectId);
                        assignments.push({
                            teacherId: chosenTeacher.id,
                            classId: classroom.id,
                            subjectId,
                            lessons: lessonCount,
                            grouping: data.assignmentGroupings?.[`${chosenTeacher.id}|${classroom.id}|${subjectId}`] ||
                                data.teacherGroupings?.[chosenTeacher.id] ||
                                data.subjectGroupings?.[subjectId] ||
                                data.generalGrouping ||
                                'Não Especificado',
                            rule
                        });
                    }
                }
            });
        });

        // Professores sem folga (Informática e Jurídico: 2 dias, 5+5 primeiros tempos)
        // entram antes do restante, senão a grade fecha os únicos horários deles.
        const openSlotsByTeacher = new Map<string, { di: number; slot: number }[]>();
        const teacherLoad = new Map<string, number>();
        for (const asg of assignments) {
            teacherLoad.set(asg.teacherId, (teacherLoad.get(asg.teacherId) || 0) + asg.lessons);
        }
        const tightOrder: { teacherId: string; slack: number; days: number }[] = [];
        for (const teacher of data.teachers) {
            const ti = teacherIdx.get(teacher.id);
            if (ti === undefined) continue;
            const open: { di: number; slot: number }[] = [];
            const daysWithRoom = new Set<number>();
            for (let di = 0; di < nDays; di++) {
                const limit = teacherLimit[ti * nDays + di];
                const nd = teacherNd[ti * nDays + di];
                let count = 0;
                for (let slot = 0; slot < slotsPerDay && count < limit; slot++) {
                    if (nd & (1 << slot)) continue;
                    open.push({ di, slot });
                    count++;
                }
                if (count > 0) daysWithRoom.add(di);
            }
            openSlotsByTeacher.set(teacher.id, open);
            const remaining = (teacherLoad.get(teacher.id) || 0) - currentFixed.filter(lesson => lesson.teacherId === teacher.id).length;
            const slack = open.length - remaining;
            const packsTwoDays = daysWithRoom.size > 0 && daysWithRoom.size <= 2 && remaining >= daysWithRoom.size * 4;
            if (remaining > 0 && open.length >= remaining && (slack <= 2 || packsTwoDays)) {
                tightOrder.push({ teacherId: teacher.id, slack, days: daysWithRoom.size });
            }
        }
        tightOrder.sort((a, b) => a.days - b.days || a.slack - b.slack);

        const classSlotKey = (classId: string, di: number, slot: number) => `${classId}|${di}|${slot}`;
        const takenClassSlots = new Set(currentFixed.map(lesson => {
            const di = dayIndex.get(lesson.day);
            return di === undefined ? '' : classSlotKey(lesson.classId, di, lesson.slotIndex);
        }));
        const takenTeacherSlots = new Set(currentFixed.map(lesson => {
            const di = dayIndex.get(lesson.day);
            return di === undefined ? '' : `${lesson.teacherId}|${di}|${lesson.slotIndex}`;
        }));

        for (const tight of tightOrder) {
            const open = openSlotsByTeacher.get(tight.teacherId) || [];
            const units: Assignment[] = [];
            for (const asg of assignments) {
                if (asg.teacherId !== tight.teacherId || asg.lessons <= 0) continue;
                const placed = currentFixed.filter(lesson =>
                    lesson.teacherId === asg.teacherId &&
                    lesson.classId === asg.classId &&
                    lesson.subjectId === asg.subjectId
                ).length;
                for (let n = placed; n < asg.lessons; n++) units.push(asg);
            }
            if (units.length === 0 || open.length === 0) continue;
            for (let i = units.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                const swap = units[i];
                units[i] = units[j];
                units[j] = swap;
            }

            const edges: number[][] = units.map(unit => {
                const ci = classIdx.get(unit.classId);
                const list: number[] = [];
                for (let s = 0; s < open.length; s++) {
                    const spot = open[s];
                    if (takenTeacherSlots.has(`${tight.teacherId}|${spot.di}|${spot.slot}`)) continue;
                    if (takenClassSlots.has(classSlotKey(unit.classId, spot.di, spot.slot))) continue;
                    if (ci !== undefined && (classNd[ci * nDays + spot.di] & (1 << spot.slot))) continue;
                    list.push(s);
                }
                return list;
            });

            const matchUnitToSlot = (useRules: boolean): number[] => {
                const matchSlot = new Array<number>(open.length).fill(-1);
                const respects = (unit: Assignment, spotIndex: number): boolean => {
                    if (!useRules) return true;
                    const spot = open[spotIndex];
                    let mask = 1 << spot.slot;
                    for (let s = 0; s < open.length; s++) {
                        const matched = matchSlot[s];
                        if (matched < 0 || open[s].di !== spot.di) continue;
                        const other = units[matched];
                        if (other.classId === unit.classId && other.subjectId === unit.subjectId) {
                            mask |= 1 << open[s].slot;
                        }
                    }
                    if (popcount(mask) > unit.rule.maxDaily) return false;
                    const streak = maxStreakFromMask(mask, slotsPerDay);
                    if (streak > unit.rule.maxConsecutive) return false;
                    if (!unit.rule.allowConsecutive && streak > 1) return false;
                    return true;
                };
                const seen = new Array<boolean>(open.length);
                const unitMatched = new Array<boolean>(units.length).fill(false);
                const dfs = (unitIndex: number): boolean => {
                    for (const spotIndex of edges[unitIndex]) {
                        if (seen[spotIndex] || !respects(units[unitIndex], spotIndex)) continue;
                        seen[spotIndex] = true;
                        const previous = matchSlot[spotIndex];
                        if (previous < 0 || dfs(previous)) {
                            matchSlot[spotIndex] = unitIndex;
                            unitMatched[unitIndex] = true;
                            return true;
                        }
                    }
                    return false;
                };
                for (let unitIndex = 0; unitIndex < units.length; unitIndex++) {
                    if (unitMatched[unitIndex]) continue;
                    seen.fill(false);
                    dfs(unitIndex);
                }
                return matchSlot;
            };

            let matchSlot = matchUnitToSlot(true);
            if (matchSlot.filter(unitIndex => unitIndex >= 0).length < units.length) {
                matchSlot = matchUnitToSlot(false);
            }
            const usedUnits = new Set<number>();
            for (let s = 0; s < open.length; s++) {
                const unitIndex = matchSlot[s];
                if (unitIndex < 0 || usedUnits.has(unitIndex)) continue;
                usedUnits.add(unitIndex);
                const unit = units[unitIndex];
                const spot = open[s];
                currentFixed.push({
                    day: originalDays[spot.di],
                    slotIndex: spot.slot,
                    classId: unit.classId,
                    teacherId: unit.teacherId,
                    subjectId: unit.subjectId
                });
                takenClassSlots.add(classSlotKey(unit.classId, spot.di, spot.slot));
                takenTeacherSlots.add(`${unit.teacherId}|${spot.di}|${spot.slot}`);
            }
        }

        // 2. Calcular Flexibilidade
        const teacherFlexibility: Record<string, number> = {};
        data.teachers.forEach(t => {
            const availCount = Object.values(t.availability || {}).filter(v => v === 'D' || v === 'IN').length;
            let totalRequestedAulas = 0;
            assignments.filter(a => a.teacherId === t.id).forEach(a => {
                totalRequestedAulas += a.lessons;
            });
            teacherFlexibility[t.id] = totalRequestedAulas > 0 ? availCount / totalRequestedAulas : 999;
        });

        // 3. Decompor em blocos respeitando as regras de agrupamento
        const blocks: Block[] = [];
        assignments.forEach(asg => {
            const alreadyFixed = currentFixed.filter(f =>
                f.teacherId === asg.teacherId &&
                f.classId === asg.classId &&
                f.subjectId === asg.subjectId
            ).length;

            let left = Math.max(0, asg.lessons - alreadyFixed);
            const rule = asg.rule;
            const gLower = asg.grouping.toLowerCase();

            // 3.1 Particionamento explícito pedagógico solicitado na configuração (ex: 2-1-1, 3-2, 2-2-1)
            let explicitPartition: number[] | null = null;
            if (gLower.includes('2-1-1-1')) {
                explicitPartition = [2, 1, 1, 1];
            } else if (gLower.includes('2-1-1')) {
                explicitPartition = [2, 1, 1];
            } else if (gLower.includes('2-2-1')) {
                explicitPartition = [2, 2, 1];
            } else if (gLower.includes('3-2')) {
                explicitPartition = [3, 2];
            } else if (gLower.includes('2-1')) {
                explicitPartition = [2, 1];
            } else if (gLower.includes('3-1')) {
                explicitPartition = [3, 1];
            }

            if (explicitPartition && rule.allowConsecutive) {
                const isConsecutiveBlock = (size: number) => {
                    if (size === 1) return false;
                    if (gLower.includes('intercalad') || gLower.includes('livre')) return false;
                    return true;
                };

                let remainingLeft = left;
                for (const blockSize of explicitPartition) {
                    if (remainingLeft >= blockSize) {
                        blocks.push({
                            assignment: asg,
                            size: blockSize,
                            consecutive: isConsecutiveBlock(blockSize)
                        });
                        remainingLeft -= blockSize;
                    }
                }
                while (remainingLeft > 0) {
                    blocks.push({ assignment: asg, size: 1, consecutive: false });
                    remainingLeft--;
                }
                return;
            }

            // Se a regra não permite aulas seguidas (ex: intercaladas ou no máximo 1 por dia)
            if (!rule.allowConsecutive || rule.maxConsecutive === 1) {
                while (left > 0) {
                    blocks.push({ assignment: asg, size: 1, consecutive: false });
                    left--;
                }
                return;
            }

            // Se a regra permite triplas (ex: 3-2 seguidas ou aulas triplas)
            if (rule.maxConsecutive >= 3 && (gLower.includes('tripla') || gLower.includes('3-2') || gLower.includes('3 aulas por dia seguidas') || gLower.includes('3 aulas seguidas'))) {
                if (left >= 3) {
                    blocks.push({ assignment: asg, size: 3, consecutive: true });
                    left -= 3;
                }
            }

            // Se a regra permite quádruplas
            if (rule.maxConsecutive >= 4 && (gLower.includes('4 aulas seguidas') || gLower.includes('4 aulas no mesmo dia'))) {
                if (left >= 4) {
                    blocks.push({ assignment: asg, size: 4, consecutive: true });
                    left -= 4;
                }
            }

            // Padrão: Blocos de 2 (aulas duplas)
            let safety = 0;
            while (left >= 2 && safety < 100) {
                blocks.push({ assignment: asg, size: 2, consecutive: true });
                left -= 2;
                safety++;
            }

            // Restantes como avulsas (size 1)
            let safetySingle = 0;
            while (left > 0 && safetySingle < 100) {
                blocks.push({ assignment: asg, size: 1, consecutive: false });
                left--;
                safetySingle++;
            }
        });

        const classMask = new Uint32Array(Math.max(1, nClasses * nDays));
        const teacherMask = new Uint32Array(Math.max(1, nTeachers * nDays));
        const subjectMask = new Map<string, number>();
        const teacherClassMask = new Map<string, number>();
        const classOcc = new Array<FixedLesson | undefined>(Math.max(1, nClasses * nDays * slotsPerDay));
        const teacherOcc = new Array<FixedLesson | undefined>(Math.max(1, nTeachers * nDays * slotsPerDay));
        const cOff = (ci: number, di: number) => ci * nDays + di;
        const tOff = (ti: number, di: number) => ti * nDays + di;
        const cPos = (ci: number, di: number, slot: number) => (ci * nDays + di) * slotsPerDay + slot;
        const tPos = (ti: number, di: number, slot: number) => (ti * nDays + di) * slotsPerDay + slot;

        const tcLimits = new Map<string, { maxDaily: number; maxStreak: number }>();
        const teacherClassTotals = new Map<string, number>();
        for (const asg of assignments) {
            const totalKey = `${asg.teacherId}|${asg.classId}`;
            teacherClassTotals.set(totalKey, (teacherClassTotals.get(totalKey) || 0) + asg.lessons);
        }
        for (const asg of assignments) {
            const days = getAvailableDaysCount(asg.teacherId, asg.classId);
            const minDaily = Math.ceil((teacherClassTotals.get(`${asg.teacherId}|${asg.classId}`) || 0) / days);
            tcLimits.set(`${asg.teacherId}|${asg.classId}|${asg.subjectId}`, {
                maxDaily: Math.max(asg.rule.maxDaily, minDaily),
                maxStreak: Math.max(asg.rule.maxConsecutive, minDaily > asg.rule.maxDaily ? minDaily : asg.rule.maxConsecutive)
            });
        }

        const clearBoard = () => {
            classMask.fill(0);
            teacherMask.fill(0);
            subjectMask.clear();
            teacherClassMask.clear();
            classOcc.fill(undefined);
            teacherOcc.fill(undefined);
        };

        const placeLesson = (lesson: FixedLesson) => {
            const di = dayIndex.get(lesson.day);
            if (di === undefined || lesson.slotIndex < 0 || lesson.slotIndex >= slotsPerDay) return;
            const ci = classIdx.get(lesson.classId);
            const ti = teacherIdx.get(lesson.teacherId);
            if (ci === undefined || ti === undefined) return;
            const bit = 1 << lesson.slotIndex;
            classMask[cOff(ci, di)] |= bit;
            teacherMask[tOff(ti, di)] |= bit;
            const sKey = `${lesson.classId}|${lesson.subjectId}|${di}`;
            subjectMask.set(sKey, (subjectMask.get(sKey) || 0) | bit);
            const tcKey = `${lesson.teacherId}|${lesson.classId}|${di}`;
            teacherClassMask.set(tcKey, (teacherClassMask.get(tcKey) || 0) | bit);
            classOcc[cPos(ci, di, lesson.slotIndex)] = lesson;
            teacherOcc[tPos(ti, di, lesson.slotIndex)] = lesson;
        };

        const removeLesson = (lesson: FixedLesson) => {
            const di = dayIndex.get(lesson.day);
            if (di === undefined || lesson.slotIndex < 0 || lesson.slotIndex >= slotsPerDay) return;
            const ci = classIdx.get(lesson.classId);
            const ti = teacherIdx.get(lesson.teacherId);
            if (ci === undefined || ti === undefined) return;
            const bit = ~(1 << lesson.slotIndex);
            classMask[cOff(ci, di)] &= bit;
            teacherMask[tOff(ti, di)] &= bit;
            const sKey = `${lesson.classId}|${lesson.subjectId}|${di}`;
            subjectMask.set(sKey, (subjectMask.get(sKey) || 0) & bit);
            const tcKey = `${lesson.teacherId}|${lesson.classId}|${di}`;
            teacherClassMask.set(tcKey, (teacherClassMask.get(tcKey) || 0) & bit);
            const classPos = cPos(ci, di, lesson.slotIndex);
            if (classOcc[classPos] === lesson) classOcc[classPos] = undefined;
            const teacherPos = tPos(ti, di, lesson.slotIndex);
            if (teacherOcc[teacherPos] === lesson) teacherOcc[teacherPos] = undefined;
        };

        const rebuildBoard = () => {
            clearBoard();
            for (const lesson of currentFixed) placeLesson(lesson);
        };

        for (const lesson of currentFixed) placeLesson(lesson);
        const pinnedSlots = new Set(initialFixed.map(lesson => `${lesson.classId}|${lesson.day}|${lesson.slotIndex}`));

        const fitsBlock = (block: Block, di: number, start: number): boolean => {
            const { teacherId, classId, subjectId, rule } = block.assignment;
            const ci = classIdx.get(classId);
            const ti = teacherIdx.get(teacherId);
            if (ci === undefined || ti === undefined) return false;
            const ndT = teacherNd[tOff(ti, di)];
            const ndC = classNd[cOff(ci, di)];
            let cMask = classMask[cOff(ci, di)];
            let tMask = teacherMask[tOff(ti, di)];
            let sMask = subjectMask.get(`${classId}|${subjectId}|${di}`) || 0;
            let tcMask = teacherClassMask.get(`${teacherId}|${classId}|${di}`) || 0;
            for (let s = 0; s < block.size; s++) {
                const bit = 1 << (start + s);
                if ((cMask & bit) || (tMask & bit) || (ndT & bit) || (ndC & bit)) return false;
                cMask |= bit;
                tMask |= bit;
                sMask |= bit;
                tcMask |= bit;
            }
            if (popcount(teacherMask[tOff(ti, di)]) + block.size > teacherLimit[tOff(ti, di)]) return false;
            if (popcount(sMask) > rule.maxDaily) return false;
            const streak = maxStreakFromMask(sMask, slotsPerDay);
            if (streak > rule.maxConsecutive) return false;
            if (!rule.allowConsecutive && streak > 1) return false;
            const tcLim = tcLimits.get(`${teacherId}|${classId}|${subjectId}`);
            if (tcLim) {
                if (popcount(tcMask) > tcLim.maxDaily) return false;
                if (maxStreakFromMask(tcMask, slotsPerDay) > tcLim.maxStreak) return false;
            }
            return true;
        };

        const countDomain = (block: Block, cap: number): number => {
            let count = 0;
            const maxStart = slotsPerDay - block.size;
            for (let di = 0; di < nDays; di++) {
                for (let start = 0; start <= maxStart; start++) {
                    if (!fitsBlock(block, di, start)) continue;
                    count++;
                    if (count > cap) return count;
                }
            }
            return count;
        };

        const orderedDays = (block: Block): number[] => {
            const ti = teacherIdx.get(block.assignment.teacherId);
            const ranked: { di: number; score: number }[] = [];
            for (let di = 0; di < nDays; di++) {
                let score = Math.random() * 0.8;
                if (ti !== undefined && teacherMask[tOff(ti, di)]) score += 6;
                if (subjectMask.get(`${block.assignment.classId}|${block.assignment.subjectId}|${di}`)) score -= 1.5;
                ranked.push({ di, score });
            }
            ranked.sort((a, b) => b.score - a.score);
            return ranked.map(item => item.di);
        };

        const orderedStarts = (block: Block, di: number): number[] => {
            const ti = teacherIdx.get(block.assignment.teacherId);
            const ci = classIdx.get(block.assignment.classId);
            const tMask = ti !== undefined ? teacherMask[tOff(ti, di)] : 0;
            const cMask = ci !== undefined ? classMask[cOff(ci, di)] : 0;
            let minS = 99;
            let maxS = -1;
            for (let s = 0; s < slotsPerDay; s++) {
                if (tMask & (1 << s)) {
                    if (s < minS) minS = s;
                    if (s > maxS) maxS = s;
                }
            }
            const ranked: { start: number; score: number }[] = [];
            for (let start = 0; start <= slotsPerDay - block.size; start++) {
                const touchesTeacher = (start > 0 && (tMask & (1 << (start - 1)))) || (tMask & (1 << (start + block.size)));
                const touchesClass = (start > 0 && (cMask & (1 << (start - 1)))) || (cMask & (1 << (start + block.size)));
                let score = (touchesTeacher ? 2 : 0) + (touchesClass ? 1 : 0);
                const end = start + block.size - 1;
                if (tMask && start >= minS && end <= maxS) score += 4;
                score -= start * 0.05;
                score += Math.random() * 0.25;
                ranked.push({ start, score });
            }
            ranked.sort((a, b) => b.score - a.score);
            return ranked.map(item => item.start);
        };

        const commitBlock = (block: Block, day: string, start: number, list: FixedLesson[]): FixedLesson[] => {
            const next = list.slice();
            for (let s = 0; s < block.size; s++) {
                const lesson: FixedLesson = {
                    day,
                    slotIndex: start + s,
                    classId: block.assignment.classId,
                    teacherId: block.assignment.teacherId,
                    subjectId: block.assignment.subjectId
                };
                next.push(lesson);
                placeLesson(lesson);
            }
            return next;
        };

        const restoreBoardFrom = (list: FixedLesson[]) => {
            clearBoard();
            for (const lesson of list) placeLesson(lesson);
        };

        // Coloca o bloco no primeiro dia em que o professor já está na escola e o slot fecha janela.
        const tryPlace = (block: Block, depth: number = 0, currentList: FixedLesson[]): FixedLesson[] | null => {
            const days = orderedDays(block);

            for (const di of days) {
                const day = originalDays[di];
                const starts = orderedStarts(block, di);
                let swapAttempts = 0;
                const ci = classIdx.get(block.assignment.classId);
                const ti = teacherIdx.get(block.assignment.teacherId);

                for (const start of starts) {
                    if (fitsBlock(block, di, start)) {
                        return commitBlock(block, day, start, currentList);
                    }

                    if (depth !== 0 || swapAttempts >= 2 || ci === undefined || ti === undefined) continue;

                    const conflictingLessons: FixedLesson[] = [];
                    const seen = new Set<FixedLesson>();
                    let canAttemptSwap = true;
                    for (let s = 0; s < block.size; s++) {
                        const slot = start + s;
                        const bit = 1 << slot;
                        if ((teacherNd[tOff(ti, di)] & bit) || (classNd[cOff(ci, di)] & bit)) {
                            canAttemptSwap = false;
                            break;
                        }
                        const hits = [classOcc[cPos(ci, di, slot)], teacherOcc[tPos(ti, di, slot)]];
                        for (const hit of hits) {
                            if (!hit || seen.has(hit)) continue;
                            if (pinnedSlots.has(`${hit.classId}|${hit.day}|${hit.slotIndex}`)) {
                                canAttemptSwap = false;
                                break;
                            }
                            seen.add(hit);
                            conflictingLessons.push(hit);
                        }
                        if (!canAttemptSwap) break;
                    }

                    if (!canAttemptSwap || conflictingLessons.length === 0 || conflictingLessons.length > 2) continue;

                    swapAttempts++;
                    for (const lesson of conflictingLessons) removeLesson(lesson);
                    let tempList = currentList.filter(item => !seen.has(item));
                    if (fitsBlock(block, di, start)) {
                        tempList = commitBlock(block, day, start, tempList);
                        let successfullyRelocated = true;
                        for (const displaced of conflictingLessons) {
                            const displacedBlock: Block = {
                                assignment: {
                                    teacherId: displaced.teacherId,
                                    classId: displaced.classId,
                                    subjectId: displaced.subjectId,
                                    lessons: 1,
                                    grouping: '1 aula',
                                    rule: getEffectiveGroupingRule(displaced.teacherId, displaced.classId, displaced.subjectId)
                                },
                                size: 1,
                                consecutive: false
                            };
                            const relocatedResult = tryPlace(displacedBlock, depth + 1, tempList);
                            if (relocatedResult) tempList = relocatedResult;
                            else {
                                successfullyRelocated = false;
                                break;
                            }
                        }
                        if (successfullyRelocated) return tempList;
                    }
                    restoreBoardFrom(currentList);
                }
            }

            return null;
        };

        // Alocação dos blocos com divisão adaptativa caso blocos agrupados não caibam inteiros
        const tryPlaceBlockWithFallback = (b: Block, list: FixedLesson[]): FixedLesson[] | null => {
            // 1. Tenta colocar o bloco com seu tamanho original
            const res = tryPlace(b, 0, list);
            if (res) return res;

            // 2. Se for bloco maior que 1 e não couber agrupado (ex: slots ímpares no dia ou restrições de horários),
            // divide em sub-blocos ou aulas individuais para garantir 100% da carga horária!
            if (b.size > 1 && !b.assignment.rule.requireDouble) {
                const subSize1 = Math.floor(b.size / 2);
                const subSize2 = b.size - subSize1;

                const subBlock1: Block = {
                    assignment: b.assignment,
                    size: subSize1,
                    consecutive: subSize1 > 1 && b.consecutive
                };
                const subBlock2: Block = {
                    assignment: b.assignment,
                    size: subSize2,
                    consecutive: subSize2 > 1 && b.consecutive
                };

                const res1 = tryPlaceBlockWithFallback(subBlock1, list);
                if (res1) {
                    const res2 = tryPlaceBlockWithFallback(subBlock2, res1);
                    if (res2) return res2;
                }
                restoreBoardFrom(list);
            }

            return null;
        };

        const rankedBlocks = blocks.map(block => ({
            block,
            weight: failedAssignmentWeights[`${block.assignment.teacherId}|${block.assignment.classId}|${block.assignment.subjectId}`] || 0,
            domain: countDomain(block, 100000),
            flex: (teacherFlexibility[block.assignment.teacherId] || 999) + Math.random() * 0.5
        }));
        rankedBlocks.sort((a, b) => {
            if (a.weight !== b.weight) return b.weight - a.weight;
            if (a.domain !== b.domain) return a.domain - b.domain;
            if (a.block.size !== b.block.size) return b.block.size - a.block.size;
            return a.flex - b.flex;
        });

        const unplacedBlocks: Block[] = [];
        for (const item of rankedBlocks) {
            const resultList = tryPlaceBlockWithFallback(item.block, currentFixed);
            if (resultList) currentFixed = resultList;
            else unplacedBlocks.push(item.block);
        }

        // 4. RESCUE PASS (Fase de Resgate de Aulas com Cadeia de Ejeção Augmenting Path)
        // Garante que NENHUM professor fique sem carga horária se houver slots válidos na grade escolar
        // Helper para verificar se um professor pode assumir um slot em uma turma
            const canTeacherTakeSlotInClass = (
                lesson: FixedLesson,
                targetDay: string,
                targetSlot: number,
                ignoreLesson?: FixedLesson,
                relaxSoftRules: boolean = false
            ): boolean => {
                const di = dayIndex.get(targetDay);
                if (di === undefined || targetSlot < 0 || targetSlot >= slotsPerDay) return false;
                const ci = classIdx.get(lesson.classId);
                const ti = teacherIdx.get(lesson.teacherId);
                if (ci === undefined || ti === undefined) return false;

                const bit = 1 << targetSlot;
                if ((classNd[cOff(ci, di)] & bit) || (teacherNd[tOff(ti, di)] & bit)) return false;

                if (pinnedSlots.has(`${lesson.classId}|${targetDay}|${targetSlot}`)) return false;
                const occupant = classOcc[cPos(ci, di, targetSlot)];

                const releases: FixedLesson[] = [];
                if (ignoreLesson && ignoreLesson.slotIndex >= 0) releases.push(ignoreLesson);
                if (occupant && occupant !== ignoreLesson) releases.push(occupant);
                for (const released of releases) removeLesson(released);

                let ok = true;
                const teacherHit = teacherOcc[tPos(ti, di, targetSlot)];
                if (teacherHit) ok = false;
                if (ok && lesson.day !== targetDay && popcount(teacherMask[tOff(ti, di)]) >= teacherLimit[tOff(ti, di)]) {
                    ok = false;
                }
                if (ok && !relaxSoftRules) {
                    ok = fitsBlock({
                        assignment: {
                            teacherId: lesson.teacherId,
                            classId: lesson.classId,
                            subjectId: lesson.subjectId,
                            lessons: 1,
                            grouping: '1 aula',
                            rule: getEffectiveGroupingRule(lesson.teacherId, lesson.classId, lesson.subjectId)
                        },
                        size: 1,
                        consecutive: false
                    }, di, targetSlot);
                }

                for (const released of releases) placeLesson(released);
                return ok;
            };

            interface ChainNode {
                lesson: FixedLesson;
                targetDay: string;
                targetSlot: number;
                parent: ChainNode | null;
                displacedLesson: FixedLesson | null;
            }

            // Cadeia de Ejeção Intra-Turma (Augmenting Path BFS)
            const tryIntraClassEjectionChain = (
                lessonToPlace: FixedLesson,
                maxDepth: number = 5,
                relaxSoftRules: boolean = false
            ): boolean => {
                // O horário de origem não conta como sucesso: devolver a aula para lá
                // deixa o professor preso e a turma de destino continua com o buraco.
                const forbidSlot = lessonToPlace.slotIndex >= 0 ? `${lessonToPlace.day}|${lessonToPlace.slotIndex}` : '';
                const classId = lessonToPlace.classId;
                const ci = classIdx.get(classId);
                if (ci === undefined) return false;

                const queue: ChainNode[] = [];
                const visitedSlots = new Set<string>();

                // 1. Enfileira todos os slots válidos que o professor da aula a alocar pode assumir
                for (const day of originalDays) {
                    for (let slot = 0; slot < slotsPerDay; slot++) {
                        if (canTeacherTakeSlotInClass(lessonToPlace, day, slot, undefined, relaxSoftRules)) {
                            const di = dayIndex.get(day)!;
                            const occ = classOcc[cPos(ci, di, slot)];
                            if (!occ) {
                                if (`${day}|${slot}` === forbidSlot) continue;
                                const placed: FixedLesson = { ...lessonToPlace, day, slotIndex: slot };
                                currentFixed.push(placed);
                                placeLesson(placed);
                                return true;
                            } else {
                                if (!initialFixed.some(fl => fl.day === day && fl.slotIndex === slot && fl.classId === classId)) {
                                    visitedSlots.add(`${day}|${slot}`);
                                    queue.push({
                                        lesson: lessonToPlace,
                                        targetDay: day,
                                        targetSlot: slot,
                                        parent: null,
                                        displacedLesson: occ
                                    });
                                }
                            }
                        }
                    }
                }

                // 2. Busca em largura (BFS) por caminho aumentante
                while (queue.length > 0) {
                    const node = queue.shift()!;

                    let depth = 1;
                    let cur: ChainNode | null = node;
                    while (cur.parent) { depth++; cur = cur.parent; }
                    if (depth >= maxDepth) continue;

                    const displaced = node.displacedLesson!;

                    for (const candDay of originalDays) {
                        for (let candSlot = 0; candSlot < slotsPerDay; candSlot++) {
                            const slotKey = `${candDay}|${candSlot}`;
                            if (visitedSlots.has(slotKey)) continue;

                            if (canTeacherTakeSlotInClass(displaced, candDay, candSlot, displaced, relaxSoftRules)) {
                                const candDi = dayIndex.get(candDay)!;
                                const nextOcc = classOcc[cPos(ci, candDi, candSlot)];
                                if (!nextOcc) {
                                    displaced.day = candDay;
                                    displaced.slotIndex = candSlot;

                                    let step: ChainNode | null = node;
                                    while (step) {
                                        if (step.parent) {
                                            step.parent.displacedLesson!.day = step.targetDay;
                                            step.parent.displacedLesson!.slotIndex = step.targetSlot;
                                        } else {
                                            currentFixed.push({
                                                ...step.lesson,
                                                day: step.targetDay,
                                                slotIndex: step.targetSlot
                                            });
                                        }
                                        step = step.parent;
                                    }
                                    rebuildBoard();
                                    return true;
                                } else {
                                    if (!initialFixed.some(fl => fl.day === candDay && fl.slotIndex === candSlot && fl.classId === classId)) {
                                        visitedSlots.add(slotKey);
                                        queue.push({
                                            lesson: displaced,
                                            targetDay: candDay,
                                            targetSlot: candSlot,
                                            parent: node,
                                            displacedLesson: nextOcc
                                        });
                                    }
                                }
                            }
                        }
                    }
                }

                return false;
            };

            // Realocação Inter-Turmas (libera professor ocupado em outra turma)
            const tryInterClassRelocation = (lessonToPlace: FixedLesson): boolean => {
                const teacher = data.teachers.find(t => t.id === lessonToPlace.teacherId);
                const classroom = data.classes.find(c => c.id === lessonToPlace.classId);
                if (!teacher || !classroom) return false;

                for (const day of originalDays) {
                    const dIdx = originalDays.indexOf(day);
                    if (teacher.dailyLimits?.[`${dIdx}`] !== undefined &&
                        currentFixed.filter(o => o.day === day && o.teacherId === lessonToPlace.teacherId).length >= teacher.dailyLimits[`${dIdx}`]) {
                        continue;
                    }

                    for (let slotIndex = 0; slotIndex < slotsPerDay; slotIndex++) {
                        if (teacher.availability?.[`${dIdx}-${slotIndex}`] === 'ND') continue;
                        if (classroom.timeConstraints?.[`${dIdx}-${slotIndex}`] === 'ND') continue;

                        const busyLesson = currentFixed.find(o =>
                            o.day === day && o.slotIndex === slotIndex &&
                            o.teacherId === lessonToPlace.teacherId &&
                            o.classId !== lessonToPlace.classId
                        );

                        if (!busyLesson) continue;
                        if (initialFixed.some(fl => fl.day === day && fl.slotIndex === slotIndex && fl.classId === busyLesson.classId)) continue;

                        // TRANSAÇÃO ATÔMICA COM SNAPSHOT: impede criação de aulas duplicadas ou fantasmas
                        const snapshot = currentFixed.map(l => ({ ...l }));

                        // Remove a aula ocupada da outra turma
                        const bIdx = currentFixed.findIndex(o =>
                            o.day === day && o.slotIndex === slotIndex &&
                            o.classId === busyLesson.classId && o.teacherId === busyLesson.teacherId
                        );
                        if (bIdx >= 0) {
                            const removed = currentFixed[bIdx];
                            currentFixed.splice(bIdx, 1);
                            removeLesson(removed);
                        }

                        // Tenta realocar a aula da outra turma
                        const relocated = tryIntraClassEjectionChain(busyLesson, 6, true);
                        if (relocated) {
                            // Tenta posicionar a aula desejada na turma alvo
                            const placed = tryIntraClassEjectionChain(lessonToPlace, 6, true);
                            if (placed) {
                                return true;
                            }
                        }

                        // Reverte 100% para o estado original caso falhe
                        currentFixed.length = 0;
                        for (const item of snapshot) {
                            currentFixed.push({ ...item });
                        }
                        rebuildBoard();
                    }
                }

                return false;
            };

            // Troca Direta entre duas turmas (Kempe Cross-Class Swap) com Transação Snapshot.
            // O número de pares cresce com turmas × horários²; o teto deixa tempo para novas tentativas.
            const tryCrossClassSwap = (lessonToPlace: FixedLesson): boolean => {
                const classId = lessonToPlace.classId;
                const originCi = classIdx.get(classId);
                if (originCi === undefined || nClasses > 12) return false;
                let checks = 0;

                for (let d1 = 0; d1 < nDays; d1++) {
                    const day1 = originalDays[d1];
                    for (let s1 = 0; s1 < slotsPerDay; s1++) {
                        const l1 = classOcc[cPos(originCi, d1, s1)];
                        if (!l1 || pinnedSlots.has(`${classId}|${day1}|${s1}`)) continue;

                        for (let d2 = 0; d2 < nDays; d2++) {
                            const day2 = originalDays[d2];
                            for (let s2 = 0; s2 < slotsPerDay; s2++) {
                                if (d1 === d2 && s1 === s2) continue;

                                for (let otherCi = 0; otherCi < nClasses; otherCi++) {
                                    if (otherCi === originCi) continue;
                                    if (++checks > 400) return false;
                                    const l2 = classOcc[cPos(otherCi, d2, s2)];
                                    const otherClassId = data.classes[otherCi].id;
                                    if (!l2 || pinnedSlots.has(`${otherClassId}|${day2}|${s2}`)) continue;

                                    if (canTeacherTakeSlotInClass(l1, day2, s2, l1, true) &&
                                        canTeacherTakeSlotInClass(l2, day1, s1, l2, true)) {
                                        
                                        const snapshot = currentFixed.map(l => ({ ...l }));

                                        const cl1 = l1;
                                        const cl2 = l2;
                                        cl1.day = day2; cl1.slotIndex = s2;
                                        cl2.day = day1; cl2.slotIndex = s1;
                                        rebuildBoard();

                                        const placed = tryIntraClassEjectionChain(lessonToPlace, 5, true);
                                        if (placed) {
                                            return true;
                                        }

                                        // Reverte 100%
                                        currentFixed.length = 0;
                                        for (const item of snapshot) {
                                            currentFixed.push({ ...item });
                                        }
                                        rebuildBoard();
                                    }
                                }
                            }
                        }
                    }
                }

                return false;
            };

            if (unplacedBlocks.length > 0) for (const failedBlock of unplacedBlocks) {
                const remainingLessons = failedBlock.size;

                for (let l = 0; l < remainingLessons; l++) {
                    const singleLesson: FixedLesson = {
                        day: '',
                        slotIndex: -1,
                        classId: failedBlock.assignment.classId,
                        teacherId: failedBlock.assignment.teacherId,
                        subjectId: failedBlock.assignment.subjectId
                    };

                    let placed = false;

                    // 1. Tenta colocar diretamente ou via cadeia de ejeção respeitando regras pedagógicas
                    placed = tryIntraClassEjectionChain(singleLesson, 8, false);

                    // 2. Se não deu, tenta cadeia de ejeção relaxando regras pedagógicas (prioridade 100% carga horária)
                    if (!placed) {
                        placed = tryIntraClassEjectionChain(singleLesson, 8, true);
                    }

                    // 3. Se não deu, tenta realocação inter-turmas atômica
                    if (!placed) {
                        placed = tryInterClassRelocation(singleLesson);
                    }

                    // 4. Se ainda não deu, tenta troca direta entre turmas atômica
                    if (!placed) {
                        placed = tryCrossClassSwap(singleLesson);
                    }

                    if (!placed) {
                        const key = `${failedBlock.assignment.teacherId}|${failedBlock.assignment.classId}|${failedBlock.assignment.subjectId}`;
                        failedAssignmentWeights[key] = (failedAssignmentWeights[key] || 0) + 20;
                        failures.push({
                            teacherId: failedBlock.assignment.teacherId,
                            classId: failedBlock.assignment.classId,
                            subjectId: failedBlock.assignment.subjectId,
                            reason: 'NO_AVAILABILITY',
                            details: `Não foi possível encontrar slot para 1 aula de ${subjectById.get(failedBlock.assignment.subjectId)?.name}.`
                        });
                    }
                }
            }

        // Compactação Automática com respeito estrito aos limites de aulas seguidas
        const compact = () => {
            let moved = true;
            let loopCount = 0;
            const scheduleList = data.schedule || [];

            while (moved && loopCount < 10) {
                loopCount++;
                moved = false;
                scheduleList.forEach(s => {
                    (data.classes || []).forEach(c => {
                        const cl = currentFixed.filter(f => f.day === s.day && f.classId === c.id).sort((a, b) => a.slotIndex - b.slotIndex);

                        const classBlocks: FixedLesson[][] = [];
                        let currentBlock: FixedLesson[] = [];
                        cl.forEach(f => {
                            if (currentBlock.length === 0) {
                                currentBlock.push(f);
                            } else {
                                const last = currentBlock[currentBlock.length - 1];
                                if (f.teacherId === last.teacherId && f.slotIndex === last.slotIndex + 1) {
                                    currentBlock.push(f);
                                } else {
                                    classBlocks.push(currentBlock);
                                    currentBlock = [f];
                                }
                            }
                        });
                        if (currentBlock.length > 0) classBlocks.push(currentBlock);

                        classBlocks.forEach(blk => {
                            const isProtected = blk.some(f => initialFixed.some(fl =>
                                fl.day === s.day && fl.slotIndex === f.slotIndex && fl.classId === f.classId && fl.teacherId === f.teacherId
                            ));
                            if (isProtected) return;

                            let safety = 0;
                            while (blk[0].slotIndex > 0 && safety < 20) {
                                safety++;
                                const prev = blk[0].slotIndex - 1;

                                let canMoveBlock = true;
                                const targetSlots = blk.map((_, i) => prev + i);
                                const fSample = blk[0];
                                const rule = getEffectiveGroupingRule(fSample.teacherId, fSample.classId, fSample.subjectId);

                                // Não pode fundir blocos na mesma turma criando mais aulas consecutivas do que permitido
                                const otherSubjectLessons = currentFixed.filter(o =>
                                    o.day === s.day && o.classId === fSample.classId && o.subjectId === fSample.subjectId && !blk.includes(o)
                                );
                                const combinedSubjectSlots = [...otherSubjectLessons.map(o => o.slotIndex), ...targetSlots];
                                if (getMaxConsecutiveStreak(combinedSubjectSlots) > rule.maxConsecutive) {
                                    canMoveBlock = false;
                                }
                                if (!rule.allowConsecutive && getMaxConsecutiveStreak(combinedSubjectSlots) > 1) {
                                    canMoveBlock = false;
                                }

                                const otherTeacherLessons = currentFixed.filter(o =>
                                    o.day === s.day && o.classId === fSample.classId && o.teacherId === fSample.teacherId && !blk.includes(o)
                                );
                                const combinedTeacherSlots = [...otherTeacherLessons.map(o => o.slotIndex), ...targetSlots];
                                if (getMaxConsecutiveStreak(combinedTeacherSlots) > rule.maxConsecutive) {
                                    canMoveBlock = false;
                                }

                                if (!canMoveBlock) break;

                                for (let i = 0; i < blk.length; i++) {
                                    const newSlot = prev + i;
                                    const f = blk[i];

                                    if (currentFixed.some(o => o.day === s.day && o.slotIndex === newSlot && (o.classId === f.classId || o.teacherId === f.teacherId) && !blk.includes(o))) {
                                        canMoveBlock = false; break;
                                    }
                                    const dIdx = dayIndex.get(s.day) ?? -1;
                                    const moveTi = teacherIdx.get(f.teacherId);
                                    const moveCi = classIdx.get(f.classId);
                                    const moveBit = 1 << newSlot;
                                    if (dIdx < 0 || moveTi === undefined || moveCi === undefined ||
                                        (teacherNd[tOff(moveTi, dIdx)] & moveBit) || (classNd[cOff(moveCi, dIdx)] & moveBit)) {
                                        canMoveBlock = false; break;
                                    }
                                }

                                if (!canMoveBlock) break;

                                blk.forEach(f => {
                                    f.slotIndex--;
                                });
                                moved = true;
                            }
                        });
                    });
                });
            }
        };

        compact();

        // Fechamento de Janelas de Professores respeitando limites de aulas consecutivas
        let manualMoves = false;
        (data.teachers || []).forEach(t => {
            (data.schedule || []).forEach(s => {
                const tl = currentFixed.filter(f => f.day === s.day && f.teacherId === t.id).sort((a, b) => a.slotIndex - b.slotIndex);

                const teacherBlocks: FixedLesson[][] = [];
                let currentBlock: FixedLesson[] = [];
                tl.forEach(f => {
                    if (currentBlock.length === 0) {
                        currentBlock.push(f);
                    } else {
                        const last = currentBlock[currentBlock.length - 1];
                        if (f.classId === last.classId && f.slotIndex === last.slotIndex + 1) {
                            currentBlock.push(f);
                        } else {
                            teacherBlocks.push(currentBlock);
                            currentBlock = [f];
                        }
                    }
                });
                if (currentBlock.length > 0) teacherBlocks.push(currentBlock);

                teacherBlocks.forEach((blk, idx) => {
                    if (idx === 0) return;
                    const isProtected = blk.some(f => initialFixed.some(fl =>
                        fl.day === s.day && fl.slotIndex === f.slotIndex && fl.classId === f.classId && fl.teacherId === f.teacherId
                    ));
                    if (isProtected) return;

                    const prevBlk = teacherBlocks[idx - 1];
                    const gapStart = prevBlk[prevBlk.length - 1].slotIndex + 1;

                    if (blk[0].slotIndex > gapStart) {
                        let canMoveBlock = true;
                        const target = gapStart;
                        const targetSlots = blk.map((_, i) => target + i);
                        const fSample = blk[0];
                        const rule = getEffectiveGroupingRule(fSample.teacherId, fSample.classId, fSample.subjectId);

                        // Não pode fundir blocos na mesma turma criando mais aulas consecutivas do que permitido
                        const otherSubjectLessons = currentFixed.filter(o =>
                            o.day === s.day && o.classId === fSample.classId && o.subjectId === fSample.subjectId && !blk.includes(o)
                        );
                        const combinedSubjectSlots = [...otherSubjectLessons.map(o => o.slotIndex), ...targetSlots];
                        if (getMaxConsecutiveStreak(combinedSubjectSlots) > rule.maxConsecutive) {
                            canMoveBlock = false;
                        }
                        if (!rule.allowConsecutive && getMaxConsecutiveStreak(combinedSubjectSlots) > 1) {
                            canMoveBlock = false;
                        }

                        const otherTeacherLessons = currentFixed.filter(o =>
                            o.day === s.day && o.classId === fSample.classId && o.teacherId === fSample.teacherId && !blk.includes(o)
                        );
                        const combinedTeacherSlots = [...otherTeacherLessons.map(o => o.slotIndex), ...targetSlots];
                        if (getMaxConsecutiveStreak(combinedTeacherSlots) > rule.maxConsecutive) {
                            canMoveBlock = false;
                        }

                        if (!canMoveBlock) return;

                        for (let i = 0; i < blk.length; i++) {
                            const newSlot = target + i;
                            const f = blk[i];

                            if (currentFixed.some(o => o.day === s.day && o.slotIndex === newSlot && (o.classId === f.classId || o.teacherId === f.teacherId) && !blk.includes(o))) {
                                canMoveBlock = false; break;
                            }
                            const dIdx = dayIndex.get(s.day) ?? -1;
                            const moveTi = teacherIdx.get(f.teacherId);
                            const moveCi = classIdx.get(f.classId);
                            const moveBit = 1 << newSlot;
                            if (dIdx < 0 || moveTi === undefined || moveCi === undefined ||
                                (teacherNd[tOff(moveTi, dIdx)] & moveBit) || (classNd[cOff(moveCi, dIdx)] & moveBit)) {
                                canMoveBlock = false; break;
                            }
                        }

                        if (canMoveBlock) {
                            for (let i = 0; i < blk.length; i++) {
                                blk[i].slotIndex = target + i;
                            }
                            manualMoves = true;
                        }
                    }
                });
            });
        });

        if (manualMoves) {
            compact();
        }

        // Deduplicação estrita de integridade: garante que nenhuma turma nem professor tenham 2 aulas no mesmo slot
        const uniqueFixed: FixedLesson[] = [];
        const seenClassSlots = new Set<string>();
        const seenTeacherSlots = new Set<string>();
        for (const fl of currentFixed) {
            const classKey = `${fl.classId}|${fl.day}|${fl.slotIndex}`;
            const teacherKey = `${fl.teacherId}|${fl.day}|${fl.slotIndex}`;
            if (!seenClassSlots.has(classKey) && !seenTeacherSlots.has(teacherKey)) {
                seenClassSlots.add(classKey);
                seenTeacherSlots.add(teacherKey);
                uniqueFixed.push(fl);
            }
        }
        currentFixed = uniqueFixed;
        rebuildBoard();

        // O que a compactação ou a deduplicação deixou de fora volta para a fila e é contado de verdade.
        const missing: Block[] = [];
        for (const asg of assignments) {
            if (asg.lessons <= 0) continue;
            const placed = currentFixed.filter(lesson =>
                lesson.teacherId === asg.teacherId &&
                lesson.classId === asg.classId &&
                lesson.subjectId === asg.subjectId
            ).length;
            for (let n = placed; n < asg.lessons; n++) {
                missing.push({ assignment: asg, size: 1, consecutive: false });
            }
        }
        const copyState = () => currentFixed.map(lesson => ({ ...lesson }));
        const restoreState = (snap: FixedLesson[]) => {
            currentFixed.length = 0;
            for (const lesson of snap) currentFixed.push(lesson);
            rebuildBoard();
        };
        const teacherCanUse = (teacherId: string, day: string, slot: number): boolean => {
            const di = dayIndex.get(day);
            const ti = teacherIdx.get(teacherId);
            if (di === undefined || ti === undefined || slot < 0 || slot >= slotsPerDay) return false;
            if (teacherNd[tOff(ti, di)] & (1 << slot)) return false;
            if (teacherOcc[tPos(ti, di, slot)]) return false;
            return popcount(teacherMask[tOff(ti, di)]) < teacherLimit[tOff(ti, di)];
        };
        const teacherCanUseIgnoring = (teacherId: string, day: string, slot: number, ignoring: FixedLesson[]): boolean => {
            const di = dayIndex.get(day);
            const ti = teacherIdx.get(teacherId);
            if (di === undefined || ti === undefined || slot < 0 || slot >= slotsPerDay) return false;
            if (teacherNd[tOff(ti, di)] & (1 << slot)) return false;
            const hit = teacherOcc[tPos(ti, di, slot)];
            if (hit && !ignoring.includes(hit)) return false;
            const staysOnDay = ignoring.some(item => item.teacherId === teacherId && item.day === day);
            if (staysOnDay) return true;
            let count = popcount(teacherMask[tOff(ti, di)]);
            for (const item of ignoring) {
                if (item.teacherId === teacherId && item.day === day) count--;
            }
            return count < teacherLimit[tOff(ti, di)];
        };
        // Tira a aula do horário atual dentro da própria turma. O destino pode ser o buraco
        // ou o horário de outra aula que consiga assumir esse buraco.
        const openSlotFor = (lesson: FixedLesson): boolean => {
            if (pinnedSlots.has(`${lesson.classId}|${lesson.day}|${lesson.slotIndex}`)) return false;
            const ci = classIdx.get(lesson.classId);
            if (ci === undefined || currentFixed.indexOf(lesson) < 0) return false;
            const originDay = lesson.day;
            const originSlot = lesson.slotIndex;
            const holes: { day: string; di: number; slot: number }[] = [];
            const others: FixedLesson[] = [];
            for (let di = 0; di < nDays; di++) {
                for (let slot = 0; slot < slotsPerDay; slot++) {
                    const occ = classOcc[cPos(ci, di, slot)];
                    if (!occ) {
                        if (classNd[cOff(ci, di)] & (1 << slot)) continue;
                        holes.push({ day: originalDays[di], di, slot });
                    } else if (occ !== lesson) {
                        others.push(occ);
                    }
                }
            }
            for (const hole of holes) {
                if (`${hole.day}|${hole.slot}` === `${originDay}|${originSlot}`) continue;
                if (!teacherCanUseIgnoring(lesson.teacherId, hole.day, hole.slot, [lesson])) continue;
                lesson.day = hole.day;
                lesson.slotIndex = hole.slot;
                rebuildBoard();
                return true;
            }
            for (const other of others) {
                if (pinnedSlots.has(`${other.classId}|${other.day}|${other.slotIndex}`)) continue;
                if (!teacherCanUseIgnoring(lesson.teacherId, other.day, other.slotIndex, [lesson, other])) continue;
                if (!teacherCanUseIgnoring(other.teacherId, originDay, originSlot, [other, lesson])) continue;
                const otherDay = other.day;
                const otherSlot = other.slotIndex;
                other.day = originDay;
                other.slotIndex = originSlot;
                lesson.day = otherDay;
                lesson.slotIndex = otherSlot;
                rebuildBoard();
                return true;
            }
            for (const other of others) {
                if (!teacherCanUseIgnoring(lesson.teacherId, other.day, other.slotIndex, [lesson, other])) continue;
                for (const third of others) {
                    if (third === other) continue;
                    if (pinnedSlots.has(`${other.classId}|${other.day}|${other.slotIndex}`)) continue;
                    if (pinnedSlots.has(`${third.classId}|${third.day}|${third.slotIndex}`)) continue;
                    if (!teacherCanUseIgnoring(other.teacherId, third.day, third.slotIndex, [other, third, lesson])) continue;
                    if (!teacherCanUseIgnoring(third.teacherId, originDay, originSlot, [third, lesson, other])) continue;
                    const otherDay = other.day;
                    const otherSlot = other.slotIndex;
                    const thirdDay = third.day;
                    const thirdSlot = third.slotIndex;
                    other.day = thirdDay;
                    other.slotIndex = thirdSlot;
                    third.day = originDay;
                    third.slotIndex = originSlot;
                    lesson.day = otherDay;
                    lesson.slotIndex = otherSlot;
                    rebuildBoard();
                    return true;
                }
            }
            for (const hole of holes) {
                for (const other of others) {
                    if (pinnedSlots.has(`${other.classId}|${other.day}|${other.slotIndex}`)) continue;
                    if (!teacherCanUseIgnoring(other.teacherId, hole.day, hole.slot, [other, lesson])) continue;
                    if (!teacherCanUseIgnoring(lesson.teacherId, other.day, other.slotIndex, [lesson, other])) continue;
                    const otherDay = other.day;
                    const otherSlot = other.slotIndex;
                    other.day = hole.day;
                    other.slotIndex = hole.slot;
                    lesson.day = otherDay;
                    lesson.slotIndex = otherSlot;
                    rebuildBoard();
                    return true;
                }
            }
            return false;
        };
        const moveLessonAway = (lesson: FixedLesson): boolean => {
            if (openSlotFor(lesson)) return true;
            if (pinnedSlots.has(`${lesson.classId}|${lesson.day}|${lesson.slotIndex}`)) return false;
            const idx = currentFixed.indexOf(lesson);
            if (idx < 0) return false;
            currentFixed.splice(idx, 1);
            removeLesson(lesson);
            return tryIntraClassEjectionChain(lesson, 6, true);
        };
        // Últimas aulas: o buraco da turma está num tempo em que o professor já dá aula em outra sala,
        // ou o tempo livre dele está ocupado por alguém que também precisa sair do lugar.
        const forcePlace = (lessonToPlace: FixedLesson): boolean => {
            const ci = classIdx.get(lessonToPlace.classId);
            const ti = teacherIdx.get(lessonToPlace.teacherId);
            if (ci === undefined || ti === undefined) return false;
            const holes: { day: string; di: number; slot: number }[] = [];
            for (let di = 0; di < nDays; di++) {
                for (let slot = 0; slot < slotsPerDay; slot++) {
                    if (classOcc[cPos(ci, di, slot)]) continue;
                    if (classNd[cOff(ci, di)] & (1 << slot)) continue;
                    holes.push({ day: originalDays[di], di, slot });
                }
            }
            const placeAt = (day: string, slot: number) => {
                const placed: FixedLesson = { ...lessonToPlace, day, slotIndex: slot };
                currentFixed.push(placed);
                placeLesson(placed);
            };
            for (const hole of holes) {
                if (!teacherCanUse(lessonToPlace.teacherId, hole.day, hole.slot)) continue;
                placeAt(hole.day, hole.slot);
                return true;
            }
            for (const hole of holes) {
                const busy = teacherOcc[tPos(ti, hole.di, hole.slot)];
                if (!busy || busy.classId === lessonToPlace.classId) continue;
                const snap = copyState();
                if (moveLessonAway(busy) && !classOcc[cPos(ci, hole.di, hole.slot)] && teacherCanUse(lessonToPlace.teacherId, hole.day, hole.slot)) {
                    placeAt(hole.day, hole.slot);
                    return true;
                }
                restoreState(snap);
            }
            for (let di = 0; di < nDays; di++) {
                for (let slot = 0; slot < slotsPerDay; slot++) {
                    const occ = classOcc[cPos(ci, di, slot)];
                    if (!occ || pinnedSlots.has(`${occ.classId}|${occ.day}|${occ.slotIndex}`)) continue;
                    if (!teacherCanUse(lessonToPlace.teacherId, originalDays[di], slot)) continue;
                    const snap = copyState();
                    if (moveLessonAway(occ) && !classOcc[cPos(ci, di, slot)] && teacherCanUse(lessonToPlace.teacherId, originalDays[di], slot)) {
                        placeAt(originalDays[di], slot);
                        return true;
                    }
                    restoreState(snap);
                    for (const hole of holes) {
                        const snapHole = copyState();
                        const occTeacher = teacherIdx.get(occ.teacherId);
                        const blocker = occTeacher === undefined ? undefined : teacherOcc[tPos(occTeacher, hole.di, hole.slot)];
                        const freed = !blocker || blocker === occ || moveLessonAway(blocker);
                        const occNow = classOcc[cPos(ci, di, slot)];
                        if (freed && occNow && moveLessonAway(occNow) && !classOcc[cPos(ci, di, slot)] && teacherCanUse(lessonToPlace.teacherId, originalDays[di], slot)) {
                            placeAt(originalDays[di], slot);
                            return true;
                        }
                        restoreState(snapHole);
                    }
                }
            }
            return false;
        };

        const rematchClass = (classId: string): boolean => {
            const needed: { teacherId: string; subjectId: string }[] = [];
            for (const asg of assignments) {
                if (asg.classId !== classId || asg.lessons <= 0) continue;
                for (let n = 0; n < asg.lessons; n++) needed.push({ teacherId: asg.teacherId, subjectId: asg.subjectId });
            }
            const ci = classIdx.get(classId);
            if (ci === undefined || needed.length === 0) return false;
            const spots: { day: string; di: number; slot: number }[] = [];
            for (let di = 0; di < nDays; di++) {
                for (let slot = 0; slot < slotsPerDay; slot++) {
                    if (classNd[cOff(ci, di)] & (1 << slot)) continue;
                    spots.push({ day: originalDays[di], di, slot });
                }
            }
            if (spots.length < needed.length) return false;
            const snap = copyState();
            const removed = currentFixed.filter(lesson => lesson.classId === classId);
            for (const lesson of removed) {
                const idx = currentFixed.indexOf(lesson);
                if (idx >= 0) currentFixed.splice(idx, 1);
                removeLesson(lesson);
            }
            const edges = needed.map(unit => {
                const list: number[] = [];
                for (let s = 0; s < spots.length; s++) {
                    if (teacherCanUse(unit.teacherId, spots[s].day, spots[s].slot)) list.push(s);
                }
                return list;
            });
            const withinDailyLimit = (unitIndex: number, spotIndex: number, matchSlot: number[]): boolean => {
                const unit = needed[unitIndex];
                const spot = spots[spotIndex];
                const ti = teacherIdx.get(unit.teacherId);
                if (ti === undefined) return false;
                let count = popcount(teacherMask[tOff(ti, spot.di)]) + 1;
                for (let s = 0; s < spots.length; s++) {
                    const matched = matchSlot[s];
                    if (matched < 0 || spots[s].di !== spot.di) continue;
                    if (needed[matched].teacherId === unit.teacherId) count++;
                }
                return count <= teacherLimit[tOff(ti, spot.di)];
            };
            const solve = (): number[] | null => {
                const matchSlot = new Array<number>(spots.length).fill(-1);
                const seen = new Array<boolean>(spots.length);
                const unitMatched = new Array<boolean>(needed.length).fill(false);
                const dfs = (unitIndex: number): boolean => {
                    for (const spotIndex of edges[unitIndex]) {
                        if (seen[spotIndex] || !withinDailyLimit(unitIndex, spotIndex, matchSlot)) continue;
                        seen[spotIndex] = true;
                        const previous = matchSlot[spotIndex];
                        if (previous < 0 || dfs(previous)) {
                            matchSlot[spotIndex] = unitIndex;
                            unitMatched[unitIndex] = true;
                            return true;
                        }
                    }
                    return false;
                };
                for (let unitIndex = 0; unitIndex < needed.length; unitIndex++) {
                    if (unitMatched[unitIndex]) continue;
                    seen.fill(false);
                    dfs(unitIndex);
                }
                const placed = matchSlot.filter(unitIndex => unitIndex >= 0).length;
                return placed === needed.length ? matchSlot : null;
            };
            let matchSlot = solve();
            if (!matchSlot) {
                for (let attempt = 0; attempt < 6 && !matchSlot; attempt++) {
                    for (let i = needed.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        const swapUnit = needed[i];
                        needed[i] = needed[j];
                        needed[j] = swapUnit;
                        const swapEdges = edges[i];
                        edges[i] = edges[j];
                        edges[j] = swapEdges;
                    }
                    matchSlot = solve();
                }
            }
            if (!matchSlot) {
                restoreState(snap);
                return false;
            }
            const used = new Set<number>();
            for (let s = 0; s < spots.length; s++) {
                const unitIndex = matchSlot[s];
                if (unitIndex < 0 || used.has(unitIndex)) continue;
                used.add(unitIndex);
                const unit = needed[unitIndex];
                const spot = spots[s];
                const placed: FixedLesson = {
                    day: spot.day,
                    slotIndex: spot.slot,
                    classId,
                    teacherId: unit.teacherId,
                    subjectId: unit.subjectId
                };
                currentFixed.push(placed);
                placeLesson(placed);
            }
            return true;
        };

        if (missing.length > 0) {
            const classesToRepair = [...new Set(missing.map(item => item.assignment.classId))];
            for (const classId of classesToRepair) rematchClass(classId);
            missing.length = 0;
            for (const asg of assignments) {
                if (asg.lessons <= 0) continue;
                const placed = currentFixed.filter(lesson =>
                    lesson.teacherId === asg.teacherId &&
                    lesson.classId === asg.classId &&
                    lesson.subjectId === asg.subjectId
                ).length;
                for (let n = placed; n < asg.lessons; n++) missing.push({ assignment: asg, size: 1, consecutive: false });
            }
        }

        if (missing.length > 0) {
            failures.length = 0;
            for (const failedBlock of missing) {
                const singleLesson: FixedLesson = {
                    day: '',
                    slotIndex: -1,
                    classId: failedBlock.assignment.classId,
                    teacherId: failedBlock.assignment.teacherId,
                    subjectId: failedBlock.assignment.subjectId
                };
                const placed = tryIntraClassEjectionChain(singleLesson, 8, true)
                    || tryInterClassRelocation(singleLesson)
                    || forcePlace(singleLesson);
                if (!placed) {
                    const key = `${failedBlock.assignment.teacherId}|${failedBlock.assignment.classId}|${failedBlock.assignment.subjectId}`;
                    failedAssignmentWeights[key] = (failedAssignmentWeights[key] || 0) + 20;
                    failures.push({
                        teacherId: failedBlock.assignment.teacherId,
                        classId: failedBlock.assignment.classId,
                        subjectId: failedBlock.assignment.subjectId,
                        reason: 'NO_AVAILABILITY',
                        details: `Não foi possível encontrar slot para 1 aula de ${subjectById.get(failedBlock.assignment.subjectId)?.name}.`
                    });
                }
            }
        } else {
            failures.length = 0;
        }

        return { fixedLessons: currentFixed, failures, score: calculateScore(currentFixed, failures) };
    };

    let bestResult = { fixedLessons: [] as FixedLesson[], failures: [] as SchedulingFailure[], score: -Infinity };
    let stagnant = 0;
    const numClasses = Math.max(1, data.classes.length);
    const maxIters = 400; // Explora até 400 iterações com GRASP e cadeias de ejeção
    const startTime = Date.now();
    const maxTimeBudgetMs = 15000; // Máximo de 15 segundos para tempo de resposta interativo garantido

    if (onProgress) {
        onProgress(5, "Iniciando motor de balanceamento pedagógico...");
    }

    const progressStep = Math.max(1, Math.floor(maxIters / 35));

    for (let iter = 1; iter <= maxIters; iter++) {
        // Encerra caso exceda o tempo de busca
        if (iter > 15 && (Date.now() - startTime) > maxTimeBudgetMs) {
            if (onProgress) onProgress(100, "Grade ideal otimizada e finalizada!");
            break;
        }

        const attempt = runAttempt();

        if (attempt.score > bestResult.score) {
            bestResult = attempt;
            stagnant = 0;
        } else {
            stagnant++;
        }

        // A heurística já concentra professores e fecha janelas; para quando novas tentativas não melhoram a nota.
        if (bestResult.failures.length === 0 && stagnant >= 12) {
            if (onProgress) onProgress(100, "Grade 100% completa e otimizada!");
            break;
        }

        // Parada antecipada: 100% da carga horária e um teto de refinamento
        if (bestResult.failures.length === 0 && (iter >= 40 || (Date.now() - startTime) > 8000)) {
            if (onProgress) onProgress(100, "Grade 100% completa e otimizada!");
            break;
        }

        if (iter % progressStep === 0 && onProgress) {
            const progress = Math.min(99, Math.max(5, Math.round((iter / maxIters) * 95)));
            const msg = bestResult.failures.length === 0
                ? `100% das aulas alocadas! Otimizando janelas e continuidade (${progress}%)...`
                : `Alocando professores (${progress}%)... (${bestResult.fixedLessons.length} aulas alocadas)`;
            onProgress(progress, msg);
        }
    }

    if (onProgress) {
        onProgress(100, "Grade gerada com sucesso!");
    }

    return { fixedLessons: bestResult.fixedLessons, failures: bestResult.failures };
}

// Handler do Web Worker
if (typeof self !== 'undefined' && typeof window === 'undefined') {
    self.onmessage = (e: MessageEvent) => {
        try {
            const { setupData } = e.data;
            const result = runGeneratorEngine(setupData, (progress, message) => {
                self.postMessage({ type: 'PROGRESS', progress, message });
            });
            self.postMessage({ type: 'SUCCESS', result });
        } catch (error: any) {
            self.postMessage({ type: 'ERROR', error: error?.message || 'Erro durante a geração do horário' });
        }
    };
}
