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

    // 2. Aulas intercaladas (não permite tempos seguidos)
    if (g.includes('intercalad')) {
        let maxD = 2;
        if (g.includes('3 aulas') || g.includes('máximo 3')) maxD = 3;
        else if (g.includes('4 aulas') || g.includes('máximo 4')) maxD = 4;
        else if (g.includes('5 aulas') || g.includes('máximo 5')) maxD = 5;
        return { maxDaily: maxD, maxConsecutive: 1, allowConsecutive: false, requireDouble: false };
    }

    // 3. Aulas triplas / até 3 aulas seguidas
    if (g.includes('tripla') || g.includes('3 aulas por dia seguidas') || g.includes('máximo 3 aulas por dia seguidas') || g.includes('3 aulas seguidas') || g.includes('3-2')) {
        return { maxDaily: 3, maxConsecutive: 3, allowConsecutive: true, requireDouble: false };
    }

    // 4. Até 4 aulas seguidas
    if (g.includes('4 aulas por dia seguidas') || g.includes('máximo 4 aulas por dia seguidas') || g.includes('4 aulas seguidas') || g.includes('4 aulas no mesmo dia')) {
        return { maxDaily: 4, maxConsecutive: 4, allowConsecutive: true, requireDouble: false };
    }

    // 5. Até 5 aulas seguidas
    if (g.includes('5 aulas por dia seguidas') || g.includes('máximo 5 aulas por dia seguidas') || g.includes('5 aulas seguidas')) {
        return { maxDaily: 5, maxConsecutive: 5, allowConsecutive: true, requireDouble: false };
    }

    // 6. Aulas duplas obrigatórias
    if (g.includes('somente permitirá aulas duplas')) {
        return { maxDaily: 2, maxConsecutive: 2, allowConsecutive: true, requireDouble: true };
    }

    // 7. Padrão Horium e Escolas (No máximo 2 aulas por dia seguidas)
    // Cobre "Agrupar no máximo 2 aulas por dia SEGUIDAS", "Permitir no máximo 2 aulas por dia LIVRES",
    // "Agrupamento Livre", "Não Especificado", "2-1", "2-1-1", "2-2-1", etc.
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

    const failedAssignmentWeights: Record<string, number> = {};

    const getGroupingRuleFor = (teacherId: string, classId: string, subjectId: string): GroupingRule => {
        const raw = data.assignmentGroupings?.[`${teacherId}|${classId}|${subjectId}`] ||
            data.teacherGroupings?.[teacherId] ||
            data.subjectGroupings?.[subjectId] ||
            data.generalGrouping ||
            'Agrupar no máximo 2 aulas por dia SEGUIDAS';
        return parseGroupingRule(raw);
    };

    const calculateScore = (fixed: FixedLesson[], fails: SchedulingFailure[]) => {
        let score = (data.classes.length * 100) - (fails.reduce((acc, f) => acc + (data.classes.find(c => c.id === f.classId)?.lessonsPerSubject[f.subjectId] || 1), 0) * 5000);
        score += fixed.length * 50;

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
            const rule = getGroupingRuleFor(lessons[0].teacherId, classId, subjectId);

            // 1. Violação de limite diário da matéria na turma
            if (lessons.length > rule.maxDaily) {
                score -= (lessons.length - rule.maxDaily) * 60000;
            }

            const streak = getMaxConsecutiveStreak(lessons.map(l => l.slotIndex));

            // 2. Violação grave: Mais tempos seguidos do que o permitido (ex: 3 tempos seguidos quando a regra permite até 2)
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

        // Penalidade por professor ter mais de 2 tempos seguidos na mesma turma (a menos que a matéria permita tripla)
        Object.entries(teacherClassDayLessons).forEach(([tcKey, lessons]) => {
            if (lessons.length > 2) {
                const [teacherId, classId] = tcKey.split('|');
                const streak = getMaxConsecutiveStreak(lessons.map(l => l.slotIndex));
                const maxAllowedConsec = lessons.reduce((max, l) => {
                    const r = getGroupingRuleFor(teacherId, classId, l.subjectId);
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
                                const rule = getGroupingRuleFor(teacher.id, classId, subjectId);
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
                    });
                });
            }
        });

        // 1.1 Coletar matérias de turmas sem atribuição OBRIGATÓRIA (PODERÁ)
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
                        const chosenTeacher = eligibleTeachers[Math.floor(Math.random() * eligibleTeachers.length)];
                        const rule = getGroupingRuleFor(chosenTeacher.id, classroom.id, subjectId);
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

        const originalDays = (data.weekConfig?.activeDays && data.weekConfig.activeDays.length > 0)
            ? data.weekConfig.activeDays
            : (data.schedule && data.schedule.length > 0 && data.schedule[0]?.day ? data.schedule.map(s => s.day) : ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta']);

        const slotsPerDay = (data.schedule && data.schedule[0]?.slots?.filter(s => s.type === 'AULA').length) ||
            data.weekConfig?.lessonsPerDayGlobal || 5;

        const shuffle = <T>(a: T[]) => [...a].sort(() => Math.random() - 0.5);

        // Ordenação Heurística
        blocks.sort((a, b) => {
            const keyA = `${a.assignment.teacherId}|${a.assignment.classId}|${a.assignment.subjectId}`;
            const keyB = `${b.assignment.teacherId}|${b.assignment.classId}|${b.assignment.subjectId}`;
            const weightA = failedAssignmentWeights[keyA] || 0;
            const weightB = failedAssignmentWeights[keyB] || 0;
            if (weightA !== weightB) return weightB - weightA;

            if (b.size !== a.size) return b.size - a.size;

            const flexA = teacherFlexibility[a.assignment.teacherId] || 999;
            const flexB = teacherFlexibility[b.assignment.teacherId] || 999;
            if (Math.abs(flexA - flexB) > 0.01) return flexA - flexB;

            return 0;
        });

        // Validação de posicionamento estrita
        const isOk = (f: FixedLesson, candidateList: FixedLesson[]) => {
            // 1. Conflito de slot na turma ou no professor
            if (candidateList.some(o => o.day === f.day && o.slotIndex === f.slotIndex && (o.classId === f.classId || o.teacherId === f.teacherId))) {
                return false;
            }

            // 2. Indisponibilidade do professor
            const dIdx = originalDays.indexOf(f.day);
            const teacher = data.teachers.find(t => t.id === f.teacherId);
            if (teacher?.availability?.[`${dIdx}-${f.slotIndex}`] === 'ND') {
                return false;
            }

            // 3. Indisponibilidade da turma
            const classroom = data.classes.find(c => c.id === f.classId);
            if (classroom?.timeConstraints?.[`${dIdx}-${f.slotIndex}`] === 'ND') {
                return false;
            }

            // 4. Limite diário de aulas do professor
            const teacherDayCount = candidateList.filter(o => o.day === f.day && o.teacherId === f.teacherId).length;
            const tLimit = teacher?.dailyLimits?.[`${dIdx}`] !== undefined ? teacher.dailyLimits[`${dIdx}`] : slotsPerDay;
            if (teacherDayCount >= tLimit) {
                return false;
            }

            // 5. Regra de agrupamento pedagógico para a matéria nesta turma
            const rule = getGroupingRuleFor(f.teacherId, f.classId, f.subjectId);
            const totalSubjectLessons = classroom?.lessonsPerSubject?.[f.subjectId] || 1;
            const minDailyNeeded = Math.ceil(totalSubjectLessons / Math.max(1, originalDays.length));
            const effectiveMaxDaily = Math.max(rule.maxDaily, minDailyNeeded);
            const effectiveMaxConsecutive = Math.max(rule.maxConsecutive, minDailyNeeded > rule.maxDaily ? minDailyNeeded : rule.maxConsecutive);

            // 5.1 Limite diário da matéria na turma
            const existingSubjectLessons = candidateList.filter(o => o.day === f.day && o.classId === f.classId && o.subjectId === f.subjectId);
            if (existingSubjectLessons.length >= effectiveMaxDaily) {
                return false;
            }

            // 5.2 Limite de aulas seguidas (streak) da matéria na turma
            const subjectSlots = [...existingSubjectLessons.map(o => o.slotIndex), f.slotIndex];
            const subjectStreak = getMaxConsecutiveStreak(subjectSlots);
            if (subjectStreak > effectiveMaxConsecutive) {
                return false;
            }

            // 5.3 Proibição de aulas seguidas se a regra for intercalada / avulsa
            if (!rule.allowConsecutive && subjectStreak > 1) {
                return false;
            }

            // 5.4 Limite diário e streak do mesmo professor com a mesma turma
            const existingTeacherClassLessons = candidateList.filter(o => o.day === f.day && o.classId === f.classId && o.teacherId === f.teacherId);
            const teacherClassTotalLessons = Object.entries(classroom?.lessonsPerSubject || {})
                .filter(([subId]) => {
                    const asg = assignments.find(a => a.classId === f.classId && a.subjectId === subId);
                    return asg?.teacherId === f.teacherId;
                })
                .reduce((sum, [, count]) => sum + count, 0);
            const minTeacherClassDailyNeeded = Math.ceil(teacherClassTotalLessons / Math.max(1, originalDays.length));
            const effectiveTeacherClassMaxDaily = Math.max(effectiveMaxDaily, minTeacherClassDailyNeeded);
            const effectiveTeacherClassMaxStreak = Math.max(effectiveMaxConsecutive, minTeacherClassDailyNeeded > effectiveMaxDaily ? minTeacherClassDailyNeeded : effectiveMaxConsecutive);

            if (existingTeacherClassLessons.length >= effectiveTeacherClassMaxDaily) {
                return false;
            }

            const teacherClassSlots = [...existingTeacherClassLessons.map(o => o.slotIndex), f.slotIndex];
            const teacherClassStreak = getMaxConsecutiveStreak(teacherClassSlots);
            if (teacherClassStreak > effectiveTeacherClassMaxStreak) {
                return false;
            }

            return true;
        };

        // Backtracking com Trocas de Slots
        const tryPlace = (block: Block, depth: number = 0, currentList: FixedLesson[]): FixedLesson[] | null => {
            const daysShuffled = shuffle(originalDays);

            for (const day of daysShuffled) {
                const availableSlots: number[] = [];
                for (let i = 0; i <= slotsPerDay - block.size; i++) {
                    availableSlots.push(i);
                }

                availableSlots.sort((s1, s2) => {
                    const lessonsT = currentList.filter(o => o.day === day && o.teacherId === block.assignment.teacherId);
                    const isAdjacentT1 = lessonsT.some(o => o.slotIndex === s1 - 1 || o.slotIndex === s1 + block.size);
                    const isAdjacentT2 = lessonsT.some(o => o.slotIndex === s2 - 1 || o.slotIndex === s2 + block.size);

                    const lessonsC = currentList.filter(o => o.day === day && o.classId === block.assignment.classId);
                    const isAdjacentC1 = lessonsC.some(o => o.slotIndex === s1 - 1 || o.slotIndex === s1 + block.size);
                    const isAdjacentC2 = lessonsC.some(o => o.slotIndex === s2 - 1 || o.slotIndex === s2 + block.size);

                    const score1 = (isAdjacentT1 ? 2 : 0) + (isAdjacentC1 ? 1 : 0);
                    const score2 = (isAdjacentT2 ? 2 : 0) + (isAdjacentC2 ? 1 : 0);

                    return score2 - score1;
                });

                let swapAttempts = 0;
                for (const slotIndex of availableSlots) {
                    const candidateLessons: FixedLesson[] = [];
                    for (let s = 0; s < block.size; s++) {
                        candidateLessons.push({
                            day,
                            slotIndex: slotIndex + s,
                            classId: block.assignment.classId,
                            teacherId: block.assignment.teacherId,
                            subjectId: block.assignment.subjectId
                        });
                    }

                    // Validação cumulativa dos candidatos do bloco
                    let checkList = [...currentList];
                    let allOk = true;
                    for (const f of candidateLessons) {
                        if (!isOk(f, checkList)) {
                            allOk = false;
                            break;
                        }
                        checkList.push(f);
                    }

                    if (allOk) {
                        return checkList;
                    }

                    // Troca controlada com limite de profundidade e tentativas para máxima performance
                    if (depth === 0 && swapAttempts < 2) {
                        const conflictingLessons: FixedLesson[] = [];
                        let canAttemptSwap = true;

                        for (const f of candidateLessons) {
                            const dIdx = originalDays.indexOf(f.day);
                            const tAvail = data.teachers.find(t => t.id === f.teacherId)?.availability?.[`${dIdx}-${f.slotIndex}`];
                            const cAvail = data.classes.find(c => c.id === f.classId)?.timeConstraints?.[`${dIdx}-${f.slotIndex}`];
                            if (tAvail === 'ND' || cAvail === 'ND') {
                                canAttemptSwap = false;
                                break;
                            }

                            const conflicts = currentList.filter(o =>
                                o.day === f.day && o.slotIndex === f.slotIndex &&
                                (o.classId === f.classId || o.teacherId === f.teacherId)
                            );

                            if (conflicts.some(c => initialFixed.some(fl => fl.day === c.day && fl.slotIndex === c.slotIndex && fl.classId === c.classId))) {
                                canAttemptSwap = false;
                                break;
                            }

                            conflictingLessons.push(...conflicts);
                        }

                        if (canAttemptSwap && conflictingLessons.length > 0 && conflictingLessons.length <= 2) {
                            swapAttempts++;
                            let tempList = currentList.filter(item => !conflictingLessons.includes(item));
                            let swapCheckList = [...tempList];
                            let candidatesFit = true;
                            for (const f of candidateLessons) {
                                if (!isOk(f, swapCheckList)) {
                                    candidatesFit = false;
                                    break;
                                }
                                swapCheckList.push(f);
                            }

                            if (candidatesFit) {
                                tempList = swapCheckList;
                                let successfullyRelocated = true;
                                for (const displaced of conflictingLessons) {
                                    const displacedBlock: Block = {
                                        assignment: {
                                            teacherId: displaced.teacherId,
                                            classId: displaced.classId,
                                            subjectId: displaced.subjectId,
                                            lessons: 1,
                                            grouping: '1 aula',
                                            rule: getGroupingRuleFor(displaced.teacherId, displaced.classId, displaced.subjectId)
                                        },
                                        size: 1,
                                        consecutive: false
                                    };

                                    const relocatedResult = tryPlace(displacedBlock, depth + 1, tempList);
                                    if (relocatedResult) {
                                        tempList = relocatedResult;
                                    } else {
                                        successfullyRelocated = false;
                                        break;
                                    }
                                }

                                if (successfullyRelocated) {
                                    return tempList;
                                }
                            }
                        }
                    }
                }
            }

            return null;
        };

        // Alocação dos blocos
        for (const block of blocks) {
            const resultList = tryPlace(block, 0, currentFixed);
            if (resultList) {
                currentFixed = resultList;
            } else {
                const key = `${block.assignment.teacherId}|${block.assignment.classId}|${block.assignment.subjectId}`;
                failedAssignmentWeights[key] = (failedAssignmentWeights[key] || 0) + 1;

                failures.push({
                    teacherId: block.assignment.teacherId,
                    classId: block.assignment.classId,
                    subjectId: block.assignment.subjectId,
                    reason: 'NO_AVAILABILITY',
                    details: `Não foi possível encontrar slot para ${block.size} aula(s) de ${data.subjects.find(s => s.id === block.assignment.subjectId)?.name}.`
                });
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
                                const rule = getGroupingRuleFor(fSample.teacherId, fSample.classId, fSample.subjectId);

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
                                    const dIdx = originalDays.indexOf(s.day);
                                    if (data.teachers.find(t => t.id === f.teacherId)?.availability?.[`${dIdx}-${newSlot}`] === 'ND') {
                                        canMoveBlock = false; break;
                                    }
                                    if (data.classes.find(classroom => classroom.id === f.classId)?.timeConstraints?.[`${dIdx}-${newSlot}`] === 'ND') {
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
                        const rule = getGroupingRuleFor(fSample.teacherId, fSample.classId, fSample.subjectId);

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
                            const dIdx = originalDays.indexOf(s.day);
                            if (data.teachers.find(teacher => teacher.id === f.teacherId)?.availability?.[`${dIdx}-${newSlot}`] === 'ND') {
                                canMoveBlock = false; break;
                            }
                            if (data.classes.find(c => c.id === f.classId)?.timeConstraints?.[`${dIdx}-${newSlot}`] === 'ND') {
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

        return { fixedLessons: currentFixed, failures, score: calculateScore(currentFixed, failures) };
    };

    let bestResult = { fixedLessons: [] as FixedLesson[], failures: [] as SchedulingFailure[], score: -Infinity };
    const numClasses = Math.max(1, data.classes.length);
    // Para escolas com muitas turmas (ex: 19 turmas), 60 a 90 iterações já encontram excelente balanceamento em poucos segundos
    const maxIters = Math.min(300, Math.max(50, Math.floor(1200 / numClasses)));
    const startTime = Date.now();
    const maxTimeBudgetMs = 15000; // Máximo de 15 segundos para tempo de resposta interativo garantido

    if (onProgress) {
        onProgress(5, "Iniciando motor de balanceamento pedagógico...");
    }

    const progressStep = Math.max(1, Math.floor(maxIters / 35));

    for (let iter = 1; iter <= maxIters; iter++) {
        // Encerra com a melhor solução encontrada caso exceda o tempo de busca
        if (iter > 10 && (Date.now() - startTime) > maxTimeBudgetMs) {
            if (onProgress) onProgress(100, "Grade ideal otimizada e finalizada!");
            break;
        }

        const attempt = runAttempt();

        if (attempt.score > bestResult.score) {
            bestResult = attempt;
        }

        // Parada antecipada se solução for 100% perfeita sem falhas e com score excelente
        if (bestResult.failures.length === 0 && bestResult.score >= (data.classes.length * 100) + (bestResult.fixedLessons.length * 50)) {
            if (onProgress) onProgress(100, "Grade ideal encontrada com perfeição!");
            break;
        }

        if (iter % progressStep === 0 && onProgress) {
            const progress = Math.min(99, Math.max(5, Math.round((iter / maxIters) * 95)));
            const msg = bestResult.failures.length === 0
                ? `Otimizando janelas e continuidade (${progress}%)...`
                : `Explorando combinações pedagógicas (${progress}%)...`;
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
