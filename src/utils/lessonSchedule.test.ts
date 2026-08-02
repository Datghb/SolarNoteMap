import { describe, expect, it } from 'vitest';
import { getInitialReleaseLocalValue, toDateTimeLocalValue, toFutureReleaseIso } from './lessonSchedule';

describe('lesson scheduling', () => {
  it('accepts only a valid future release time', () => {
    expect(toFutureReleaseIso('2026-08-01T09:00', new Date('2026-07-31T00:00:00Z'))).toBe(new Date('2026-08-01T09:00').toISOString());
    expect(() => toFutureReleaseIso('2026-07-30T09:00', new Date('2026-07-31T00:00:00Z'))).toThrow('tương lai');
  });

  it('defaults a new schedule to the current device minute', () => {
    const now = new Date('2026-08-02T08:12:59.000Z');
    const initial = getInitialReleaseLocalValue(undefined, now);
    expect(initial).toBe(toDateTimeLocalValue(now.toISOString()));
  });

  it('treats the current displayed minute as opening immediately', () => {
    const now = new Date('2026-08-02T08:12:45.000Z');
    expect(toFutureReleaseIso(toDateTimeLocalValue(now.toISOString()), now)).toBe(now.toISOString());
  });

  it('keeps an existing scheduled time when reopening the dialog', () => {
    const existing = '2026-08-03T09:30:00.000Z';
    expect(getInitialReleaseLocalValue(existing)).toBe(toDateTimeLocalValue(existing));
  });
});
