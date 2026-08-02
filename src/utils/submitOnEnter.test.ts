import { describe, expect, it } from 'vitest';
import { shouldSubmitOnEnter } from './submitOnEnter';

describe('submit on Enter', () => {
  it('submits textarea content with Enter and keeps Shift+Enter for a newline', () => {
    expect(shouldSubmitOnEnter({ key: 'Enter' })).toBe(true);
    expect(shouldSubmitOnEnter({ key: 'Enter', shiftKey: true })).toBe(false);
  });

  it('does not submit while a Vietnamese IME composition is active', () => {
    expect(shouldSubmitOnEnter({ key: 'Enter', isComposing: true })).toBe(false);
  });

  it('allows Enter submission from a single-line input', () => {
    expect(shouldSubmitOnEnter({ key: 'Enter', shiftKey: true }, false)).toBe(true);
    expect(shouldSubmitOnEnter({ key: 'Escape' }, false)).toBe(false);
  });
});
