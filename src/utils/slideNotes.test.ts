import { describe, expect, it } from 'vitest';
import { addSlidePin, combineSlideNotes, restoreSlideThoughts, updateSlideNote } from './slideNotes';

describe('slide notes', () => {
  it('updates notes immutably', () => {
    const current = { intro: 'AI là phần mềm thông minh' };
    const next = updateSlideNote(current, 'data', 'AI học từ dữ liệu');

    expect(next).not.toBe(current);
    expect(current).toEqual({ intro: 'AI là phần mềm thông minh' });
    expect(next.data).toContain('dữ liệu');
  });

  it('combines non-empty notes with slide context for map generation', () => {
    const result = combineSlideNotes(
      [{ id: 'intro', title: 'Khởi động' }, { id: 'data', title: 'Dữ liệu' }],
      { intro: '  ', data: 'Mô hình học từ dữ liệu.' },
    );

    expect(result).toBe('[Slide: Dữ liệu]\nMô hình học từ dữ liệu.');
  });

  it('does not restore a mind map from a saved map when slide notes are empty', () => {
    const result = restoreSlideThoughts(
      [{ id: 'intro', title: 'Khởi động' }],
      {},
      '[Slide: Khởi động]\nNội dung demo còn sót lại.',
    );

    expect(result).toBe('');
  });

  it('adds a normalized interaction pin without mutating previous pins', () => {
    const pins = [{ id: 'old', x: 20, y: 30, page: 1 }];
    const next = addSlidePin(pins, { x: 74.235, y: 12.999, page: 2 });

    expect(pins).toHaveLength(1);
    expect(next).toHaveLength(2);
    expect(next[1]).toMatchObject({ x: 74.2, y: 13, page: 2 });
  });
});
