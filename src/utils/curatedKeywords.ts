import glossaryCsv from '../../tu_khoa_AI_LLM_RAG_Agent_MLOps.csv?raw';
import { findGlossaryMatches, parseKeywordGlossaryCsv, selectFirstGlossaryMatches } from '../../shared/keywordGlossary.mjs';
import { extractSummaryKeywordDefinitions, isTechnicalKeywordDefinition, normalizeKeywordTerm, type KeywordDefinition } from './summaryKeywords';

const curatedGlossary = parseKeywordGlossaryCsv(glossaryCsv);

export function getCuratedSummaryKeywords(summary: string): KeywordDefinition[] {
  if (!summary.trim()) return [];
  return selectFirstGlossaryMatches(findGlossaryMatches(summary, curatedGlossary))
    .map((item: { term: string; definition: string }) => ({ term: item.term, definition: item.definition }));
}

export function resolveSummaryKeywordDefinitions(summary: string, stored: KeywordDefinition[]) {
  const resolved = new Map<string, KeywordDefinition>();
  for (const item of extractSummaryKeywordDefinitions(summary)) {
    if (isTechnicalKeywordDefinition(item)) resolved.set(normalizeKeywordTerm(item.term), item);
  }
  for (const item of stored) {
    if (isTechnicalKeywordDefinition(item)) resolved.set(normalizeKeywordTerm(item.term), item);
  }
  for (const item of getCuratedSummaryKeywords(summary)) {
    if (isTechnicalKeywordDefinition(item)) resolved.set(normalizeKeywordTerm(item.term), item);
  }
  return [...resolved.values()];
}
