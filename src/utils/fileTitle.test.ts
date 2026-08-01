import { describe, expect, it } from 'vitest';
import { getLessonTitleFromPdfName } from './fileTitle';

describe('getLessonTitleFromPdfName', () => {
  it('uses the PDF file name without its extension', () => {
    expect(getLessonTitleFromPdfName('Day 10 Data Pipeline and Data Observability.pdf'))
      .toBe('Day 10 Data Pipeline and Data Observability');
  });

  it('removes a case-insensitive final PDF extension only', () => {
    expect(getLessonTitleFromPdfName('lesson.v2.PDF')).toBe('lesson.v2');
  });

  it('keeps generated titles within the lesson name limit', () => {
    expect(getLessonTitleFromPdfName(`${'a'.repeat(140)}.pdf`)).toHaveLength(120);
  });
});
