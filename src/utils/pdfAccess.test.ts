import { describe, expect, it } from 'vitest';
import { isExpiredPdfAccessError, isPdfPasswordError } from './pdfAccess';

describe('PDF access errors', () => {
  it('recognizes expired signed URL responses', () => {
    expect(isExpiredPdfAccessError(new Error('Unexpected server response (400) while retrieving PDF'))).toBe(true);
    expect(isExpiredPdfAccessError(new Error('Unexpected server response (403) while retrieving PDF'))).toBe(true);
    expect(isExpiredPdfAccessError(new Error('Invalid PDF structure'))).toBe(false);
  });

  it('recognizes password-protected PDF errors', () => {
    expect(isPdfPasswordError(new Error('No password given'))).toBe(true);
    expect(isPdfPasswordError(new Error('Incorrect Password'))).toBe(true);
  });
});
