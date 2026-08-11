import { describe, expect, it } from 'vitest';
import { parseLessonQuizIndexResult } from './lessonQuizIndex';

describe('lesson quiz index response', () => {
  it('accepts a ready raw-PDF chunk index', () => {
    expect(parseLessonQuizIndexResult({
      lessonId: 'day01-llm-foundation',
      sourceIdentity: 'lesson.pdf:2026-08-11',
      chunkCount: 42,
      source: 'generated',
      ready: true,
    })).toMatchObject({ chunkCount: 42, ready: true });
  });

  it('rejects empty indexes so the UI cannot report a false ready state', () => {
    expect(() => parseLessonQuizIndexResult({
      lessonId: 'day01-llm-foundation',
      sourceIdentity: 'lesson.pdf:2026-08-11',
      chunkCount: 0,
      source: 'generated',
      ready: false,
    })).toThrow(/không hợp lệ/);
  });
});
