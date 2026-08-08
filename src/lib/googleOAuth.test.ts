import { describe, expect, it } from 'vitest';
import { createGoogleOAuthCredentials } from './googleOAuth';

describe('createGoogleOAuthCredentials', () => {
  it('uses Google and redirects back to the application root', () => {
    expect(createGoogleOAuthCredentials('https://solar-note-map.example/lesson/1')).toEqual({
      provider: 'google',
      options: { redirectTo: 'https://solar-note-map.example/' },
    });
  });

  it('preserves the local development port', () => {
    expect(createGoogleOAuthCredentials('http://localhost:5173').options?.redirectTo)
      .toBe('http://localhost:5173/');
  });
});
