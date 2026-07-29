import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('../lib/supabase', () => ({
  requireSupabase: () => ({ rpc }),
}));

import { loadAdminAccounts, updateAccountRole } from './adminAccounts';

beforeEach(() => rpc.mockReset());

describe('admin account API', () => {
  it('loads every account through the protected admin RPC', async () => {
    const rows = [{ id: 'user-1', email: 'student@example.com', display_name: 'An', role: 'student', created_at: '2026-07-29', class_count: 1 }];
    rpc.mockResolvedValue({ data: rows, error: null });

    await expect(loadAdminAccounts()).resolves.toEqual(rows);
    expect(rpc).toHaveBeenCalledWith('admin_list_accounts');
  });

  it('changes a target account to an allowed role', async () => {
    rpc.mockResolvedValue({ data: true, error: null });

    await expect(updateAccountRole(' user-1 ', 'teacher')).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith('admin_set_account_role', { target_user_id: 'user-1', target_role: 'teacher' });
  });

  it('rejects an empty account id before contacting Supabase', async () => {
    await expect(updateAccountRole(' ', 'student')).rejects.toThrow('Tài khoản không hợp lệ');
    expect(rpc).not.toHaveBeenCalled();
  });
});
