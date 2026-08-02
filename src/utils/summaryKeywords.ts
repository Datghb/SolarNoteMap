export interface KeywordDefinition {
  term: string;
  definition: string;
}

export interface SummaryTextPart {
  text: string;
  keyword?: KeywordDefinition;
}

const nonKeywordLabels = /^(?:đặc tính|cách xử lý lỗi|mô hình|khái niệm|ví dụ(?: minh họa)?|bài học|lưu ý(?: quan trọng)?|chủ đề|mục tiêu|bản chất)\b/iu;

export function normalizeKeywordTerm(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi');
}

export function isTechnicalKeywordDefinition(item: KeywordDefinition) {
  const term = item.term.trim();
  const definition = item.definition.trim();
  const words = term.split(/\s+/);
  return term.length >= 2
    && term.length <= 60
    && words.length <= 6
    && definition.length >= 8
    && definition.length <= 400
    && !/[·:;!?]/u.test(term)
    && !/\b(?:day|batch)\s*0*\d+\b/iu.test(term)
    && !nonKeywordLabels.test(term)
    && /^[\p{L}\p{N}+#&()./_\-\s]+$/u.test(term);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function splitTextWithKeywords(text: string, definitions: KeywordDefinition[]): SummaryTextPart[] {
  const unique = new Map(definitions.map((item) => [normalizeKeywordTerm(item.term), item]));
  const keywords = [...unique.values()].sort((left, right) => right.term.length - left.term.length);
  if (!keywords.length) return [{ text }];
  const alternatives = keywords.map((item) => escapeRegExp(item.term)).join('|');
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(${alternatives})(?![\\p{L}\\p{N}])`, 'giu');
  const parts: SummaryTextPart[] = [];
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) parts.push({ text: text.slice(cursor, index) });
    const matchedText = match[0];
    const keyword = unique.get(normalizeKeywordTerm(matchedText));
    parts.push(keyword ? { text: matchedText, keyword } : { text: matchedText });
    cursor = index + matchedText.length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts.length ? parts : [{ text }];
}

export function splitLinesWithFirstKeywordOccurrences(lines: string[], definitions: KeywordDefinition[]): SummaryTextPart[][] {
  return lines.reduce<{ seen: ReadonlySet<string>; result: SummaryTextPart[][] }>((state, line) => {
    const split = splitTextWithKeywords(line, definitions);
    const lineState = split.reduce<{ seen: ReadonlySet<string>; parts: SummaryTextPart[] }>((current, part) => {
      if (!part.keyword) {
        const previous = current.parts.at(-1);
        return previous && !previous.keyword
          ? { ...current, parts: [...current.parts.slice(0, -1), { text: previous.text + part.text }] }
          : { ...current, parts: [...current.parts, part] };
      }
      const normalized = normalizeKeywordTerm(part.keyword.term);
      if (current.seen.has(normalized)) {
        const previous = current.parts.at(-1);
        const plainPart = { text: part.text };
        return previous && !previous.keyword
          ? { ...current, parts: [...current.parts.slice(0, -1), { text: previous.text + plainPart.text }] }
          : { ...current, parts: [...current.parts, plainPart] };
      }
      return { seen: new Set([...current.seen, normalized]), parts: [...current.parts, part] };
    }, { seen: state.seen, parts: [] });
    return { seen: lineState.seen, result: [...state.result, lineState.parts] };
  }, { seen: new Set<string>(), result: [] }).result;
}
