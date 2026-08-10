import dagre from '@dagrejs/dagre';
import type { KnowledgeMap, KnowledgeNode } from './smartMap';

export type KnowledgeKind = 'concept' | 'support' | 'example' | 'process' | 'question';

export interface HierarchicalPosition {
  id: string;
  x: number;
  y: number;
  depth: number;
  side: -1 | 0 | 1;
}

export const FULL_NODE_DIMENSIONS = {
  root: { width: 260, height: 176 },
  node: { width: 242, height: 164 },
} as const;

export const COMPACT_NODE_DIMENSIONS = {
  root: { width: 190, height: 76 },
  node: { width: 180, height: 72 },
} as const;

export interface KnowledgeHierarchy {
  coreId: string;
  parentById: Map<string, string>;
  depthById: Map<string, number>;
  treeEdgeIndexes: Set<number>;
  crossEdgeIndexes: Set<number>;
}

export const KNOWLEDGE_COLORS: Record<KnowledgeKind, string> = {
  concept: '#F6C453',
  support: '#4D9DE0',
  example: '#2EC4A6',
  process: '#9B7EDE',
  question: '#F26B7A',
};

export const KNOWLEDGE_LABELS: Record<KnowledgeKind, string> = {
  concept: 'Khái niệm chính',
  support: 'Kiến thức hỗ trợ',
  example: 'Ví dụ / ứng dụng',
  process: 'Quy trình / nguyên nhân',
  question: 'Câu hỏi / cảnh báo',
};

export function getKnowledgeKind(node: KnowledgeNode): KnowledgeKind {
  const content = `${node.title} ${node.note}`.toLocaleLowerCase('vi');
  if (/câu hỏi|chưa rõ|tại sao|rủi ro|sai lệch|hạn chế|cảnh báo|vấn đề|thất bại/.test(content)) return 'question';
  if (/ví dụ|ứng dụng|thực tế|minh họa|tình huống/.test(content)) return 'example';
  if (/quá trình|huấn luyện|bước|dẫn đến|tạo ra|điều chỉnh|cơ chế|nguyên nhân/.test(content)) return 'process';
  if (node.importance === 'core') return 'concept';
  return 'support';
}

export function getSemanticNodeColor(node: KnowledgeNode) {
  return KNOWLEDGE_COLORS[getKnowledgeKind(node)];
}

export function getConnectedNodeIds(map: KnowledgeMap, focusedId: string) {
  const ids = new Set([focusedId]);
  map.edges.forEach((edge) => {
    if (edge.from === focusedId) ids.add(edge.to);
    if (edge.to === focusedId) ids.add(edge.from);
  });
  return ids;
}

export function getDescendantNodeIds(map: KnowledgeMap, parentId: string) {
  const hierarchy = classifyKnowledgeEdges(map);
  const children = new Map<string, string[]>();
  hierarchy.parentById.forEach((parent, child) => children.set(parent, [...(children.get(parent) ?? []), child]));
  const descendants = new Set<string>();
  const queue = [parentId];
  while (queue.length) {
    const current = queue.shift()!;
    (children.get(current) ?? []).forEach((childId) => {
      if (!descendants.has(childId)) {
        descendants.add(childId);
        queue.push(childId);
      }
    });
  }
  return descendants;
}

export function classifyKnowledgeEdges(map: KnowledgeMap): KnowledgeHierarchy {
  if (!map.nodes.length) {
    return { coreId: '', parentById: new Map(), depthById: new Map(), treeEdgeIndexes: new Set(), crossEdgeIndexes: new Set() };
  }
  const orderedNodes = [...map.nodes].sort((a, b) => a.id.localeCompare(b.id));
  const core = orderedNodes.find((node) => node.importance === 'core') ?? orderedNodes[0];
  const validIds = new Set(map.nodes.map((node) => node.id));
  const outgoing = new Map<string, { nodeId: string; edgeIndex: number }[]>();
  map.edges.forEach((edge, edgeIndex) => {
    if (!validIds.has(edge.from) || !validIds.has(edge.to) || edge.from === edge.to) return;
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), { nodeId: edge.to, edgeIndex }]);
  });
  outgoing.forEach((neighbors) => neighbors.sort((a, b) => a.nodeId.localeCompare(b.nodeId) || a.edgeIndex - b.edgeIndex));

  const parentById = new Map<string, string>();
  const depthById = new Map<string, number>();
  const treeEdgeIndexes = new Set<number>();
  const visited = new Set<string>();
  const roots = [core.id, ...orderedNodes.map((node) => node.id).filter((id) => id !== core.id)];

  roots.forEach((rootId) => {
    if (visited.has(rootId)) return;
    visited.add(rootId);
    depthById.set(rootId, rootId === core.id ? 0 : 1);
    const queue = [rootId];
    while (queue.length) {
      const current = queue.shift()!;
      (outgoing.get(current) ?? []).forEach(({ nodeId, edgeIndex }) => {
        if (visited.has(nodeId)) return;
        visited.add(nodeId);
        parentById.set(nodeId, current);
        depthById.set(nodeId, (depthById.get(current) ?? 0) + 1);
        treeEdgeIndexes.add(edgeIndex);
        queue.push(nodeId);
      });
    }
  });

  const crossEdgeIndexes = new Set<number>();
  map.edges.forEach((edge, edgeIndex) => {
    if (validIds.has(edge.from) && validIds.has(edge.to) && !treeEdgeIndexes.has(edgeIndex)) crossEdgeIndexes.add(edgeIndex);
  });
  return { coreId: core.id, parentById, depthById, treeEdgeIndexes, crossEdgeIndexes };
}

export function createMindMapLayout(map: KnowledgeMap, options: { compact?: boolean } = {}): HierarchicalPosition[] {
  if (!map.nodes.length) return [];
  const hierarchy = classifyKnowledgeEdges(map);
  const dimensions = options.compact ? COMPACT_NODE_DIMENSIONS : FULL_NODE_DIMENSIONS;
  const nodeById = new Map(map.nodes.map((node) => [node.id, node]));
  const children = new Map<string, string[]>();
  hierarchy.parentById.forEach((parent, child) => children.set(parent, [...(children.get(parent) ?? []), child]));
  children.forEach((ids) => ids.sort((a, b) => a.localeCompare(b)));

  const subtreeWeight = (id: string): number => 1 + (children.get(id) ?? []).reduce((sum, child) => sum + subtreeWeight(child), 0);
  const disconnectedRoots = map.nodes
    .map((node) => node.id)
    .filter((id) => id !== hierarchy.coreId && !hierarchy.parentById.has(id));
  const mainBranches = [...(children.get(hierarchy.coreId) ?? []), ...disconnectedRoots]
    .sort((a, b) => subtreeWeight(b) - subtreeWeight(a) || a.localeCompare(b));
  const branchesBySide: Record<-1 | 1, string[]> = { [-1]: [], [1]: [] };
  const weights: Record<-1 | 1, number> = { [-1]: 0, [1]: 0 };
  mainBranches.forEach((id) => {
    const side: -1 | 1 = weights[-1] <= weights[1] ? -1 : 1;
    branchesBySide[side].push(id);
    weights[side] += subtreeWeight(id);
  });

  const positions = new Map<string, HierarchicalPosition>();
  const rootSize = dimensions.root;
  positions.set(hierarchy.coreId, { id: hierarchy.coreId, x: 0, y: 0, depth: 0, side: 0 });

  ([-1, 1] as const).forEach((side) => {
    if (!branchesBySide[side].length) return;
    const graph = new dagre.graphlib.Graph();
    graph.setGraph({
      rankdir: side === -1 ? 'RL' : 'LR',
      ranker: 'network-simplex',
      acyclicer: 'greedy',
      nodesep: options.compact ? 30 : 72,
      ranksep: options.compact ? 76 : 140,
      edgesep: options.compact ? 16 : 28,
      marginx: 24,
      marginy: 24,
    });
    graph.setDefaultEdgeLabel(() => ({}));
    graph.setNode(hierarchy.coreId, { width: rootSize.width, height: rootSize.height });
    const addBranch = (id: string) => {
      const size = dimensions.node;
      graph.setNode(id, { width: size.width, height: size.height });
      (children.get(id) ?? []).forEach((child) => {
        addBranch(child);
        graph.setEdge(id, child);
      });
    };
    branchesBySide[side].forEach((id) => {
      addBranch(id);
      graph.setEdge(hierarchy.coreId, id);
    });
    dagre.layout(graph);
    const rootCenter = graph.node(hierarchy.coreId) as { x: number; y: number };
    graph.nodes().forEach((id: string) => {
      if (id === hierarchy.coreId) return;
      const center = graph.node(id) as { x: number; y: number };
      const size = dimensions.node;
      positions.set(id, {
        id,
        x: center.x - rootCenter.x - size.width / 2 + rootSize.width / 2,
        y: center.y - rootCenter.y - size.height / 2 + rootSize.height / 2,
        depth: hierarchy.depthById.get(id) ?? 1,
        side,
      });
    });
  });

  return [...nodeById.keys()].sort().map((id) => positions.get(id)!).filter(Boolean);
}

// Compatibility aliases for older imports.
export const createHierarchicalLayout = createMindMapLayout;
export const createConstellationLayout = createMindMapLayout;
