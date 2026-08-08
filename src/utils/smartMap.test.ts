import { describe, expect, it } from 'vitest';
import { createRealtimeMap, createSmartDraft, createSummaryFallbackMap, reviewKnowledgeMap } from './smartMap';

describe('createSmartDraft', () => {
  it('creates a structured draft with semantic relationships', () => {
    const draft = createSmartDraft('ai-foundations', 'AI học từ dữ liệu để đưa ra dự đoán và hỗ trợ con người.');

    expect(draft.nodes.length).toBeGreaterThanOrEqual(5);
    expect(draft.nodes.filter((node) => node.importance === 'core')).toHaveLength(1);
    expect(draft.edges.every((edge) => edge.label.length > 0)).toBe(true);
    expect(draft.sourceNote).toContain('AI học từ dữ liệu');
    expect(draft.nodes.every((node) => node.status === 'suggested')).toBe(true);
  });
});

describe('createRealtimeMap', () => {
  it('turns the learner note into a deterministic live diagram', () => {
    const note = 'AI học từ dữ liệu. Sau đó mô hình dùng quy luật để đưa ra dự đoán.';
    const first = createRealtimeMap('ai-foundations', note);
    const second = createRealtimeMap('ai-foundations', note);

    expect(first.nodes.length).toBeGreaterThanOrEqual(3);
    expect(first.nodes.map((node) => node.id)).toEqual(second.nodes.map((node) => node.id));
    expect(first.nodes.some((node) => node.title.toLowerCase().includes('dữ liệu'))).toBe(true);
    expect(first.edges.length).toBe(first.nodes.length - 1);
    expect(first.sourceNote).toBe(note);
  });

  it('returns an empty diagram when the note has no meaningful content', () => {
    expect(createRealtimeMap('ai-foundations', '  ').nodes).toHaveLength(0);
  });
});

describe('createSummaryFallbackMap', () => {
  it('records summary provenance without treating it as a learner note', () => {
    const summary = 'AI học từ dữ liệu và tạo ra mô hình.';
    const map = createSummaryFallbackMap('ai-foundations', summary);

    expect(map.sourceSummary).toBe(summary);
    expect(map.sourceNote).toBeUndefined();
  });
});

describe('reviewKnowledgeMap', () => {
  it('reports progress and a useful next question', () => {
    const draft = createSmartDraft('machine-learning', 'Dữ liệu được dùng để huấn luyện mô hình.');
    const review = reviewKnowledgeMap(draft);

    expect(review.coverage).toBeGreaterThan(0);
    expect(review.strengths.length).toBeGreaterThan(0);
    expect(review.question.endsWith('?')).toBe(true);
  });
});
