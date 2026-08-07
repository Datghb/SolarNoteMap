// Lightweight constant kept separate from SelectablePdfPage.tsx so importing
// the built-in slide URL does not pull the (large) pdfjs-dist library into
// whatever bundle imports it.
export const builtInSlidePdfUrl = new URL('../../day01-llm-foundation.pdf', import.meta.url).href;
