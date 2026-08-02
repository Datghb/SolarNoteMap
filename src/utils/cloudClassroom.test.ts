import { describe, expect, it } from 'vitest';
import { communitySchemaIsMissing, courseSchemaIsMissing, fromCloudActivityKind, isClassLessonReleased, mapCommunityQuestionRows, parseRegeneratedJoinCode, toCloudActivityKind } from './cloudClassroom';

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

  it('maps shared questions, answers and the current user vote', () => {
    expect(mapCommunityQuestionRows([{
      id: 'question-1', lesson_id: 'lesson-1', slide_id: 'slide-2', body: 'Eval khác test thường như thế nào?', title: 'Eval', created_at: '2026-08-02T00:00:00Z',
      author: { display_name: 'Minh Anh' },
      votes: [{ user_id: 'student-1' }, { user_id: 'student-2' }],
      answers: [{ id: 'answer-1', body: 'Eval dùng bộ tiêu chí cố định.', created_at: '2026-08-02T00:05:00Z', author: { display_name: 'Thảo Linh' } }],
    }], 'student-2')).toEqual([expect.objectContaining({
      slideId: 'slide-2', author: 'Minh Anh', votes: 2, voted: true,
      answers: [expect.objectContaining({ author: 'Thảo Linh' })],
    })]);
  });

  it('recognizes a missing community vote relationship in the PostgREST cache', () => {
    expect(communitySchemaIsMissing({ code: 'PGRST200', message: "Could not find a relationship between 'community_questions' and 'community_question_votes'" })).toBe(true);
    expect(communitySchemaIsMissing({ code: '42501', message: 'permission denied' })).toBe(false);
  });

  it('accepts only a valid regenerated class join code response', () => {
    expect(parseRegeneratedJoinCode({ joinCode: 'abc12345' })).toBe('abc12345');
    expect(() => parseRegeneratedJoinCode({ joinCode: '' })).toThrow('mã lớp mới không hợp lệ');
    expect(() => parseRegeneratedJoinCode(null)).toThrow('mã lớp mới không hợp lệ');
  });
});
