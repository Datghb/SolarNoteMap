import type { Lesson } from '../data/lessons';

export const TEACHER_LESSONS_KEY = 'solar-lessons:v1';
export const ACTIVITY_KEY = 'solar-activity:v1';
export type ActivityType = 'lesson_opened' | 'slide_viewed' | 'note_updated' | 'map_saved' | 'question_posted' | 'answer_posted' | 'understanding_updated';

export interface StudentActivity {
  id: string;
  studentId: string;
  studentName: string;
  lessonId: string;
  type: ActivityType;
  occurredAt: string;
  slideId?: string;
  metadata?: { wordCount?: number; nodeCount?: number; status?: string };
}

export interface TeacherLesson extends Lesson {
  published: boolean;
  pdfName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeacherLessonInput {
  name: string;
  shortName: string;
  description: string;
  prompt: string;
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
  const shortName = limited(input.shortName, 48, 'Tên ngắn');
  if (!name || !shortName) throw new Error('Tên bài giảng và tên ngắn không được để trống.');
  return {
    id,
    name,
    shortName,
    subtitle: 'Bài giảng do giáo viên tạo',
    description: limited(input.description, 500, 'Mô tả'),
    prompt: limited(input.prompt, 300, 'Câu hỏi dẫn đường') || `Những kiến thức quan trọng nhất trong “${name}” là gì?`,
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
      typeof lesson.description === 'string' && typeof lesson.prompt === 'string' && typeof lesson.color === 'string' &&
      Array.isArray(lesson.colors) && typeof lesson.published === 'boolean' && typeof lesson.createdAt === 'string';
  });
}

export function saveTeacherLessons(lessons: TeacherLesson[]) {
  localStorage.setItem(TEACHER_LESSONS_KEY, JSON.stringify(lessons));
  window.dispatchEvent(new CustomEvent('solar-course:changed'));
}

export function loadActivities() {
  const types = new Set<ActivityType>(['lesson_opened', 'slide_viewed', 'note_updated', 'map_saved', 'question_posted', 'answer_posted', 'understanding_updated']);
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

export function recordStudentActivity(activity: Omit<StudentActivity, 'id' | 'studentId' | 'studentName' | 'occurredAt'>) {
  const next = appendActivity(loadActivities(), {
    ...activity,
    id: crypto.randomUUID(),
    studentId: 'local-learner',
    studentName: 'Người học trên thiết bị',
    occurredAt: new Date().toISOString(),
  });
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('solar-activity:changed'));
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
