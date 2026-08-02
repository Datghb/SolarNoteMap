import { describe, expect, it, vi } from 'vitest';
import { copyTextToClipboard } from './clipboard';

describe('copyTextToClipboard', () => {
  it('writes the complete class code to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    await expect(copyTextToClipboard('class-code-123', { writeText })).resolves.toBeUndefined();
    expect(writeText).toHaveBeenCalledWith('class-code-123');
  });

  it('rejects empty text', async () => {
    await expect(copyTextToClipboard(' ', { writeText: vi.fn() })).rejects.toThrow('Không có mã để sao chép');
  });
});
