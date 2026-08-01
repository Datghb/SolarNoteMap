import { describe, expect, it } from 'vitest';
import { getPdfLessonLabel } from './lessonLabels';

describe('PDF lesson labels', () => {
  it('uses the day number from the active lesson name', () => {
    expect(getPdfLessonLabel('Day 8 - RAG pipeline')).toBe('DAY 8 · PDF');
    expect(getPdfLessonLabel('Bài học Agentic')).toBe('BÀI HỌC · PDF');
  });
});
