import { SetupData } from '../types';

const STORAGE_KEY = 'horium_schedules';

export const storageService = {
    saveSchedule: (data: SetupData): SetupData[] => {
        const schedules = storageService.getAllSchedules();
        const now = new Date().toISOString();

        let updatedSchedules: SetupData[];

        if (data.id) {
            // Update existing
            updatedSchedules = schedules.map(s =>
                s.id === data.id ? { ...data, updatedAt: now } : s
            );
        } else {
            // Create new
            const newSchedule: SetupData = {
                ...data,
                id: crypto.randomUUID(),
                createdAt: now,
                status: 'Finalizado' // Default status for new creations that reach the list
            };
            updatedSchedules = [newSchedule, ...schedules];
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSchedules));
        return updatedSchedules;
    },

    getAllSchedules: (): SetupData[] => {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    },

    deleteSchedule: (id: string): SetupData[] => {
        const schedules = storageService.getAllSchedules();
        const filtered = schedules.filter(s => s.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
        return filtered;
    },

    getScheduleById: (id: string): SetupData | undefined => {
        const schedules = storageService.getAllSchedules();
        return schedules.find(s => s.id === id);
    }
};
