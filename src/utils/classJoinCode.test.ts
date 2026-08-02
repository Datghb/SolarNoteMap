import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('../lib/supabase', () => ({ requireSupabase: () => ({ rpc }) }));

import { joinClassroom, regenerateClassJoinCode } from './cloudClassroom';

beforeEach(() => rpc.mockReset());

describe('class join code API', () => {
  it('joins another class with a normalized code', async () => {
    rpc.mockResolvedValue({ data: 'class-2', error: null });
    await expect(joinClassroom('  abc12345  ')).resolves.toBe('class-2');
    expect(rpc).toHaveBeenCalledWith('join_class', { join_token: 'abc12345' });
  });

  it('rejects an invalid join response', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(joinClassroom('abc12345')).rejects.toThrow('Mã lớp không đúng hoặc đã hết hiệu lực');
  });

  it('regenerates a join code through the protected RPC', async () => {
    rpc.mockResolvedValue({ data: { joinCode: 'new-code-123' }, error: null });
    await expect(regenerateClassJoinCode(' class-1 ')).resolves.toBe('new-code-123');
    expect(rpc).toHaveBeenCalledWith('regenerate_class_join_code', { target_class_id: 'class-1' });
  });

  it('rejects an empty class id before contacting Supabase', async () => {
    await expect(regenerateClassJoinCode(' ')).rejects.toThrow('Lớp học không hợp lệ');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('reports when the database migration is missing', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Function not found' } });
    await expect(regenerateClassJoinCode('class-1')).rejects.toThrow('20260802120000_regenerate_class_join_code.sql');
  });
});
