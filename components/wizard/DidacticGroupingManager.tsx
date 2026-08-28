
import React from 'react';
import { Modal } from '../ui/Modal';

interface DidacticGroupingManagerProps {
    isOpen: boolean;
    onClose: () => void;
}

export const DidacticGroupingManager: React.FC<DidacticGroupingManagerProps> = ({ isOpen, onClose }) => {
    const rules = [
        "Não permitir disciplinas nas mesmas turmas no mesmo dia",
        "Não permitir disciplinas em sequencia nas mesmas turmas no mesmo dia",
        "Obrigar disciplina em determinado horario ou dia da semana",
        "Bloquear disciplina em determinado horario ou dia da semana"
    ];

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="lg" className="p-0 overflow-hidden bg-white border-2 border-[#3b82f6]">
            {/* Custom Header from Mockup */}
            <div className="bg-[#5c92d1] p-2 flex justify-between items-center px-4 border-b-2 border-primary/20">
                <h2 className="text-xl font-bold text-yellow-400 tracking-tight">
                    Agrupamento didático
                </h2>
                <button onClick={onClose} className="hover:scale-110 transition-transform">
                    <div className="bg-black rounded-full p-1 border-2 border-white flex items-center justify-center w-8 h-8">
                        <span className="material-symbols-outlined text-white text-xl font-black">close</span>
                    </div>
                </button>
            </div>

            <div className="p-8 pb-12 bg-white flex flex-col items-center gap-6">
                <p className="text-[#3a86ff]/60 font-medium text-lg mb-4">
                    Escolha o tipo de regra que deseja inserir:
                </p>

                <div className="w-full flex flex-col gap-4">
                    {rules.map((rule, idx) => (
                        <button
                            key={idx}
                            className="w-full bg-[#38b2ac] hover:bg-[#319795] text-white py-4 px-6 rounded-2xl shadow-md font-bold text-base transition-all hover:scale-[1.01] active:scale-95 border border-black/10 text-center leading-tight uppercase tracking-wide"
                        >
                            {rule}
                        </button>
                    ))}
                </div>
            </div>
        </Modal>
    );
};
