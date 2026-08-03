/// <reference types="vite/client" />

declare module '*?url' {
  const url: string;
  export default url;
}

declare module '*?raw' {
  const content: string;
  export default content;
}

declare module '*keywordGlossary.mjs' {
  interface GlossaryEntry {
    term: string;
    definition: string;
    aliases: string[];
  }
  interface GlossaryMatch extends GlossaryEntry {
    normalizedTerm: string;
    canonicalTerm: string;
    matchIndex: number;
  }
  export function parseKeywordGlossaryCsv(content: string): GlossaryEntry[];
  export function findGlossaryMatches(text: string, glossary: GlossaryEntry[]): GlossaryMatch[];
  export function selectFirstGlossaryMatches(matches: GlossaryMatch[]): GlossaryMatch[];
}
