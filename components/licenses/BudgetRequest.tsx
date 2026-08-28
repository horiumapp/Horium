
import React, { useState } from 'react';
import { Button } from '../ui/Button';

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
    const [budgetLicenseType, setBudgetLicenseType] = useState('Licença Ano ( 2026 )');
    const [applicantData, setApplicantData] = useState<ApplicantData>({ name: 'Escola Modelo', city: '' });

    const pricePerClass = 18.0;
    const budgetTotalPrice = budgetNumClasses * pricePerClass;

    const renderConfig = () => (
        <div className="flex-1 flex flex-col items-center p-6 w-full max-w-5xl mx-auto">
            <h1 className="text-3xl font-medium mb-8 text-center md:text-left w-full">Orçamento Online</h1>
            <div className="w-full bg-[#b5c69b] dark:bg-[#2d3a1e] rounded-3xl p-10 shadow-2xl border border-[#9eb084] animate-in fade-in slide-in-from-bottom-12">
                <div className="space-y-8">
                    <p className="text-gray-800 dark:text-gray-200 text-lg font-medium leading-relaxed">
                        Informe o número total de turmas somando todos os turnos / períodos de funcionamento.
                    </p>
                    <div className="bg-[#fff1a8] dark:bg-yellow-900/30 border-2 border-[#e5d06b] dark:border-yellow-700/50 p-6 rounded-xl text-sm text-gray-800 dark:text-yellow-100 text-center font-bold">
                        <span className="material-symbols-outlined block text-3xl mb-2 text-yellow-700 dark:text-yellow-500">lightbulb</span>
                        Exemplo: para 10 turmas de manhã e 5 turmas de tarde, é necessário uma licença para 15 turmas.
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                        <div className="space-y-2">
                            <label className="font-black uppercase text-xs text-gray-700 dark:text-gray-300 ml-1">Total de Turmas</label>
                            <select
                                className="w-full h-12 border-2 border-transparent focus:border-primary rounded-xl px-4 bg-white dark:bg-gray-900 font-bold shadow-sm outline-none transition-all"
                                value={budgetNumClasses}
                                onChange={(e) => setBudgetNumClasses(Number(e.target.value))}
                            >
                                <option value="0">Selecione...</option>
                                {Array.from({ length: 50 }, (_, i) => i + 1).map(n => (
                                    <option key={n} value={n}>{n} turma{n > 1 ? 's' : ''}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="font-black uppercase text-xs text-gray-700 dark:text-gray-300 ml-1">Vigência</label>
                            <select
                                className="w-full h-12 border-2 border-transparent focus:border-primary rounded-xl px-4 bg-white dark:bg-gray-900 font-bold shadow-sm outline-none transition-all"
                                value={budgetLicenseType}
                                onChange={(e) => setBudgetLicenseType(e.target.value)}
                            >
                                <option>6 meses</option>
                                <option>Licença Ano ( 2026 )</option>
                                <option>Licença Ano ( 2027 )</option>
                                <option>Vitalício</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex justify-center gap-4 pt-6">
                        <Button onClick={onBack} variant="ghost" className="bg-black/10 hover:bg-black/20 text-gray-900 dark:text-gray-100">
                            Cancelar
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
            <h1 className="text-3xl font-medium mb-8 text-center md:text-left w-full">Resultado do Orçamento</h1>
            <div className="w-full bg-[#b5c69b] dark:bg-[#2d3a1e] rounded-3xl p-10 shadow-2xl border border-[#9eb084] space-y-10 animate-in fade-in slide-in-from-right-12">
                <div className="text-[#000080] dark:text-blue-200">
                    <p className="text-xl font-medium mb-2 opacity-80">Investimento necessário para {budgetNumClasses} turmas:</p>
                    <div className="flex items-baseline gap-4 flex-wrap">
                        <p className="text-5xl font-black tracking-tight">
                            R$ {budgetTotalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <span className="text-lg font-bold bg-white/20 px-3 py-1 rounded-lg border border-white/20">{budgetLicenseType}</span>
                    </div>
                </div>

                <div className="bg-white/50 dark:bg-black/20 p-8 rounded-2xl border border-white/40 dark:border-white/10">
                    <p className="font-black uppercase text-xs text-primary mb-4 tracking-widest">Incluso no pacote:</p>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-gray-800 dark:text-gray-200 font-medium text-sm">
                        <li className="flex items-center gap-2"><span className="material-symbols-outlined text-green-700">check_circle</span> Sistema Web Completo</li>
                        <li className="flex items-center gap-2"><span className="material-symbols-outlined text-green-700">check_circle</span> Processamento em Nuvem</li>
                        <li className="flex items-center gap-2"><span className="material-symbols-outlined text-green-700">check_circle</span> Editor de Grades</li>
                        <li className="flex items-center gap-2"><span className="material-symbols-outlined text-green-700">check_circle</span> Suporte Prioritário</li>
                        <li className="flex items-center gap-2"><span className="material-symbols-outlined text-green-700">check_circle</span> Backup Automático</li>
                        <li className="flex items-center gap-2"><span className="material-symbols-outlined text-green-700">check_circle</span> Exportação PDF/Excel</li>
                    </ul>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-4 pt-4">
                    <Button onClick={() => setStep('config')} variant="secondary" className="w-full md:w-auto">
                        Refazer Cálculo
                    </Button>
                    <Button onClick={() => setStep('form')} className="w-full md:w-auto px-8 text-lg shadow-xl">
                        Solicitar Proposta Formal
                    </Button>
                </div>
            </div>
        </div>
    );

    const renderForm = () => (
        <div className="flex-1 flex flex-col items-center p-6 w-full max-w-5xl mx-auto">
            <h1 className="text-3xl font-medium mb-8 text-center md:text-left w-full">Dados para Proposta</h1>
            <div className="w-full bg-[#b5c69b] dark:bg-[#2d3a1e] rounded-3xl p-10 shadow-2xl border border-[#9eb084] space-y-8 animate-in fade-in slide-in-from-right-12">
                <p className="text-lg text-gray-800 dark:text-gray-200 font-medium">Preencha os dados da instituição:</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="font-black uppercase text-xs text-gray-700 dark:text-gray-300 ml-1">Nome da Escola / Instituição</label>
                        <input type="text" className="w-full h-12 rounded-xl px-4 border-2 border-transparent focus:border-primary font-bold shadow-sm outline-none bg-white dark:bg-gray-900" value={applicantData.name} onChange={(e) => setApplicantData({ ...applicantData, name: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                        <label className="font-black uppercase text-xs text-gray-700 dark:text-gray-300 ml-1">Cidade / UF</label>
                        <input type="text" className="w-full h-12 rounded-xl px-4 border-2 border-transparent focus:border-primary font-bold shadow-sm outline-none bg-white dark:bg-gray-900" value={applicantData.city} onChange={(e) => setApplicantData({ ...applicantData, city: e.target.value })} />
                    </div>
                </div>

                <div className="flex justify-center gap-4 pt-8">
                    <Button onClick={() => setStep('result')} variant="secondary">Voltar</Button>
                    <Button onClick={() => setStep('proposal')} className="px-10 text-lg shadow-xl">
                        Gerar Documento
                    </Button>
                </div>
            </div>
        </div>
    );

    const renderProposal = () => (
        <div className="flex-1 flex flex-col items-center bg-gray-200 dark:bg-gray-900 min-h-[calc(100vh-64px)] p-8 overflow-y-auto">
            <div className="w-full max-w-4xl bg-white text-black shadow-2xl min-h-[800px] flex flex-col animate-in zoom-in-95 duration-500">
                <div className="bg-[#4a7766] p-8 flex items-center justify-between text-white print:bg-[#4a7766] print:print-color-adjust-exact">
                    <div className="flex items-center gap-4">
                        <div className="bg-white p-3 rounded-full"><span className="material-symbols-outlined text-[#4a7766] text-4xl">schedule</span></div>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tighter">HORÁRIO fácil</h1>
                            <p className="text-xs italic text-yellow-300 font-medium">Soluções Inteligentes para Gestão Escolar</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="font-bold text-lg">PROPOSTA COMERCIAL</p>
                        <p className="text-xs opacity-80">{new Date().toLocaleDateString()}</p>
                    </div>
                </div>

                <div className="p-12 space-y-12 flex-1">
                    <div className="border-b pb-8">
                        <p className="text-xs font-black uppercase text-gray-400 mb-1">Para:</p>
                        <p className="text-2xl font-bold">{applicantData.name}</p>
                        {applicantData.city && <p className="text-gray-600">{applicantData.city}</p>}
                    </div>

                    <div className="space-y-6">
                        <h3 className="font-bold text-xl text-[#4a7766] border-l-4 border-[#4a7766] pl-4">Objeto</h3>
                        <p className="leading-relaxed text-gray-700">
                            Fornecimento de licença de uso do software <strong>HORÁRIO fácil</strong>, plataforma especializada na elaboração e otimização de grades horárias escolares, utilizando inteligência artificial para resolução de conflitos.
                        </p>
                    </div>

                    <div className="space-y-6">
                        <h3 className="font-bold text-xl text-[#4a7766] border-l-4 border-[#4a7766] pl-4">Investimento</h3>
                        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                            <div className="flex justify-between items-center mb-4">
                                <span className="font-bold text-gray-600">Descrição</span>
                                <span className="font-bold text-gray-600">Valor</span>
                            </div>
                            <div className="flex justify-between items-center text-xl">
                                <span>Licença para {budgetNumClasses} Turmas ({budgetLicenseType})</span>
                                <span className="font-black">R$ {budgetTotalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-50 p-8 border-t border-gray-100 flex gap-4 print:hidden">
                    <Button onClick={() => window.print()} variant="secondary" className="flex items-center gap-2">
                        <span className="material-symbols-outlined">print</span> Imprimir
                    </Button>
                    <Button onClick={() => setStep('config')} className="flex items-center gap-2">
                        <span className="material-symbols-outlined">add</span> Novo Orçamento
                    </Button>
                    <Button onClick={onBack} variant="ghost" className="ml-auto">
                        Sair
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
