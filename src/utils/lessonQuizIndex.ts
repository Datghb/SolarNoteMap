import { getSupabaseAuthHeaders } from '../lib/supabase';

export interface LessonQuizIndexResult {
  lessonId: string;
  sourceIdentity: string;
  chunkCount: number;
  source: 'cache' | 'generated';
  ready: boolean;
}

export class LessonQuizIndexApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function parseLessonQuizIndexResult(value: unknown): LessonQuizIndexResult {
  if (!isRecord(value) || typeof value.lessonId !== 'string' || !value.lessonId.trim() ||
    typeof value.sourceIdentity !== 'string' || !value.sourceIdentity.trim() ||
    !Number.isInteger(value.chunkCount) || Number(value.chunkCount) < 1 ||
    !['cache', 'generated'].includes(String(value.source)) || value.ready !== true) {
    throw new Error('Máy chủ trả về chỉ mục quiz không hợp lệ.');
  }
  return {
    lessonId: value.lessonId,
    sourceIdentity: value.sourceIdentity,
    chunkCount: Number(value.chunkCount),
    source: value.source as LessonQuizIndexResult['source'],
    ready: true,
  };
}

export async function generateLessonQuizIndex(lessonId: string, pdfUrl: string, force = false, signal?: AbortSignal) {
  const response = await fetch('/api/lesson-quiz-index/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...await getSupabaseAuthHeaders() },
    body: JSON.stringify({ lessonId, pdfUrl, force }),
    signal,
  });
  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new LessonQuizIndexApiError(
      isRecord(payload) && typeof payload.error === 'string' ? payload.error : 'Không thể lập chỉ mục PDF cho quiz.',
      response.status,
    );
  }
  return parseLessonQuizIndexResult(payload);
}
