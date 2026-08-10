export const MAP_THEMES = [
  { id: 'classic', name: 'Sáng rõ', description: 'Dễ đọc và tương phản cao' },
  { id: 'figma', name: 'Canvas', description: 'Không gian thiết kế sáng' },
  { id: 'minimal', name: 'Tối giản', description: 'Mind map tinh gọn' },
  { id: 'galaxy', name: 'Vũ trụ', description: 'Chòm sao kiến thức' },
  { id: 'neon', name: 'Neon tối', description: 'Dark color mode' },
] as const;

export type MapTheme = typeof MAP_THEMES[number]['id'];

export const DEFAULT_MAP_THEME: MapTheme = 'classic';
export const MAP_THEME_STORAGE_KEY = 'solar-knowledge-map-theme:v2';
export const MAP_THEME_CHANGE_EVENT = 'solar-knowledge-map-theme:changed';

export function isMapTheme(value: unknown): value is MapTheme {
  return typeof value === 'string' && MAP_THEMES.some((theme) => theme.id === value);
}

export function loadMapTheme(storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage): MapTheme {
  try {
    const stored = storage?.getItem(MAP_THEME_STORAGE_KEY);
    return isMapTheme(stored) ? stored : DEFAULT_MAP_THEME;
  } catch {
    return DEFAULT_MAP_THEME;
  }
}

export function saveMapTheme(theme: MapTheme, storage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage) {
  try {
    storage?.setItem(MAP_THEME_STORAGE_KEY, theme);
  } catch {
    // The UI can still switch themes when storage is unavailable.
  }
}
