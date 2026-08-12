import type { Lesson } from '../data/lessons';
import { recordCloudActivity, saveCloudMap, saveCloudNote } from './cloudClassroom';

export const TEACHER_LESSONS_KEY = 'solar-lessons:v1';
export const ACTIVITY_KEY = 'solar-activity:v1';
let activeCloudClassId: string | null = null;

export function setActiveCloudClass(classId: string | null) { activeCloudClassId = classId; }

export type ActivityType = 'lesson_opened' | 'slide_viewed' | 'note_updated' | 'map_saved' | 'question_posted' | 'answer_posted' | 'understanding_updated' | 'keyword_opened' | 'slide_dwell_completed' | 'quiz_recommended' | 'quiz_started' | 'quiz_completed' | 'quiz_dismissed';

export interface StudentActivity {
  id: string;
  studentId: string;
  studentName: string;
  lessonId: string;
  type: ActivityType;
  occurredAt: string;
  slideId?: string;
  metadata?: {
    wordCount?: number;
    nodeCount?: number;
    status?: string;
    slideId?: string;
    slideNumber?: number;
    keyword?: string;
    source?: string;
    activeSeconds?: number;
    trigger?: string;
    quizId?: string;
    score?: number;
    questionCount?: number;
    durationSeconds?: number;
    quizMode?: 'micro' | 'lesson_review';
    requestedQuestionCount?: number;
    deliveredQuestionCount?: number;
    retrievalVersion?: string;
  };
}

export interface TeacherLesson extends Lesson {
  published: boolean;
  pdfName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeacherLessonInput {
  name: string;
  shortName?: string;
  description: string;
  pdfName?: string;
}

function readArray(key: string): unknown[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    localStorage.removeItem(key);
    return [];
  }
}

function limited(value: string, max: number, label: string) {
  const clean = value.trim();
  if (clean.length > max) throw new Error(`${label} không được vượt quá ${max} ký tự.`);
  return clean;
}

export function createTeacherLesson(input: TeacherLessonInput, id: string = crypto.randomUUID(), now = new Date().toISOString()): TeacherLesson {
  const name = limited(input.name, 120, 'Tên bài giảng');
  const shortName = input.shortName
    ? limited(input.shortName, 48, 'Tên ngắn')
    : name;
  if (!name) throw new Error('Tên bài giảng không được để trống.');
  return {
    id,
    name,
    shortName,
    subtitle: 'Bài giảng do giáo viên tạo',
    description: limited(input.description, 500, 'Mô tả'),
    color: '#8ea1ff',
    colors: ['#d8deff', '#7289ff', '#314387'],
    published: false,
    pdfName: input.pdfName ? limited(input.pdfName, 180, 'Tên tệp') : undefined,
    createdAt: now,
    updatedAt: now,
  };
}

export function loadTeacherLessons() {
  return readArray(TEACHER_LESSONS_KEY).filter((value): value is TeacherLesson => {
    if (!value || typeof value !== 'object') return false;
    const lesson = value as Partial<TeacherLesson>;
    return typeof lesson.id === 'string' && typeof lesson.name === 'string' && typeof lesson.shortName === 'string' &&
      typeof lesson.description === 'string' && typeof lesson.color === 'string' &&
      Array.isArray(lesson.colors) && typeof lesson.published === 'boolean' && typeof lesson.createdAt === 'string';
  });
}

export function saveTeacherLessons(lessons: TeacherLesson[]) {
  localStorage.setItem(TEACHER_LESSONS_KEY, JSON.stringify(lessons));
  window.dispatchEvent(new CustomEvent('solar-course:changed'));
}

export function loadActivities() {
  const types = new Set<ActivityType>(['lesson_opened', 'slide_viewed', 'note_updated', 'map_saved', 'question_posted', 'answer_posted', 'understanding_updated', 'keyword_opened', 'slide_dwell_completed', 'quiz_recommended', 'quiz_started', 'quiz_completed', 'quiz_dismissed']);
  return readArray(ACTIVITY_KEY).filter((value): value is StudentActivity => {
    if (!value || typeof value !== 'object') return false;
    const activity = value as Partial<StudentActivity>;
    return typeof activity.id === 'string' && typeof activity.studentId === 'string' && typeof activity.studentName === 'string' &&
      activity.studentName.length <= 100 && typeof activity.lessonId === 'string' && typeof activity.occurredAt === 'string' &&
      typeof activity.type === 'string' && types.has(activity.type as ActivityType);
  });
}

export function appendActivity(current: StudentActivity[], activity: StudentActivity) {
  return [activity, ...current].slice(0, 1000);
}

export function buildCloudActivityMetadata(slideId: string | undefined, metadata: StudentActivity['metadata'] = {}) {
  return slideId ? { ...metadata, slideId } : { ...metadata };
}

export function recordStudentActivity(activity: Omit<StudentActivity, 'id' | 'studentId' | 'studentName' | 'occurredAt'>) {
  const next = appendActivity(loadActivities(), {
    ...activity,
    id: crypto.randomUUID(),
    studentId: 'anh-nguyen',
    studentName: 'Anh Nguyen',
    occurredAt: new Date().toISOString(),
  });
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('solar-activity:changed'));
  if (activeCloudClassId) void recordCloudActivity(activeCloudClassId, activity.lessonId, activity.type, buildCloudActivityMetadata(activity.slideId, activity.metadata)).catch(() => undefined);
}

export async function persistCloudNote(lessonId: string, slideNumber: number, content: string) {
  if (activeCloudClassId) await saveCloudNote(activeCloudClassId, lessonId, slideNumber, content);
}

export async function persistCloudMap(lessonId: string, title: string, graph: unknown) {
  if (activeCloudClassId) await saveCloudMap(activeCloudClassId, lessonId, title, graph);
}

export function summarizeClassroom(activities: StudentActivity[]) {
  return {
    activeStudents: new Set(activities.map((activity) => activity.studentId)).size,
    notes: activities.filter((activity) => activity.type === 'note_updated').length,
    maps: activities.filter((activity) => activity.type === 'map_saved').length,
    questions: activities.filter((activity) => activity.type === 'question_posted').length,
    totalEvents: activities.length,
  };
}
