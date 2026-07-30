import { LESSONS } from "../data/lessons";

const CUSTOM_PALETTES = [
  { color: "#8ea1ff", colors: ["#d8deff", "#8ea1ff", "#314387"] },
  { color: "#43d6c5", colors: ["#b9fff5", "#43d6c5", "#17655f"] },
  { color: "#f28bb7", colors: ["#ffd1e3", "#f28bb7", "#75314f"] },
  { color: "#c29aff", colors: ["#eadcff", "#c29aff", "#553486"] },
  { color: "#f4ca64", colors: ["#fff0ad", "#f4ca64", "#76531d"] },
  { color: "#ff8a62", colors: ["#ffd0bd", "#ff8a62", "#7d3828"] },
  { color: "#5fc8ff", colors: ["#c8eeff", "#5fc8ff", "#20577d"] },
  { color: "#9bdd62", colors: ["#dcffbd", "#9bdd62", "#3f6924"] },
] as const;

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("vi");
}

export function resolveLessonPalette(id: string, shortName: string, name: string) {
  const normalizedId = normalize(id);
  const normalizedShortName = normalize(shortName);
  const normalizedName = normalize(name);
  const canonical = LESSONS.find(
    (lesson) =>
      normalize(lesson.id) === normalizedId ||
      normalize(lesson.shortName) === normalizedShortName ||
      normalize(lesson.name) === normalizedName,
  );

  if (canonical) {
    return { color: canonical.color, colors: [...canonical.colors] };
  }

  const hash = Array.from(`${id}:${shortName}:${name}`).reduce(
    (value, character) => (value * 31 + character.charCodeAt(0)) >>> 0,
    0,
  );
  const palette = CUSTOM_PALETTES[hash % CUSTOM_PALETTES.length];
  return { color: palette.color, colors: [...palette.colors] };
}

export function resolveLessonPalettes(
  lessons: Array<{ id: string; shortName: string; name: string }>,
) {
  const usedColors = new Set<string>();

  return lessons.map((lesson) => {
    const preferred = resolveLessonPalette(
      lesson.id,
      lesson.shortName,
      lesson.name,
    );
    if (!usedColors.has(preferred.color)) {
      usedColors.add(preferred.color);
      return preferred;
    }

    const available = CUSTOM_PALETTES.find(
      (palette) => !usedColors.has(palette.color),
    );
    const palette = available ?? preferred;
    usedColors.add(palette.color);
    return { color: palette.color, colors: [...palette.colors] };
  });
}
