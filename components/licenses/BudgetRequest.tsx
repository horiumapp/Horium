import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { pricingService, PlanDuration, PLAN_OPTIONS } from '../../services/pricingService';

interface BudgetRequestProps {
    onBack: () => void;
}

interface ApplicantData {
    name: string;
    city: string;
}

export const BudgetRequest: React.FC<BudgetRequestProps> = ({ onBack }) => {
    const [step, setStep] = useState<'config' | 'result' | 'form' | 'proposal'>('config');
    const [budgetNumClasses, setBudgetNumClasses] = useState(0);
    const [budgetLicenseType, setBudgetLicenseType] = useState<PlanDuration>('1 ano');
    const [applicantData, setApplicantData] = useState<ApplicantData>({ name: 'Escola Modelo', city: '' });

    const budgetTotalPrice = budgetNumClasses > 0
        ? pricingService.calculatePrice(budgetNumClasses, budgetLicenseType)
        : 0;

    const renderConfig = () => (
        <div className="flex-1 flex flex-col items-center p-6 w-full max-w-5xl mx-auto">
            <h1 className="text-3xl font-black mb-8 text-center md:text-left w-full text-gray-900 dark:text-white flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-4xl">request_quote</span>
                Orçamento Online & Proposta Comercial
            </h1>
            <div className="w-full bg-white dark:bg-gray-800 rounded-3xl p-8 md:p-10 shadow-xl border border-gray-200 dark:border-gray-700 animate-in fade-in slide-in-from-bottom-12">
                <div className="space-y-8">
                    <p className="text-gray-700 dark:text-gray-300 text-lg font-medium leading-relaxed">
                        Informe o número total de turmas somando todos os turnos / períodos de funcionamento da sua instituição.
                    </p>
                    <div className="bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-200 dark:border-blue-700/50 p-6 rounded-2xl text-sm text-blue-900 dark:text-blue-100 text-center font-bold">
                        <span className="material-symbols-outlined block text-3xl mb-2 text-primary">lightbulb</span>
                        Exemplo: para 10 turmas de manhã e 5 turmas de tarde, é necessária uma licença para 15 turmas.
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                        <div className="space-y-2">
                            <label className="font-black uppercase text-xs text-gray-700 dark:text-gray-300 ml-1">Total de Turmas</label>
                            <select
                                className="w-full h-12 border-2 border-gray-200 dark:border-gray-700 focus:border-primary rounded-xl px-4 bg-white dark:bg-gray-900 font-bold shadow-sm outline-none transition-all text-gray-900 dark:text-white"
                                value={budgetNumClasses}
                                onChange={(e) => setBudgetNumClasses(Number(e.target.value))}
                            >
                                <option value="0">Selecione a quantidade de turmas...</option>
                                {Array.from({ length: 60 }, (_, i) => i + 1).map(n => (
                                    <option key={n} value={n}>{n} turma{n > 1 ? 's' : ''}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="font-black uppercase text-xs text-gray-700 dark:text-gray-300 ml-1">Vigência / Plano</label>
                            <select
                                className="w-full h-12 border-2 border-gray-200 dark:border-gray-700 focus:border-primary rounded-xl px-4 bg-white dark:bg-gray-900 font-bold shadow-sm outline-none transition-all text-gray-900 dark:text-white"
                                value={budgetLicenseType}
                                onChange={(e) => setBudgetLicenseType(e.target.value as PlanDuration)}
                            >
                                {PLAN_OPTIONS.map((plan) => (
                                    <option key={plan.label} value={plan.label}>
                                        {plan.label} ({pricingService.formatCurrency(plan.pricePerClass)}/turma) - {plan.sub}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex justify-center gap-4 pt-6">
                        <Button onClick={onBack} variant="outline" className="px-8">
                            Voltar
                        </Button>
                        <Button
                            disabled={budgetNumClasses === 0}
                            onClick={() => setStep('result')}
                            className="px-12 text-lg shadow-xl"
                        >
                            Calcular Orçamento
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderResult = () => (
        <div className="flex-1 flex flex-col items-center p-6 w-full max-w-5xl mx-auto">
            <h1 className="text-3xl font-black mb-8 text-center md:text-left w-full text-gray-900 dark:text-white flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-4xl">payments</span>
                Resultado do Orçamento
            </h1>
            <div className="w-full bg-white dark:bg-gray-800 rounded-3xl p-8 md:p-10 shadow-xl border border-gray-200 dark:border-gray-700 space-y-10 animate-in fade-in slide-in-from-right-12">
                <div className="text-primary dark:text-blue-300">
                    <p className="text-xl font-medium mb-2 opacity-80 text-gray-700 dark:text-gray-300">
                        Investimento oficial para <strong className="text-primary">{budgetNumClasses} turmas</strong>:
                    </p>
                    <div className="flex items-baseline gap-4 flex-wrap">
                        <p className="text-5xl font-black tracking-tight text-primary dark:text-blue-400">
                            {pricingService.formatCurrency(budgetTotalPrice)}
                        </p>
                        <span className="text-base font-bold bg-primary/10 text-primary dark:bg-primary/20 dark:text-blue-300 px-4 py-1.5 rounded-full border border-primary/20">
                            Vigência: {budgetLicenseType}
                        </span>
                    </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-900/50 p-6 md:p-8 rounded-2xl border border-gray-200 dark:border-gray-700">
                    <p className="font-black uppercase text-xs text-primary mb-4 tracking-widest">Incluso na Licença Horium:</p>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-gray-800 dark:text-gray-200 font-medium text-sm">
                        <li className="flex items-center gap-2"><span className="material-symbols-outlined text-green-600">check_circle</span> Sistema Web Completo e Intuitivo</li>
                        <li className="flex items-center gap-2"><span className="material-symbols-outlined text-green-600">check_circle</span> Processamento I.A. Ilimitado</li>
                        <li className="flex items-center gap-2"><span className="material-symbols-outlined text-green-600">check_circle</span> Editor Interativo com Detecção de Conflitos</li>
                        <li className="flex items-center gap-2"><span className="material-symbols-outlined text-green-600">check_circle</span> Suporte Prioritário Direto na Plataforma</li>
                        <li className="flex items-center gap-2"><span className="material-symbols-outlined text-green-600">check_circle</span> Backup Seguro em Nuvem</li>
                        <li className="flex items-center gap-2"><span className="material-symbols-outlined text-green-600">check_circle</span> Exportação em PDF e Excel para Professores e Turmas</li>
                    </ul>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-4 pt-4">
                    <Button onClick={() => setStep('config')} variant="outline" className="w-full md:w-auto">
                        Refazer Cálculo
                    </Button>
                    <Button onClick={() => setStep('form')} className="w-full md:w-auto px-8 text-lg shadow-xl">
                        Solicitar Proposta Formal em PDF
                    </Button>
                </div>
            </div>
        </div>
    );

    const renderForm = () => (
        <div className="flex-1 flex flex-col items-center p-6 w-full max-w-5xl mx-auto">
            <h1 className="text-3xl font-black mb-8 text-center md:text-left w-full text-gray-900 dark:text-white flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-4xl">domain</span>
                Dados para Proposta Formal
            </h1>
            <div className="w-full bg-white dark:bg-gray-800 rounded-3xl p-8 md:p-10 shadow-xl border border-gray-200 dark:border-gray-700 space-y-8 animate-in fade-in slide-in-from-right-12">
                <p className="text-lg text-gray-800 dark:text-gray-200 font-medium">Preencha os dados da instituição:</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="font-black uppercase text-xs text-gray-700 dark:text-gray-300 ml-1">Nome da Escola / Instituição</label>
                        <input
                            type="text"
                            className="w-full h-12 rounded-xl px-4 border-2 border-gray-200 dark:border-gray-700 focus:border-primary font-bold shadow-sm outline-none bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                            value={applicantData.name}
                            onChange={(e) => setApplicantData({ ...applicantData, name: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="font-black uppercase text-xs text-gray-700 dark:text-gray-300 ml-1">Cidade / UF</label>
                        <input
                            type="text"
                            className="w-full h-12 rounded-xl px-4 border-2 border-gray-200 dark:border-gray-700 focus:border-primary font-bold shadow-sm outline-none bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                            value={applicantData.city}
                            onChange={(e) => setApplicantData({ ...applicantData, city: e.target.value })}
                        />
                    </div>
                </div>

                <div className="flex justify-center gap-4 pt-8">
                    <Button onClick={() => setStep('result')} variant="outline">Voltar</Button>
                    <Button onClick={() => setStep('proposal')} className="px-10 text-lg shadow-xl">
                        Gerar Documento
                    </Button>
                </div>
            </div>
        </div>
    );

    const renderProposal = () => (
        <div className="flex-1 flex flex-col items-center bg-gray-100 dark:bg-gray-900 min-h-[calc(100vh-64px)] p-6 md:p-8 overflow-y-auto">
            <div className="w-full max-w-4xl bg-white text-gray-900 shadow-2xl rounded-2xl overflow-hidden min-h-[800px] flex flex-col animate-in zoom-in-95 duration-300 border border-gray-200">
                <div className="bg-primary p-8 flex items-center justify-between text-white print:bg-primary print:print-color-adjust-exact">
                    <div className="flex items-center gap-4">
                        <div className="bg-white text-primary p-3 rounded-2xl shadow-sm">
                            <span className="material-symbols-outlined text-4xl">schedule</span>
                        </div>
                        <div>
                            <h1 className="text-3xl font-black tracking-tight">HORIUM</h1>
                            <p className="text-xs text-blue-100 font-medium">Sistema de Gestão & Otimização de Horários Escolares</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="font-bold text-lg">PROPOSTA COMERCIAL</p>
                        <p className="text-xs opacity-90">{new Date().toLocaleDateString('pt-BR')}</p>
                    </div>
                </div>

                <div className="p-8 md:p-12 space-y-10 flex-1">
                    <div className="border-b pb-6">
                        <p className="text-xs font-black uppercase text-gray-400 mb-1">Para a Instituição:</p>
                        <p className="text-2xl font-bold text-gray-900">{applicantData.name}</p>
                        {applicantData.city && <p className="text-gray-600 mt-1">{applicantData.city}</p>}
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-bold text-lg text-primary border-l-4 border-primary pl-3">Objeto</h3>
                        <p className="leading-relaxed text-gray-700 text-sm">
                            Fornecimento de licença de uso do software <strong>Horium</strong>, plataforma profissional em nuvem para elaboração, balanceamento e otimização automatizada de grades horárias escolares, equipada com inteligência computacional para atendimento integral de restrições pedagógicas e docentes.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-bold text-lg text-primary border-l-4 border-primary pl-3">Investimento</h3>
                        <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                            <div className="flex justify-between items-center mb-4 text-xs uppercase tracking-wider font-bold text-gray-500 border-b pb-2">
                                <span>Descrição</span>
                                <span>Valor</span>
                            </div>
                            <div className="flex justify-between items-center text-lg">
                                <div>
                                    <p className="font-bold text-gray-900">Licença para {budgetNumClasses} Turmas</p>
                                    <p className="text-xs text-gray-500">Plano Vigência: {budgetLicenseType}</p>
                                </div>
                                <span className="font-black text-2xl text-primary">{pricingService.formatCurrency(budgetTotalPrice)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-50 p-6 border-t border-gray-200 flex gap-4 print:hidden">
                    <Button onClick={() => window.print()} variant="outline" className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">print</span> Imprimir / Salvar PDF
                    </Button>
                    <Button onClick={() => setStep('config')} className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">refresh</span> Novo Orçamento
                    </Button>
                    <Button onClick={onBack} variant="ghost" className="ml-auto text-gray-600">
                        Voltar
                    </Button>
                </div>
            </div>
        </div>
    );

    return (
        <>
            {step === 'config' && renderConfig()}
            {step === 'result' && renderResult()}
            {step === 'form' && renderForm()}
            {step === 'proposal' && renderProposal()}
        </>
    );
};

