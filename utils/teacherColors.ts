export interface TeacherColorSource {
    id: string;
    name: string;
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
    const sat = saturation / 100;
    const lig = lightness / 100;
    const chroma = (1 - Math.abs(2 * lig - 1)) * sat;
    const sector = hue / 60;
    const x = chroma * (1 - Math.abs((sector % 2) - 1));
    let red = 0;
    let green = 0;
    let blue = 0;
    if (sector < 1) [red, green, blue] = [chroma, x, 0];
    else if (sector < 2) [red, green, blue] = [x, chroma, 0];
    else if (sector < 3) [red, green, blue] = [0, chroma, x];
    else if (sector < 4) [red, green, blue] = [0, x, chroma];
    else if (sector < 5) [red, green, blue] = [x, 0, chroma];
    else [red, green, blue] = [chroma, 0, x];
    const match = lig - chroma / 2;
    const channel = (value: number) => Math.round((value + match) * 255).toString(16).padStart(2, '0');
    return `#${channel(red)}${channel(green)}${channel(blue)}`.toUpperCase();
}

/** Uma cor clara e exclusiva por professor, estável pelo nome. Serve para a grade, a impressão e o Excel. */
export function teacherColorMap(teachers: TeacherColorSource[]): Map<string, string> {
    const ordered = [...teachers].sort((a, b) =>
        a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }) || a.id.localeCompare(b.id)
    );
    const colors = new Map<string, string>();
    ordered.forEach((teacher, index) => {
        const hue = Math.round((index * 137.508) % 360);
        colors.set(teacher.id, hslToHex(hue, 58, 80));
    });
    return colors;
}
