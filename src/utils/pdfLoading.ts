export function createPdfLoadingOptions(pdfUrl: string) {
  return {
    url: pdfUrl,
    disableAutoFetch: true,
    disableStream: true,
    disableRange: false,
  } as const;
}

export function getPriorityPdfPages(pageCount: number, limit = 3) {
  const safeCount = Math.max(0, Math.floor(pageCount));
  return Array.from({ length: Math.min(safeCount, limit) }, (_, index) => index + 1);
}

export type PdfPreloadItem = { pdfUrl: string; pageNumber: number };

export function createPdfPreloadPlan(pdfUrls: string[], pageLimit = 3) {
  const uniqueUrls = [...new Set(pdfUrls)];
  const pages = getPriorityPdfPages(pageLimit, pageLimit);
  const itemsForPage = (pageNumber: number): PdfPreloadItem[] =>
    uniqueUrls.map((pdfUrl) => ({ pdfUrl, pageNumber }));
  return {
    immediate: pages.slice(0, 1).flatMap(itemsForPage),
    deferred: pages.slice(1).flatMap(itemsForPage),
  };
}
