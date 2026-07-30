import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('../lib/supabase', () => ({
  requireSupabase: () => ({ rpc }),
}));

import { loadAdminAccounts, setAccountBlocked } from './adminAccounts';

beforeEach(() => rpc.mockReset());

describe('admin account API', () => {
  it('loads every account through the protected admin RPC', async () => {
    const rows = [{ id: 'user-1', email: 'student@example.com', display_name: 'An', role: 'student', created_at: '2026-07-29', class_count: 1 }];
    rpc.mockResolvedValue({ data: rows, error: null });

    await expect(loadAdminAccounts()).resolves.toEqual(rows);
    expect(rpc).toHaveBeenCalledWith('admin_list_accounts');
  });

  it('blocks a target account without changing its role', async () => {
    rpc.mockResolvedValue({ data: true, error: null });

    await expect(setAccountBlocked(' user-1 ', true, 'Vi phạm nội quy')).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith('admin_set_account_blocked', { target_user_id: 'user-1', should_block: true, reason: 'Vi phạm nội quy' });
  });

  it('rejects an empty account id before contacting Supabase', async () => {
    await expect(setAccountBlocked(' ', true)).rejects.toThrow('Tài khoản không hợp lệ');
    expect(rpc).not.toHaveBeenCalled();
  });
});
