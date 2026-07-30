import type { Lesson } from '../data/lessons';
import type { StudentActivity, TeacherLessonInput } from './courseStore';
import { requireSupabase } from '../lib/supabase';

export interface CloudClassroom { id: string; name: string; description: string; teacher_id: string; created_at: string }

const DB_TO_ACTIVITY: Record<string, StudentActivity['type']> = {
  lesson_viewed: 'lesson_opened', slide_viewed: 'slide_viewed', note_created: 'note_updated', map_created: 'map_saved', question_posted: 'question_posted', answer_posted: 'answer_posted', understanding_updated: 'understanding_updated',
};
const ACTIVITY_TO_DB: Record<StudentActivity['type'], string> = {
  lesson_opened: 'lesson_viewed', slide_viewed: 'slide_viewed', note_updated: 'note_created', map_saved: 'map_created',
  question_posted: 'question_posted', answer_posted: 'answer_posted', understanding_updated: 'understanding_updated',
};

export function toCloudActivityKind(type: StudentActivity['type']) { return ACTIVITY_TO_DB[type]; }
export function fromCloudActivityKind(kind: string) { return DB_TO_ACTIVITY[kind] ?? 'lesson_opened'; }

export async function loadMyClasses() {
  const { data, error } = await requireSupabase().from('classes').select('id,name,description,teacher_id,created_at').is('archived_at', null).order('created_at');
  if (error) throw error;
  return (data ?? []) as CloudClassroom[];
}

export async function createClassroom(name: string, description: string): Promise<{ classId: string; joinCode: string }> {
  const { data, error } = await requireSupabase().rpc('create_class_secure', { class_name: name.trim(), class_description: description.trim() });
  if (error) throw error;
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
  const { data, error } = await client.from('lessons').select('*').eq('class_id', classId).order('created_at');
  if (error) throw error;
  return Promise.all((data ?? []).map(async (row) => {
    const signed = row.pdf_path
      ? await client.storage.from('lesson-pdfs').createSignedUrl(row.pdf_path, 3600)
      : { data: null, error: null };
    if (signed.error) throw signed.error;
    return {
    id: row.id, name: row.title, shortName: row.short_name, subtitle: row.published_at ? 'Bài giảng đã xuất bản' : 'Bản nháp',
    description: row.description, prompt: row.prompt, color: '#8ea1ff',
    colors: ['#d8deff', '#7289ff', '#314387'], published: Boolean(row.published_at), pdfName: row.pdf_path?.split('/').pop(),
    pdfPath: row.pdf_path ?? undefined, pdfUrl: signed.data?.signedUrl,
    createdAt: row.created_at, updatedAt: row.updated_at,
    };
  }));
}

function safeSlug(value: string) {
  const base = value.toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'lesson';
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function createCloudLesson(classId: string, userId: string, input: TeacherLessonInput, pdf?: File) {
  const client = requireSupabase();
  const id = safeSlug(input.name);
  let pdfPath: string | null = null;
  if (pdf) {
    if (pdf.size > 50 * 1024 * 1024) throw new Error('PDF không được vượt quá 50 MB.');
    const signature = new TextDecoder().decode(new Uint8Array(await pdf.slice(0, 5).arrayBuffer()));
    if (pdf.type !== 'application/pdf' || signature !== '%PDF-') throw new Error('Tệp tải lên không phải PDF hợp lệ.');
    const cleanName = pdf.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-120);
    pdfPath = `${classId}/${id}/${crypto.randomUUID()}-${cleanName}`;
    const { error: uploadError } = await client.storage.from('lesson-pdfs').upload(pdfPath, pdf, { contentType: 'application/pdf', upsert: false });
    if (uploadError) throw uploadError;
  }
  const { data, error } = await client.from('lessons').insert({ id, class_id: classId, created_by: userId, title: input.name.trim(), short_name: input.shortName.trim(), description: input.description.trim(), prompt: input.prompt.trim(), pdf_path: pdfPath }).select().single();
  if (error) {
    if (pdfPath) await client.storage.from('lesson-pdfs').remove([pdfPath]);
    throw error;
  }
  return data;
}

export async function setCloudLessonPublished(lessonId: string, published: boolean) {
  const { error } = await requireSupabase().from('lessons').update({ published_at: published ? new Date().toISOString() : null }).eq('id', lessonId);
  if (error) throw error;
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

export async function saveCloudNote(lessonId: string, slideNumber: number, content: string) {
  const client = requireSupabase();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return;
  const { error } = await client.from('slide_notes').upsert({ lesson_id: lessonId, user_id: auth.user.id, slide_number: slideNumber, content }, { onConflict: 'lesson_id,user_id,slide_number' });
  if (error) throw error;
}

export async function saveCloudMap(lessonId: string, title: string, graph: unknown) {
  const client = requireSupabase();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return;
  const payload = { lesson_id: lessonId, user_id: auth.user.id, title, graph };
  const { error } = await client.from('knowledge_maps').upsert(payload, { onConflict: 'lesson_id,user_id' });
  if (error) throw error;
}

export async function loadCloudLearningState(lessonId: string) {
  const client = requireSupabase();
  const [{ data: notes, error: notesError }, { data: savedMap, error: mapError }] = await Promise.all([
    client.from('slide_notes').select('slide_number,content').eq('lesson_id', lessonId),
    client.from('knowledge_maps').select('graph').eq('lesson_id', lessonId).maybeSingle(),
  ]);
  if (notesError) throw notesError;
  if (mapError) throw mapError;
  return {
    notes: notes ?? [],
    map: savedMap?.graph ?? null,
  };
}
