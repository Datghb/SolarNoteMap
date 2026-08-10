import { describe, expect, it, vi } from 'vitest';
import { MAP_THEME_STORAGE_KEY, isMapTheme, loadMapTheme, saveMapTheme } from './mapTheme';

describe('map theme preference', () => {
  it('loads a supported theme and falls back for invalid values', () => {
    expect(loadMapTheme({ getItem: () => 'figma' })).toBe('figma');
    expect(loadMapTheme({ getItem: () => 'unknown' })).toBe('classic');
    expect(loadMapTheme({ getItem: () => null })).toBe('classic');
    expect(isMapTheme('neon')).toBe(true);
  });

  it('persists the selected theme', () => {
    const setItem = vi.fn();
    saveMapTheme('minimal', { setItem });
    expect(setItem).toHaveBeenCalledWith(MAP_THEME_STORAGE_KEY, 'minimal');
  });
});
