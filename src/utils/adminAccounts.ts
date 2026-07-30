import { requireSupabase } from '../lib/supabase';

export type ManagedAccountRole = 'student' | 'teacher';

export interface AdminAccount {
  id: string;
  email: string;
  display_name: string;
  role: 'student' | 'teacher' | 'admin';
  created_at: string;
  class_count: number;
}

export interface AdminCourse { id: string; name: string; description: string; owner_id: string; created_at: string }
export interface AdminClassroom { id: string; name: string; course_id: string; teacher_id: string; created_at: string }

function courseSchemaIsMissing(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const value = error as { code?: string; message?: string };
  return ['PGRST204', 'PGRST205', '42703', '42P01'].includes(value.code ?? '') || value.message?.includes('course_id') === true || value.message?.includes('public.courses') === true;
}

export async function loadAdminAccounts(): Promise<AdminAccount[]> {
  const { data, error } = await requireSupabase().rpc('admin_list_accounts');
  if (error) throw error;
  return (data ?? []) as AdminAccount[];
}

export async function updateAccountRole(userId: string, role: ManagedAccountRole): Promise<void> {
  const targetUserId = userId.trim();
  if (!targetUserId) throw new Error('Tài khoản không hợp lệ.');
  const { error } = await requireSupabase().rpc('admin_set_account_role', {
    target_user_id: targetUserId,
    target_role: role,
  });
  if (error) throw error;
}

export async function loadAdminCourses(): Promise<AdminCourse[]> {
  const { data, error } = await requireSupabase().from('courses').select('id,name,description,owner_id,created_at').is('archived_at', null).order('created_at', { ascending: false });
  if (error && courseSchemaIsMissing(error)) return [];
  if (error) throw error;
  return (data ?? []) as AdminCourse[];
}

export async function loadAdminClasses(): Promise<AdminClassroom[]> {
  const client = requireSupabase();
  const { data, error } = await client.from('classes').select('id,name,course_id,teacher_id,created_at').is('archived_at', null).order('created_at', { ascending: false });
  if (error && courseSchemaIsMissing(error)) {
    const legacy = await client.from('classes').select('id,name,teacher_id,created_at').is('archived_at', null).order('created_at', { ascending: false });
    if (legacy.error) throw legacy.error;
    return (legacy.data ?? []).map((row) => ({ ...row, course_id: row.id })) as AdminClassroom[];
  }
  if (error) throw error;
  return (data ?? []) as AdminClassroom[];
}
