import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { SetupData } from '../types';
import { DAYS_OF_WEEK } from '../constants';

/**
 * Service to handle Export to Excel (XLSX) with styling
 */
export const excelService = {
    /**
     * Helper to convert HEX color to ARGB for ExcelJS
     */
    hexToARGB: (hex: string) => {
        if (!hex) return 'FFFFFFFF';
        return 'FF' + hex.replace('#', '').toUpperCase();
    },

    /**
     * Generates a styled Excel for the specified view mode (TEACHER or CLASS)
     */
    exportEntityView: async (viewMode: 'TEACHER' | 'CLASS', selectedId: string, data: SetupData) => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Horário');

        const entityName = viewMode === 'CLASS'
            ? data.classes.find(c => c.id === selectedId)?.name
            : data.teachers.find(t => t.id === selectedId)?.name;

        // Title row
        const titleCell = worksheet.getCell('A1');
        titleCell.value = `HORÁRIO - ${entityName || 'GERAL'}`;
        titleCell.font = { name: 'Arial Black', size: 16, color: { argb: 'FF136DEC' } };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        worksheet.mergeCells(`A1:${String.fromCharCode(65 + DAYS_OF_WEEK.length)}1`);
        worksheet.getRow(1).height = 40;

        // Header row
        const headerRow = worksheet.getRow(3);
        headerRow.values = ['HORA', ...DAYS_OF_WEEK];
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
        headerRow.height = 25;

        headerRow.eachCell((cell) => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF136DEC' }
            };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FF000000' } },
                left: { style: 'thin', color: { argb: 'FF000000' } },
                bottom: { style: 'thin', color: { argb: 'FF000000' } },
                right: { style: 'thin', color: { argb: 'FF000000' } }
            };
        });

        const lessons = data.schedule[0].slots.filter(s => s.type === 'AULA');

        lessons.forEach((lesson, idx) => {
            const excelRow = worksheet.getRow(idx + 4);

            DAYS_OF_WEEK.forEach((day, dayIdx) => {
                const lessonData = data.fixedLessons?.find(fl =>
                    fl.day === day &&
                    fl.slotIndex === idx &&
                    (viewMode === 'CLASS' ? fl.classId === selectedId : fl.teacherId === selectedId)
                );

                const cell = excelRow.getCell(dayIdx + 2);

                if (lessonData) {
                    const subject = data.subjects.find(s => s.id === lessonData.subjectId);
                    const otherEntity = viewMode === 'CLASS'
                        ? data.teachers.find(t => t.id === lessonData.teacherId)?.name
                        : data.classes.find(c => c.id === lessonData.classId)?.name;

                    cell.value = `${subject?.shortName || subject?.name || ''}\n(${otherEntity || ''})`;
                    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

                    if (subject?.color) {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: excelService.hexToARGB(subject.color) }
                        };
                        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
                    }
                } else {
                    cell.value = '-';
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFF9FAFB' }
                    };
                    cell.font = { color: { argb: 'FF9CA3AF' } };
                }

                cell.border = {
                    top: { style: 'thin', color: { argb: 'FF000000' } },
                    left: { style: 'thin', color: { argb: 'FF000000' } },
                    bottom: { style: 'thin', color: { argb: 'FF000000' } },
                    right: { style: 'thin', color: { argb: 'FF000000' } }
                };
            });

            const timeCell = excelRow.getCell(1);
            timeCell.value = {
                richText: [
                    { font: { bold: true, size: 10, color: { argb: 'FF111418' } }, text: `${lesson.start} - ${lesson.end}\n` },
                    { font: { bold: true, size: 8, color: { argb: 'FF9CA3AF' } }, text: `${idx + 1}º AULA` }
                ]
            };
            timeCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            timeCell.border = {
                top: { style: 'thin', color: { argb: 'FF000000' } },
                left: { style: 'thin', color: { argb: 'FF000000' } },
                bottom: { style: 'thin', color: { argb: 'FF000000' } },
                right: { style: 'thin', color: { argb: 'FF000000' } }
            };
            excelRow.height = 45;
        });

        // Column widths
        worksheet.getColumn(1).width = 15;
        for (let i = 2; i <= DAYS_OF_WEEK.length + 1; i++) {
            worksheet.getColumn(i).width = 20;
        }

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `Horário - ${entityName || 'Geral'}.xlsx`);
    },

    /**
     * Generates a styled Excel for the Weekly view (All classes as columns)
     */
    exportWeeklyView: async (dayIndex: number, data: SetupData) => {
        const dayName = DAYS_OF_WEEK[dayIndex];
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(`Semanal - ${dayName}`);

        const sortedClasses = [...data.classes].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
        const lessons = data.schedule[0].slots.filter(s => s.type === 'AULA');

        // Title row
        const titleCell = worksheet.getCell('A1');
        titleCell.value = `RELATÓRIO SEMANAL - ${dayName.toUpperCase()}`;
        titleCell.font = { name: 'Arial Black', size: 16, color: { argb: 'FF136DEC' } };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        worksheet.mergeCells(`A1:${String.fromCharCode(65 + sortedClasses.length)}1`);
        worksheet.getRow(1).height = 40;

        // Header row
        const headerRow = worksheet.getRow(3);
        headerRow.values = ['HORA', ...sortedClasses.map(c => c.name)];
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
        headerRow.height = 25;

        headerRow.eachCell((cell) => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF136DEC' }
            };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FF000000' } },
                left: { style: 'thin', color: { argb: 'FF000000' } },
                bottom: { style: 'thin', color: { argb: 'FF000000' } },
                right: { style: 'thin', color: { argb: 'FF000000' } }
            };
        });

        lessons.forEach((lesson, idx) => {
            const excelRow = worksheet.getRow(idx + 4);

            sortedClasses.forEach((cls, clsIdx) => {
                const lessonData = data.fixedLessons?.find(fl =>
                    fl.day === dayName &&
                    fl.slotIndex === idx &&
                    fl.classId === cls.id
                );

                const cell = excelRow.getCell(clsIdx + 2);

                if (lessonData) {
                    const subject = data.subjects.find(s => s.id === lessonData.subjectId);
                    const teacher = data.teachers.find(t => t.id === lessonData.teacherId);

                    cell.value = `${subject?.shortName || subject?.name || ''}\n(${teacher?.name || ''})`;
                    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

                    if (subject?.color) {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: excelService.hexToARGB(subject.color) }
                        };
                        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
                    }
                } else {
                    cell.value = '-';
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFF9FAFB' }
                    };
                    cell.font = { color: { argb: 'FF9CA3AF' } };
                }

                cell.border = {
                    top: { style: 'thin', color: { argb: 'FF000000' } },
                    left: { style: 'thin', color: { argb: 'FF000000' } },
                    bottom: { style: 'thin', color: { argb: 'FF000000' } },
                    right: { style: 'thin', color: { argb: 'FF000000' } }
                };
            });

            const timeCell = excelRow.getCell(1);
            timeCell.value = {
                richText: [
                    { font: { bold: true, size: 10, color: { argb: 'FF111418' } }, text: `${lesson.start} - ${lesson.end}\n` },
                    { font: { bold: true, size: 8, color: { argb: 'FF9CA3AF' } }, text: `${idx + 1}º AULA` }
                ]
            };
            timeCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            timeCell.border = {
                top: { style: 'thin', color: { argb: 'FF000000' } },
                left: { style: 'thin', color: { argb: 'FF000000' } },
                bottom: { style: 'thin', color: { argb: 'FF000000' } },
                right: { style: 'thin', color: { argb: 'FF000000' } }
            };
            excelRow.height = 45;
        });

        // Column widths
        worksheet.getColumn(1).width = 15;
        for (let i = 2; i <= sortedClasses.length + 1; i++) {
            worksheet.getColumn(i).width = 18;
        }

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `Relatório Semanal - ${dayName}.xlsx`);
    }
};
