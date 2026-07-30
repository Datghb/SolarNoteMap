import type { Lesson } from '../data/lessons';
import type { StudentActivity, TeacherLessonInput } from './courseStore';
import { requireSupabase } from '../lib/supabase';

export interface CloudClassroom { id: string; name: string; description: string; teacher_id: string; course_id: string; created_at: string }
export interface CloudCourse { id: string; name: string; description: string; owner_id: string; created_at: string }

const DB_TO_ACTIVITY: Record<string, StudentActivity['type']> = {
  lesson_viewed: 'lesson_opened', slide_viewed: 'slide_viewed', note_created: 'note_updated', map_created: 'map_saved', question_posted: 'question_posted', answer_posted: 'answer_posted', understanding_updated: 'understanding_updated',
};
const ACTIVITY_TO_DB: Record<StudentActivity['type'], string> = {
  lesson_opened: 'lesson_viewed', slide_viewed: 'slide_viewed', note_updated: 'note_created', map_saved: 'map_created',
  question_posted: 'question_posted', answer_posted: 'answer_posted', understanding_updated: 'understanding_updated',
};

export function toCloudActivityKind(type: StudentActivity['type']) { return ACTIVITY_TO_DB[type]; }
export function fromCloudActivityKind(kind: string) { return DB_TO_ACTIVITY[kind] ?? 'lesson_opened'; }
export function isClassLessonReleased(releaseAt: string | null | undefined, now = Date.now()) {
  return Boolean(releaseAt && new Date(releaseAt).getTime() <= now);
}

interface SupabaseErrorLike { code?: string; message?: string; details?: string }

export function courseSchemaIsMissing(value: unknown) {
  if (!value || typeof value !== 'object') return false;
  const error = value as SupabaseErrorLike;
  const message = error.message ?? '';
  if (error.code === 'PGRST202' || error.code === '42883') return ['load_class_lessons', 'load_course_lessons', 'create_course_secure', 'create_class_for_course', 'set_class_lesson_release'].some((name) => message.includes(name));
  if (error.code === 'PGRST204' || error.code === '42703') return message.includes('course_id');
  if (error.code === 'PGRST205' || error.code === '42P01') return message.includes('courses');
  return false;
}

function asError(value: unknown, fallback: string) {
  if (value instanceof Error) return value;
  if (value && typeof value === 'object') {
    const error = value as SupabaseErrorLike;
    const message = [error.message, error.details].filter(Boolean).join(' — ');
    if (message) return new Error(message);
  }
  return new Error(fallback);
}

function secureCreateRpcIsMissing(value: unknown) {
  if (!value || typeof value !== 'object') return false;
  const error = value as SupabaseErrorLike;
  return error.code === 'PGRST202' || error.code === '42883' || error.message?.includes('create_class_secure') === true && error.message.includes('not find');
}

export async function loadMyClasses() {
  const client = requireSupabase();
  const { data, error } = await client.from('classes').select('id,name,description,teacher_id,course_id,created_at').is('archived_at', null).order('created_at');
  if (error && courseSchemaIsMissing(error)) {
    const legacy = await client.from('classes').select('id,name,description,teacher_id,created_at').is('archived_at', null).order('created_at');
    if (legacy.error) throw asError(legacy.error, 'Không thể tải lớp học.');
    return (legacy.data ?? []).map((row) => ({ ...row, course_id: row.id })) as CloudClassroom[];
  }
  if (error) throw asError(error, 'Không thể tải lớp học.');
  return (data ?? []) as CloudClassroom[];
}

export async function loadOwnedClasses() {
  const client = requireSupabase();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return [];
  const { data, error } = await client.from('classes').select('id,name,description,teacher_id,course_id,created_at').eq('teacher_id', auth.user.id).is('archived_at', null).order('created_at');
  if (error && courseSchemaIsMissing(error)) {
    const legacy = await client.from('classes').select('id,name,description,teacher_id,created_at').eq('teacher_id', auth.user.id).is('archived_at', null).order('created_at');
    if (legacy.error) throw asError(legacy.error, 'Không thể tải lớp học.');
    return (legacy.data ?? []).map((row) => ({ ...row, course_id: row.id })) as CloudClassroom[];
  }
  if (error) throw asError(error, 'Không thể tải lớp học.');
  return (data ?? []) as CloudClassroom[];
}

export async function loadMyCourses() {
  const client = requireSupabase();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return [];
  const { data, error } = await client.from('courses').select('id,name,description,owner_id,created_at').eq('owner_id', auth.user.id).is('archived_at', null).order('created_at');
  if (error && courseSchemaIsMissing(error)) {
    const legacy = await client.from('classes').select('id,name,description,teacher_id,created_at').eq('teacher_id', auth.user.id).is('archived_at', null).order('created_at');
    if (legacy.error) throw asError(legacy.error, 'Không thể tải chương trình học.');
    return (legacy.data ?? []).map((row) => ({ id: row.id, name: row.name, description: row.description, owner_id: row.teacher_id, created_at: row.created_at })) as CloudCourse[];
  }
  if (error) throw asError(error, 'Không thể tải chương trình học.');
  return (data ?? []) as CloudCourse[];
}

export async function createCourse(name: string, description: string) {
  const { data, error } = await requireSupabase().rpc('create_course_secure', { course_name: name.trim(), course_description: description.trim() });
  if (error && courseSchemaIsMissing(error)) throw new Error('Database chưa có chức năng chương trình học. Hãy chạy migration 20260730100000_course_programs.sql.');
  if (error) throw asError(error, 'Không thể tạo chương trình học.');
  if (typeof data !== 'string') throw new Error('Máy chủ trả về chương trình không hợp lệ.');
  return data;
}

export async function createClassForCourse(courseId: string, name: string, description: string): Promise<{ classId: string; joinCode: string }> {
  const { data, error } = await requireSupabase().rpc('create_class_for_course', { target_course_id: courseId, class_name: name.trim(), class_description: description.trim() });
  if (error && courseSchemaIsMissing(error)) throw new Error('Database chưa có chức năng nhiều lớp. Hãy chạy migration 20260730100000_course_programs.sql.');
  if (error) throw asError(error, 'Không thể tạo lớp học.');
  if (!data || typeof data !== 'object' || typeof data.classId !== 'string' || typeof data.joinCode !== 'string') throw new Error('Máy chủ trả về lớp học không hợp lệ.');
  return { classId: data.classId, joinCode: data.joinCode };
}

export async function createClassroom(name: string, description: string): Promise<{ classId: string; joinCode: string }> {
  const client = requireSupabase();
  const args = { class_name: name.trim(), class_description: description.trim() };
  const { data, error } = await client.rpc('create_class_secure', args);
  if (error && secureCreateRpcIsMissing(error)) {
    throw new Error('Supabase chưa được cập nhật chức năng tạo lớp. Hãy chạy migration 20260730090200_join_code_rate_limit.sql.');
  }
  if (error) throw asError(error, 'Không thể tạo lớp học.');
  if (!data || typeof data !== 'object' || typeof data.classId !== 'string' || typeof data.joinCode !== 'string') throw new Error('Không thể tạo lớp học.');
  return { classId: data.classId, joinCode: data.joinCode };
}

export async function joinClassroom(joinCode: string) {
  const { data, error } = await requireSupabase().rpc('join_class', { join_token: joinCode.trim() });
  if (error) throw error;
  if (typeof data !== 'string') throw new Error('Mã lớp không đúng hoặc đã hết hiệu lực.');
  return data;
}

export async function loadCloudLessons(classId: string): Promise<Lesson[]> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('load_class_lessons', { target_class_id: classId });
  if (error && courseSchemaIsMissing(error)) {
    const legacy = await client.from('lessons').select('*').eq('class_id', classId).order('created_at');
    if (legacy.error) throw asError(legacy.error, 'Không thể tải bài giảng.');
    return mapLessonRows(client, legacy.data ?? []);
  }
  if (error) throw asError(error, 'Không thể tải bài giảng.');
  return mapLessonRows(client, data ?? []);
}

export async function loadCourseLessons(courseId: string): Promise<Lesson[]> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('load_course_lessons', { target_course_id: courseId });
  if (error) throw asError(error, 'Không thể tải bài giảng của chương trình.');
  return mapLessonRows(client, data ?? []);
}

async function mapLessonRows(client: ReturnType<typeof requireSupabase>, rows: Record<string, any>[]) {
  return Promise.all(rows.map(async (row) => {
    const signed = row.pdf_path
      ? await client.storage.from('lesson-pdfs').createSignedUrl(row.pdf_path, 3600)
      : { data: null, error: null };
    if (signed.error) throw signed.error;
    return {
    id: row.id, name: row.title, shortName: row.short_name, subtitle: isClassLessonReleased(row.published_at) ? 'Bài giảng đang mở' : row.published_at ? 'Bài giảng đã lên lịch' : 'Bài giảng đang khóa',
    description: row.description, color: '#8ea1ff',
    colors: ['#d8deff', '#7289ff', '#314387'], published: isClassLessonReleased(row.published_at), availableAt: row.published_at ?? undefined, pdfName: row.pdf_path?.split('/').pop(),
    pdfPath: row.pdf_path ?? undefined, pdfUrl: signed.data?.signedUrl,
    createdAt: row.created_at, updatedAt: row.updated_at,
    };
  }));
}

function safeSlug(value: string) {
  const base = value.toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'lesson';
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function createCloudLesson(courseId: string, userId: string, input: TeacherLessonInput, pdf?: File) {
  const client = requireSupabase();
  const id = safeSlug(input.name);
  const lessonDraft = { id, course_id: courseId, created_by: userId, title: input.name.trim(), short_name: input.shortName.trim(), description: input.description.trim(), prompt: '', pdf_path: null };
  let { data, error } = await client.from('lessons').insert(lessonDraft).select().single();
  if (error && courseSchemaIsMissing(error)) {
    const legacy = await client.from('lessons').insert({ ...lessonDraft, course_id: undefined, class_id: courseId }).select().single();
    data = legacy.data;
    error = legacy.error;
  }
  if (error) throw asError(error, 'Không thể tạo bản nháp bài giảng.');
  if (!pdf) return data;

  let pdfPath: string | null = null;
  if (pdf) {
    if (pdf.size > 50 * 1024 * 1024) {
      await client.from('lessons').delete().eq('id', id);
      throw new Error('PDF không được vượt quá 50 MB.');
    }
    const signature = new TextDecoder().decode(new Uint8Array(await pdf.slice(0, 5).arrayBuffer()));
    if (pdf.type !== 'application/pdf' || signature !== '%PDF-') {
      await client.from('lessons').delete().eq('id', id);
      throw new Error('Tệp tải lên không phải PDF hợp lệ.');
    }
    pdfPath = `${courseId}/${id}/lesson.pdf`;
    // Clear an interrupted, unattached upload from an earlier attempt. The path
    // is deterministic, so one draft lesson can never accumulate many objects.
    await client.storage.from('lesson-pdfs').remove([pdfPath]);
    const { error: uploadError } = await client.storage.from('lesson-pdfs').upload(pdfPath, pdf, { contentType: 'application/pdf', upsert: false });
    if (uploadError) {
      await client.from('lessons').delete().eq('id', id);
      throw new Error(`Không thể tải PDF lên: ${uploadError.message}`);
    }
  }

  if (!pdfPath) return data;
  const updated = await client.from('lessons').update({ pdf_path: pdfPath }).eq('id', id).select().single();
  if (updated.error) {
    await client.storage.from('lesson-pdfs').remove([pdfPath]);
    await client.from('lessons').delete().eq('id', id);
    throw asError(updated.error, 'Không thể gắn PDF vào bài giảng.');
  }
  return updated.data;
}

export async function setCloudLessonPublished(classId: string, lessonId: string, published: boolean) {
  return setCloudLessonRelease(classId, lessonId, published ? new Date().toISOString() : null);
}

export async function setCloudLessonRelease(classId: string, lessonId: string, releaseAt: string | null) {
  const { error } = await requireSupabase().rpc('set_class_lesson_release', { target_class_id: classId, target_lesson_id: lessonId, release_at: releaseAt });
  if (error) throw asError(error, 'Không thể cập nhật lịch bài giảng.');
}

export async function loadCloudActivities(classId: string): Promise<StudentActivity[]> {
  const { data, error } = await requireSupabase().from('student_activities').select('id,user_id,lesson_id,kind,metadata,occurred_at,profiles(display_name)').eq('class_id', classId).order('occurred_at', { ascending: false }).limit(1000);
  if (error) throw error;
  return (data ?? []).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    return { id: String(row.id), studentId: row.user_id, studentName: profile?.display_name ?? 'Học sinh', lessonId: row.lesson_id ?? '', type: fromCloudActivityKind(row.kind), occurredAt: row.occurred_at, slideId: typeof metadata.slideId === 'string' ? metadata.slideId : undefined, metadata };
  });
}

export async function recordCloudActivity(classId: string, lessonId: string, type: StudentActivity['type'], metadata: Record<string, unknown> = {}) {
  const client = requireSupabase();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return;
  const { error } = await client.from('student_activities').insert({ user_id: auth.user.id, class_id: classId, lesson_id: lessonId || null, kind: toCloudActivityKind(type), metadata });
  if (error) throw error;
}

export async function saveCloudNote(classId: string, lessonId: string, slideNumber: number, content: string) {
  const client = requireSupabase();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return;
  const { error } = await client.from('slide_notes').upsert({ class_id: classId, lesson_id: lessonId, user_id: auth.user.id, slide_number: slideNumber, content }, { onConflict: 'class_id,lesson_id,user_id,slide_number' });
  if (error) throw error;
}

export async function saveCloudMap(classId: string, lessonId: string, title: string, graph: unknown) {
  const client = requireSupabase();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return;
  const payload = { class_id: classId, lesson_id: lessonId, user_id: auth.user.id, title, graph };
  const { error } = await client.from('knowledge_maps').upsert(payload, { onConflict: 'class_id,lesson_id,user_id' });
  if (error) throw error;
}

export async function loadCloudLearningState(classId: string, lessonId: string) {
  const client = requireSupabase();
  const [{ data: notes, error: notesError }, { data: savedMap, error: mapError }] = await Promise.all([
    client.from('slide_notes').select('slide_number,content').eq('class_id', classId).eq('lesson_id', lessonId),
    client.from('knowledge_maps').select('graph').eq('class_id', classId).eq('lesson_id', lessonId).maybeSingle(),
  ]);
  if (notesError) throw notesError;
  if (mapError) throw mapError;
  return {
    notes: notes ?? [],
    map: savedMap?.graph ?? null,
  };
}
