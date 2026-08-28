
import React from 'react';
import { Modal } from '../ui/Modal';
import { SetupData } from '../../types';
import { GENERAL_GROUPING_OPTIONS } from '../../constants';

interface SubjectGroupingManagerProps {
    isOpen: boolean;
    onClose: () => void;
    data: SetupData;
    setData: React.Dispatch<React.SetStateAction<SetupData>>;
}

export const SubjectGroupingManager: React.FC<SubjectGroupingManagerProps> = ({ isOpen, onClose, data, setData }) => {

    const handleUpdateGrouping = (subjectId: string, grouping: string) => {
        setData(prev => ({
            ...prev,
            subjectGroupings: {
                ...(prev.subjectGroupings || {}),
                [subjectId]: grouping
            }
        }));
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="lg" className="p-0 overflow-hidden bg-[#a6b87d]">
            {/* Header */}
            <div className="bg-[#a6b87d] p-6 text-center border-b border-black/10">
                <h2 className="text-xl font-bold text-[#2d4d29] uppercase tracking-tight">
                    Informe o número máximo de aulas seguidas para cada Matéria ou Reunião
                </h2>
            </div>

            <div className="p-0 bg-[#a6cc72]">
                {/* Table Header */}
                <div className="grid grid-cols-[1.2fr_2fr] bg-[#7a9565] text-gray-800 border-y border-black/20 text-sm">
                    <div className="px-4 py-2 font-bold border-r border-black/10">Matéria ou Reunião</div>
                    <div className="px-4 py-2 font-bold text-center">Escolha a configuração</div>
                </div>

                {/* Table Body */}
                <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {data.subjects.map((subject, idx) => {
                        const grouping = data.subjectGroupings?.[subject.id] || "Não Especificado";

                        return (
                            <div
                                key={subject.id}
                                className={`grid grid-cols-[1.2fr_2fr] items-center border-b border-black/5 transition-colors ${idx % 2 === 0 ? 'bg-[#a6cc72]' : 'bg-[#96bc62]'}`}
                            >
                                <div className="px-4 py-2 font-black text-[#2d4d29] border-r border-black/5 uppercase truncate">
                                    {subject.name}
                                </div>
                                <div className="px-4 py-2">
                                    <select
                                        value={grouping}
                                        onChange={(e) => handleUpdateGrouping(subject.id, e.target.value)}
                                        className="w-full border border-gray-400 rounded px-2 pr-8 py-1 text-xs font-bold outline-none focus:ring-1 focus:ring-green-600 shadow-sm h-8 bg-white appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C/polyline%3E%3C/svg%3E')] bg-[length:14px] bg-[right_8px_center] bg-no-repeat"
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
            <div className="bg-[#a6b87d] p-2 flex justify-end">
                <button
                    onClick={onClose}
                    className="p-1 hover:bg-black/10 rounded-full transition-colors"
                >
                    <span className="material-symbols-outlined text-[#2d4d29]">close</span>
                </button>
            </div>
        </Modal>
    );
};
