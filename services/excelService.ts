import writeXlsxFile, { Row, Cell } from 'write-excel-file/browser';
import { saveAs } from 'file-saver';
import { SetupData } from '../types';
import { DAYS_OF_WEEK } from '../constants';
import { ensureScheduleSlots } from './scheduleService';
import { teacherColorMap } from '../utils/teacherColors';

/**
 * Formats a color string to valid 6-digit hex (#RRGGBB)
 */
const formatHexColor = (color?: string, fallback = '#FFFFFF'): string => {
    if (!color) return fallback;
    const clean = color.replace('#', '').trim();
    if (clean.length === 3) {
        return `#${clean[0]}${clean[0]}${clean[1]}${clean[1]}${clean[2]}${clean[2]}`;
    }
    if (clean.length === 6) {
        return `#${clean}`;
    }
    return fallback;
};

/**
 * Computes contrast text color (black or white) based on background luminance
 */
const getContrastTextColor = (hexColor: string): string => {
    const hex = hexColor.replace('#', '');
    if (hex.length === 6) {
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        const yiq = (r * 299 + g * 587 + b * 114) / 1000;
        return yiq >= 150 ? '#000000' : '#FFFFFF';
    }
    return '#FFFFFF';
};

/**
 * Service to handle Export to Excel (XLSX) with styling
 */
export const excelService = {
    /**
     * Helper to convert HEX color to ARGB (maintained for backward compatibility)
     */
    hexToARGB: (hex: string) => {
        if (!hex) return 'FFFFFFFF';
        return 'FF' + hex.replace('#', '').toUpperCase();
    },

    /**
     * Generates a styled Excel for the specified view mode (TEACHER or CLASS)
     */
    exportEntityView: async (viewMode: 'TEACHER' | 'CLASS', selectedId: string, data: SetupData) => {
        const normalizedData = ensureScheduleSlots(data);
        const activeDays = normalizedData.weekConfig?.activeDays && normalizedData.weekConfig.activeDays.length > 0
            ? normalizedData.weekConfig.activeDays
            : DAYS_OF_WEEK;

        const entityName = viewMode === 'CLASS'
            ? normalizedData.classes.find(c => c.id === selectedId)?.name
            : normalizedData.teachers.find(t => t.id === selectedId)?.name;

        const totalCols = 1 + activeDays.length;

        // Title row (Row 1)
        const titleRow: Row = [
            {
                value: `HORÁRIO - ${entityName || 'GERAL'}`,
                fontWeight: 'bold',
                fontSize: 16,
                textColor: '#136DEC',
                align: 'center',
                alignVertical: 'center',
                columnSpan: totalCols,
                height: 40,
            },
            ...Array(totalCols - 1).fill(null)
        ];

        // Empty spacing row (Row 2)
        const emptyRow: Row = [
            {
                value: '',
                columnSpan: totalCols,
                height: 12,
            },
            ...Array(totalCols - 1).fill(null)
        ];

        // Header row (Row 3)
        const headerRow: Row = [
            {
                value: 'HORA',
                fontWeight: 'bold',
                textColor: '#FFFFFF',
                backgroundColor: '#136DEC',
                align: 'center',
                alignVertical: 'center',
                borderColor: '#000000',
                borderStyle: 'thin',
                height: 25,
            },
            ...activeDays.map(day => ({
                value: day,
                fontWeight: 'bold' as const,
                textColor: '#FFFFFF',
                backgroundColor: '#136DEC',
                align: 'center' as const,
                alignVertical: 'center' as const,
                borderColor: '#000000',
                borderStyle: 'thin' as const,
                height: 25,
            }))
        ];

        const lessons = data.schedule?.[0]?.slots?.filter(s => s.type === 'AULA') || [];
        const teacherColors = teacherColorMap(normalizedData.teachers);

        const lessonRows: Row[] = lessons.map((lesson, idx) => {
            const timeCell: Cell = {
                value: `${lesson.start} - ${lesson.end}\n${idx + 1}ª AULA`,
                fontWeight: 'bold',
                align: 'center',
                alignVertical: 'center',
                wrap: true,
                borderColor: '#000000',
                borderStyle: 'thin',
                height: 45,
                fontSize: 10,
            };

            const dayCells: Cell[] = activeDays.map(day => {
                const lessonData = data.fixedLessons?.find(fl =>
                    fl.day === day &&
                    fl.slotIndex === idx &&
                    (viewMode === 'CLASS' ? fl.classId === selectedId : fl.teacherId === selectedId)
                );

                if (lessonData) {
                    const subject = data.subjects.find(s => s.id === lessonData.subjectId);
                    const otherEntity = viewMode === 'CLASS'
                        ? data.teachers.find(t => t.id === lessonData.teacherId)?.name
                        : data.classes.find(c => c.id === lessonData.classId)?.name;

                    const subjectName = subject?.shortName || subject?.name || '';
                    const entityLabel = otherEntity ? `\n(${otherEntity})` : '';
                    const bgColor = formatHexColor(teacherColors.get(lessonData.teacherId), '#FFFFFF');
                    const textColor = getContrastTextColor(bgColor);

                    return {
                        value: `${subjectName}${entityLabel}`,
                        align: 'center',
                        alignVertical: 'center',
                        wrap: true,
                        backgroundColor: bgColor,
                        textColor: textColor,
                        fontWeight: 'bold',
                        fontSize: 9,
                        borderColor: '#000000',
                        borderStyle: 'thin',
                    };
                }

                return {
                    value: '-',
                    align: 'center',
                    alignVertical: 'center',
                    backgroundColor: '#F9FAFB',
                    textColor: '#9CA3AF',
                    borderColor: '#000000',
                    borderStyle: 'thin',
                };
            });

            return [timeCell, ...dayCells];
        });

        const columns = [
            { width: 15 },
            ...activeDays.map(() => ({ width: 20 }))
        ];

        const blob = await writeXlsxFile([titleRow, emptyRow, headerRow, ...lessonRows], {
            sheet: 'Horário',
            columns,
        }).toBlob();

        saveAs(blob, `Horário - ${entityName || 'Geral'}.xlsx`);
    },

    /**
     * Gera um único Excel da semana, com uma planilha para cada dia.
     */
    exportWeeklyView: async (data: SetupData) => {
        const normalizedData = ensureScheduleSlots(data);
        const activeDays = normalizedData.weekConfig?.activeDays && normalizedData.weekConfig.activeDays.length > 0
            ? normalizedData.weekConfig.activeDays
            : DAYS_OF_WEEK;
        const sortedClasses = [...normalizedData.classes].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
        const totalCols = 1 + sortedClasses.length;
        const lessons = normalizedData.schedule?.[0]?.slots?.filter(s => s.type === 'AULA') || [];
        const teacherColors = teacherColorMap(normalizedData.teachers);
        const columns = [
            { width: 15 },
            ...sortedClasses.map(() => ({ width: 18 }))
        ];
        const usedSheetNames = new Set<string>();

        const sheets = activeDays.map((dayName, dayIndex) => {
            const titleRow: Row = [
                {
                    value: `HORÁRIO - ${dayName.toUpperCase()}`,
                    fontWeight: 'bold',
                    fontSize: 16,
                    textColor: '#136DEC',
                    align: 'center',
                    alignVertical: 'center',
                    columnSpan: totalCols,
                    height: 40,
                },
                ...Array(totalCols - 1).fill(null)
            ];

            const emptyRow: Row = [
                {
                    value: '',
                    columnSpan: totalCols,
                    height: 12,
                },
                ...Array(totalCols - 1).fill(null)
            ];

            const headerRow: Row = [
                {
                    value: 'HORA',
                    fontWeight: 'bold',
                    textColor: '#FFFFFF',
                    backgroundColor: '#136DEC',
                    align: 'center',
                    alignVertical: 'center',
                    borderColor: '#000000',
                    borderStyle: 'thin',
                    height: 25,
                },
                ...sortedClasses.map(c => ({
                    value: c.name,
                    fontWeight: 'bold' as const,
                    textColor: '#FFFFFF',
                    backgroundColor: '#136DEC',
                    align: 'center' as const,
                    alignVertical: 'center' as const,
                    borderColor: '#000000',
                    borderStyle: 'thin' as const,
                    height: 25,
                }))
            ];

            const lessonRows: Row[] = lessons.map((lesson, idx) => {
                const timeCell: Cell = {
                    value: `${lesson.start} - ${lesson.end}\n${idx + 1}ª AULA`,
                    fontWeight: 'bold',
                    align: 'center',
                    alignVertical: 'center',
                    wrap: true,
                    borderColor: '#000000',
                    borderStyle: 'thin',
                    height: 45,
                    fontSize: 10,
                };

                const classCells: Cell[] = sortedClasses.map(cls => {
                    const lessonData = normalizedData.fixedLessons?.find(fl =>
                        fl.day === dayName &&
                        fl.slotIndex === idx &&
                        fl.classId === cls.id
                    );

                    if (lessonData) {
                        const subject = normalizedData.subjects.find(s => s.id === lessonData.subjectId);
                        const teacher = normalizedData.teachers.find(t => t.id === lessonData.teacherId);

                        const subjectName = subject?.shortName || subject?.name || '';
                        const teacherName = teacher?.name ? `\n(${teacher.name})` : '';
                        const bgColor = formatHexColor(teacherColors.get(lessonData.teacherId), '#FFFFFF');
                        const textColor = getContrastTextColor(bgColor);

                        return {
                            value: `${subjectName}${teacherName}`,
                            align: 'center' as const,
                            alignVertical: 'center' as const,
                            wrap: true,
                            backgroundColor: bgColor,
                            textColor: textColor,
                            fontWeight: 'bold' as const,
                            fontSize: 9,
                            borderColor: '#000000',
                            borderStyle: 'thin' as const,
                        };
                    }

                    return {
                        value: '-',
                        align: 'center' as const,
                        alignVertical: 'center' as const,
                        backgroundColor: '#F9FAFB',
                        textColor: '#9CA3AF',
                        borderColor: '#000000',
                        borderStyle: 'thin' as const,
                    };
                });

                return [timeCell, ...classCells];
            });

            let sheetName = (dayName || `Dia ${dayIndex + 1}`).slice(0, 31);
            if (usedSheetNames.has(sheetName)) sheetName = `${sheetName.slice(0, 28)} ${dayIndex + 1}`;
            usedSheetNames.add(sheetName);

            return {
                data: [titleRow, emptyRow, headerRow, ...lessonRows],
                sheet: sheetName,
                columns,
                orientation: 'landscape' as const,
            };
        });

        const blob = await writeXlsxFile(sheets).toBlob();
        saveAs(blob, 'Horário - Semana.xlsx');
    }
};
