import { describe, expect, it } from 'vitest';
import { sanitizeSummaryChatMessages } from './summaryChatStore';

describe('summary chat storage', () => {
  it('keeps only valid, bounded chat messages', () => {
    const messages = sanitizeSummaryChatMessages([
      { role: 'user', content: '  Câu hỏi  ' },
      { role: 'assistant', content: 'Câu trả lời' },
      { role: 'system', content: 'không hợp lệ' },
      { role: 'user', content: '   ' },
    ]);

    expect(messages).toEqual([
      { role: 'user', content: 'Câu hỏi' },
      { role: 'assistant', content: 'Câu trả lời' },
    ]);
  });
});
