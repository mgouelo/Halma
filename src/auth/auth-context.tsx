import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

import { fetchProfile, type Profile } from './auth-service';

export interface AuthState {
  /** Faux si les variables d'environnement Supabase manquent : l'app reste jouable hors ligne. */
  configured: boolean;
  /** Vrai tant que la session enregistrée n'a pas été relue. */
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  /** Vrai pour un compte invité (anonyme). */
  isGuest: boolean;
}

const AuthContext = createContext<AuthState>({
  configured: false,
  loading: false,
  session: null,
  profile: null,
  isGuest: false,
});

/** Session Supabase et profil du joueur connecté, pour toute l'application. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  // Session : lecture initiale puis suivi des changements (connexion, déconnexion, rafraîchissement).
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabase();
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setSession(data.session);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  // Sur mobile, le jeton n'est rafraîchi que quand l'application est au premier plan.
  useEffect(() => {
    if (!isSupabaseConfigured || Platform.OS === 'web') return;
    const supabase = getSupabase();
    const sync = (state: string) =>
      state === 'active' ? supabase.auth.startAutoRefresh() : supabase.auth.stopAutoRefresh();
    sync(AppState.currentState);
    const subscription = AppState.addEventListener('change', sync);
    return () => subscription.remove();
  }, []);

  // Profil du joueur connecté.
  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (!userId) return;
    let active = true;
    fetchProfile(getSupabase(), userId)
      .then((p) => {
        if (active) setProfile(p);
      })
      .catch(() => {
        if (active) setProfile(null);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const value: AuthState = {
    configured: isSupabaseConfigured,
    loading,
    session,
    // Le profil n'est valable que pour la session en cours.
    profile: profile && profile.id === userId ? profile : null,
    isGuest: session?.user.is_anonymous ?? false,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
