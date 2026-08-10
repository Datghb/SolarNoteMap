import { describe, expect, it } from 'vitest';
import {
  COMPACT_NODE_DIMENSIONS,
  FULL_NODE_DIMENSIONS,
  classifyKnowledgeEdges,
  createMindMapLayout,
  getConnectedNodeIds,
  getDescendantNodeIds,
  getKnowledgeKind,
  getSemanticNodeColor,
} from './constellationLayout';
import type { KnowledgeMap } from './smartMap';

const map: KnowledgeMap = {
  nodes: [
    { id: 'ai', title: 'AI', note: '', importance: 'core', status: 'confirmed', x: 0, y: 0 },
    { id: 'data', title: 'Dữ liệu', note: '', importance: 'important', status: 'suggested', x: 0, y: 0 },
    { id: 'train', title: 'Quá trình huấn luyện', note: '', importance: 'important', status: 'suggested', x: 0, y: 0 },
    { id: 'bias', title: 'Rủi ro sai lệch', note: '', importance: 'detail', status: 'suggested', x: 0, y: 0 },
    { id: 'example', title: 'Ví dụ thực tế', note: '', importance: 'support', status: 'suggested', x: 0, y: 0 },
  ],
  edges: [
    { from: 'ai', to: 'data', label: 'học từ' },
    { from: 'ai', to: 'train', label: 'trải qua' },
    { from: 'data', to: 'bias', label: 'có thể gây' },
    { from: 'train', to: 'example', label: 'được minh họa bởi' },
  ],
};

describe('mind map layout', () => {
  it('places the core at the center and main branches on both sides', () => {
    const layout = createMindMapLayout(map);
    const core = layout.find((node) => node.id === 'ai')!;
    const data = layout.find((node) => node.id === 'data')!;
    const train = layout.find((node) => node.id === 'train')!;
    const bias = layout.find((node) => node.id === 'bias')!;

    expect(core).toMatchObject({ depth: 0, x: 0 });
    expect(data.depth).toBe(1);
    expect(bias.depth).toBe(2);
    expect(Math.sign(data.x)).toBe(-Math.sign(train.x));
    expect(Math.sign(data.x)).toBe(Math.sign(bias.x));
    expect(Math.abs(bias.x)).toBeGreaterThan(Math.abs(data.x));
    expect(new Set(layout.map(({ x, y }) => `${x}:${y}`)).size).toBe(layout.length);
  });

  it('keeps every card separated in a wide and deep graph', () => {
    const wideMap: KnowledgeMap = {
      nodes: [
        { id: 'root', title: 'Root', note: '', importance: 'core', status: 'confirmed', x: 0, y: 0 },
        ...Array.from({ length: 8 }, (_, index) => ({ id: `branch-${index}`, title: `Branch ${index}`, note: '', importance: 'support' as const, status: 'suggested' as const, x: 0, y: 0 })),
        ...Array.from({ length: 8 }, (_, index) => ({ id: `leaf-${index}`, title: `Leaf ${index}`, note: '', importance: 'detail' as const, status: 'suggested' as const, x: 0, y: 0 })),
      ],
      edges: Array.from({ length: 8 }, (_, index) => [
        { from: 'root', to: `branch-${index}`, label: 'gồm' },
        { from: `branch-${index}`, to: `leaf-${index}`, label: 'chi tiết' },
      ]).flat(),
    };
    const layout = createMindMapLayout(wideMap);

    for (let first = 0; first < layout.length; first += 1) {
      for (let second = first + 1; second < layout.length; second += 1) {
        const a = layout[first];
        const b = layout[second];
        const aSize = a.depth === 0 ? FULL_NODE_DIMENSIONS.root : FULL_NODE_DIMENSIONS.node;
        const bSize = b.depth === 0 ? FULL_NODE_DIMENSIONS.root : FULL_NODE_DIMENSIONS.node;
        const overlaps = a.x < b.x + bSize.width && a.x + aSize.width > b.x
          && a.y < b.y + bSize.height && a.y + aSize.height > b.y;
        expect(overlaps, `${a.id} overlaps ${b.id}`).toBe(false);
      }
    }
  });

  it('is deterministic and balances weighted branches across both sides', () => {
    const first = createMindMapLayout(map);
    const shuffled: KnowledgeMap = { nodes: [...map.nodes].reverse(), edges: [...map.edges].reverse() };
    const second = createMindMapLayout(shuffled);
    expect([...second].sort((a, b) => a.id.localeCompare(b.id))).toEqual([...first].sort((a, b) => a.id.localeCompare(b.id)));
  });

  it('classifies cycles as cross-links and only collapses tree descendants', () => {
    const cyclic: KnowledgeMap = {
      nodes: [
        { id: 'a', title: 'A', note: '', importance: 'core', status: 'confirmed', x: 0, y: 0 },
        { id: 'b', title: 'B', note: '', importance: 'support', status: 'confirmed', x: 0, y: 0 },
        { id: 'c', title: 'C', note: '', importance: 'support', status: 'confirmed', x: 0, y: 0 },
      ],
      edges: [
        { from: 'a', to: 'b', label: 'ab' },
        { from: 'b', to: 'c', label: 'bc' },
        { from: 'c', to: 'a', label: 'ca' },
      ],
    };
    const hierarchy = classifyKnowledgeEdges(cyclic);
    expect(hierarchy.treeEdgeIndexes.size).toBe(2);
    expect(hierarchy.crossEdgeIndexes.size).toBe(1);
    expect(getDescendantNodeIds(cyclic, 'b')).toEqual(new Set(['c']));
    expect(createMindMapLayout(cyclic)).toHaveLength(3);
  });

  it('uses smaller but still non-overlapping dimensions in compact mode', () => {
    expect(COMPACT_NODE_DIMENSIONS.node.width).toBeLessThan(FULL_NODE_DIMENSIONS.node.width);
    const compact = createMindMapLayout(map, { compact: true });
    expect(new Set(compact.map(({ x, y }) => `${x}:${y}`)).size).toBe(compact.length);
  });

  it('returns direct focus neighbors and all descendants separately', () => {
    expect(getConnectedNodeIds(map, 'data')).toEqual(new Set(['data', 'ai', 'bias']));
    expect(getDescendantNodeIds(map, 'data')).toEqual(new Set(['bias']));
    expect(getDescendantNodeIds(map, 'ai')).toEqual(new Set(['data', 'train', 'bias', 'example']));
  });

  it('uses five stable colors with a fixed learning meaning', () => {
    expect(getKnowledgeKind(map.nodes[0])).toBe('concept');
    expect(getKnowledgeKind(map.nodes[2])).toBe('process');
    expect(getKnowledgeKind(map.nodes[3])).toBe('question');
    expect(getKnowledgeKind(map.nodes[4])).toBe('example');
    expect(getSemanticNodeColor(map.nodes[0])).toBe('#F6C453');
    expect(getSemanticNodeColor(map.nodes[2])).toBe('#9B7EDE');
    expect(getSemanticNodeColor(map.nodes[3])).toBe('#F26B7A');
    expect(new Set(map.nodes.map(getSemanticNodeColor)).size).toBeLessThanOrEqual(5);
  });
});
