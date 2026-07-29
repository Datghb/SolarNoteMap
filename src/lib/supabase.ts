import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const env = (import.meta as ImportMeta & { env: Record<string, string | undefined> }).env;
const supabaseUrl = env.VITE_SUPABASE_URL?.trim();
const supabasePublishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const supabaseConfigError =
  supabaseUrl && supabasePublishableKey
    ? null
    : 'Supabase chưa được cấu hình. Hãy thêm VITE_SUPABASE_URL và VITE_SUPABASE_PUBLISHABLE_KEY.';

export const supabase: SupabaseClient | null =
  supabaseUrl && supabasePublishableKey
    ? createClient(supabaseUrl, supabasePublishableKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error(supabaseConfigError ?? 'Không thể kết nối Supabase.');
  return supabase;
}

export async function getSupabaseAuthHeaders(): Promise<Record<string, string>> {
  if (!supabase) return {};
  const client = supabase;
  const { data } = await client.auth.getSession();
  if (!data.session?.access_token) throw new Error('Phiên đăng nhập đã hết hạn.');
  return { Authorization: `Bearer ${data.session.access_token}` };
}
