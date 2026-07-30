import { describe, expect, it } from 'vitest';
import { fromCloudActivityKind, toCloudActivityKind } from './cloudClassroom';

describe('cloud classroom activity mapping', () => {
  it('preserves slide and understanding interactions as distinct events', () => {
    expect(toCloudActivityKind('lesson_opened')).toBe('lesson_viewed');
    expect(toCloudActivityKind('slide_viewed')).toBe('slide_viewed');
    expect(toCloudActivityKind('understanding_updated')).toBe('understanding_updated');
    expect(fromCloudActivityKind('slide_viewed')).toBe('slide_viewed');
    expect(fromCloudActivityKind('understanding_updated')).toBe('understanding_updated');
  });
});
