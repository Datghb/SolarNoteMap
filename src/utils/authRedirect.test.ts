import { describe, expect, it } from 'vitest';
import { getOAuthRedirectUrl } from './authRedirect';

describe('getOAuthRedirectUrl', () => {
  it('returns the app origin without carrying login paths or query params', () => {
    expect(getOAuthRedirectUrl({ origin: 'http://localhost:5173' })).toBe('http://localhost:5173');
    expect(getOAuthRedirectUrl({ origin: 'https://solar.example.com' })).toBe('https://solar.example.com');
  });
});
