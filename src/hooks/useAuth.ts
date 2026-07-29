import { useCallback, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { requireSupabase, supabase, supabaseConfigError } from '../lib/supabase';

export type UserRole = 'student' | 'teacher';

export interface UserProfile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  role: UserRole;
  created_at?: string;
  updated_at?: string;
}

export interface SignUpDetails {
  email: string;
  password: string;
  fullName?: string;
}

export interface AuthState {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  configured: boolean;
  error: string | null;
}

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Đã có lỗi xảy ra. Vui lòng thử lại.';

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    profile: null,
    loading: Boolean(supabase),
    configured: Boolean(supabase),
    error: supabaseConfigError,
  });

  const fetchProfile = useCallback(async (user: User): Promise<UserProfile | null> => {
    const client = requireSupabase();
    const { data, error } = await client.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (error) throw error;
    return data as UserProfile | null;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!state.user) return null;
    try {
      const profile = await fetchProfile(state.user);
      setState((current) => ({ ...current, profile, error: null }));
      return profile;
    } catch (error) {
      setState((current) => ({ ...current, error: errorMessage(error) }));
      return null;
    }
  }, [fetchProfile, state.user]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    const applySession = async (session: Session | null) => {
      const user = session?.user ?? null;
      let profile: UserProfile | null = null;
      let error: string | null = null;
      if (user) {
        try {
          profile = await fetchProfile(user);
        } catch (caught) {
          error = errorMessage(caught);
        }
      }
      if (active) setState({ session, user, profile, loading: false, configured: true, error });
    };

    void supabase.auth.getSession().then(({ data }) => applySession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySession(session);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const { data, error } = await requireSupabase().auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      return data;
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: errorMessage(error) }));
      throw error;
    }
  }, []);

  const signUp = useCallback(async ({ email, password, fullName }: SignUpDetails) => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const { data, error } = await requireSupabase().auth.signUp({
        email: email.trim(),
        password,
        options: { data: { display_name: fullName?.trim() || undefined } },
      });
      if (error) throw error;
      setState((current) => ({ ...current, loading: false }));
      return data;
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: errorMessage(error) }));
      throw error;
    }
  }, []);

  const redeemTeacherInvite = useCallback(async (inviteCode: string) => {
    const code = inviteCode.trim();
    if (!code) throw new Error('Vui lòng nhập mã mời giáo viên.');
    try {
      const { data, error } = await requireSupabase().rpc('redeem_teacher_invite', { invite_token: code });
      if (error) throw error;
      await refreshProfile();
      setState((current) => ({ ...current, error: null }));
      return data;
    } catch (error) {
      setState((current) => ({ ...current, error: errorMessage(error) }));
      throw error;
    }
  }, [refreshProfile]);

  const signOut = useCallback(async () => {
    try {
      const { error } = await requireSupabase().auth.signOut();
      if (error) throw error;
      setState((current) => ({ ...current, session: null, user: null, profile: null, error: null }));
    } catch (error) {
      setState((current) => ({ ...current, error: errorMessage(error) }));
      throw error;
    }
  }, []);

  return { ...state, signIn, signUp, signOut, redeemTeacherInvite, refreshProfile };
}
