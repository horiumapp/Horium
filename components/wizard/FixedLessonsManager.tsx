
import React, { useState, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { SetupData, FixedLesson, Subject, Teacher, ClassRoom } from '../../types';
import { DAYS_OF_WEEK } from '../../constants';

interface FixedLessonsManagerProps {
    isOpen: boolean;
    onClose: () => void;
    data: SetupData;
    setData: React.Dispatch<React.SetStateAction<SetupData>>;
    gridRows: any[];
}

export const FixedLessonsManager: React.FC<FixedLessonsManagerProps> = ({ isOpen, onClose, data, setData, gridRows }) => {
    const formatTime = (totalMinutes: number) => {
        const h = Math.floor(totalMinutes / 60) % 24;
        const m = totalMinutes % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };
    const [activeTab, setActiveTab] = useState<'classes' | 'teachers'>('classes');
    const [selectedClassId, setSelectedClassId] = useState<string | null>(data.classes[0]?.id || null);
    const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
    const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Active selection objects
    const selectedClass = useMemo(() => data.classes.find(c => c.id === selectedClassId), [data.classes, selectedClassId]);
    const subjectsInSelectedClass = useMemo(() => {
        if (!selectedClass) return [];
        return data.subjects.filter(s => selectedClass.subjects.includes(s.id));
    }, [data.subjects, selectedClass]);

    // Allocation counts
    const getAllocatedCount = (subId: string) => {
        if (!selectedClassId) return 0;
        return (data.fixedLessons || []).filter(fl => fl.classId === selectedClassId && fl.subjectId === subId).length;
    };

    const handleSelectSubject = (subId: string) => {
        setSelectedSubjectId(subId);
        setSelectedTeacherId(null);
    };

    const handleSelectTeacher = (teacherId: string) => {
        setSelectedTeacherId(teacherId);
    };

    const handleAllocate = (day: string, slotIndex: number) => {
        if (!selectedClassId || !selectedSubjectId || !selectedTeacherId) return;

        // Check if already allocated there
        const alreadyAtSlot = (data.fixedLessons || []).find(fl => fl.classId === selectedClassId && fl.day === day && fl.slotIndex === slotIndex);
        if (alreadyAtSlot) return;

        // Check teacher availability
        const teacher = data.teachers.find(t => t.id === selectedTeacherId);
        const activeDaysList = data.weekConfig?.activeDays && data.weekConfig.activeDays.length > 0 ? data.weekConfig.activeDays : DAYS_OF_WEEK;
        const dayIdx = activeDaysList.indexOf(day);
        const status = teacher?.availability?.[`${dayIdx}-${slotIndex}`];
        if (status === 'ND') return;

        // Check if teacher is already fixed elsewhere at this time
        const teacherBusy = (data.fixedLessons || []).find(fl => fl.teacherId === selectedTeacherId && fl.day === day && fl.slotIndex === slotIndex);
        if (teacherBusy) return;

        const newFixed: FixedLesson = {
            classId: selectedClassId,
            subjectId: selectedSubjectId,
            teacherId: selectedTeacherId,
            day,
            slotIndex
        };

        setData(prev => ({
            ...prev,
            fixedLessons: [...(prev.fixedLessons || []), newFixed]
        }));
    };

    const handleDeallocate = (day: string, slotIndex: number) => {
        setData(prev => ({
            ...prev,
            fixedLessons: (prev.fixedLessons || []).filter(fl => !(fl.classId === selectedClassId && fl.day === day && fl.slotIndex === slotIndex))
        }));
    };

    // Table view helpers
    const slots = data.schedule[0]?.slots || [];

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="full" className="p-0 overflow-hidden bg-[#f0f0f0]">
            {/* Main Layout */}
            <div className="flex flex-col h-full">

                {/* Header Bar */}
                <div className="bg-[#5c92d1] p-1 flex justify-between items-center text-white border-b border-black/10">
                    <div className="flex items-center gap-4 px-2">
                        <span className="text-[10px] font-bold uppercase">Alocar Aula / Horário</span>
                    </div>
                    <button onClick={onClose} className="hover:bg-white/10 rounded-full p-1 transition-colors">
                        <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                </div>

                {/* Top Control Bar */}
                <div className="bg-white p-2 flex items-center justify-between border-b border-gray-300 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="flex gap-1">
                            <button className="bg-white border border-gray-300 p-1 shadow-sm"><span className="material-symbols-outlined text-sm text-blue-600">save</span></button>
                            <button className="bg-white border border-gray-300 p-1 shadow-sm"><span className="material-symbols-outlined text-sm text-green-600">refresh</span></button>
                        </div>
                        <div className="flex gap-2 text-[10px] items-center italic text-gray-600">
                            <input type="checkbox" checked readOnly className="h-3 w-3" /> Bloquear Limite Diário
                            <input type="checkbox" checked readOnly className="h-3 w-3" /> Bloquear Limite Semanal
                        </div>
                    </div>
                    <div className="text-[14px] font-bold text-gray-700">
                        {selectedSubjectId ? "Selecione uma posição no horário." : "Selecione uma matéria / disciplina."}
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-green-600 text-3xl">replay</span>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex flex-1 overflow-hidden">

                    {/* Left Sidebar (Classes/Teachers + Subjects) */}
                    <div className={`${activeTab === 'classes' ? 'w-[450px]' : 'w-[200px]'} flex bg-[#a6cc72] border-r border-gray-400 transition-all duration-300`}>
                        {/* Selector (Classes / Teachers) */}
                        <div className="flex-1 flex flex-col border-r border-gray-400">
                            <div className="flex text-[10px] font-bold">
                                <button
                                    onClick={() => setActiveTab('classes')}
                                    className={`flex-1 py-2 ${activeTab === 'classes' ? 'bg-[#dae8fc] text-blue-900' : 'bg-[#e0e0e0] text-gray-600'} border-b border-r border-gray-400`}
                                >SALAS / TURMAS</button>
                                <button
                                    onClick={() => {
                                        setActiveTab('teachers');
                                        setSelectedSubjectId(null);
                                    }}
                                    className={`flex-1 py-2 ${activeTab === 'teachers' ? 'bg-[#dae8fc] text-blue-900' : 'bg-[#e0e0e0] text-gray-600'} border-b border-gray-400`}
                                >PROFESSORES</button>
                            </div>

                            <div className="p-2 bg-[#7a9565]">
                                <div className="flex items-center bg-white rounded border border-gray-400 px-1">
                                    <span className="material-symbols-outlined text-yellow-600 text-sm">brush</span>
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full bg-transparent border-none focus:ring-0 text-[11px] h-6 px-1"
                                    />
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto bg-white border border-gray-400 m-1 custom-scrollbar">
                                {activeTab === 'classes' ? (
                                    [...data.classes]
                                        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
                                        .filter(cls => cls.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                        .map(cls => (
                                            <div
                                                key={cls.id}
                                                onClick={() => setSelectedClassId(cls.id)}
                                                className={`px-2 py-1 text-[11px] font-bold cursor-pointer border-b border-gray-100 ${selectedClassId === cls.id ? 'bg-[#3b82f6] text-white' : 'text-blue-900 hover:bg-blue-50'}`}
                                            >
                                                {cls.name}
                                            </div>
                                        ))
                                ) : (
                                    [...data.teachers]
                                        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
                                        .filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                        .map(t => (
                                            <div
                                                key={t.id}
                                                onClick={() => setSelectedTeacherId(t.id)}
                                                className={`px-2 py-1 text-[11px] font-bold cursor-pointer border-b border-gray-100 ${selectedTeacherId === t.id ? 'bg-[#3b82f6] text-white' : 'text-blue-900 hover:bg-blue-50'}`}
                                            >
                                                {t.name}
                                            </div>
                                        ))
                                )}
                            </div>
                        </div>

                        {/* Subjects Column - Only visible in 'classes' tab */}
                        {activeTab === 'classes' && (
                            <div className="flex-1 flex flex-col p-2 gap-1 overflow-y-auto custom-scrollbar border-l border-gray-400/30">
                                {subjectsInSelectedClass.map(sub => {
                                    const total = selectedClass?.lessonsPerSubject[sub.id] || 0;
                                    const allocated = getAllocatedCount(sub.id);
                                    const isSelected = selectedSubjectId === sub.id;

                                    return (
                                        <button
                                            key={sub.id}
                                            onClick={() => handleSelectSubject(sub.id)}
                                            className={`w-full text-left px-3 py-1.5 rounded flex justify-between items-center transition-all ${isSelected ? 'bg-yellow-400 text-blue-900 ring-2 ring-yellow-600' : 'bg-[#7a9565] text-white hover:bg-[#6b8555]'} border border-black/10`}
                                        >
                                            <span className="text-[11px] font-bold uppercase truncate">{sub.name}</span>
                                            <span className="text-[10px] font-bold">({allocated} de {total})</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Middle: Main Schedule Grid */}
                    <div className="flex-1 overflow-auto p-4 flex flex-col justify-start items-center custom-scrollbar bg-[#f0f0f0]">

                        {/* Exact Mockup Table Structure */}
                        <div className="flex flex-col border-[1px] border-black w-fit bg-white shadow-sm overflow-hidden select-none">
                            {/* Header: Sala / Turma (Grey) */}
                            <div className="bg-[#bdc3c7] border-b-[1px] border-black px-3 py-2 text-[14px] font-bold text-black flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">home</span>
                                Sala / Turma: {selectedClass?.name || '1° 01'}
                            </div>

                            {/* Sub-header: Manhã (Light Green) */}
                            <div className="bg-[#d5e8d4] border-b-[1px] border-black p-1.5 text-center text-[13px] font-bold text-black uppercase tracking-widest">
                                {data.institution.shift || 'Manhã'}
                            </div>

                            {/* Body Section with Vertical Label and Grid */}
                            <div className="flex">
                                {/* Vertical Label Bar */}
                                <div className="w-[35px] bg-[#d5e8d4] flex items-center justify-center border-r-[1px] border-black py-4">
                                    <span className="-rotate-90 whitespace-nowrap font-bold text-[12px] text-black uppercase">{data.institution.shift || 'Manhã'}</span>
                                </div>

                                {/* Main Grid Content */}
                                <div className="flex flex-col">
                                    {/* Days Header Row */}
                                    <div className="flex bg-[#d5e8d4] border-b-[1px] border-black">
                                        <div className="w-[70px] border-r-[1px] border-black"></div>
                                        {DAYS_OF_WEEK.map(day => (
                                            <div key={day} className="w-[85px] py-1.5 text-center text-[12px] font-black text-black border-r-[1px] border-black last:border-r-0 uppercase">
                                                {day.substring(0, 3)}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Slots and Content */}
                                    <div className="flex flex-col bg-[#eaeded] divide-y-[1px] divide-black">
                                        {gridRows.map((slot, sIdx) => {
                                            if (slot.type === 'INTERVALO') {
                                                return (
                                                    <div key={sIdx} className="flex bg-[#eaeded] border-b-[1px] border-black last:border-b-0">
                                                        <div className="w-[70px] border-r-[1px] border-black"></div>
                                                        <div className="flex-1 py-1.5 text-center text-[13px] font-bold text-black flex items-center justify-center gap-2">
                                                            Intervalo: {formatTime(slot.end - slot.start)}
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div key={sIdx} className="flex bg-[#eaeded] border-b-[1px] border-black last:border-b-0">
                                                    {/* Time Slot Column */}
                                                    <div className="w-[70px] py-4 flex items-center justify-center text-[11px] font-black text-black border-r-[1px] border-black">
                                                        {formatTime(slot.start)}
                                                    </div>

                                                    {/* Day Cells */}
                                                    {DAYS_OF_WEEK.map((day, dIdx) => {
                                                        const fixed = data.fixedLessons?.find(fl => fl.classId === selectedClassId && fl.day === day && fl.slotIndex === sIdx);
                                                        const sub = fixed ? data.subjects.find(s => s.id === fixed.subjectId) : null;
                                                        const teacher = fixed ? data.teachers.find(t => t.id === fixed.teacherId) : null;

                                                        return (
                                                            <div
                                                                key={day}
                                                                onClick={() => fixed ? handleDeallocate(day, sIdx) : handleAllocate(day, sIdx)}
                                                                className="w-[85px] h-[55px] border-r-[1px] border-black last:border-r-0 p-[2px] cursor-pointer transition-all flex items-center justify-center group bg-[#eaeded]"
                                                            >
                                                                {fixed ? (
                                                                    <div className="w-full h-full bg-[#a6cc72] border-[1px] border-black/20 flex flex-col items-center justify-center p-0.5 overflow-hidden">
                                                                        <div className="text-[10px] font-black text-black leading-tight uppercase truncate w-full text-center">{sub?.shortName || sub?.name}</div>
                                                                        <div className="text-[8px] font-bold text-black/70 leading-tight truncate w-full text-center">{teacher?.name.split(' ')[0]}</div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="w-full h-full border border-black/5 flex items-center justify-center">
                                                                        <div className="opacity-0 group-hover:opacity-100 text-[8px] font-black text-black/20 uppercase tracking-tighter">Fixar</div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Floating Availability Legend or Stats could go here if needed */}
                    </div>

                    {/* Teacher View Overlay / Side Grid if Teacher Selected */}
                    {selectedTeacherId && (
                        <div className="fixed top-40 right-10 w-[250px] bg-white border-2 border-primary shadow-2xl rounded-sm z-10 animate-in slide-in-from-right-4">
                            <div className="bg-primary p-1 text-[10px] font-bold text-white flex justify-between items-center">
                                <span>PROFESSOR: {data.teachers.find(t => t.id === selectedTeacherId)?.name}</span>
                                <button onClick={() => setSelectedTeacherId(null)}><span className="material-symbols-outlined text-xs">close</span></button>
                            </div>
                            <div className="p-1">
                                <div className="grid grid-cols-[50px_repeat(5,1fr)] bg-gray-200 border border-gray-300">
                                    <div className="bg-gray-100"></div>
                                    {DAYS_OF_WEEK.map(d => <div key={d} className="text-[8px] font-bold text-center border-l border-gray-300">{d.substring(0, 3)}</div>)}

                                    {slots.map((s, sIdx) => (
                                        <React.Fragment key={s.id}>
                                            <div className="text-[8px] font-bold p-0.5 border-t border-gray-300 text-center">{s.start}</div>
                                            {DAYS_OF_WEEK.map((d, dIdx) => {
                                                const teacher = data.teachers.find(t => t.id === selectedTeacherId);
                                                const status = teacher?.availability?.[`${dIdx}-${sIdx}`];
                                                const fixedElsewhere = data.fixedLessons?.find(fl => fl.teacherId === selectedTeacherId && fl.day === d && fl.slotIndex === sIdx && fl.classId !== selectedClassId);

                                                let color = 'bg-[#dae8fc]'; // Disponível
                                                let text = 'D';
                                                if (status === 'ND') { color = 'bg-red-500'; text = 'ND'; }
                                                if (status === 'IN') { color = 'bg-yellow-500'; text = 'IND'; }
                                                if (fixedElsewhere) { color = 'bg-red-800'; text = 'F'; }

                                                return <div key={d} className={`border-t border-l border-gray-300 ${color} text-white flex items-center justify-center font-bold text-[8px] h-4`}>{text}</div>
                                            })}
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Teacher Selection Popup */}
                    {selectedSubjectId && !selectedTeacherId && (
                        <div className="fixed top-40 left-1/2 -translate-x-1/2 w-[350px] bg-[#dae8fc] border-2 border-primary shadow-2xl rounded-lg p-4 z-20 animate-in zoom-in-95">
                            <div className="flex justify-end -mt-2 -mr-2 mb-1">
                                <button
                                    onClick={() => setSelectedSubjectId(null)}
                                    className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-black/10 text-primary transition-colors"
                                >
                                    <span className="material-symbols-outlined text-sm">close</span>
                                </button>
                            </div>
                            <div className="text-[12px] font-bold text-primary mb-3 text-center uppercase border-b border-primary/20 pb-2">
                                Selecione 1 dos possíveis professores para lecionar esta disciplina nesta turma
                            </div>
                            <div className="flex flex-wrap gap-2 justify-center">
                                {data.teachers
                                    .filter(t => t.subjects.includes(selectedSubjectId) && t.classAssignments?.[selectedSubjectId]?.[selectedClassId!] === 'OBRIGATORIAMENTE')
                                    .map(t => (
                                        <button
                                            key={t.id}
                                            onClick={() => handleSelectTeacher(t.id)}
                                            className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded shadow-sm font-bold text-sm transition-all hover:scale-105"
                                        >
                                            {t.name}
                                        </button>
                                    ))
                                }
                                {data.teachers
                                    .filter(t => t.subjects.includes(selectedSubjectId) && t.classAssignments?.[selectedSubjectId]?.[selectedClassId!] === 'PODERÁ').length > 0 &&
                                    <div className="w-full text-center text-[10px] text-gray-500 italic mt-2 border-t pt-2">Professores que podem lecionar:</div>
                                }
                                {data.teachers
                                    .filter(t => t.subjects.includes(selectedSubjectId) && t.classAssignments?.[selectedSubjectId]?.[selectedClassId!] === 'PODERÁ')
                                    .map(t => (
                                        <button
                                            key={t.id}
                                            onClick={() => handleSelectTeacher(t.id)}
                                            className="bg-white hover:bg-gray-50 text-primary border border-primary px-6 py-2 rounded shadow-sm font-bold text-sm transition-all hover:scale-105"
                                        >
                                            {t.name}
                                        </button>
                                    ))
                                }
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};
