import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import { applyLanguage, getLanguagePreference, isLanguage, useLanguage } from '@/i18n';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { createDailyLoginTracker } from '@/stats/daily-login';
import { recordDailyLogin } from '@/stats/stats-service';

import { setFlashNotice } from '@/lib/flash-notice';

import { fetchProfile, guestEmailConfirmed, saveAccountLanguage, type Profile } from './auth-service';
import { CONFIRMED_NOTICE, GUEST_POLL_MS } from './confirmation-timing';
import { forgetPendingConfirmation } from './pending-confirmation';
import { useConfirmationWatcher } from './use-confirmation-watcher';

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
  /** Vrai si la dernière lecture du profil a échoué (réseau, serveur) : `refreshProfile` réessaie. */
  profileError: boolean;
  /** Relit le profil (après un changement de pseudo, par exemple). */
  refreshProfile: () => void;
  /** Change quand les statistiques du joueur ont pu changer (connexion du jour enregistrée). */
  statsVersion: number;
}

const AuthContext = createContext<AuthState>({
  configured: false,
  loading: false,
  session: null,
  profile: null,
  isGuest: false,
  pendingEmail: null,
  profileError: false,
  refreshProfile: () => {},
  statsVersion: 0,
});

/** Session Supabase et profil du joueur connecté, pour toute l'application. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileVersion, setProfileVersion] = useState(0);
  const [profileError, setProfileError] = useState(false);
  const [statsVersion, setStatsVersion] = useState(0);

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

  // Invité en attente de confirmation d'e-mail : le lien peut être ouvert sur un
  // autre appareil. On relit le compte à intervalle court et au retour au
  // premier plan ; une fois l'e-mail validé, la session est renouvelée et le
  // compte devient un compte e-mail, sans bouton à toucher.
  const pendingEmail = session?.user.is_anonymous ? (session.user.new_email ?? null) : null;
  useConfirmationWatcher(
    Boolean(pendingEmail),
    () => guestEmailConfirmed(getSupabase()),
    () => {
      void forgetPendingConfirmation();
      setFlashNotice(CONFIRMED_NOTICE);
      setProfileVersion((v) => v + 1);
    },
    GUEST_POLL_MS,
  );

  // Profil du joueur connecté.
  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (!userId) return;
    let active = true;
    fetchProfile(getSupabase(), userId)
      .then((p) => {
        if (!active) return;
        setProfile(p);
        setProfileError(false);
      })
      .catch(() => {
        if (!active) return;
        setProfile(null);
        setProfileError(true);
      });
    return () => {
      active = false;
    };
  }, [userId, profileVersion]);

  // Connexion du jour (série de connexion) : à l'ouverture et à chaque retour
  // dans l'application, une fois par jour. En arrière-plan : rien n'attend
  // cette demande, et un échec (hors ligne) est simplement réessayé plus tard.
  useEffect(() => {
    if (!userId) return;
    let active = true;
    const tracker = createDailyLoginTracker(() => recordDailyLogin(getSupabase()));
    const check = () =>
      tracker.check().then((recorded) => {
        if (recorded && active) setStatsVersion((v) => v + 1);
      });
    check();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [userId]);

  // Langue du compte (e-mails d'authentification) :
  // - sans choix fait sur cet appareil, c'est la langue du compte qui s'applique
  //   (choisie ailleurs) ; la langue de l'appareil ne l'écrase pas ;
  // - un choix fait sur cet appareil est enregistré sur le compte ;
  // - un compte sans langue (créé avant la traduction) reçoit celle affichée.
  // Hors ligne ou serveur pas encore migré : on réessaie au prochain changement
  // de session ou de langue.
  const language = useLanguage();
  const preference = getLanguagePreference();
  const accountLanguage = session?.user.user_metadata?.language;
  const languageToAdopt = userId && preference === null && isLanguage(accountLanguage) ? accountLanguage : null;
  // Pas de boucle : une fois `user_metadata.language` enregistre, la session
  // mise a jour (onAuthStateChange) porte la meme langue et `languageToSave`
  // redevient null. Un echec n'est pas reessaye en boucle non plus : l'effet ne
  // se rejoue qu'au prochain changement de compte ou de langue.
  const languageToSave =
    userId && (!isLanguage(accountLanguage) || (preference !== null && accountLanguage !== language)) ? language : null;
  useEffect(() => {
    if (languageToAdopt) applyLanguage(languageToAdopt);
  }, [languageToAdopt]);
  useEffect(() => {
    if (!languageToSave) return;
    saveAccountLanguage(getSupabase(), languageToSave).catch(() => {});
  }, [userId, languageToSave]);

  const value: AuthState = {
    configured: isSupabaseConfigured,
    loading,
    session,
    // Le profil n'est valable que pour la session en cours.
    profile: profile && profile.id === userId ? profile : null,
    isGuest: session?.user.is_anonymous ?? false,
    pendingEmail,
    profileError: profileError && Boolean(userId),
    refreshProfile: () => {
      // Réessayer efface l'erreur : l'écran repasse en chargement.
      setProfileError(false);
      setProfileVersion((v) => v + 1);
    },
    statsVersion,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
