export function normalizeGlossaryTerm(value) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi');
}

function parseCsvLine(line) {
  const parsed = Array.from(line).reduce((state, character, index, characters) => {
    if (state.skipNext) return { ...state, skipNext: false };
    if (character === '"' && state.inQuotes && characters[index + 1] === '"') {
      return { ...state, field: `${state.field}"`, skipNext: true };
    }
    if (character === '"') return { ...state, inQuotes: !state.inQuotes };
    if (character === ',' && !state.inQuotes) return { ...state, fields: [...state.fields, state.field], field: '' };
    return { ...state, field: `${state.field}${character}` };
  }, { fields: [], field: '', inQuotes: false, skipNext: false });
  return [...parsed.fields, parsed.field];
}

function glossaryAliases(keyword, vietnameseTerm) {
  const parentheticalAliases = [...keyword.matchAll(/\(([^)]+)\)/g)].map((match) => match[1].trim());
  const keywordWithoutParentheses = keyword.replace(/\s*\([^)]+\)\s*/g, ' ').trim();
  return [...new Set([keyword, keywordWithoutParentheses, vietnameseTerm, ...parentheticalAliases].map((value) => value.trim()).filter(Boolean))];
}

export function parseKeywordGlossaryCsv(content) {
  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).flatMap((line) => {
    const values = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() || '']));
    if (!row.Keyword || !row.Explanation) return [];
    return [{
      category: row.Category,
      term: row.Keyword,
      vietnameseTerm: row.Vietnamese_Term,
      definition: row.Explanation,
      level: row.Level,
      origin: row.Origin,
      aliases: glossaryAliases(row.Keyword, row.Vietnamese_Term),
    }];
  });
}

export function findGlossaryMatches(text, glossary) {
  const normalizedText = normalizeGlossaryTerm(text);
  const matches = glossary.flatMap((entry) => entry.aliases.flatMap((alias) => {
    const normalizedAlias = normalizeGlossaryTerm(alias);
    let index = normalizedText.indexOf(normalizedAlias);
    while (index !== -1) {
      const before = normalizedText[index - 1] || '';
      const after = normalizedText[index + normalizedAlias.length] || '';
      if (!/[\p{L}\p{N}]/u.test(before) && !/[\p{L}\p{N}]/u.test(after)) {
        return [{ ...entry, term: alias, normalizedTerm: normalizedAlias, canonicalTerm: entry.term, matchIndex: index }];
      }
      index = normalizedText.indexOf(normalizedAlias, index + 1);
    }
    return [];
  }));
  return [...new Map(matches.map((item) => [item.normalizedTerm, item])).values()];
}

export function selectFirstGlossaryMatches(matches) {
  return [...[...matches]
    .sort((left, right) => left.matchIndex - right.matchIndex || right.term.length - left.term.length)
    .reduce((selected, item) => {
      const canonical = normalizeGlossaryTerm(item.canonicalTerm);
      return selected.has(canonical) ? selected : new Map([...selected, [canonical, item]]);
    }, new Map()).values()];
}
