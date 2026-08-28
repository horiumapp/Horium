import writeXlsxFile, { Row, Cell } from 'write-excel-file/browser';
import { saveAs } from 'file-saver';
import { SetupData } from '../types';
import { DAYS_OF_WEEK } from '../constants';

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
        const activeDays = data.weekConfig?.activeDays && data.weekConfig.activeDays.length > 0
            ? data.weekConfig.activeDays
            : DAYS_OF_WEEK;

        const entityName = viewMode === 'CLASS'
            ? data.classes.find(c => c.id === selectedId)?.name
            : data.teachers.find(t => t.id === selectedId)?.name;

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
                    const hasColor = Boolean(subject?.color);
                    const bgColor = hasColor ? formatHexColor(subject!.color) : '#FFFFFF';
                    const textColor = hasColor ? getContrastTextColor(bgColor) : '#000000';

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
     * Generates a styled Excel for the Weekly view (All classes as columns)
     */
    exportWeeklyView: async (dayIndex: number, data: SetupData) => {
        const activeDays = data.weekConfig?.activeDays && data.weekConfig.activeDays.length > 0
            ? data.weekConfig.activeDays
            : DAYS_OF_WEEK;
        const dayName = activeDays[dayIndex] || DAYS_OF_WEEK[dayIndex] || 'Dia';
        const sortedClasses = [...data.classes].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
        const totalCols = 1 + sortedClasses.length;

        // Title row (Row 1)
        const titleRow: Row = [
            {
                value: `RELATÓRIO SEMANAL - ${dayName.toUpperCase()}`,
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

        const lessons = data.schedule?.[0]?.slots?.filter(s => s.type === 'AULA') || [];

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
                const lessonData = data.fixedLessons?.find(fl =>
                    fl.day === dayName &&
                    fl.slotIndex === idx &&
                    fl.classId === cls.id
                );

                if (lessonData) {
                    const subject = data.subjects.find(s => s.id === lessonData.subjectId);
                    const teacher = data.teachers.find(t => t.id === lessonData.teacherId);

                    const subjectName = subject?.shortName || subject?.name || '';
                    const teacherName = teacher?.name ? `\n(${teacher.name})` : '';
                    const hasColor = Boolean(subject?.color);
                    const bgColor = hasColor ? formatHexColor(subject!.color) : '#FFFFFF';
                    const textColor = hasColor ? getContrastTextColor(bgColor) : '#000000';

                    return {
                        value: `${subjectName}${teacherName}`,
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

            return [timeCell, ...classCells];
        });

        const columns = [
            { width: 15 },
            ...sortedClasses.map(() => ({ width: 18 }))
        ];

        const blob = await writeXlsxFile([titleRow, emptyRow, headerRow, ...lessonRows], {
            sheet: `Semanal - ${dayName}`,
            columns,
        }).toBlob();

        saveAs(blob, `Relatório Semanal - ${dayName}.xlsx`);
    }
};
