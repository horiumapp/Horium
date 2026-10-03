import { SetupData, FixedLesson, SchedulingFailure } from '../types';
import { ensureScheduleSlots } from '../utils/scheduleUtils';

interface Assignment {
    teacherId: string;
    classId: string;
    subjectId: string;
    lessons: number;
    grouping: string;
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

        // Fragmentação pedagógica (Mesmo dia, mesma turma, mesma disciplina separadas)
        Object.values(classLessons).forEach(lessons => {
            if (lessons.length > 1) {
                score -= 100;
                lessons.sort((a, b) => a.slotIndex - b.slotIndex);
                for (let i = 1; i < lessons.length; i++) {
                    if (lessons[i].slotIndex !== lessons[i - 1].slotIndex + 1) {
                        score -= 2500;
                    }
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
        const initialFixed: FixedLesson[] = (data.fixedLessons || []).filter(fl =>
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
                                assignments.push({
                                    teacherId: teacher.id,
                                    classId,
                                    subjectId,
                                    lessons: classroom.lessonsPerSubject?.[subjectId] || 0,
                                    grouping: data.assignmentGroupings?.[`${teacher.id}|${classId}|${subjectId}`] ||
                                        data.teacherGroupings?.[teacher.id] ||
                                        data.subjectGroupings?.[subjectId] ||
                                        data.generalGrouping ||
                                        'Não Especificado'
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
                        assignments.push({
                            teacherId: chosenTeacher.id,
                            classId: classroom.id,
                            subjectId,
                            lessons: lessonCount,
                            grouping: data.assignmentGroupings?.[`${chosenTeacher.id}|${classroom.id}|${subjectId}`] ||
                                data.teacherGroupings?.[chosenTeacher.id] ||
                                data.subjectGroupings?.[subjectId] ||
                                data.generalGrouping ||
                                'Não Especificado'
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

        // 3. Decompor em blocos
        const blocks: Block[] = [];
        assignments.forEach(asg => {
            const alreadyFixed = currentFixed.filter(f =>
                f.teacherId === asg.teacherId &&
                f.classId === asg.classId &&
                f.subjectId === asg.subjectId
            ).length;

            let left = Math.max(0, asg.lessons - alreadyFixed);
            const double = (asg.grouping || '').toLowerCase().match(/dupla|seguida|junta/);
            if (double) {
                let safety = 0;
                while (left >= 2 && safety < 100) { blocks.push({ assignment: asg, size: 2, consecutive: true }); left -= 2; safety++; }
            }
            let safetySingle = 0;
            while (left > 0 && safetySingle < 100) { blocks.push({ assignment: asg, size: 1, consecutive: true }); left--; safetySingle++; }
        });

        const originalDays = (data.weekConfig?.activeDays && data.weekConfig.activeDays.length > 0)
            ? data.weekConfig.activeDays
            : (data.schedule && data.schedule.length > 0 && data.schedule[0]?.day ? data.schedule.map(s => s.day) : ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta']);

        const slotsPerDay = (data.schedule && data.schedule[0]?.slots?.filter(s => s.type === 'AULA').length) ||
            data.weekConfig?.lessonsPerDayGlobal || 5;

        const shuffle = <T>(a: T[]) => [...a].sort(() => Math.random() - 0.5);

        // Limite por Princípio da Casa dos Pombos
        const maxAllowedDailyLessons: Record<string, number> = {};
        assignments.forEach(asg => {
            const key = `${asg.teacherId}|${asg.classId}`;
            const total = asg.lessons;
            const daysCount = originalDays.length || 5;
            maxAllowedDailyLessons[key] = Math.ceil(total / daysCount);
        });

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

        // Validação de posicionamento
        const isOk = (f: FixedLesson, candidateList: FixedLesson[]) => {
            if (candidateList.some(o => o.day === f.day && o.slotIndex === f.slotIndex && (o.classId === f.classId || o.teacherId === f.teacherId))) {
                return false;
            }

            const dIdx = originalDays.indexOf(f.day);
            const teacher = data.teachers.find(t => t.id === f.teacherId);
            if (teacher?.availability?.[`${dIdx}-${f.slotIndex}`] === 'ND') {
                return false;
            }

            const classroom = data.classes.find(c => c.id === f.classId);
            if (classroom?.timeConstraints?.[`${dIdx}-${f.slotIndex}`] === 'ND') {
                return false;
            }

            const teacherDayCount = candidateList.filter(o => o.day === f.day && o.teacherId === f.teacherId).length;
            const tLimit = teacher?.dailyLimits?.[`${dIdx}`] !== undefined ? teacher.dailyLimits[`${dIdx}`] : slotsPerDay;
            if (teacherDayCount >= tLimit) {
                return false;
            }

            const pigeonMax = maxAllowedDailyLessons[`${f.teacherId}|${f.classId}`] || slotsPerDay;
            const sameTeacherClassDayCount = candidateList.filter(o => o.day === f.day && o.teacherId === f.teacherId && o.classId === f.classId).length;
            if (sameTeacherClassDayCount >= pigeonMax) {
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

                    if (candidateLessons.every(f => isOk(f, currentList))) {
                        return [...currentList, ...candidateLessons];
                    }

                    if (depth < 2) {
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
                            let tempList = currentList.filter(item => !conflictingLessons.includes(item));
                            tempList = [...tempList, ...candidateLessons];

                            let successfullyRelocated = true;
                            for (const displaced of conflictingLessons) {
                                const displacedBlock: Block = {
                                    assignment: {
                                        teacherId: displaced.teacherId,
                                        classId: displaced.classId,
                                        subjectId: displaced.subjectId,
                                        lessons: 1,
                                        grouping: '1 aula'
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

        // Compactação Automática
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
                                fl.day === f.day && fl.slotIndex === f.slotIndex && fl.classId === f.classId && fl.teacherId === f.teacherId
                            ));
                            if (isProtected) return;

                            let safety = 0;
                            while (blk[0].slotIndex > 0 && safety < 20) {
                                safety++;
                                const prev = blk[0].slotIndex - 1;

                                let canMoveBlock = true;
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

        // Fechamento de Janelas de Professores
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
                        fl.day === f.day && fl.slotIndex === f.slotIndex && fl.classId === f.classId && fl.teacherId === f.teacherId
                    ));
                    if (isProtected) return;

                    const prevBlk = teacherBlocks[idx - 1];
                    const gapStart = prevBlk[prevBlk.length - 1].slotIndex + 1;

                    if (blk[0].slotIndex > gapStart) {
                        let canMoveBlock = true;
                        const target = gapStart;

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
    const maxIters = 600;

    if (onProgress) {
        onProgress(3, "Iniciando motor de balanceamento pedagógico...");
    }

    for (let iter = 1; iter <= maxIters; iter++) {
        const attempt = runAttempt();

        if (attempt.score > bestResult.score) {
            bestResult = attempt;
        }

        // Parada antecipada se solução for 100% perfeita sem falhas e com score excelente
        if (bestResult.failures.length === 0 && bestResult.score >= (data.classes.length * 100) + (bestResult.fixedLessons.length * 50)) {
            if (onProgress) onProgress(100, "Grade ideal encontrada com perfeição!");
            break;
        }

        if (iter % 15 === 0 && onProgress) {
            const progress = Math.min(99, Math.round((iter / maxIters) * 100));
            const msg = bestResult.failures.length === 0
                ? `Otimizando janelas e continuidade (${progress}%)...`
                : `Explorando combinações pedagógicas (${progress}%)...`;
            onProgress(progress, msg);
        }
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
