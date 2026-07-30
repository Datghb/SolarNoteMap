import { describe, expect, it } from 'vitest';
import { courseSchemaIsMissing, fromCloudActivityKind, isClassLessonReleased, toCloudActivityKind } from './cloudClassroom';

describe('cloud classroom activity mapping', () => {
  it('preserves slide and understanding interactions as distinct events', () => {
    expect(toCloudActivityKind('lesson_opened')).toBe('lesson_viewed');
    expect(toCloudActivityKind('slide_viewed')).toBe('slide_viewed');
    expect(toCloudActivityKind('understanding_updated')).toBe('understanding_updated');
    expect(fromCloudActivityKind('slide_viewed')).toBe('slide_viewed');
    expect(fromCloudActivityKind('understanding_updated')).toBe('understanding_updated');
  });

  it('keeps future class lessons scheduled but unavailable', () => {
    const now = Date.parse('2026-08-01T00:00:00.000Z');
    expect(isClassLessonReleased('2026-07-31T23:59:00.000Z', now)).toBe(true);
    expect(isClassLessonReleased('2026-08-02T00:00:00.000Z', now)).toBe(false);
    expect(isClassLessonReleased(null, now)).toBe(false);
  });

  it('falls back only for exact missing course-schema errors', () => {
    expect(courseSchemaIsMissing({ code: 'PGRST204', message: "Could not find the 'course_id' column" })).toBe(true);
    expect(courseSchemaIsMissing({ code: 'PGRST202', message: 'Could not find public.load_class_lessons' })).toBe(true);
    expect(courseSchemaIsMissing({ code: '42501', message: 'permission denied for public.courses' })).toBe(false);
    expect(courseSchemaIsMissing({ code: 'PGRST202', message: 'Could not find an unrelated RPC' })).toBe(false);
  });
});
