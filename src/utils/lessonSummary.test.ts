import { afterEach, describe, expect, it, vi } from 'vitest';
import { askLessonSummaryAI, fetchLessonKeywords, fetchLessonSummary, generateLessonKeywords, isExtractiveFallbackSummary, queueLessonSummaryGeneration } from './lessonSummary';

vi.mock('../lib/supabase', () => ({
  getSupabaseAuthHeaders: vi.fn().mockResolvedValue({ Authorization: 'Bearer test-access-token' }),
}));

afterEach(() => vi.restoreAllMocks());

describe('lesson summary API', () => {
  it('recognizes obsolete extractive summaries', () => {
    expect(isExtractiveFallbackSummary('## Tổng quan bài học\n## Nội dung theo từng slide\n### Trang 1\nRaw text')).toBe(true);
    expect(isExtractiveFallbackSummary('## Tổng quan bài học\nAI đã tổng hợp nội dung.')).toBe(false);
  });

  it('loads a persisted lesson summary', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ summary: 'Tổng quan bài học', source: 'cache' }), { status: 200 }));
    await expect(fetchLessonSummary('ai-foundations')).resolves.toEqual({ summary: 'Tổng quan bài học', source: 'cache', keywords: [] });
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith('/api/lesson-summary?lessonId=ai-foundations', {
      headers: { Authorization: 'Bearer test-access-token' },
    });
  });

  it('loads persisted keyword definitions for a lesson', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ keywords: [{ term: 'LLM', definition: 'Mô hình ngôn ngữ lớn.' }] }), { status: 200 }));
    await expect(fetchLessonKeywords('ai-foundations')).resolves.toEqual([{ term: 'LLM', definition: 'Mô hình ngôn ngữ lớn.' }]);
  });

  it('requests pedagogical keyword explanations for an existing summary', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ keywords: [{ term: 'Eval', definition: 'Eval là quy trình kiểm tra có hệ thống chất lượng đầu ra của mô hình AI.' }] }), { status: 200 }));
    await expect(generateLessonKeywords('day-5', 'Nội dung bài học có **Eval**.')).resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/lesson-keywords/generate', expect.objectContaining({ method: 'POST' }));
  });

  it('passes the uploaded PDF URL when summarizing a custom lesson', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ summary: 'Tóm tắt', source: 'generated' }), { status: 200 }));
    await fetchLessonSummary('custom-lesson', 'https://school.supabase.co/storage/v1/object/sign/lesson.pdf?token=signed');
    expect(String(fetchMock.mock.calls[0][0])).toContain('pdfUrl=https%3A%2F%2Fschool.supabase.co');
  });

  it('can force regeneration after a PDF replacement', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ summary: 'Bản mới', source: 'generated' }), { status: 200 }));
    await fetchLessonSummary('custom-lesson', 'https://school.supabase.co/storage/v1/object/sign/lesson.pdf', true);
    expect(String(fetchMock.mock.calls[0][0])).toContain('force=true');
  });

  it('queues summary generation without waiting for the AI result', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ queued: true }), { status: 202 }));
    await queueLessonSummaryGeneration('lesson-9', 'https://school.supabase.co/storage/v1/object/sign/lesson.pdf');
    expect(fetchMock).toHaveBeenCalledWith('/api/lesson-summary/generate', expect.objectContaining({ method: 'POST' }));
  });

  it('sends a bounded chat history with the question', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ answer: 'Câu trả lời' }), { status: 200 }));
    await askLessonSummaryAI('ai-foundations', ' Giải thích LLM ', [{ role: 'assistant', content: 'Chào bạn' }]);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ lessonId: 'ai-foundations', question: 'Giải thích LLM', history: [{ role: 'assistant', content: 'Chào bạn' }] });
  });

  it('sends the loaded summary as chat context', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ answer: 'Giải thích' }), { status: 200 }));
    await askLessonSummaryAI('custom-lesson', 'Giải thích', [], undefined, undefined, 'Nội dung tóm tắt đã lưu');
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).summary).toBe('Nội dung tóm tắt đã lưu');
  });

  it('rejects an empty summary question locally', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    await expect(askLessonSummaryAI('ai-foundations', '   ', [])).rejects.toThrow('Câu hỏi phải có');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
