export interface SlideQuestionInput {
  page: number;
  question: string;
  note?: string;
  image?: string;
  useBundledPdfContext?: boolean;
}

export interface SlideAnswer {
  answer: string;
  model?: string;
}

export async function askSlideAI(input: SlideQuestionInput): Promise<SlideAnswer> {
  const question = input.question.trim();
  if (!Number.isInteger(input.page) || input.page < 1) throw new Error('Trang slide không hợp lệ.');
  if (!question || question.length > 1_000) throw new Error('Câu hỏi phải có từ 1 đến 1.000 ký tự.');

  const response = await fetch('/api/slide-question', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...await getSupabaseAuthHeaders() },
    body: JSON.stringify({ page: input.page, question, note: input.note?.slice(0, 4_000) ?? '', image: input.image ?? '', useBundledPdfContext: input.useBundledPdfContext === true }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'AI chưa thể trả lời lúc này.');
  if (typeof payload.answer !== 'string' || !payload.answer.trim()) throw new Error('AI trả về câu trả lời không hợp lệ.');
  return { answer: payload.answer.trim(), model: typeof payload.model === 'string' ? payload.model : undefined };
}
import { getSupabaseAuthHeaders } from '../lib/supabase';
