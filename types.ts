
export enum AppView {
  LOGIN = 'LOGIN',
  DASHBOARD = 'DASHBOARD',
  PLANS = 'PLANS',
  SETUP = 'SETUP',
  PROCESSING = 'PROCESSING',
  RESULT = 'RESULT',
  LICENSES = 'LICENSES',
  TEST_MODE_START = 'TEST_MODE_START',
  ADMIN = 'ADMIN'
}

export interface Institution {
  name: string;
  year: string;
  shift: string;
  additionalInfo: string;
}

export interface IntervalConfig {
  id: string;
  afterLesson: number;
  durationMinutes: number;
}

export interface TimeSlot {
  id: string;
  type: 'AULA' | 'INTERVALO';
  start: string;
  end: string;
}

export interface DaySchedule {
  day: string;
  slots: TimeSlot[];
}

export interface Subject {
  id: string;
  name: string;
  shortName: string;
  color: string;
  category: string;
}

export interface ClassRoom {
  id: string;
  name: string;
  students: number;
  room: string;
  subjects: string[]; // Subject IDs
  lessonsPerSubject: Record<string, number>; // subjectId -> number of weekly lessons
  shift?: string; // 'Manhã', 'Tarde', 'Noite'
  timeConstraints?: Record<string, AvailabilityStatus>; // "dayIndex-slotIndex" -> status 'D' | 'ND'
  specificTimeSubjects?: Record<string, { type: string; time?: string }>; // subjectId -> { type, time }
  groupingPerSubject?: Record<string, string>; // subjectId -> grouping option string
}

export type AvailabilityStatus = 'D' | 'IN' | 'ND';
export type ClassAssignmentStatus = 'PODERÁ' | 'OBRIGATORIAMENTE' | 'NÃO';

export interface Teacher {
  id: string;
  name: string;
  department: string;
  subjects: string[]; // Subject IDs
  shifts: string[]; // ['Manhã', 'Tarde', 'Noite']
  availability?: Record<string, AvailabilityStatus>; // "dayIndex-slotIndex" -> status
  classAssignments?: Record<string, Record<string, ClassAssignmentStatus>>; // subjectId -> { classId -> status }
  dailyLimits?: Record<string, number>; // "dayIndex" -> max lessons per day
}

export interface FixedLesson {
  classId: string;
  subjectId: string;
  teacherId: string;
  day: string;
  slotIndex: number;
  isManual?: boolean;
}

export interface WeekConfig {
  activeDays: string[];
  startHour: number;
  startMinute: number;
  durationMinute: number;
  lessonsPerDayGlobal: number;
  intervals: IntervalConfig[];
}

export interface SchedulingFailure {
  subjectId: string;
  classId: string;
  teacherId: string;
  reason: 'TEACHER_LIMIT' | 'NO_AVAILABILITY' | 'CLASS_LIMIT' | 'CONFLICT';
  details?: string;
}

export interface SetupData {
  id?: string;
  createdAt?: string;
  updatedAt?: string;
  status?: string;
  currentStep?: number;
  institution: Institution;
  weekConfig?: WeekConfig;
  schedule: DaySchedule[];
  subjects: Subject[];
  classes: ClassRoom[];
  teachers: Teacher[];
  groupingOptions: {
    minimizeMovement: boolean;
    clusterLessons: boolean;
    distributionType: 'consecutive' | 'dense' | 'random';
    doubleLessons: 'required' | 'allowed' | 'forbidden';
    maxWindows: number;
    syncLunch: boolean;
  };
  assignmentGroupings?: Record<string, string>; // "teacherId|classId|subjectId" -> grouping choice
  teacherGroupings?: Record<string, string>; // teacherId -> grouping choice
  subjectGroupings?: Record<string, string>; // subjectId -> grouping choice
  generalGrouping?: string; // Global grouping choice
  fixedLessons?: FixedLesson[];
  pinnedLessons?: FixedLesson[];
  failures?: SchedulingFailure[];
  isLicensed?: boolean;
  licenseStatus?: string;
}
