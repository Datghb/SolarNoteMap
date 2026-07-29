export type SummaryChatRole = 'user' | 'assistant';
export interface SummaryChatMessage { role: SummaryChatRole; content: string }
export interface LessonSummaryResult { summary: string; source: 'cache' | 'generated' }

export async function fetchLessonSummary(lessonId: string): Promise<LessonSummaryResult> {
  return fetch(`/api/lesson-summary?lessonId=${encodeURIComponent(lessonId)}`, { headers: await getSupabaseAuthHeaders() })
    .then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'Không thể tạo bản tóm tắt.');
      if (typeof payload.summary !== 'string' || !payload.summary.trim()) throw new Error('AI trả về bản tóm tắt không hợp lệ.');
      return { summary: payload.summary.trim(), source: payload.source === 'cache' ? 'cache' : 'generated' } as LessonSummaryResult;
    });
}

export async function askLessonSummaryAI(lessonId: string, questionValue: string, history: SummaryChatMessage[], signal?: AbortSignal) {
  const question = questionValue.trim();
  if (!question || question.length > 1_000) throw new Error('Câu hỏi phải có từ 1 đến 1.000 ký tự.');
  const safeHistory = history.slice(-8).map((message) => ({ role: message.role, content: message.content.slice(0, 2_000) }));
  const response = await fetch('/api/lesson-summary-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...await getSupabaseAuthHeaders() },
    body: JSON.stringify({ lessonId, question, history: safeHistory }),
    signal,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'AI chưa thể trả lời lúc này.');
  if (typeof payload.answer !== 'string' || !payload.answer.trim()) throw new Error('AI trả về câu trả lời không hợp lệ.');
  return payload.answer.trim();
}
import { getSupabaseAuthHeaders } from '../lib/supabase';
