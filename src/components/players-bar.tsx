import { StyleSheet, View } from 'react-native';

import type { AvatarConfig } from '@/avatar/avatar';
import { Colors, Radius, Spacing, Stroke } from '@/constants/theme';
import { useT } from '@/i18n';

import { PlayerChip } from './player-chip';

export interface PlayersBarEntry {
  /** Numéro du joueur (sa couleur). */
  player: number;
  label?: string;
  /** « joue », « parti », « IA · Moyen »… (affiché seulement quand il y a de la place). */
  detail?: string;
  avatar?: { value: AvatarConfig | string | null; seed: string };
  /** Place dans le tour ; absent quand la partie est finie. */
  turn?: 'active' | 'waiting';
  /** Joueur parti : trait en pointillés. */
  gone?: boolean;
  accessibilityLabel: string;
}

/** Au-delà, seul le joueur dont c'est le tour garde son nom : la barre tient toujours sur une ligne. */
const MAX_NAMED = 3;
const AVATAR_SIZE = 30;

/**
 * Joueurs de la partie sur une seule ligne, de hauteur fixe : le plateau garde
 * la même taille quel que soit le nombre de joueurs et celui dont c'est le tour.
 * Le joueur courant est entouré en noir.
 */
export function PlayersBar({ entries }: { entries: readonly PlayersBarEntry[] }) {
  const t = useT();
  const crowded = entries.length > MAX_NAMED;
  return (
    <View style={styles.row} accessibilityRole="list" accessibilityLabel={t('game.players')}>
      {entries.map((entry) => {
        const current = entry.turn === 'active';
        const compact = crowded && !current;
        return (
          <View
            key={entry.player}
            accessibilityLabel={entry.accessibilityLabel}
            style={[styles.tag, current && styles.tagCurrent, entry.gone && styles.tagGone]}>
            <PlayerChip
              player={entry.player}
              size={AVATAR_SIZE}
              label={entry.label}
              detail={entry.detail}
              avatar={entry.avatar}
              turn={entry.turn}
              compact={compact}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  tag: {
    flexShrink: 1,
    minWidth: 0,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    // Même épaisseur pour tous : rien ne bouge quand le tour passe.
    borderWidth: Stroke.regular,
    borderColor: Colors.line,
    borderRadius: Radius.round,
  },
  tagCurrent: {
    borderColor: Colors.ink,
  },
  tagGone: {
    borderStyle: 'dashed',
    borderColor: Colors.inkSoft,
  },
});
