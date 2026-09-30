import { router, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useState } from 'react';

import { setWebBackGuard } from '@/navigation/web-back-guard';

import type { GuardKind } from './leave-guard';

type NavigationAction = Parameters<Parameters<typeof usePreventRemove>[1]>[0]['data']['action'];

/**
 * Demande en attente : recommencer, ou quitter l'écran. Pour quitter, l'action
 * de navigation bloquée, ou null pour le retour du navigateur (web).
 */
type Pending = { kind: 'leave'; action: NavigationAction | null } | { kind: 'restart' } | null;

/**
 * Tant que `active` est vrai, quitter l'écran (bouton « Accueil », geste de
 * retour, bouton retour d'Android, retour du navigateur) ou recommencer passe
 * par une confirmation. Renvoie la demande en attente et de quoi y répondre.
 */
export function useLeaveGuard(active: boolean, restart: () => void) {
  const navigation = useNavigation();
  const [pending, setPending] = useState<Pending>(null);
  // Départ confirmé : plus rien ne bloque, l'action est rejouée juste après.
  const [leaving, setLeaving] = useState<{ action: NavigationAction | null } | null>(null);
  const guarded = active && !leaving;

  // Boutons, gestes et bouton retour d'Android : React Navigation prévient avant de retirer l'écran.
  usePreventRemove(guarded, ({ data }) => setPending({ kind: 'leave', action: data.action }));

  // Retour du navigateur (web) : voir setWebBackGuard.
  useEffect(() => {
    if (!guarded) return;
    return setWebBackGuard(() => setPending({ kind: 'leave', action: null }));
  }, [guarded]);

  useEffect(() => {
    if (!leaving) return;
    if (leaving.action) navigation.dispatch(leaving.action);
    else router.back();
  }, [leaving, navigation]);

  return {
    /** Demande affichée, ou null. */
    kind: (pending?.kind ?? null) as GuardKind | null,
    /** « Nouvelle partie » : demande confirmation seulement si une partie est en cours. */
    requestRestart: () => (active ? setPending({ kind: 'restart' }) : restart()),
    cancel: () => setPending(null),
    confirm: () => {
      setPending(null);
      if (pending?.kind === 'restart') restart();
      else if (pending?.kind === 'leave') setLeaving({ action: pending.action });
    },
  };
}
