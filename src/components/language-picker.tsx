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
import { chooseLanguage, LANGUAGE_NAMES, LANGUAGES, useLanguage, useT, type Language } from '@/i18n';

import { DrawnCard } from './drawn-card';

/**
 * Choix de la langue : quatre pastilles au trait, chaque langue écrite dans sa
 * propre langue (« Français », « English », « Deutsch », « Español »), la
 * langue active relevée par une ombre franche, un trait épais et du pastel.
 * Le changement s'applique tout de suite, partout, et reste enregistré sur
 * l'appareil (et sur le compte, pour les e-mails : voir AuthProvider).
 * Deux colonnes : tient sur un téléphone étroit (360 points) sans couper un nom.
 */
export function LanguagePicker() {
  const t = useT();
  const current = useLanguage();
  return (
    <DrawnCard contentStyle={styles.card}>
      <View style={styles.titles}>
        <Text style={Typography.heading} accessibilityRole="header">
          {t('language.title')}
        </Text>
        <Text style={Typography.caption}>{t('language.caption')}</Text>
      </View>
      <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel={t('language.pickerLabel')}>
        {LANGUAGES.map((language) => (
          <LanguageOption
            key={language}
            language={language}
            selected={language === current}
            onPress={() => void chooseLanguage(language)}
          />
        ))}
      </View>
    </DrawnCard>
  );
}

function LanguageOption({ language, selected, onPress }: { language: Language; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={LANGUAGE_NAMES[language]}
      // Lu dans sa propre langue par les lecteurs d'écran (web : attribut lang).
      {...{ lang: language }}
      style={styles.optionWrapper}>
      {({ pressed }) => (
        <>
          {selected && <View style={styles.shadow} />}
          <View style={[styles.option, selected && styles.optionSelected, pressed && !selected && styles.pressed]}>
            <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
              {LANGUAGE_NAMES[language]}
            </Text>
          </View>
        </>
      )}
    </Pressable>
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: Spacing.two,
    columnGap: Spacing.two,
  },
  // Deux par ligne, de même largeur ; la place de l'ombre est réservée pour que rien ne bouge.
  optionWrapper: {
    flexGrow: 1,
    flexBasis: '45%',
    paddingRight: Shadow.offset,
    paddingBottom: Shadow.offset,
  },
  shadow: {
    ...StyleSheet.absoluteFill,
    top: Shadow.offset,
    left: Shadow.offset,
    borderRadius: Radius.round,
    backgroundColor: Colors.ink,
  },
  option: {
    minHeight: TouchTarget,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.round,
    borderWidth: Stroke.thin,
    borderColor: Colors.ink,
    backgroundColor: Colors.paper,
  },
  optionSelected: {
    borderWidth: Stroke.bold,
    backgroundColor: playerColor(2).piece,
  },
  pressed: {
    backgroundColor: playerColor(2).tint,
  },
  label: {
    ...Typography.body,
    color: Colors.ink,
  },
  labelSelected: {
    fontFamily: Fonts.bold,
  },
});
