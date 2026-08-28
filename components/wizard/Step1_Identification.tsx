
import React from 'react';
import { SetupData } from '../../types';
import { WizardStepHeader } from './WizardStepHeader';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';

interface Step1IdentificationProps {
    data: SetupData;
    setData: React.Dispatch<React.SetStateAction<SetupData>>;
    onNext: () => void;
}

export const Step1Identification: React.FC<Step1IdentificationProps> = ({ data, setData, onNext }) => {
    const [errors, setErrors] = React.useState<Record<string, string>>({});

    const handleNext = () => {
        const newErrors: Record<string, string> = {};
        if (!data.institution.name?.trim()) {
            newErrors.name = 'O nome da instituição é obrigatório';
        }
        if (!data.institution.year?.trim()) {
            newErrors.year = 'O ano é obrigatório';
        } else if (!/^\d{4}$/.test(data.institution.year)) {
            newErrors.year = 'Ano inválido (ex: 2026)';
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setErrors({});
        onNext();
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <WizardStepHeader
                title="Identificação"
                description="Defina os dados fundamentais da sua escola."
                icon="school"
            />
            <div className="p-6 flex flex-col items-center">
                <div className="w-full max-w-2xl space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                        <div className="md:col-span-7">
                            <Input
                                label="Instituição"
                                placeholder="Nome da Escola"
                                value={data.institution.name}
                                error={errors.name}
                                onChange={e => {
                                    setData({ ...data, institution: { ...data.institution, name: e.target.value } });
                                    if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
                                }}
                            />
                        </div>
                        <div className="md:col-span-3">
                            <Select
                                label="Turno"
                                value={data.institution.shift}
                                onChange={e => setData({ ...data, institution: { ...data.institution, shift: e.target.value } })}
                                options={[
                                    { value: 'Manhã', label: 'Manhã' },
                                    { value: 'Tarde', label: 'Tarde' },
                                    { value: 'Noite', label: 'Noite' },
                                    { value: 'Integral', label: 'Integral' },
                                ]}
                            />
                        </div>
                        <div className="md:col-span-2">
                            <Input
                                label="Ano"
                                maxLength={4}
                                className="text-center"
                                value={data.institution.year}
                                error={errors.year}
                                onChange={e => {
                                    setData({ ...data, institution: { ...data.institution, year: e.target.value } });
                                    if (errors.year) setErrors(prev => ({ ...prev, year: '' }));
                                }}
                            />
                        </div>
                    </div>
                    <div className="flex justify-center pt-2">
                        <Button
                            onClick={handleNext}
                            size="lg"
                            className="w-full max-w-lg shadow-lg"
                        >
                            Próxima Etapa
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
