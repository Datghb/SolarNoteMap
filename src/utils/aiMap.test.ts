import { describe, expect, it } from 'vitest';
import { normalizeAiMap } from './aiMap';
import type { KnowledgeMap } from './smartMap';

describe('normalizeAiMap', () => {
  it('validates AI output and preserves positions of stable nodes', () => {
    const previous: KnowledgeMap = {
      nodes: [{ id: 'data', title: 'Dữ liệu', note: '', importance: 'important', status: 'confirmed', x: 18, y: 24 }],
      edges: [],
    };
    const result = normalizeAiMap({
      nodes: [
        { id: 'data', title: 'Dữ liệu', description: 'Nguồn để mô hình học', importance: 'important' },
        { id: 'model', title: 'Mô hình', description: 'Kết quả huấn luyện', importance: 'core' },
      ],
      edges: [{ source: 'data', target: 'model', relation: 'huấn luyện' }],
    }, 'Dữ liệu được dùng để huấn luyện mô hình.', previous);

    expect(result.nodes).toHaveLength(2);
    expect(result.nodes[0]).toMatchObject({ id: 'data', x: 18, y: 24 });
    expect(result.edges[0]).toEqual({ from: 'data', to: 'model', label: 'huấn luyện' });
    expect(result.sourceNote).toContain('Dữ liệu');
  });

  it('rejects malformed or dangling graph data', () => {
    expect(() => normalizeAiMap({ nodes: [], edges: [{ source: 'a', target: 'b', relation: '' }] }, '', { nodes: [], edges: [] })).toThrow();
  });
});
