import React from 'react';
import { SetupData } from './types';

export const DAYS_OF_WEEK = [
  'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'
];

export const CATEGORIES = [
  'Base Nacional Comum',
  'Ciências da Natureza',
  'Ciências Humanas',
  'Linguagens e Códigos',
  'Eletiva Avançada'
];

export const COLORS = [
  { name: 'Azul Real', hex: '#136dec' },
  { name: 'Esmeralda', hex: '#10b981' },
  { name: 'Âmbar', hex: '#f59e0b' },
  { name: 'Violeta', hex: '#8b5cf6' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'Escarlate', hex: '#ef4444' },
  { name: 'Índigo', hex: '#6366f1' },
  { name: 'Ciano', hex: '#06b6d4' },
  { name: 'Lima', hex: '#84cc16' },
  { name: 'Rosa Choque', hex: '#f43f5e' },
  { name: 'Dourado', hex: '#eab308' },
  { name: 'Azul Céu', hex: '#3b82f6' },
  { name: 'Roxo Profundo', hex: '#a855f7' },
  { name: 'Teal', hex: '#14b8a6' },
  { name: 'Laranja Queimado', hex: '#f97316' },
  { name: 'Cinza Ardósia', hex: '#64748b' },
  { name: 'Menta', hex: '#4ade80' },
  { name: 'Coral', hex: '#fb7185' },
  { name: 'Lavanda', hex: '#818cf8' },
  { name: 'Turquesa', hex: '#2dd4bf' }
];

export const INITIAL_SETUP: SetupData = {
  institution: {
    name: '',
    year: '2026',
    shift: 'Integral',
    additionalInfo: ''
  },
  isLicensed: false,
  weekConfig: {
    activeDays: ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'],
    startHour: 7,
    startMinute: 0,
    durationMinute: 45,
    lessonsPerDayGlobal: 5,
    intervals: [
      { id: 'int-1', afterLesson: 2, durationMinutes: 15 }
    ]
  },
  schedule: DAYS_OF_WEEK.map(day => ({ day, slots: [] })),
  subjects: [
    { id: '1', name: 'ARTES', shortName: 'ART', color: '#136dec', category: 'Base Nacional Comum' },
    { id: '2', name: 'BIOLOGIA', shortName: 'BIO', color: '#10b981', category: 'Base Nacional Comum' },
    { id: '3', name: 'EDUCAÇÃO FÍSICA', shortName: 'EFIS', color: '#ec4899', category: 'Base Nacional Comum' },
    { id: '4', name: 'ENFAS CIENTE', shortName: 'CIEN', color: '#f59e0b', category: 'Base Nacional Comum' },
    { id: '5', name: 'ENFAS HUMANAS', shortName: 'EHUM', color: '#8b5cf6', category: 'Base Nacional Comum' },
    { id: '6', name: 'ENFAS LINGUAGEM', shortName: 'ELIN', color: '#eab308', category: 'Base Nacional Comum' },
    { id: '7', name: 'ENFAS MATEMÁTICA', shortName: 'EMAT', color: '#14b8a6', category: 'Base Nacional Comum' },
    { id: '8', name: 'FILOSOFIA', shortName: 'FILO', color: '#ef4444', category: 'Base Nacional Comum' },
    { id: '9', name: 'FÍSICA', shortName: 'FIS', color: '#6366f1', category: 'Base Nacional Comum' },
    { id: '10', name: 'GEOGRAFIA', shortName: 'GEO', color: '#84cc16', category: 'Base Nacional Comum' },
    { id: '11', name: 'HISTÓRIA', shortName: 'HIS', color: '#06b6d4', category: 'Base Nacional Comum' },
    { id: '12', name: 'INFORMÁTICA', shortName: 'INFO', color: '#2dd4bf', category: 'Base Nacional Comum' },
    { id: '13', name: 'INGLÊS', shortName: 'ING', color: '#f43f5e', category: 'Base Nacional Comum' },
    { id: '14', name: 'JURÍDICO', shortName: 'JURI', color: '#fb7185', category: 'Base Nacional Comum' },
    { id: '15', name: 'LETRAMENTO MATEMÁTICO', shortName: 'LMAT', color: '#64748b', category: 'Base Nacional Comum' },
    { id: '16', name: 'LITERATURA', shortName: 'LPT', color: '#818cf8', category: 'Base Nacional Comum' },
    { id: '17', name: 'MATEMÁTICA', shortName: 'MAT', color: '#f97316', category: 'Base Nacional Comum' },
    { id: '18', name: 'PORTUGUÊS', shortName: 'POR', color: '#3b82f6', category: 'Base Nacional Comum' },
    { id: '19', name: 'QUÍMICA', shortName: 'QUI', color: '#a855f7', category: 'Base Nacional Comum' },
    { id: '20', name: 'SOCIOLOGIA', shortName: 'SOCI', color: '#4ade80', category: 'Base Nacional Comum' }
  ],
  classes: [],
  teachers: [],
  groupingOptions: {
    minimizeMovement: true,
    clusterLessons: false,
    distributionType: 'consecutive',
    doubleLessons: 'allowed',
    maxWindows: 1,
    syncLunch: false
  }
};

export const GROUPING_OPTIONS_2_LESSONS = [
  "Não Especificado",
  "Agrupamento Livre",
  "Agrupar no máximo 2 aulas por dia SEGUIDAS",
  "Permitir no máximo 2 aulas por dia LIVRES (Intercaladas ou Seguidas)",
  "Permitir no máximo 2 aulas por dia INTERCALADAS",
  "No máximo 1 aula por dia",
  "Agrupar Obrigatoriamente - O sistema somente permitirá aulas duplas",
  "Agrupar Obrigatoriamente - O sistema somente permitirá aulas duplas sem intervalos",
  "Agrupar Obrigatoriamente - O sistema somente permitirá aulas duplas com intervalo no meio"
];

export const GROUPING_OPTIONS_3_LESSONS = [
  "Não Especificado",
  "Agrupamento Livre",
  "Agrupar no máximo 3 aulas por dia SEGUIDAS",
  "Agrupar no máximo 2 aulas por dia SEGUIDAS",
  "Permitir no máximo 3 aulas por dia LIVRES (Intercaladas ou Seguidas)",
  "Permitir no máximo 2 aulas por dia LIVRES (Intercaladas ou Seguidas)",
  "Permitir no máximo 3 aulas por dia INTERCALADAS",
  "Permitir no máximo 2 aulas por dia INTERCALADAS",
  "(Agrupar Parcial 2-1 SEGUIDAS) 2 aulas JUNTAS em um dia e 1 aula sozinha em outro dia",
  "(Parcial 2-1 LIVRE) 2 aulas em um dia e 1 aula em outro dia",
  "(Parcial 2-1 INTERCALADAS) 2 aulas Intercaladas em um dia e 1 aula sozinha em outro dia",
  "No máximo 1 aula por dia",
  "Agrupar Obrigatoriamente - O sistema somente permitirá aulas triplas"
];

export const GROUPING_OPTIONS_4_LESSONS = [
  "Não Especificado",
  "Agrupamento Livre",
  "Agrupar no máximo 4 aulas por dia SEGUIDAS",
  "Agrupar no máximo 3 aulas por dia SEGUIDAS",
  "Agrupar no máximo 2 aulas por dia SEGUIDAS",
  "Permitir no máximo 4 aulas por dia LIVRES (Intercaladas ou Seguidas)",
  "Permitir no máximo 3 aulas por dia LIVRES (Intercaladas ou Seguidas)",
  "Permitir no máximo 2 aulas por dia LIVRES (Intercaladas ou Seguidas)",
  "Permitir no máximo 4 aulas por dia INTERCALADAS",
  "Permitir no máximo 3 aulas por dia INTERCALADAS",
  "Permitir no máximo 2 aulas por dia INTERCALADAS",
  "No máximo 1 aula por dia",
  "Agrupar Obrigatoriamente - O sistema somente permitirá aulas duplas",
  "Agrupar Obrigatoriamente - O sistema somente permitirá aulas duplas sem intervalos",
  "Agrupar 4 Aulas no mesmo dia Livres(Intercaladas ou Seguidas)",
  "Agrupar 4 Aulas SEGUIDAS no mesmo dia",
  "(Agrupar Parcial 2-1-1 Seguidas) 2 Aulas Seguidas em um dia e 1 aula sozinhas em 2 dias",
  "(Parcial 2-1-1 LIVRE) 2 aulas em um dia e 1 aula em cada um dos outros 2 dias"
];

export const GROUPING_OPTIONS_5_LESSONS = [
  "Não Especificado",
  "Agrupamento Livre",
  "Agrupar no máximo 5 aulas por dia SEGUIDAS",
  "Agrupar no máximo 4 aulas por dia SEGUIDAS",
  "Agrupar no máximo 3 aulas por dia SEGUIDAS",
  "Agrupar no máximo 2 aulas por dia SEGUIDAS",
  "Permitir no máximo 5 aulas por dia LIVRES (Intercaladas ou Seguidas)",
  "Permitir no máximo 4 aulas por dia LIVRES (Intercaladas ou Seguidas)",
  "Permitir no máximo 3 aulas por dia LIVRES (Intercaladas ou Seguidas)",
  "Permitir no máximo 2 aulas por dia LIVRES (Intercaladas ou Seguidas)",
  "Permitir no máximo 5 aulas por dia INTERCALADAS",
  "Permitir no máximo 4 aulas por dia INTERCALADAS",
  "Permitir no máximo 3 aulas por dia INTERCALADAS",
  "Permitir no máximo 2 aulas por dia INTERCALADAS",
  "(Agrupar Parcial 3-2 SEGUIDAS) 3 aulas SEGUIDAS em um dia e 2 aulas SEGUIDAS em outro dia",
  "(Agrupar Parcial 2-2-1 SEGUIDAS) 2 aulas JUNTAS em dois dias e 1 aula sozinha em outro dia",
  "(Agrupar Parcial 2-1-1-1 SEGUIDAS) 2 aulas SEGUIDAS em um dia e 1 aula sozinha em 3 dias",
  "(Parcial 3-2 LIVRE) 3 aulas em um dia e 2 aulas em outro dia",
  "(Parcial 2-2-1 LIVRE) 2 aulas em dois dias e 1 aula em outro dia",
  "(Parcial 2-1-1-1 LIVRE) 2 aulas em um dia e 1 aula sozinha em 3 dias"
];

export const GROUPING_OPTIONS_10_LESSONS = [
  "Não Especificado",
  "Agrupamento Livre",
  "Agrupar no máximo 5 aulas por dia SEGUIDAS",
  "Agrupar no máximo 4 aulas por dia SEGUIDAS",
  "Agrupar no máximo 3 aulas por dia SEGUIDAS",
  "Agrupar no máximo 2 aulas por dia SEGUIDAS",
  "Permitir no máximo 5 aulas por dia LIVRES (Intercaladas ou Seguidas)",
  "Permitir no máximo 4 aulas por dia LIVRES (Intercaladas ou Seguidas)",
  "Permitir no máximo 3 aulas por dia LIVRES (Intercaladas ou Seguidas)",
  "Permitir no máximo 2 aulas por dia LIVRES (Intercaladas ou Seguidas)",
  "Permitir no máximo 5 aulas por dia INTERCALADAS",
  "Permitir no máximo 4 aulas por dia INTERCALADAS",
  "Permitir no máximo 3 aulas por dia INTERCALADAS",
  "Permitir no máximo 2 aulas por dia INTERCALADAS",
  "Agrupar Obrigatoriamente - O sistema somente permitirá aulas duplas",
  "Agrupar Obrigatoriamente - O sistema somente permitirá aulas duplas sem intervalos"
];

export const GENERAL_GROUPING_OPTIONS = [
  "Não Especificado",
  "Agrupamento Livre",
  "Agrupar no máximo 5 aulas por dia SEGUIDAS",
  "Agrupar no máximo 4 aulas por dia SEGUIDAS",
  "Agrupar no máximo 3 aulas por dia SEGUIDAS",
  "Agrupar no máximo 2 aulas por dia SEGUIDAS",
  "Permitir no máximo 5 aulas por dia LIVRES (Intercaladas ou Seguidas)",
  "Permitir no máximo 4 aulas por dia LIVRES (Intercaladas ou Seguidas)",
  "Permitir no máximo 3 aulas por dia LIVRES (Intercaladas ou Seguidas)",
  "Permitir no máximo 2 aulas por dia LIVRES (Intercaladas ou Seguidas)",
  "Permitir no máximo 5 aulas por dia INTERCALADAS",
  "Permitir no máximo 4 aulas por dia INTERCALADAS",
  "Permitir no máximo 3 aulas por dia INTERCALADAS",
  "Permitir no máximo 2 aulas por dia INTERCALADAS",
  "No máximo 1 aula por dia",
  "Agrupar Obrigatoriamente - O sistema somente permitirá aulas duplas",
  "Agrupar Obrigatoriamente - O sistema somente permitirá aulas duplas sem intervalos",
  "Agrupar Obrigatoriamente - O sistema somente permitirá aulas triplas"
];

export const LOGO_SVG = (
  <img src="/logo.png.png" alt="Horium Logo" className="w-full h-full object-contain drop-shadow-sm" />
);
