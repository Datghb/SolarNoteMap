export interface SlideSummary {
  id: string;
  title: string;
}

export interface SlidePin {
  id: string;
  x: number;
  y: number;
  page: number;
}

export function addSlidePin(pins: SlidePin[], pin: Omit<SlidePin, 'id'>): SlidePin[] {
  return [...pins, {
    id: crypto.randomUUID(),
    x: Math.min(100, Math.max(0, Math.round(pin.x * 10) / 10)),
    y: Math.min(100, Math.max(0, Math.round(pin.y * 10) / 10)),
    page: pin.page,
  }];
}

export function updateSlideNote(notes: Record<string, string>, slideId: string, content: string) {
  return { ...notes, [slideId]: content };
}

export function combineSlideNotes(slides: SlideSummary[], notes: Record<string, string>) {
  return slides
    .map((slide) => ({ slide, note: notes[slide.id]?.trim() ?? '' }))
    .filter(({ note }) => note)
    .map(({ slide, note }) => `[Slide: ${slide.title}]\n${note}`)
    .join('\n\n');
}

export function restoreSlideThoughts(
  slides: SlideSummary[],
  notes: Record<string, string>,
  _savedMapSourceNote?: string,
) {
  return combineSlideNotes(slides, notes);
}
