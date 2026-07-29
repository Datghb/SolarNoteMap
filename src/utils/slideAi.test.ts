import { afterEach, describe, expect, it, vi } from 'vitest';
import { askSlideAI } from './slideAi';

afterEach(() => vi.restoreAllMocks());

describe('askSlideAI', () => {
  it('sends the page, question and note to the slide endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ answer: 'Đây là câu trả lời.', model: 'test' }), { status: 200 }));
    await expect(askSlideAI({ page: 2, question: '  Mục này nghĩa là gì? ', note: 'Ghi chú' })).resolves.toEqual({ answer: 'Đây là câu trả lời.', model: 'test' });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ page: 2, question: 'Mục này nghĩa là gì?', note: 'Ghi chú', image: '', useBundledPdfContext: false });
  });

  it('rejects empty questions before calling the server', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    await expect(askSlideAI({ page: 1, question: '   ' })).rejects.toThrow('Câu hỏi phải có');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows a safe server error to the learner', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: 'Máy chủ chưa được cấu hình OpenAI API key.' }), { status: 503 }));
    await expect(askSlideAI({ page: 1, question: 'Giải thích giúp mình' })).rejects.toThrow('OpenAI API key');
  });
});
