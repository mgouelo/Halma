import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Colors,
  Fonts,
  playerColor,
  Radius,
  Shadow,
  Spacing,
  Stroke,
  TouchTarget,
  Typography,
} from '@/constants/theme';
import { activeMutators, MUTATOR_KEYS, MUTATOR_TEXTS, type MutatorKey, type Mutators } from '@/mutators/mutators';

import { DrawnCard } from './drawn-card';

const TRACK_WIDTH = 52;
const TRACK_HEIGHT = 30;
const KNOB = 22;
/** Bouton centré verticalement dans le rail (bordure comprise). */
const KNOB_TOP = (TRACK_HEIGHT - Stroke.regular * 2 - KNOB) / 2;
/** Couleur du rail d'un interrupteur activé. */
const ON_COLOR = playerColor(2).piece;

/**
 * Interrupteur dessiné : rail au trait noir, bouton rond à ombre franche. Activé,
 * le rail se remplit de pastel et le bouton passe à droite ; l'état est aussi
 * écrit à côté (« Activé » / « Désactivé ») : la couleur n'est jamais le seul indice.
 */
function DrawnSwitch({ value, dashed = false }: { value: boolean; dashed?: boolean }) {
  return (
    <View
      style={[styles.track, value && { backgroundColor: ON_COLOR }, dashed && styles.trackDashed]}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden>
      <View style={[styles.knobShadow, value ? styles.knobOn : styles.knobOff]} />
      <View style={[styles.knob, value ? styles.knobOn : styles.knobOff]} />
    </View>
  );
}

interface MutatorSettingsProps {
  value: Mutators;
  /** Absent : lecture seule (joueurs qui ne sont pas l'hôte). */
  onChange?: (key: MutatorKey, value: boolean) => void;
  /** Changement en cours d'envoi (en ligne) : les interrupteurs ne réagissent plus. */
  disabled?: boolean;
  /** Phrase sous le titre. */
  caption?: string;
}

/** Carte « Mutateurs » : un interrupteur et sa phrase d'explication par mutateur. */
export function MutatorSettings({ value, onChange, disabled = false, caption }: MutatorSettingsProps) {
  const readOnly = !onChange;
  return (
    <DrawnCard contentStyle={styles.card}>
      <View style={styles.titles}>
        <Text style={Typography.heading} accessibilityRole="header">
          Mutateurs
        </Text>
        {caption && <Text style={Typography.caption}>{caption}</Text>}
      </View>
      {MUTATOR_KEYS.map((key) => {
        const on = value[key];
        const { label, description } = MUTATOR_TEXTS[key];
        const state = on ? 'Activé' : 'Désactivé';
        const content = (
          <>
            <View style={styles.texts}>
              <Text style={styles.label}>{label}</Text>
              <Text style={Typography.caption}>{description}</Text>
            </View>
            <View style={styles.control}>
              <DrawnSwitch value={on} dashed={readOnly || disabled} />
              <Text style={styles.state}>{state}</Text>
            </View>
          </>
        );
        return readOnly ? (
          <View
            key={key}
            style={styles.row}
            accessible
            accessibilityLabel={`${label} : ${state.toLowerCase()}. ${description}`}>
            {content}
          </View>
        ) : (
          <Pressable
            key={key}
            style={styles.row}
            onPress={() => onChange(key, !on)}
            disabled={disabled}
            accessibilityRole="switch"
            accessibilityLabel={label}
            accessibilityHint={description}
            accessibilityState={{ checked: on, disabled }}>
            {content}
          </Pressable>
        );
      })}
    </DrawnCard>
  );
}

/** Petits badges des mutateurs actifs, pendant la partie. Rien si aucun n'est actif. */
export function MutatorBadges({ value }: { value: Mutators }) {
  const active = activeMutators(value);
  if (active.length === 0) return null;
  const labels = active.map((key) => MUTATOR_TEXTS[key].label);
  return (
    <View style={styles.badges} accessible accessibilityLabel={`Mutateurs actifs : ${labels.join(', ')}`}>
      {labels.map((label) => (
        <View key={label} style={styles.badge}>
          <Text style={styles.badgeText}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  titles: {
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: TouchTarget,
  },
  texts: {
    flex: 1,
    gap: Spacing.half,
  },
  label: {
    ...Typography.body,
    fontFamily: Fonts.semibold,
  },
  control: {
    alignItems: 'center',
    gap: Spacing.one,
    minWidth: 72,
  },
  state: {
    ...Typography.caption,
    color: Colors.ink,
  },
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: Radius.round,
    borderWidth: Stroke.regular,
    borderColor: Colors.ink,
    backgroundColor: Colors.paper,
  },
  trackDashed: {
    borderStyle: 'dashed',
  },
  knob: {
    position: 'absolute',
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    borderWidth: Stroke.regular,
    borderColor: Colors.ink,
    backgroundColor: Colors.paper,
    top: KNOB_TOP,
  },
  knobShadow: {
    position: 'absolute',
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: Colors.ink,
    top: KNOB_TOP + Shadow.offset / 2,
    transform: [{ translateX: Shadow.offset / 2 }],
  },
  knobOff: {
    left: 2,
  },
  knobOn: {
    left: TRACK_WIDTH - KNOB - Stroke.regular * 2 - 2,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  badge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderWidth: Stroke.thin,
    borderColor: Colors.ink,
    borderRadius: Radius.round,
    backgroundColor: Colors.paper,
  },
  badgeText: {
    ...Typography.caption,
    color: Colors.ink,
    fontFamily: Fonts.semibold,
  },
});
