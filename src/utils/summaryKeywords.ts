export interface KeywordDefinition {
  term: string;
  definition: string;
}

export interface SummaryTextPart {
  text: string;
  keyword?: KeywordDefinition;
}

const glossaryHeadingPattern = /^#{2,4}\s+(?:(?:bảng|danh sách)\s+)?(?:thuật ngữ|từ khóa)(?:\s+chuyên ngành|\s+ngắn)?\s*$/iu;
const glossaryEntryPattern = /^[-*]\s+\*\*([^*\n]{2,80})\*\*\s*[:—–-]\s*(.+)$/u;

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
    && /^[\p{L}\p{N}+#&()./_\-\s]+$/u.test(term);
}

export function extractKeywordDefinitions(summary: string): KeywordDefinition[] {
  const definitions = new Map<string, KeywordDefinition>();
  let insideGlossary = false;
  for (const rawLine of summary.split('\n')) {
    const line = rawLine.trim();
    if (glossaryHeadingPattern.test(line)) { insideGlossary = true; continue; }
    if (insideGlossary && /^##\s+/u.test(line)) { insideGlossary = false; continue; }
    if (!insideGlossary) continue;
    const match = glossaryEntryPattern.exec(line);
    if (!match) continue;
    const item = { term: match[1].trim(), definition: match[2].replace(/\*\*/g, '').trim() };
    if (isTechnicalKeywordDefinition(item)) definitions.set(normalizeKeywordTerm(item.term), item);
  }
  return [...definitions.values()];
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
