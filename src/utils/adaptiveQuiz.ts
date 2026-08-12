import { getSupabaseAuthHeaders } from '../lib/supabase';

export type QuizSlotId = `q${number}`;
export type QuizLevel = 'recall' | 'relationship' | 'application';
export type AdaptiveQuizMode = 'micro' | 'lesson_review';

export interface AdaptiveQuizQuestion {
  slotId: QuizSlotId;
  question: string;
  options: [string, string, string, string];
  keyword: string;
  sourceSlides: number[];
  level: QuizLevel;
}

export interface AdaptiveQuizRecommendation {
  id: string;
  status: 'pending' | 'accepted' | 'dismissed' | 'completed';
  title: string;
  targetKeywords: string[];
  targetSlides: number[];
  questionCount: number;
  requestedQuestionCount: number;
  quizMode: AdaptiveQuizMode;
  estimatedDurationMinutes: number;
  questions: AdaptiveQuizQuestion[];
  savedAnswers: Array<number | null> | null;
  recommendedAt: string;
  cacheHit: boolean;
}

export interface AdaptiveQuizAnswerResult {
  slotId: QuizSlotId;
  selectedIndex: number;
  correctIndex: number;
  correct: boolean;
  explanation: string;
  sourceSlides: number[];
  keyword: string;
}

export interface AdaptiveQuizResult {
  score: number;
  questionCount: number;
  durationSeconds: number;
  items: AdaptiveQuizAnswerResult[];
}

export interface AdaptiveQuizHistoryItem {
  id: string;
  recommendation: AdaptiveQuizRecommendation;
  result: AdaptiveQuizResult;
  completedAt: string;
}

export interface AdaptiveQuizContextRequest {
  classId: string;
  lessonId: string;
  targetKeywords: string[];
  targetSlides: number[];
  unclearSlides: number[];
  currentSlide: number;
  activeSeconds: number;
  reasons: string[];
  questionCount?: number;
  quizMode?: AdaptiveQuizMode;
}

export class AdaptiveQuizApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function strings(value: unknown, limit = 10) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).slice(0, limit) : [];
}

function slides(value: unknown) {
  return Array.isArray(value) ? value.map(Number).filter((page) => Number.isInteger(page) && page >= 1 && page <= 500).slice(0, 10) : [];
}

function isQuizSlot(value: unknown) {
  return typeof value === 'string' && /^q(?:[1-9]|1[0-5])$/.test(value);
}

export function parseAdaptiveQuizRecommendation(value: unknown): AdaptiveQuizRecommendation | null {
  if (value === null) return null;
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.title !== 'string' || typeof value.recommendedAt !== 'string') {
    throw new Error('Máy chủ trả về quiz không hợp lệ.');
  }
  const questionCount = Number(value.questionCount);
  if (!['pending', 'accepted', 'dismissed', 'completed'].includes(String(value.status)) || !Number.isInteger(questionCount) || questionCount < 3 || questionCount > 15 || !Array.isArray(value.questions) || value.questions.length !== questionCount) {
    throw new Error('Máy chủ trả về quiz có số câu không hợp lệ.');
  }
  const questions = value.questions.map((question): AdaptiveQuizQuestion => {
    if (!isRecord(question) || !isQuizSlot(question.slotId) || typeof question.question !== 'string' || typeof question.keyword !== 'string' || !['recall', 'relationship', 'application'].includes(String(question.level))) {
      throw new Error('Máy chủ trả về câu hỏi không hợp lệ.');
    }
    if ('correctIndex' in question || 'explanation' in question || !Array.isArray(question.options) || question.options.length !== 4 || question.options.some((option) => typeof option !== 'string' || !option.trim())) {
      throw new Error('Quiz trước khi nộp chứa dữ liệu không an toàn hoặc không hợp lệ.');
    }
    return {
      slotId: question.slotId as QuizSlotId,
      question: question.question,
      options: question.options as [string, string, string, string],
      keyword: question.keyword,
      sourceSlides: slides(question.sourceSlides),
      level: question.level as QuizLevel,
    };
  });
  const expectedSlots = questions.map((_, index) => `q${index + 1}`);
  if (questions.some((question, index) => question.slotId !== expectedSlots[index])) throw new Error('Quiz có slot câu hỏi thiếu, trùng hoặc sai thứ tự.');
  const savedAnswers = Array.isArray(value.savedAnswers) && value.savedAnswers.length === questionCount && value.savedAnswers.every((answer) => answer === null || (Number.isInteger(answer) && Number(answer) >= 0 && Number(answer) <= 3))
    ? value.savedAnswers.map((answer) => answer === null ? null : Number(answer)) : null;
  return {
    id: value.id,
    status: value.status as AdaptiveQuizRecommendation['status'],
    title: value.title,
    targetKeywords: strings(value.targetKeywords, 5),
    targetSlides: slides(value.targetSlides),
    questionCount,
    requestedQuestionCount: Number.isInteger(value.requestedQuestionCount) ? Number(value.requestedQuestionCount) : questionCount,
    quizMode: value.quizMode === 'lesson_review' ? 'lesson_review' : 'micro',
    estimatedDurationMinutes: Number.isInteger(value.estimatedDurationMinutes) ? Number(value.estimatedDurationMinutes) : Math.max(2, Math.ceil(questionCount * 0.75)),
    questions,
    savedAnswers,
    recommendedAt: value.recommendedAt,
    cacheHit: value.cacheHit === true,
  };
}

function parseAdaptiveQuizResult(value: unknown): AdaptiveQuizResult {
  const questionCount = isRecord(value) ? Number(value.questionCount) : 0;
  if (!isRecord(value) || !Number.isInteger(questionCount) || questionCount < 3 || questionCount > 15 || !Number.isInteger(value.score) || Number(value.score) < 0 || Number(value.score) > questionCount || !Number.isInteger(value.durationSeconds) || Number(value.durationSeconds) < 0 || Number(value.durationSeconds) > 86_400 || !Array.isArray(value.items) || value.items.length !== questionCount) {
    throw new Error('Máy chủ trả về kết quả quiz không hợp lệ.');
  }
  const items = value.items.map((item): AdaptiveQuizAnswerResult => {
    if (!isRecord(item) || !isQuizSlot(item.slotId) || !Number.isInteger(item.selectedIndex) || Number(item.selectedIndex) < 0 || Number(item.selectedIndex) > 3 || !Number.isInteger(item.correctIndex) || Number(item.correctIndex) < 0 || Number(item.correctIndex) > 3 || typeof item.correct !== 'boolean' || typeof item.explanation !== 'string' || typeof item.keyword !== 'string') {
      throw new Error('Máy chủ trả về chi tiết đáp án không hợp lệ.');
    }
    return {
      slotId: item.slotId as QuizSlotId,
      selectedIndex: item.selectedIndex as number,
      correctIndex: item.correctIndex as number,
      correct: item.correct,
      explanation: item.explanation,
      sourceSlides: slides(item.sourceSlides),
      keyword: item.keyword,
    };
  });
  return { score: value.score as number, questionCount, durationSeconds: value.durationSeconds as number, items };
}

export function parseAdaptiveQuizHistory(value: unknown): AdaptiveQuizHistoryItem[] {
  if (!Array.isArray(value)) throw new Error('Máy chủ trả về lịch sử quiz không hợp lệ.');
  return value.map((item) => {
    if (!isRecord(item) || typeof item.id !== 'string' || typeof item.completedAt !== 'string' || !Number.isFinite(Date.parse(item.completedAt))) {
      throw new Error('Lượt quiz trong lịch sử không hợp lệ.');
    }
    const recommendation = parseAdaptiveQuizRecommendation(item.recommendation);
    if (!recommendation || recommendation.status !== 'completed') throw new Error('Quiz lịch sử chưa ở trạng thái hoàn thành.');
    return {
      id: item.id,
      recommendation,
      result: parseAdaptiveQuizResult(item.result),
      completedAt: item.completedAt,
    };
  });
}

async function request(path: string, init?: RequestInit) {
  const response = await fetch(`/api/adaptive-quiz${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...await getSupabaseAuthHeaders(),
      ...init?.headers,
    },
  });
  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = isRecord(payload) && typeof payload.error === 'string' ? payload.error : 'Adaptive quiz chưa thể xử lý yêu cầu lúc này.';
    throw new AdaptiveQuizApiError(response.status, message);
  }
  if (!isRecord(payload)) throw new Error('Máy chủ trả về dữ liệu quiz không hợp lệ.');
  return payload;
}

export async function prepareAdaptiveQuiz(context: AdaptiveQuizContextRequest) {
  const payload = await request('/prepare', { method: 'POST', body: JSON.stringify(context) });
  return parseAdaptiveQuizRecommendation(payload.recommendation);
}

export async function loadAdaptiveQuizRecommendation(classId: string, lessonId: string) {
  const query = new URLSearchParams({ classId, lessonId });
  const payload = await request(`/recommendation?${query.toString()}`);
  return parseAdaptiveQuizRecommendation(payload.recommendation);
}

export async function loadAdaptiveQuizHistory(classId: string, lessonId: string) {
  const query = new URLSearchParams({ classId, lessonId });
  const payload = await request(`/history?${query.toString()}`);
  return parseAdaptiveQuizHistory(payload.history);
}

export async function startAdaptiveQuiz(recommendationId: string) {
  const payload = await request(`/${encodeURIComponent(recommendationId)}/start`, { method: 'POST' });
  return parseAdaptiveQuizRecommendation(payload.recommendation);
}

export async function submitAdaptiveQuiz(recommendationId: string, answers: number[]) {
  const payload = await request(`/${encodeURIComponent(recommendationId)}/submit`, { method: 'POST', body: JSON.stringify({ answers }) });
  return parseAdaptiveQuizResult(payload.result);
}

export async function saveAdaptiveQuizProgress(recommendationId: string, answers: Array<number | null>) {
  await request(`/${encodeURIComponent(recommendationId)}/progress`, { method: 'PATCH', body: JSON.stringify({ answers }) });
}

export async function dismissAdaptiveQuiz(recommendationId: string) {
  await request(`/${encodeURIComponent(recommendationId)}/dismiss`, { method: 'POST' });
}

export async function reportAdaptiveQuizQuestion(recommendationId: string, slotId: QuizSlotId, reason: string) {
  await request(`/${encodeURIComponent(recommendationId)}/report`, { method: 'POST', body: JSON.stringify({ slotId, reason }) });
}
