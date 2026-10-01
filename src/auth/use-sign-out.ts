import { router } from 'expo-router';
import { useState } from 'react';

import { getSupabase } from '@/lib/supabase';

import { signOut } from './auth-service';
import { useAuthAction } from './use-auth-action';

/**
 * Déconnexion, la même partout (accueil, profil) : un compte invité ne peut pas
 * être retrouvé après déconnexion, on demande donc d'abord confirmation (avec
 * l'invitation à créer un compte) ; un compte e-mail se déconnecte aussitôt.
 * Après la déconnexion, retour à l'accueil. Une erreur (réseau…) donne un
 * message en français, le joueur reste connecté et peut réessayer.
 */
export function useSignOut(isGuest: boolean) {
  const [confirming, setConfirming] = useState(false);
  const { pending, error, run } = useAuthAction();

  const signOutNow = async () => {
    setConfirming(false);
    if (await run(() => signOut(getSupabase()))) router.dismissTo('/');
  };

  return {
    /** Appelée par le bouton : confirmation pour un invité, déconnexion directe sinon. */
    request: () => {
      if (pending) return;
      if (isGuest) setConfirming(true);
      else void signOutNow();
    },
    confirming,
    confirm: signOutNow,
    cancel: () => setConfirming(false),
    /** Le joueur préfère créer son compte pour garder sa progression. */
    createAccount: () => {
      setConfirming(false);
      router.push('/upgrade');
    },
    pending,
    error,
  };
}

export type SignOutController = ReturnType<typeof useSignOut>;
