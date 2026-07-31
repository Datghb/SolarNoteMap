import { describe, expect, it } from 'vitest';
import { resolveRestoredLessonId } from './lessonSession';

describe('lesson session restoration', () => {
  it('restores a stored lesson that is still visible', () => {
    expect(resolveRestoredLessonId(null, 'lesson-2', ['lesson-1', 'lesson-2'])).toBe('lesson-2');
  });

  it('keeps the current lesson and rejects inaccessible stored lessons', () => {
    expect(resolveRestoredLessonId('lesson-1', 'lesson-2', ['lesson-1'])).toBe('lesson-1');
    expect(resolveRestoredLessonId(null, 'draft', ['lesson-1'])).toBeNull();
  });
});
