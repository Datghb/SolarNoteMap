import { getSupabaseAuthHeaders } from '../lib/supabase';

export interface AdaptiveQuizAnalytics {
  recommendationCount: number;
  acceptedCount: number;
  completedCount: number;
  dismissedCount: number;
  acceptanceRate: number;
  completionRate: number;
  averageScorePercent: number;
  averageDurationSeconds: number;
  reportedQuestionCount: number;
  verifierRetryRate: number;
  averageGenerationLatencyMs: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function parseAdaptiveQuizAnalytics(value: unknown): AdaptiveQuizAnalytics {
  const keys: Array<keyof AdaptiveQuizAnalytics> = [
    'recommendationCount', 'acceptedCount', 'completedCount', 'dismissedCount',
    'acceptanceRate', 'completionRate', 'averageScorePercent', 'averageDurationSeconds',
    'reportedQuestionCount', 'verifierRetryRate', 'averageGenerationLatencyMs',
  ];
  if (!isRecord(value) || keys.some((key) => !Number.isFinite(Number(value[key])) || Number(value[key]) < 0)) {
    throw new Error('Máy chủ trả về analytics quiz không hợp lệ.');
  }
  return Object.fromEntries(keys.map((key) => [key, Number(value[key])])) as unknown as AdaptiveQuizAnalytics;
}

export async function loadAdaptiveQuizAnalytics(classId: string) {
  const response = await fetch(`/api/adaptive-quiz/analytics?${new URLSearchParams({ classId })}`, { headers: await getSupabaseAuthHeaders() });
  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(isRecord(payload) && typeof payload.error === 'string' ? payload.error : 'Không thể tải analytics quiz.');
  if (!isRecord(payload)) throw new Error('Máy chủ trả về analytics quiz không hợp lệ.');
  return parseAdaptiveQuizAnalytics(payload.analytics);
}
