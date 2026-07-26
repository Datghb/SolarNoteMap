import type { KnowledgeMap, KnowledgeNode } from './smartMap';

export type KnowledgeKind = 'concept' | 'support' | 'example' | 'process' | 'question';

export interface HierarchicalPosition {
  id: string;
  x: number;
  y: number;
  depth: number;
  side: -1 | 0 | 1;
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
  const descendants = new Set<string>();
  const queue = [parentId];
  while (queue.length) {
    const current = queue.shift()!;
    map.edges.forEach((edge) => {
      if (edge.from === current && edge.to !== parentId && !descendants.has(edge.to)) {
        descendants.add(edge.to);
        queue.push(edge.to);
      }
    });
  }
  return descendants;
}

export function createMindMapLayout(map: KnowledgeMap): HierarchicalPosition[] {
  if (!map.nodes.length) return [];
  const core = map.nodes.find((node) => node.importance === 'core') ?? map.nodes[0];
  const validIds = new Set(map.nodes.map((node) => node.id));
  const children = new Map<string, string[]>();
  map.edges.forEach((edge) => {
    if (!validIds.has(edge.from) || !validIds.has(edge.to) || edge.to === core.id) return;
    children.set(edge.from, [...(children.get(edge.from) ?? []), edge.to]);
  });
  const mainBranches = [...new Set(children.get(core.id) ?? [])];
  map.nodes.forEach((node) => {
    const isLinked = node.id === core.id || map.edges.some((edge) => edge.to === node.id || edge.from === node.id);
    if (!isLinked) mainBranches.push(node.id);
  });

  const positions: HierarchicalPosition[] = [{ id: core.id, x: 0, y: 0, depth: 0, side: 0 }];
  const visited = new Set([core.id]);
  const branchesBySide = {
    [-1]: mainBranches.filter((_id, index) => index % 2 === 0),
    [1]: mainBranches.filter((_id, index) => index % 2 === 1),
  } as Record<-1 | 1, string[]>;

  const placeBranch = (id: string, side: -1 | 1, depth: number, y: number) => {
    if (visited.has(id)) return;
    visited.add(id);
    positions.push({ id, depth, side, x: side * depth * 330, y });
    const branchChildren = [...new Set(children.get(id) ?? [])].filter((childId) => !visited.has(childId));
    branchChildren.forEach((childId, index) => {
      const offset = (index - (branchChildren.length - 1) / 2) * 125;
      placeBranch(childId, side, depth + 1, y + offset);
    });
  };

  ([-1, 1] as const).forEach((side) => {
    const branches = branchesBySide[side];
    branches.forEach((id, index) => {
      placeBranch(id, side, 1, (index - (branches.length - 1) / 2) * 230);
    });
  });
  map.nodes.filter((node) => !visited.has(node.id)).forEach((node, index) => placeBranch(node.id, index % 2 ? 1 : -1, 1, 280 + index * 135));
  return positions;
}

// Compatibility aliases for older imports.
export const createHierarchicalLayout = createMindMapLayout;
export const createConstellationLayout = createMindMapLayout;
