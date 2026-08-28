
import React from 'react';
import { Modal } from '../ui/Modal';
import { SetupData } from '../../types';

interface TeacherSegmentationManagerProps {
    isOpen: boolean;
    onClose: () => void;
    data: SetupData;
}

export const TeacherSegmentationManager: React.FC<TeacherSegmentationManagerProps> = ({ isOpen, onClose, data }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} size="lg" className="p-0 overflow-hidden bg-white border-2 border-[#3b82f6]">
            {/* Header: Exact style from didactic but with new title */}
            <div className="bg-[#5c92d1] p-2 flex justify-between items-center px-4 border-b-2 border-primary/20">
                <h2 className="text-xl font-bold text-yellow-400 tracking-tight">
                    Segmentação de Professor
                </h2>
                <button onClick={onClose} className="hover:scale-110 transition-transform">
                    <div className="bg-black rounded-full p-1 border-2 border-white flex items-center justify-center w-8 h-8">
                        <span className="material-symbols-outlined text-white text-xl font-black">close</span>
                    </div>
                </button>
            </div>

            <div className="p-8 pb-12 bg-white flex flex-col items-center gap-6">
                <p className="text-[#3a86ff]/60 font-medium text-lg mb-4">
                    Selecione o professor
                </p>

                <div className="w-full max-w-sm flex flex-col gap-2 max-h-[40vh] overflow-y-auto px-4 custom-scrollbar">
                    {data.teachers.map((teacher) => (
                        <button
                            key={teacher.id}
                            className="w-full bg-[#87ace0] hover:bg-[#7299d1] text-white py-4 px-6 rounded-2xl shadow-sm font-bold text-lg transition-all hover:scale-[1.02] active:scale-95 border border-black/5 text-center"
                        >
                            {teacher.name}
                        </button>
                    ))}
                </div>

                <button
                    onClick={onClose}
                    className="mt-8 flex items-center gap-2 bg-[#e0e0e0] hover:bg-gray-200 text-gray-700 px-6 py-2 rounded border border-gray-400 font-bold uppercase text-sm shadow-sm transition-colors"
                >
                    <span className="material-symbols-outlined text-base">arrow_back_ios</span>
                    Cancelar
                </button>
            </div>
        </Modal>
    );
};
