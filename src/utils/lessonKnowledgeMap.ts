import { getSupabaseAuthHeaders } from '../lib/supabase';
import type { KnowledgeMap } from './smartMap';
import { normalizeAiMap } from './aiMap';

export interface SlideSummary {
  page: number;
  title: string;
  summary: string;
  keyConcepts: string[];
}

export interface LessonKnowledgeArtifact {
  graph: KnowledgeMap;
  slideSummaries: SlideSummary[];
  source: 'cache' | 'generated';
  model: string;
  generatedAt: string;
  sourcePdfPath: string;
}

export class KnowledgeMapApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function normalizeLessonKnowledgeArtifact(value: unknown): LessonKnowledgeArtifact {
  if (!isRecord(value) || !Array.isArray(value.slideSummaries) ||
    typeof value.source !== 'string' || !['cache', 'generated'].includes(value.source) ||
    typeof value.model !== 'string' || !value.model.trim() || typeof value.generatedAt !== 'string' || !Number.isFinite(Date.parse(value.generatedAt)) ||
    typeof value.sourcePdfPath !== 'string' || !value.sourcePdfPath.trim()) {
    throw new Error('Dữ liệu sơ đồ bài học không hợp lệ.');
  }
  const slideSummaries = value.slideSummaries.map((item) => {
    if (!isRecord(item) || !Number.isInteger(item.page) || Number(item.page) < 1 || Number(item.page) > 500 ||
      typeof item.title !== 'string' || !item.title.trim() || typeof item.summary !== 'string' || !item.summary.trim() ||
      !Array.isArray(item.keyConcepts) || item.keyConcepts.some((concept) => typeof concept !== 'string')) {
      throw new Error('Bản tóm tắt slide không hợp lệ.');
    }
    return {
      page: Number(item.page),
      title: item.title.trim(),
      summary: item.summary.trim(),
      keyConcepts: item.keyConcepts.map(String),
    };
  });
  if (new Set(slideSummaries.map((slide) => slide.page)).size !== slideSummaries.length) {
    throw new Error('Bản tóm tắt slide bị trùng số trang.');
  }
  const sourceSummary = slideSummaries.map((slide) => `Slide ${slide.page}: ${slide.summary}`).join('\n\n');
  const graph = normalizeAiMap(value.graph, sourceSummary, { nodes: [], edges: [] });
  const validPages = new Set(slideSummaries.map((slide) => slide.page));
  if (graph.nodes.some((node) => !node.slideNumbers?.length || node.slideNumbers.some((page) => !validPages.has(page)))) {
    throw new Error('Sơ đồ tham chiếu tới slide không tồn tại.');
  }
  return {
    graph: { ...graph, sourceVersion: value.generatedAt },
    slideSummaries,
    source: value.source as 'cache' | 'generated',
    model: value.model,
    generatedAt: value.generatedAt,
    sourcePdfPath: value.sourcePdfPath,
  };
}

async function parseResponse(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new KnowledgeMapApiError(
      isRecord(payload) && typeof payload.error === 'string' ? payload.error : 'Không thể tải sơ đồ bài học.',
      response.status,
    );
  }
  return normalizeLessonKnowledgeArtifact(payload);
}

export async function fetchLessonKnowledgeMap(lessonId: string, pdfUrl?: string, signal?: AbortSignal) {
  const query = new URLSearchParams({ lessonId });
  if (pdfUrl) query.set('pdfUrl', pdfUrl);
  const response = await fetch(`/api/lesson-knowledge-map?${query}`, {
    headers: await getSupabaseAuthHeaders(),
    signal,
  });
  return parseResponse(response);
}

export async function generateLessonKnowledgeMap(lessonId: string, pdfUrl: string, force = false, signal?: AbortSignal) {
  const response = await fetch('/api/lesson-knowledge-map/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...await getSupabaseAuthHeaders() },
    body: JSON.stringify({ lessonId, pdfUrl, force }),
    signal,
  });
  return parseResponse(response);
}
