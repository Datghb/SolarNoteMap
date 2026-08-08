import type { SignInWithOAuthCredentials } from '@supabase/supabase-js';

export function createGoogleOAuthCredentials(origin: string): SignInWithOAuthCredentials {
  const redirectTo = new URL('/', origin).toString();

  return {
    provider: 'google',
    options: { redirectTo },
  };
}
