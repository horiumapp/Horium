
import { SetupData, FixedLesson, Teacher, ClassRoom, Subject, SchedulingFailure } from '../types';

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

export const generateTimetable = async (
    data: SetupData,
    onProgress?: (progress: number, message: string) => void
): Promise<{ fixedLessons: FixedLesson[], failures: SchedulingFailure[] }> => {

    // Heurística de aprendizado persistente entre tentativas
    const failedAssignmentWeights: Record<string, number> = {};

    const calculateScore = (fixed: FixedLesson[], fails: SchedulingFailure[]) => {
        // Penalidade MASSIVA por aula não alocada
        let score = (data.classes.length * 100) - (fails.reduce((acc, f) => acc + (data.classes.find(c => c.id === f.classId)?.lessonsPerSubject[f.subjectId] || 1), 0) * 5000);

        // Bônus pela quantidade de aulas alocadas
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
                if (gap > 0) score -= (gap * 400); // Penalidade alta para evitar janelas
            }
        });

        // Fragmentação pedagógica (Mesmo dia, mesma turma, mesma disciplina separadas)
        Object.values(classLessons).forEach(lessons => {
            if (lessons.length > 1) {
                // Penalidade para encorajar espalhamento pela semana
                score -= 100;

                lessons.sort((a, b) => a.slotIndex - b.slotIndex);
                for (let i = 1; i < lessons.length; i++) {
                    // Penalidade DRÁSTICA se não forem consecutivas no mesmo dia
                    if (lessons[i].slotIndex !== lessons[i - 1].slotIndex + 1) {
                        score -= 2500;
                    }
                }
            }
        });

        // Nova Regra: Penalidade por sair e voltar para a mesma sala no mesmo dia
        Object.values(teacherClassDayLessons).forEach(lessons => {
            if (lessons.length > 1) {
                lessons.sort((a, b) => a.slotIndex - b.slotIndex);
                for (let i = 1; i < lessons.length; i++) {
                    const gap = lessons[i].slotIndex - lessons[i - 1].slotIndex - 1;
                    if (gap > 0) {
                        score -= (gap * 1500); // Penalidade significativa para evitar o "vai e vem"
                    }
                }
            }
        });

        return score;
    };

    const runAttempt = (): { fixedLessons: FixedLesson[], failures: SchedulingFailure[], score: number } => {
        let currentFixed: FixedLesson[] = [];
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
                                    lessons: classroom.lessonsPerSubject[subjectId] || 0,
                                    grouping: data.assignmentGroupings?.[`${teacher.id}|${classId}|${subjectId}`] || 'Não Especificado'
                                });
                            }
                        }
                    });
                });
            }
        });

        // 2. Calcular Flexibilidade (Ousadia: quanto menos folego, mais cedo agendamos)
        const teacherFlexibility: Record<string, number> = {};
        data.teachers.forEach(t => {
            const availCount = Object.values(t.availability || {}).filter(v => v === 'D' || v === 'IN').length;
            let totalRequestedAulas = 0;
            if (t.classAssignments) {
                Object.entries(t.classAssignments).forEach(([subjectId, classes]) => {
                    Object.entries(classes).forEach(([classId, status]) => {
                        if (status === 'OBRIGATORIAMENTE') {
                            const classroom = data.classes.find(c => c.id === classId);
                            if (classroom) {
                                totalRequestedAulas += classroom.lessonsPerSubject[subjectId] || 0;
                            }
                        }
                    });
                });
            }
            teacherFlexibility[t.id] = totalRequestedAulas > 0 ? availCount / totalRequestedAulas : 999;
        });

        // 3. Decompor em blocos
        const blocks: Block[] = [];
        assignments.forEach(asg => {
            let left = asg.lessons;
            const double = (asg.grouping || '').toLowerCase().match(/dupla|seguida|junta/);
            if (double) {
                let safety = 0;
                while (left >= 2 && safety < 100) { blocks.push({ assignment: asg, size: 2, consecutive: true }); left -= 2; safety++; }
            }
            let safetySingle = 0;
            while (left > 0 && safetySingle < 100) { blocks.push({ assignment: asg, size: 1, consecutive: true }); left--; safetySingle++; }
        });

        const originalDays = data.schedule.map(s => s.day);
        const slotsPerDay = data.schedule[0]?.slots.filter(s => s.type === 'AULA').length || 0;

        const shuffle = <T>(a: T[]) => [...a].sort(() => Math.random() - 0.5);

        // 1.5 Pré-calcular o teto de aulas consecutivas permitido para cada professor em cada turma baseado no Princípio da Casa dos Pombos
        const maxLessonsPerDayClass: Record<string, number> = {};
        
        data.teachers.forEach(t => {
            const availDaysCount = originalDays.filter((_, dIdx) => 
                Array.from({length: slotsPerDay}).some((_, sIdx) => t.availability?.[`${dIdx}-${sIdx}`] !== 'ND')
            ).length || originalDays.length;

            const classLessonsCount: Record<string, number> = {};
            assignments.filter(a => a.teacherId === t.id).forEach(a => {
                classLessonsCount[a.classId] = (classLessonsCount[a.classId] || 0) + a.lessons;
            });

            Object.entries(classLessonsCount).forEach(([classId, total]) => {
                const mathRequiredMax = Math.ceil(total / Math.max(1, availDaysCount));
                maxLessonsPerDayClass[`${t.id}|${classId}`] = Math.max(2, mathRequiredMax);
            });
        });

        const isOk = (day: string, slot: number, asg: Assignment, list: FixedLesson[]): boolean | 'TEACHER_LIMIT' => {
            // Conflito básico (mesmo horário, mesmo professor ou mesma turma)
            if (list.some(f => f.day === day && f.slotIndex === slot && (f.teacherId === asg.teacherId || f.classId === asg.classId))) return false;

            // Restrição 1 e 2: Máximo elástico de tempos do mesmo professor na mesma turma por dia, 
            // e os tempos devem ser estritamente adjacentes (sem buracos / janelas).
            const maxForThisDay = maxLessonsPerDayClass[`${asg.teacherId}|${asg.classId}`] || 2;
            const teacherClassDayLessons = list.filter(f => f.teacherId === asg.teacherId && f.classId === asg.classId && f.day === day);
            if (teacherClassDayLessons.length >= maxForThisDay) return false;
            
            if (teacherClassDayLessons.length >= 1) {
                const isAdjacent = teacherClassDayLessons.some(f => f.slotIndex === slot - 1 || f.slotIndex === slot + 1);
                if (!isAdjacent) return false;
            }

            const dIdx = originalDays.indexOf(day);
            const teacher = data.teachers.find(t => t.id === asg.teacherId);

            // Verificação de disponibilidade (ND = Não Disponível)
            if (teacher?.availability?.[`${dIdx}-${slot}`] === 'ND') return false;
            if (data.classes.find(c => c.id === asg.classId)?.timeConstraints?.[`${dIdx}-${slot}`] === 'ND') return false;

            // Verificação de Limite Diário (dailyLimits)
            const dailyMax = teacher?.dailyLimits?.[dIdx.toString()];
            if (dailyMax !== undefined) {
                const currentLessonsOnDay = list.filter(f => f.teacherId === asg.teacherId && f.day === day).length;
                if (currentLessonsOnDay >= dailyMax) return 'TEACHER_LIMIT';
            }

            return true;
        };

        const tryPlace = (block: Block, list: FixedLesson[], depth = 0, forceConsecutive = true): boolean | 'TEACHER_LIMIT' => {
            const days = shuffle(originalDays).sort((a, b) => {
                const hasA = list.some(f => f.classId === block.assignment.classId && f.subjectId === block.assignment.subjectId && f.day === a);
                const hasB = list.some(f => f.classId === block.assignment.classId && f.subjectId === block.assignment.subjectId && f.day === b);
                if (hasA !== hasB) return hasA ? 1 : -1;

                return list.filter(f => f.teacherId === block.assignment.teacherId && f.day === a).length -
                    list.filter(f => f.teacherId === block.assignment.teacherId && f.day === b).length;
            });

            let hitLimit = false;
            for (const day of days) {
                if (list.filter(f => f.teacherId === block.assignment.teacherId && f.day === day).length + block.size > slotsPerDay) continue;

                const existingOnDay = list.filter(f => f.classId === block.assignment.classId && f.subjectId === block.assignment.subjectId && f.day === day);
                const hasSubjectOnDay = existingOnDay.length > 0;

                for (let i = 0; i <= slotsPerDay - block.size; i++) {
                    // Heurística de Aproximação: se já tem no dia, prioriza colocar grudado (Último caso desativa isso)
                    if (hasSubjectOnDay && forceConsecutive) {
                        const isAdjacent = existingOnDay.some(e => e.slotIndex === i + block.size || e.slotIndex === i - 1);
                        if (!isAdjacent) continue;
                    }

                    let possible: boolean | 'TEACHER_LIMIT' = true;
                    for (let j = 0; j < block.size; j++) {
                        const res = isOk(day, i + j, block.assignment, list);
                        if (res !== true) {
                            if (res === 'TEACHER_LIMIT') hitLimit = true;
                            possible = false;
                            break;
                        }
                    }

                    if (possible === true) {
                        for (let j = 0; j < block.size; j++) list.push({ ...block.assignment, day, slotIndex: i + j });
                        return true;
                    }

                    // Kick-out (Swap) básico para resolver conflitos de "muro"
                    if (depth < 2) {
                        const conflictingIdxs = list.flatMap((f, idx) =>
                            (f.day === day && f.slotIndex >= i && f.slotIndex < i + block.size && (f.teacherId === block.assignment.teacherId || f.classId === block.assignment.classId))
                                ? [idx] : []
                        );

                        if (conflictingIdxs.length > 0 && conflictingIdxs.length <= 3) {
                            const newList = [...list];
                            const filteredList = newList.filter((_, idx) => !conflictingIdxs.includes(idx));

                            let canFitNow = true;
                            for (let j = 0; j < block.size; j++) if (isOk(day, i + j, block.assignment, filteredList) !== true) { canFitNow = false; break; }

                            if (canFitNow) {
                                const victims = conflictingIdxs.map(idx => list[idx]);
                                const tempFinal = [...filteredList];
                                for (let j = 0; j < block.size; j++) tempFinal.push({ ...block.assignment, day, slotIndex: i + j });

                                let allVictimsBack = true;
                                for (const v of victims) {
                                    const vAsg: Assignment = { teacherId: v.teacherId, classId: v.classId, subjectId: v.subjectId, lessons: 1, grouping: 'Não Especificado' };
                                    if (tryPlace({ assignment: vAsg, size: 1, consecutive: true }, tempFinal, depth + 1) !== true) {
                                        allVictimsBack = false;
                                        break;
                                    }
                                }

                                if (allVictimsBack) {
                                    list.length = 0;
                                    list.push(...tempFinal);
                                    return true;
                                }
                            }
                        }
                    }
                }
            }

            // ÚLTIMO RECURSO: Se não conseguiu alocar respeitando a regra de "juntar", tenta de qualquer forma
            if (forceConsecutive && depth === 0) {
                return tryPlace(block, list, 0, false);
            }

            return hitLimit ? 'TEACHER_LIMIT' : false;
        };

        shuffle(blocks).sort((a, b) => {
            const wA = failedAssignmentWeights[`${a.assignment.teacherId}|${a.assignment.classId}|${a.assignment.subjectId}`] || 0;
            const wB = failedAssignmentWeights[`${b.assignment.teacherId}|${b.assignment.classId}|${b.assignment.subjectId}`] || 0;
            if (wA !== wB) return wB - wA;
            const flexA = teacherFlexibility[a.assignment.teacherId] || 999;
            const flexB = teacherFlexibility[b.assignment.teacherId] || 999;
            if (flexA !== flexB) return flexA - flexB;
            return b.size - a.size;
        }).forEach(block => {
            const placement = tryPlace(block, currentFixed);
            if (placement !== true) {
                const reason = placement === 'TEACHER_LIMIT' ? 'TEACHER_LIMIT' : 'NO_AVAILABILITY';
                const details = reason === 'TEACHER_LIMIT'
                    ? 'Limite diário de aulas atingido para este professor.'
                    : 'Sem horários compatíveis entre professor e turma.';

                failures.push({ ...block.assignment, reason, details });
                failedAssignmentWeights[`${block.assignment.teacherId}|${block.assignment.classId}|${block.assignment.subjectId}`] = (failedAssignmentWeights[`${block.assignment.teacherId}|${block.assignment.classId}|${block.assignment.subjectId}`] || 0) + 1;
            }
        });

        // Compactação Automática
        const compact = () => {
            let moved = true;
            let loopCount = 0;
            while (moved && loopCount < 10) {
                loopCount++;
                moved = false;
                data.schedule.forEach(s => {
                    data.classes.forEach(c => {
                        const cl = currentFixed.filter(f => f.day === s.day && f.classId === c.id).sort((a, b) => a.slotIndex - b.slotIndex);
                        
                        // Agrupar aulas consecutivas do mesmo professor na mesma turma em blocos para movê-las juntas
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
                            let safety = 0;
                            while (blk[0].slotIndex > 0 && safety < 20) {
                                safety++;
                                const prev = blk[0].slotIndex - 1;
                                
                                // O novo slot inicial deve estar livre, e os slots seguintes que o bloco ocupará também
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
        data.teachers.forEach(t => {
            data.schedule.forEach(s => {
                const tl = currentFixed.filter(f => f.day === s.day && f.teacherId === t.id).sort((a, b) => a.slotIndex - b.slotIndex);
                
                // Agrupar por turma para não separar dobradinhas
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
                    const prevBlk = teacherBlocks[idx - 1];
                    const gapStart = prevBlk[prevBlk.length - 1].slotIndex + 1;
                    
                    if (blk[0].slotIndex > gapStart) {
                        let canMoveBlock = true;
                        const target = gapStart;
                        
                        for (let i = 0; i < blk.length; i++) {
                            const newSlot = target + i;
                            const f = blk[i];
                            
                            if (currentFixed.some(o => o.day === s.day && o.slotIndex === newSlot && o.classId === f.classId && !blk.includes(o))) {
                                canMoveBlock = false; break;
                            }
                            const dIdx = originalDays.indexOf(s.day);
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
    const maxIters = 1000;
    const batch = 2;

    for (let i = 0; i < maxIters; i += batch) {
        const currentProgress = Math.floor((i / maxIters) * 100);
        let message = "Otimizando distribuição...";
        if (currentProgress < 30) message = "Validando cargas horárias...";
        else if (currentProgress < 70) message = "Eliminando conflitos de professores...";

        onProgress?.(currentProgress, message);
        await new Promise(r => setTimeout(r, 0)); // Yield to main thread

        for (let j = 0; j < batch; j++) {
            const res = runAttempt();
            if (res.score > bestResult.score) {
                bestResult = res;
            }
            // Condição de parada: nenhuma falha e score satisfatório
            if (res.failures.length === 0 && res.score > (data.classes.length * 50)) {
                i = maxIters; break;
            }
        }
    }

    onProgress?.(100, "Grade de horários concluída!");
    return { fixedLessons: bestResult.fixedLessons, failures: bestResult.failures };
};
