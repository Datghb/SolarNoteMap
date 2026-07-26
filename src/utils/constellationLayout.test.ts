import { describe, expect, it } from 'vitest';
import {
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
