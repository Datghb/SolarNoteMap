import { describe, expect, it } from 'vitest';
import { createPdfLoadingOptions, createPdfPreloadPlan, getPriorityPdfPages } from './pdfLoading';

describe('PDF loading options', () => {
  it('streams the requested ranges without downloading the rest automatically', () => {
    expect(createPdfLoadingOptions('lesson.pdf')).toEqual({
      url: 'lesson.pdf',
      disableAutoFetch: true,
      disableStream: true,
      disableRange: false,
    });
  });

  it('prioritizes the first pages without exceeding the document length', () => {
    expect(getPriorityPdfPages(42)).toEqual([1, 2, 3]);
    expect(getPriorityPdfPages(2)).toEqual([1, 2]);
    expect(getPriorityPdfPages(0)).toEqual([]);
  });

  it('starts page one immediately and defers later pages', () => {
    expect(createPdfPreloadPlan(['a.pdf', 'b.pdf'])).toEqual({
      immediate: [
        { pdfUrl: 'a.pdf', pageNumber: 1 },
        { pdfUrl: 'b.pdf', pageNumber: 1 },
      ],
      deferred: [
        { pdfUrl: 'a.pdf', pageNumber: 2 },
        { pdfUrl: 'b.pdf', pageNumber: 2 },
        { pdfUrl: 'a.pdf', pageNumber: 3 },
        { pdfUrl: 'b.pdf', pageNumber: 3 },
      ],
    });
  });
});
