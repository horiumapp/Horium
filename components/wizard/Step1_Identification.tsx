
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

const readInstitutionLogo = (file: File) => new Promise<string>((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
        const maxSize = 256;
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        if (!context) {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Não foi possível ler a imagem.'));
            return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(objectUrl);
        const webp = canvas.toDataURL('image/webp', 0.85);
        resolve(webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.85));
    };
    image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Não foi possível ler a imagem.'));
    };
    image.src = objectUrl;
});

export const Step1Identification: React.FC<Step1IdentificationProps> = ({ data, setData, onNext }) => {
    const [errors, setErrors] = React.useState<Record<string, string>>({});
    const logoInputRef = React.useRef<HTMLInputElement>(null);

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

    const handleLogoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setErrors(prev => ({ ...prev, logo: 'Envie um arquivo de imagem (PNG, JPG ou WEBP).' }));
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setErrors(prev => ({ ...prev, logo: 'A imagem precisa ter no máximo 5 MB.' }));
            return;
        }
        try {
            const logo = await readInstitutionLogo(file);
            setData({ ...data, institution: { ...data.institution, logo } });
            setErrors(prev => ({ ...prev, logo: '' }));
        } catch {
            setErrors(prev => ({ ...prev, logo: 'Não foi possível usar essa imagem.' }));
        }
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
                    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/40">
                        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white text-primary dark:border-slate-700 dark:bg-slate-900">
                            {data.institution.logo ? (
                                <img src={data.institution.logo} alt="" className="size-full object-contain p-1.5" />
                            ) : (
                                <span className="material-symbols-outlined text-[32px]">school</span>
                            )}
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Logo da instituição</p>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Aparece ao lado do nome da escola no painel.</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => logoInputRef.current?.click()}
                                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-white transition hover:brightness-95"
                                >
                                    <span className="material-symbols-outlined text-base">upload</span>
                                    {data.institution.logo ? 'Trocar logo' : 'Enviar logo'}
                                </button>
                                {data.institution.logo && (
                                    <button
                                        type="button"
                                        onClick={() => setData({ ...data, institution: { ...data.institution, logo: undefined } })}
                                        className="inline-flex min-h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:border-red-200 hover:text-red-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                                    >
                                        Remover
                                    </button>
                                )}
                            </div>
                            {errors.logo && <p className="mt-2 text-xs font-medium text-red-600">{errors.logo}</p>}
                        </div>
                        <input
                            ref={logoInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/svg+xml"
                            className="sr-only"
                            onChange={handleLogoChange}
                        />
                    </div>
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
