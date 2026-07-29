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
