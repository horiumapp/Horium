import { describe, expect, it } from 'vitest';
import { teacherColorMap } from '../teacherColors';

describe('teacherColorMap', () => {
    it('gives each teacher a different pastel color', () => {
        const teachers = Array.from({ length: 40 }, (_, index) => ({
            id: `t${index}`,
            name: `Professor ${String(index).padStart(2, '0')}`
        }));
        const colors = [...teacherColorMap(teachers).values()];
        expect(new Set(colors).size).toBe(40);
        colors.forEach(color => expect(color).toMatch(/^#[0-9A-F]{6}$/));
    });

    it('keeps the same color when the teacher list changes order', () => {
        const first = teacherColorMap([
            { id: 'a', name: 'Zaira' },
            { id: 'b', name: 'Afimar' }
        ]);
        const second = teacherColorMap([
            { id: 'b', name: 'Afimar' },
            { id: 'a', name: 'Zaira' }
        ]);
        expect(first.get('a')).toBe(second.get('a'));
        expect(first.get('b')).toBe(second.get('b'));
        expect(first.get('a')).not.toBe(first.get('b'));
    });
});
