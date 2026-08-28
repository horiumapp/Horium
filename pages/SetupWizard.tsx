
import React, { useState, useMemo } from 'react';
import { SetupData, IntervalConfig, DaySchedule, TimeSlot } from '../types';
import { Step1Identification } from '../components/wizard/Step1_Identification';
import { Step2WeekConfig } from '../components/wizard/Step2_WeekConfig';
import { Step3Subjects } from '../components/wizard/Step3_Subjects';
import { Step4Classes } from '../components/wizard/Step4_Classes';
import { Step5Teachers } from '../components/wizard/Step5_Teachers';
import { Step6Options } from '../components/wizard/Step6_Options';
import { Step7Process } from '../components/wizard/Step7_Process';
import { Step8Result } from '../components/wizard/Step8_Result';
import { generateTimetable } from '../services/timetableGenerator';

import { scheduleService } from '../services/scheduleService';
import { audio } from '../services/audioService';

interface SetupWizardProps {
  data: SetupData;
  setData: React.Dispatch<React.SetStateAction<SetupData>>;
  activeLicenseStatus?: string;
  onLicenseNeeded?: () => void;
  onComplete?: () => void;
}

const SetupWizard: React.FC<SetupWizardProps> = ({ data, setData, activeLicenseStatus, onLicenseNeeded, onComplete }) => {
  const [step, setStep] = useState(data.currentStep || 1);
  const [furthestStep, setFurthestStep] = useState(data.currentStep || 1);
  const [genProgress, setGenProgress] = useState(0);
  const [genMessage, setGenMessage] = useState('');

  // Sync local step with prop data
  React.useEffect(() => {
    if (data.currentStep && data.currentStep !== step) {
      setStep(data.currentStep);
      setFurthestStep(prev => Math.max(prev, data.currentStep || 1));
    }
  }, [data.currentStep]);

  // Persist step when changed locally
  const handleStepChange = (newStep: number) => {
    setStep(newStep);
    setFurthestStep(prev => Math.max(prev, newStep));
    setData(prev => ({ ...prev, currentStep: newStep }));
  };



  // Configurações da Semana (Lifted State from Step 2)
  const [activeDays, setActiveDays] = useState<string[]>(data.weekConfig?.activeDays || ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta']);
  const [startHour, setStartHour] = useState(data.weekConfig?.startHour ?? 7);
  const [startMinute, setStartMinute] = useState(data.weekConfig?.startMinute ?? 0);
  const [durationMinute, setDurationMinute] = useState(data.weekConfig?.durationMinute ?? 45);
  const [lessonsPerDayGlobal, setLessonsPerDayGlobal] = useState(data.weekConfig?.lessonsPerDayGlobal ?? 5);
  const [intervals, setIntervals] = useState<IntervalConfig[]>(data.weekConfig?.intervals || [
    { id: 'int-1', afterLesson: 2, durationMinutes: 15 }
  ]);

  // Update local states if data changes (e.g. after session restore)
  React.useEffect(() => {
    if (data.weekConfig) {
      if (JSON.stringify(data.weekConfig.activeDays) !== JSON.stringify(activeDays)) setActiveDays(data.weekConfig.activeDays);
      if (data.weekConfig.startHour !== startHour) setStartHour(data.weekConfig.startHour);
      if (data.weekConfig.startMinute !== startMinute) setStartMinute(data.weekConfig.startMinute);
      if (data.weekConfig.durationMinute !== durationMinute) setDurationMinute(data.weekConfig.durationMinute);
      if (data.weekConfig.lessonsPerDayGlobal !== lessonsPerDayGlobal) setLessonsPerDayGlobal(data.weekConfig.lessonsPerDayGlobal);
      if (JSON.stringify(data.weekConfig.intervals) !== JSON.stringify(intervals)) setIntervals(data.weekConfig.intervals);
    }
  }, [data.weekConfig]);

  // Optimized sync helper to avoid loops
  const updateWeekConfig = (newData: Partial<typeof data.weekConfig>) => {
    setData(prev => {
      const base = prev.weekConfig || {
        activeDays,
        startHour,
        startMinute,
        durationMinute,
        lessonsPerDayGlobal,
        intervals,
      };
      return {
        ...prev,
        weekConfig: {
          ...base,
          ...newData
        }
      };
    });
  };

  // Derived Grid Rows (Reused for Step 2 and Step 5)
  const gridRows = useMemo(() => {
    let currentTotalMinutes = startHour * 60 + startMinute;
    const rows: any[] = [];

    for (let i = 1; i <= lessonsPerDayGlobal; i++) {
      const startTime = currentTotalMinutes;
      const endTime = startTime + durationMinute;
      rows.push({ type: 'AULA', index: i, start: startTime, end: endTime });
      currentTotalMinutes = endTime;

      const afterThisLesson = intervals.filter(int => int.afterLesson === i);
      afterThisLesson.forEach(int => {
        rows.push({
          type: 'INTERVALO',
          id: int.id,
          duration: int.durationMinutes,
          start: currentTotalMinutes,
          end: currentTotalMinutes + int.durationMinutes
        });
        currentTotalMinutes += int.durationMinutes;
      });
    }
    return rows;
  }, [lessonsPerDayGlobal, startHour, startMinute, durationMinute, intervals]);

  const formatTime = (totalMinutes: number) => {
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const generateSchedule = () => {
    const generatedSchedule: DaySchedule[] = activeDays.map(day => {
      const slots: TimeSlot[] = gridRows.map((row, idx) => ({
        id: crypto.randomUUID(),
        type: row.type,
        start: formatTime(row.start),
        end: formatTime(row.end)
      }));
      return { day, slots };
    });

    setData(prev => ({ ...prev, schedule: generatedSchedule }));
    return generatedSchedule;
  };

  const handleBack = () => {
    handleStepChange(Math.max(1, step - 1));
  };

  const handleRegenerateIntelligence = async () => {
    // Bloqueio de processamento sem licença
    if (!data.isLicensed) {
      onLicenseNeeded?.();
      return;
    }

    handleStepChange(7);
    setGenProgress(0);
    setGenMessage('Iniciando motor de busca profunda...');

    const schedule = generateSchedule();
    const resultData = { ...data, schedule };

    try {
      const result = await generateTimetable(resultData, (p, m) => {
        setGenProgress(p);
        setGenMessage(m);
      });

      const finalData = {
        ...resultData,
        fixedLessons: result.fixedLessons,
        failures: result.failures,
        status: 'Finalizado'
      };

      // Save it using the service for persistence
      await scheduleService.saveSchedule(finalData);

      setData(prev => ({
        ...prev,
        fixedLessons: result.fixedLessons,
        failures: result.failures,
        status: 'Finalizado'
      }));

      audio.playSuccess();
      handleStepChange(8);
    } catch (err) {
      console.error('Erro na geração de horários:', err);
      alert('Ocorreu um erro ao gerar os horários. Tente novamente.');
      handleStepChange(6);
    }
  };

  const renderCurrentStep = () => {
    switch (step) {
      case 1:
        return (
          <Step1Identification
            data={data}
            setData={setData}
            onNext={() => setStep(2)}
          />
        );
      case 2:
        return (
          <Step2WeekConfig
            startHour={startHour} setStartHour={(val) => { setStartHour(val); updateWeekConfig({ startHour: val }); }}
            startMinute={startMinute} setStartMinute={(val) => { setStartMinute(val); updateWeekConfig({ startMinute: val }); }}
            durationMinute={durationMinute} setDurationMinute={(val) => { setDurationMinute(val); updateWeekConfig({ durationMinute: val }); }}
            lessonsPerDayGlobal={lessonsPerDayGlobal} setLessonsPerDayGlobal={(val) => { setLessonsPerDayGlobal(val); updateWeekConfig({ lessonsPerDayGlobal: val }); }}
            intervals={intervals} setIntervals={(val) => { setIntervals(val); updateWeekConfig({ intervals: val }); }}
            activeDays={activeDays} setActiveDays={(val) => { setActiveDays(val); updateWeekConfig({ activeDays: val }); }}
            data={data}
            onNext={() => {
              generateSchedule();
              handleStepChange(3);
            }}
            onBack={handleBack}
          />
        );
      case 3:
        return (
          <Step3Subjects
            data={data}
            setData={setData}
            onNext={() => handleStepChange(4)}
            onBack={handleBack}
          />
        );
      case 4:
        return (
          <Step4Classes
            data={data}
            setData={setData}
            activeDays={activeDays}
            gridRows={gridRows}
            onNext={() => handleStepChange(5)}
            onBack={handleBack}
          />
        );
      case 5:
        return (
          <Step5Teachers
            data={data}
            setData={setData}
            activeDays={activeDays}
            gridRows={gridRows}
            onComplete={() => handleStepChange(6)}
            onBack={handleBack}
          />
        );
      case 6:
        return (
          <Step6Options
            data={data}
            setData={setData}
            gridRows={gridRows}
            onNext={handleRegenerateIntelligence}
            onBack={handleBack}
          />
        );
      case 7:
        return (
          <Step7Process
            progress={genProgress}
            message={genMessage}
          />
        );
      case 8:
        return (
          <Step8Result
            data={data}
            setData={setData}
            onReprocess={handleRegenerateIntelligence}
            activeLicenseStatus={activeLicenseStatus}
            onLicenseNeeded={onLicenseNeeded}
          />
        );
      default:
        return null;
    }
  };

  const steps = [
    { n: 1, title: 'Identificação', icon: 'school' },
    { n: 2, title: 'Semana', icon: 'calendar_month' },
    { n: 3, title: 'Disciplinas', icon: 'menu_book' },
    { n: 4, title: 'Turmas', icon: 'groups' },
    { n: 5, title: 'Professores', icon: 'person' },
    { n: 6, title: 'Opções', icon: 'settings' },
    { n: 7, title: 'Processar', icon: 'bolt' },
    { n: 8, title: 'GRADE', icon: 'calendar_view_week' }
  ];

  return (
    <div className="max-w-7xl mx-auto pt-8 pb-20 overflow-visible">
      {/* STEPS INDICATOR */}
      <div className="flex justify-between mb-12 px-4 relative overflow-visible no-print">
        <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-200 dark:bg-gray-800 -z-10 -translate-y-1/2 rounded-full"></div>
        <div
          className="absolute top-1/2 left-0 h-1 bg-primary -z-10 -translate-y-1/2 rounded-full transition-all duration-500"
          style={{ width: `${((step - 1) / (steps.length - 1)) * 100}%` }}
        ></div>

        {steps.map((s) => (
          <button
            key={s.n}
            onClick={() => {
              if (s.n <= furthestStep) {
                handleStepChange(s.n);
              }
            }}
            disabled={s.n > furthestStep}
            className={`flex flex-col items-center gap-2 group focus:outline-none ${s.n <= furthestStep ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
          >
            <div
              className={`size-10 rounded-2xl flex items-center justify-center font-black text-sm transition-all border-4 relative z-10 ${step >= s.n
                ? 'bg-primary border-primary text-white shadow-lg shadow-primary/30 scale-110'
                : 'bg-white dark:bg-[#101822] border-gray-200 dark:border-gray-700 text-gray-300 hover:border-primary/50'
                }`}
            >
              {step > s.n ? <span className="material-symbols-outlined text-[18px]">check</span> : (s.n === 8 ? 'G' : s.n)}
            </div>
            <span className={`text-[8px] font-black uppercase tracking-widest transition-all ${step >= s.n ? 'text-primary' : 'text-gray-300'
              }`}>
              {s.title}
            </span>
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-[#101822] rounded-3xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800">
        {renderCurrentStep()}
      </div>
    </div>
  );
};

export default SetupWizard;
