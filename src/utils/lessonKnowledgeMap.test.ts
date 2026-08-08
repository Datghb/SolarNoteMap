import { describe, expect, it } from 'vitest';
import { normalizeLessonKnowledgeArtifact } from './lessonKnowledgeMap';

describe('normalizeLessonKnowledgeArtifact', () => {
  it('keeps slide provenance on graph nodes', () => {
    const artifact = normalizeLessonKnowledgeArtifact({
      graph: {
        nodes: [{ id: 'ai', title: 'AI', description: 'Khái niệm chính', importance: 'core', slideNumbers: [3, 1, 3] }],
        edges: [],
      },
      slideSummaries: [
        { page: 1, title: 'AI', summary: 'Giới thiệu AI', keyConcepts: ['AI'] },
        { page: 3, title: 'Ứng dụng', summary: 'Ứng dụng của AI', keyConcepts: ['AI'] },
      ],
      source: 'cache',
      model: 'openai:test',
      generatedAt: '2026-08-08T00:00:00.000Z',
      sourcePdfPath: 'course/lesson/lesson.pdf',
    });

    expect(artifact.graph.nodes[0].slideNumbers).toEqual([1, 3]);
    expect(artifact.graph.sourceVersion).toBe('2026-08-08T00:00:00.000Z');
    expect(artifact.graph.sourceSummary).toContain('Slide 1: Giới thiệu AI');
  });

  it('rejects malformed slide summaries', () => {
    expect(() => normalizeLessonKnowledgeArtifact({
      graph: { nodes: [], edges: [] },
      slideSummaries: [{ page: 0, title: '', summary: '', keyConcepts: [] }],
      source: 'cache', model: 'test', generatedAt: '2026-08-08T00:00:00.000Z', sourcePdfPath: 'x.pdf',
    })).toThrow('Bản tóm tắt slide không hợp lệ');
  });

  it('rejects graph nodes without a valid source slide', () => {
    expect(() => normalizeLessonKnowledgeArtifact({
      graph: { nodes: [{ id: 'ai', title: 'AI', description: '', importance: 'core', slideNumbers: [2] }], edges: [] },
      slideSummaries: [{ page: 1, title: 'AI', summary: 'Giới thiệu AI', keyConcepts: [] }],
      source: 'cache', model: 'test', generatedAt: '2026-08-08T00:00:00.000Z', sourcePdfPath: 'x.pdf',
    })).toThrow('slide không tồn tại');
  });
});
