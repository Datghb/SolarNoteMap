import { describe, expect, it } from 'vitest';
import { canSubmitClassCode, normalizeClassCode } from './classCode';

describe('student class code', () => {
  it('normalizes a code before joining another class', () => {
    expect(normalizeClassCode('  abc12345  ')).toBe('abc12345');
  });

  it('accepts only codes supported by the join-class RPC', () => {
    expect(canSubmitClassCode('abc12345')).toBe(true);
    expect(canSubmitClassCode(' short ')).toBe(false);
    expect(canSubmitClassCode('a'.repeat(65))).toBe(false);
    expect(canSubmitClassCode('abc 12345')).toBe(false);
    expect(canSubmitClassCode('!!!!!!!!')).toBe(false);
  });
});
