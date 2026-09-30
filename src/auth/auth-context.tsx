import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

import { fetchProfile, refreshAccount, type Profile } from './auth-service';

export interface AuthState {
  /** Faux si les variables d'environnement Supabase manquent : l'app reste jouable hors ligne. */
  configured: boolean;
  /** Vrai tant que la session enregistrée n'a pas été relue. */
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  /** Vrai pour un compte invité (anonyme). */
  isGuest: boolean;
  /** Invité qui a demandé à devenir un compte e-mail : adresse en attente de confirmation. */
  pendingEmail: string | null;
  /** Relit le profil (après un changement de pseudo, par exemple). */
  refreshProfile: () => void;
}

const AuthContext = createContext<AuthState>({
  configured: false,
  loading: false,
  session: null,
  profile: null,
  isGuest: false,
  pendingEmail: null,
  refreshProfile: () => {},
});

/** Session Supabase et profil du joueur connecté, pour toute l'application. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileVersion, setProfileVersion] = useState(0);

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

  // Invité en attente de confirmation d'e-mail : au retour dans l'app (souvent
  // après avoir cliqué le lien dans sa messagerie), on relit le compte.
  const pendingEmail = session?.user.is_anonymous ? (session.user.new_email ?? null) : null;
  useEffect(() => {
    if (!pendingEmail || Platform.OS === 'web') return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshAccount(getSupabase()).catch(() => {});
    });
    return () => subscription.remove();
  }, [pendingEmail]);

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
  }, [userId, profileVersion]);

  const value: AuthState = {
    configured: isSupabaseConfigured,
    loading,
    session,
    // Le profil n'est valable que pour la session en cours.
    profile: profile && profile.id === userId ? profile : null,
    isGuest: session?.user.is_anonymous ?? false,
    pendingEmail,
    refreshProfile: () => setProfileVersion((v) => v + 1),
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
