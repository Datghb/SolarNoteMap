import type { Importance, KnowledgeMap } from './smartMap';
import { getSupabaseAuthHeaders } from '../lib/supabase';

const IMPORTANCE = new Set<Importance>(['minor', 'detail', 'support', 'important', 'core']);

interface AiNode {
  id: string;
  title: string;
  description: string;
  importance: Importance;
  slideNumbers?: number[];
}

interface AiEdge {
  source: string;
  target: string;
  relation: string;
}

interface AiGraph {
  nodes: AiNode[];
  edges: AiEdge[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseGraph(value: unknown): AiGraph {
  if (!isRecord(value) || !Array.isArray(value.nodes) || !Array.isArray(value.edges)) {
    throw new Error('AI graph must contain nodes and edges arrays.');
  }
  const nodes = value.nodes.map((node) => {
    if (!isRecord(node) || typeof node.id !== 'string' || typeof node.title !== 'string' ||
      typeof node.description !== 'string' || typeof node.importance !== 'string' ||
      !IMPORTANCE.has(node.importance as Importance) ||
      (node.slideNumbers !== undefined && (!Array.isArray(node.slideNumbers) || node.slideNumbers.some((page) => !Number.isInteger(page) || page < 1 || page > 500)))) {
      throw new Error('AI returned an invalid node.');
    }
    return node as unknown as AiNode;
  });
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = value.edges.map((edge) => {
    if (!isRecord(edge) || typeof edge.source !== 'string' || typeof edge.target !== 'string' ||
      typeof edge.relation !== 'string' || !edge.relation.trim() ||
      !nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      throw new Error('AI returned an invalid relationship.');
    }
    return edge as unknown as AiEdge;
  });
  return { nodes, edges };
}

export function normalizeAiMap(value: unknown, sourceSummary: string, previous: KnowledgeMap): KnowledgeMap {
  const graph = parseGraph(value);
  return {
    sourceSummary,
    nodes: graph.nodes.map((node, index) => {
      const existing = previous.nodes.find((item) => item.id === node.id);
      const angle = (index / Math.max(1, graph.nodes.length)) * Math.PI * 2;
      return {
        id: node.id,
        title: node.title,
        note: node.description,
        importance: node.importance,
        slideNumbers: [...new Set(node.slideNumbers ?? [])].sort((a, b) => a - b),
        status: existing?.status ?? 'suggested',
        x: existing?.x ?? 50 + Math.cos(angle) * 28,
        y: existing?.y ?? 50 + Math.sin(angle) * 28,
      };
    }),
    edges: graph.edges.map((edge) => ({ from: edge.source, to: edge.target, label: edge.relation })),
  };
}

export function createKnowledgeMapRequestBody(summary: string, lesson: { id: string; name: string }) {
  return { summary, lesson };
}

export async function requestAiMap(
  summary: string,
  lesson: { id: string; name: string },
  previous: KnowledgeMap,
  signal: AbortSignal,
) {
  const response = await fetch('/api/knowledge-map', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...await getSupabaseAuthHeaders() },
    body: JSON.stringify(createKnowledgeMapRequestBody(summary, lesson)),
    signal,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'Không thể kết nối dịch vụ AI.');
  return normalizeAiMap(payload.graph, summary, previous);
}
