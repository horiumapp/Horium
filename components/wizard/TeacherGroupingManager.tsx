
import React from 'react';
import { Modal } from '../ui/Modal';
import { SetupData } from '../../types';
import { GENERAL_GROUPING_OPTIONS } from '../../constants';

interface TeacherGroupingManagerProps {
    isOpen: boolean;
    onClose: () => void;
    data: SetupData;
    setData: React.Dispatch<React.SetStateAction<SetupData>>;
}

export const TeacherGroupingManager: React.FC<TeacherGroupingManagerProps> = ({ isOpen, onClose, data, setData }) => {

    const handleUpdateGrouping = (teacherId: string, grouping: string) => {
        setData(prev => ({
            ...prev,
            teacherGroupings: {
                ...(prev.teacherGroupings || {}),
                [teacherId]: grouping
            }
        }));
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="lg" className="p-0 overflow-hidden bg-[#89b3f7]">
            {/* Header */}
            <div className="bg-[#89b3f7] p-6 text-center border-b border-black/10">
                <h2 className="text-xl font-bold text-gray-800 uppercase tracking-tight">
                    Informe o Agrupamento Padrão para cada Professor
                </h2>
            </div>

            <div className="p-0 bg-white">
                {/* Table Header */}
                <div className="grid grid-cols-[1fr_2.5fr] bg-primary text-white border-y border-black/20">
                    <div className="px-4 py-2 font-bold border-r border-black/10">Professor</div>
                    <div className="px-4 py-2 font-bold text-center">Número Máximo de Aulas Agrupadas</div>
                </div>

                {/* Table Body */}
                <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {data.teachers.map((teacher, idx) => {
                        const grouping = data.teacherGroupings?.[teacher.id] || "Não Especificado";

                        return (
                            <div
                                key={teacher.id}
                                className={`grid grid-cols-[1fr_2.5fr] items-center border-b border-gray-200 transition-colors ${idx % 2 === 0 ? 'bg-[#dae8fc]' : 'bg-white'}`}
                            >
                                <div className="px-4 py-2 font-bold text-gray-700 border-r border-gray-200 uppercase truncate">
                                    {teacher.name}
                                </div>
                                <div className="px-4 py-2">
                                    <select
                                        value={grouping}
                                        onChange={(e) => handleUpdateGrouping(teacher.id, e.target.value)}
                                        className="w-full border border-gray-300 rounded px-2 pr-8 py-1 text-xs font-bold outline-none focus:ring-1 focus:ring-primary shadow-sm h-8 bg-white appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C/polyline%3E%3C/svg%3E')] bg-[length:14px] bg-[right_8px_center] bg-no-repeat"
                                    >
                                        {GENERAL_GROUPING_OPTIONS.map(o => (
                                            <option key={o} value={o}>{o}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Footer / Close Area */}
            <div className="bg-[#89b3f7] p-2 flex justify-end">
                <button
                    onClick={onClose}
                    className="p-1 hover:bg-black/10 rounded-full transition-colors"
                >
                    <span className="material-symbols-outlined text-gray-700">close</span>
                </button>
            </div>
        </Modal>
    );
};
