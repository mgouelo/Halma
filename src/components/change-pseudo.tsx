import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { changePseudo, type Profile } from '@/auth/auth-service';
import { nextPseudoChange, PSEUDO_CHANGE_DELAY_DAYS, tooSoonMessage } from '@/auth/pseudo-change';
import { useAuthAction } from '@/auth/use-auth-action';
import {
  GUEST_PSEUDO_PREFIX,
  normalizePseudo,
  normalizePseudoInput,
  PSEUDO_HINT,
  PSEUDO_MAX_LENGTH,
  validatePseudo,
} from '@/auth/validation';
import { Colors, playerColor, Radius, Spacing, Stroke, Typography } from '@/constants/theme';
import { getSupabase } from '@/lib/supabase';

import { Notice } from './auth-screen';
import { DrawnButton } from './drawn-button';
import { DrawnTextInput } from './drawn-text-input';

interface ChangePseudoProps {
  profile: Pick<Profile, 'pseudo' | 'pseudo_changed_at'>;
  /** Relit le profil après un changement réussi (le nouveau pseudo apparaît partout). */
  onChanged: () => void;
}

export const SAME_PSEUDO_ERROR = 'C’est déjà ton pseudo.';

/**
 * « Changer mon pseudo », sur le profil : le bouton ouvre un champ dans la
 * carte. Mêmes règles qu'à l'inscription ; la base impose en plus 7 jours
 * entre deux changements (annoncés ici à l'avance quand on le sait).
 */
export function ChangePseudo({ profile, onChanged }: ChangePseudoProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<string | null>(null);
  const { pending, error, setError, run } = useAuthAction();

  const next = nextPseudoChange(profile);
  const isGuestPseudo = profile.pseudo.startsWith(GUEST_PSEUDO_PREFIX);

  const open = () => {
    setConfirmed(null);
    setError(null);
    setFieldError(null);
    setValue(isGuestPseudo ? '' : profile.pseudo);
    setEditing(true);
  };

  const submit = async () => {
    if (pending) return;
    const wanted = normalizePseudo(value);
    const invalid = validatePseudo(wanted);
    if (invalid) return setFieldError(invalid);
    if (wanted === profile.pseudo) return setFieldError(SAME_PSEUDO_ERROR);
    let saved = wanted;
    const ok = await run(async () => {
      saved = await changePseudo(getSupabase(), wanted);
    });
    if (!ok) return;
    setEditing(false);
    setConfirmed(saved);
    onChanged();
  };

  if (!editing) {
    return (
      <View style={styles.closed}>
        {confirmed && <Notice tone="info">C’est fait : ton pseudo est maintenant « {confirmed} ».</Notice>}
        <DrawnButton
          label="Changer mon pseudo"
          size="small"
          onPress={open}
          disabled={next !== null}
          accessibilityHint={next ? tooSoonMessage(next) : 'Ouvre un champ pour choisir un nouveau pseudo'}
        />
        {next && <Text style={[Typography.caption, styles.center]}>{tooSoonMessage(next)}</Text>}
      </View>
    );
  }

  return (
    <View style={styles.box}>
      <DrawnTextInput
        label="Nouveau pseudo"
        value={value}
        onChangeText={(text) => {
          setValue(normalizePseudoInput(text));
          setFieldError(null);
        }}
        error={fieldError}
        hint={PSEUDO_HINT}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username-new"
        textContentType="username"
        maxLength={PSEUDO_MAX_LENGTH}
        autoFocus
        onSubmitEditing={submit}
      />
      {!isGuestPseudo && (
        <Text style={Typography.caption}>
          Ensuite, tu devras attendre {PSEUDO_CHANGE_DELAY_DAYS} jours avant de le changer de nouveau.
        </Text>
      )}
      {error && <Notice>{error}</Notice>}
      <View style={styles.actions}>
        <DrawnButton
          label={pending ? 'Enregistrement…' : 'Enregistrer'}
          busy={pending}
          onPress={submit}
          color={playerColor(0).piece}
          size="small"
        />
        <DrawnButton label="Annuler" size="small" onPress={() => setEditing(false)} disabled={pending} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  closed: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: Spacing.two,
  },
  center: {
    textAlign: 'center',
  },
  box: {
    alignSelf: 'stretch',
    gap: Spacing.three,
    padding: Spacing.three,
    borderWidth: Stroke.regular,
    borderColor: Colors.ink,
    borderRadius: Radius.medium,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
