import { describe, expect, it } from 'vitest';
import { appendActivity, buildCloudActivityMetadata, createTeacherLesson, summarizeClassroom, type StudentActivity } from './courseStore';

describe('teacher course store', () => {
  it('creates a normalized lesson without mutating the form input', () => {
    const input = { name: '  Prompt Engineering ', shortName: ' Prompt ', description: 'Kỹ thuật viết prompt', pdfName: 'lesson.pdf' };
    const lesson = createTeacherLesson(input, 'lesson-id', '2026-07-29T00:00:00.000Z');
    expect(input.name).toContain('  ');
    expect(lesson).toMatchObject({ id: 'lesson-id', name: 'Prompt Engineering', shortName: 'Prompt', published: false, pdfName: 'lesson.pdf' });
  });

  it('uses the lesson name when no short name is provided', () => {
    const lesson = createTeacherLesson(
      { name: 'Agentic AI cho doanh nghiệp', description: '' },
      'lesson-id',
      '2026-07-29T00:00:00.000Z',
    );

    expect(lesson.shortName).toBe('Agentic AI cho doanh nghiệp');
  });

  it('prepends activity immutably and caps the history', () => {
    const current = Array.from({ length: 1000 }, (_, index) => ({ id: String(index), studentId: 's', studentName: 'A', lessonId: 'l', type: 'lesson_opened' as const, occurredAt: String(index) }));
    const next = appendActivity(current, { id: 'new', studentId: 's', studentName: 'A', lessonId: 'l', type: 'map_saved', occurredAt: 'now' });
    expect(current).toHaveLength(1000);
    expect(next).toHaveLength(1000);
    expect(next[0].id).toBe('new');
  });

  it('aggregates unique students and learning actions', () => {
    const activities: StudentActivity[] = [
      { id: '1', studentId: 'a', studentName: 'An', lessonId: 'l1', type: 'lesson_opened', occurredAt: '1' },
      { id: '2', studentId: 'a', studentName: 'An', lessonId: 'l1', type: 'note_updated', occurredAt: '2', metadata: { wordCount: 12 } },
      { id: '3', studentId: 'b', studentName: 'Bình', lessonId: 'l1', type: 'question_posted', occurredAt: '3' },
    ];
    expect(summarizeClassroom(activities)).toEqual({ activeStudents: 2, notes: 1, maps: 0, questions: 1, totalEvents: 3 });
  });

  it('preserves the viewed slide id in cloud activity metadata', () => {
    const metadata = { status: 'reviewing' };
    expect(buildCloudActivityMetadata('slide-7', metadata)).toEqual({ status: 'reviewing', slideId: 'slide-7' });
    expect(metadata).toEqual({ status: 'reviewing' });
  });
});
