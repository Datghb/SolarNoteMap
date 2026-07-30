import { afterEach, describe, expect, it, vi } from 'vitest';
import { askLessonSummaryAI, fetchLessonSummary } from './lessonSummary';

vi.mock('../lib/supabase', () => ({
  getSupabaseAuthHeaders: vi.fn().mockResolvedValue({ Authorization: 'Bearer test-access-token' }),
}));

afterEach(() => vi.restoreAllMocks());

describe('lesson summary API', () => {
  it('loads a persisted lesson summary', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ summary: 'Tổng quan bài học', source: 'cache' }), { status: 200 }));
    await expect(fetchLessonSummary('ai-foundations')).resolves.toEqual({ summary: 'Tổng quan bài học', source: 'cache' });
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith('/api/lesson-summary?lessonId=ai-foundations', {
      headers: { Authorization: 'Bearer test-access-token' },
    });
  });

  it('passes the uploaded PDF URL when summarizing a custom lesson', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ summary: 'Tóm tắt', source: 'generated' }), { status: 200 }));
    await fetchLessonSummary('custom-lesson', 'https://school.supabase.co/storage/v1/object/sign/lesson.pdf?token=signed');
    expect(String(fetchMock.mock.calls[0][0])).toContain('pdfUrl=https%3A%2F%2Fschool.supabase.co');
  });

  it('sends a bounded chat history with the question', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ answer: 'Câu trả lời' }), { status: 200 }));
    await askLessonSummaryAI('ai-foundations', ' Giải thích LLM ', [{ role: 'assistant', content: 'Chào bạn' }]);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ lessonId: 'ai-foundations', question: 'Giải thích LLM', history: [{ role: 'assistant', content: 'Chào bạn' }] });
  });

  it('rejects an empty summary question locally', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    await expect(askLessonSummaryAI('ai-foundations', '   ', [])).rejects.toThrow('Câu hỏi phải có');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
