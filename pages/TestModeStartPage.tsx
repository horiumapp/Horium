import React from 'react';
import { LOGO_SVG } from '../constants';

interface TestModeStartPageProps {
  onStart: () => void;
}

const TestModeStartPage: React.FC<TestModeStartPageProps> = ({ onStart }) => {
  const tutorials = [
    { title: 'Tutorial Etapa 1', subtitle: 'Identificando', color: 'bg-[#b5c69b]' },
    { title: 'Tutorial Etapa 2', subtitle: 'Semana', color: 'bg-[#5da9e9]' },
    { title: 'Tutorial Etapa 3', subtitle: 'Disciplinas', color: 'bg-[#66cdaa]' },
    { title: 'Tutorial Etapa 4', subtitle: 'Turmas', color: 'bg-[#9370db]' },
  ];

  return (
    <div className="flex-1 bg-white dark:bg-black min-h-[calc(100vh-64px)] p-8">
      <h1 className="text-2xl font-bold mb-10 text-[#111418] dark:text-white">Horium - Clique abaixo para iniciar.</h1>
      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_400px] gap-12">
        <div className="flex flex-col items-center gap-6 border-r border-gray-400 pr-12">
          <button onClick={onStart} className="w-24 h-24 bg-gray-200 dark:bg-gray-800 rounded-full border-4 border-gray-400 flex items-center justify-center hover:scale-105 transition-transform">
            <div className="w-12 h-12 text-gray-700 dark:text-gray-300">
              {LOGO_SVG}
            </div>
          </button>
        </div>
        <div className="space-y-6">
          <h2 className="text-lg font-bold">Instruções</h2>
          <button onClick={onStart} className="text-blue-700 underline font-bold">Iniciar Horium</button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {tutorials.map((t, idx) => (
            <div key={idx} className={`aspect-video rounded-lg ${t.color} flex items-center justify-center p-2 text-center text-white font-bold text-[10px]`}>
              {t.title}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TestModeStartPage;