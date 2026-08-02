export type SummaryChatRole = 'user' | 'assistant';
export interface SummaryChatMessage { role: SummaryChatRole; content: string }
export interface LessonKeyword { term: string; definition: string }
export interface LessonSummaryResult { summary: string; source: 'cache' | 'generated'; keywords: LessonKeyword[] }

export function isExtractiveFallbackSummary(summary?: string) {
  if (!summary) return false;
  return summary.includes('## Nội dung theo từng slide')
    && /### Trang \d+/.test(summary);
}

export async function queueLessonSummaryGeneration(lessonId: string, pdfUrl: string, force = false) {
  const response = await fetch('/api/lesson-summary/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...await getSupabaseAuthHeaders() },
    body: JSON.stringify({ lessonId, pdfUrl, force }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'Không thể bắt đầu tạo bản tóm tắt.');
}

export async function fetchLessonSummary(lessonId: string, pdfUrl?: string, force = false): Promise<LessonSummaryResult> {
  const query = new URLSearchParams({ lessonId });
  if (pdfUrl) query.set('pdfUrl', pdfUrl);
  if (force) query.set('force', 'true');
  return fetch(`/api/lesson-summary?${query.toString()}`, { headers: await getSupabaseAuthHeaders() })
    .then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'Không thể tạo bản tóm tắt.');
      if (typeof payload.summary !== 'string' || !payload.summary.trim()) throw new Error('AI trả về bản tóm tắt không hợp lệ.');
      const keywords = Array.isArray(payload.keywords)
        ? payload.keywords.filter((item: unknown): item is LessonKeyword => Boolean(item && typeof item === 'object' && typeof (item as LessonKeyword).term === 'string' && typeof (item as LessonKeyword).definition === 'string'))
        : [];
      return { summary: payload.summary.trim(), source: payload.source === 'cache' ? 'cache' : 'generated', keywords } as LessonSummaryResult;
    });
}

export async function fetchLessonKeywords(lessonId: string): Promise<LessonKeyword[]> {
  const response = await fetch(`/api/lesson-keywords?${new URLSearchParams({ lessonId }).toString()}`, { headers: await getSupabaseAuthHeaders() });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'Không thể tải từ điển keyword.');
  return Array.isArray(payload.keywords)
    ? payload.keywords.filter((item: unknown): item is LessonKeyword => Boolean(item && typeof item === 'object' && typeof (item as LessonKeyword).term === 'string' && typeof (item as LessonKeyword).definition === 'string'))
    : [];
}

export async function askLessonSummaryAI(lessonId: string, questionValue: string, history: SummaryChatMessage[], signal?: AbortSignal, pdfUrl?: string, summaryValue?: string) {
  const question = questionValue.trim();
  if (!question || question.length > 1_000) throw new Error('Câu hỏi phải có từ 1 đến 1.000 ký tự.');
  const safeHistory = history.slice(-8).map((message) => ({ role: message.role, content: message.content.slice(0, 2_000) }));
  const summary = summaryValue?.trim().slice(0, 20_000);
  const response = await fetch('/api/lesson-summary-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...await getSupabaseAuthHeaders() },
    body: JSON.stringify({ lessonId, question, history: safeHistory, ...(pdfUrl ? { pdfUrl } : {}), ...(summary ? { summary } : {}) }),
    signal,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'AI chưa thể trả lời lúc này.');
  if (typeof payload.answer !== 'string' || !payload.answer.trim()) throw new Error('AI trả về câu trả lời không hợp lệ.');
  return payload.answer.trim();
}
import { getSupabaseAuthHeaders } from '../lib/supabase';
