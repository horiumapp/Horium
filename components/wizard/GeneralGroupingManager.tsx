
import React from 'react';
import { Modal } from '../ui/Modal';
import { SetupData } from '../../types';
import { GENERAL_GROUPING_OPTIONS } from '../../constants';

interface GeneralGroupingManagerProps {
    isOpen: boolean;
    onClose: () => void;
    data: SetupData;
    setData: React.Dispatch<React.SetStateAction<SetupData>>;
}

export const GeneralGroupingManager: React.FC<GeneralGroupingManagerProps> = ({ isOpen, onClose, data, setData }) => {

    const grouping = data.generalGrouping || "Agrupar no máximo 2 aulas por dia SEGUIDAS";

    const handleUpdateGrouping = (value: string) => {
        setData(prev => ({
            ...prev,
            generalGrouping: value
        }));
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="md" className="p-0 overflow-hidden bg-[#a6cc72]">
            {/* Header Area */}
            <div className="bg-[#a6cc72] p-8 flex flex-col items-center gap-6">
                <div className="bg-[#7a9565] p-3 px-6 border border-black/20 w-full">
                    <h2 className="text-xl font-bold text-gray-800 uppercase tracking-tight text-center">
                        Informe a configuração de AGRUPAMENTO GERAL:
                    </h2>
                </div>

                <div className="w-full px-4">
                    <select
                        value={grouping}
                        onChange={(e) => handleUpdateGrouping(e.target.value)}
                        className="w-full border border-gray-400 rounded px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-green-600 shadow-sm h-10 bg-white appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C/polyline%3E%3C/svg%3E')] bg-[length:16px] bg-[right_12px_center] bg-no-repeat uppercase"
                    >
                        {GENERAL_GROUPING_OPTIONS.map(o => (
                            <option key={o} value={o}>{o}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Close Bar */}
            <div className="bg-[#a6cc72] p-2 flex justify-end border-t border-black/5">
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
