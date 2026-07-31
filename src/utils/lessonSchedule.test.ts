import { describe, expect, it } from 'vitest';
import { toFutureReleaseIso } from './lessonSchedule';

describe('lesson scheduling', () => {
  it('accepts only a valid future release time', () => {
    expect(toFutureReleaseIso('2026-08-01T09:00', new Date('2026-07-31T00:00:00Z'))).toBe(new Date('2026-08-01T09:00').toISOString());
    expect(() => toFutureReleaseIso('2026-07-30T09:00', new Date('2026-07-31T00:00:00Z'))).toThrow('tương lai');
  });
});
