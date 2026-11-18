import { StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts, Radius, Spacing, Stroke, Typography } from '@/constants/theme';
import { useT } from '@/i18n';
import type { LegalDocument } from '@/legal/document';

import { Bullet, DocScreen, DocSection, Paragraph } from './doc-screen';

/** Page légale (confidentialité, conditions), avec un bandeau tant que c'est un brouillon. */
export function LegalScreen({ doc }: { doc: LegalDocument }) {
  const t = useT();
  return (
    <DocScreen title={doc.title} subtitle={t('legal.version', { version: doc.version })} description={doc.description}>
      {doc.draft && (
        <View style={styles.draft} accessibilityRole="alert">
          <Text style={styles.draftTitle}>{t('legal.draftTitle')}</Text>
          <Text style={Typography.body}>{t('legal.draftText')}</Text>
        </View>
      )}
      {doc.sections.map((section) => (
        <DocSection key={section.title} title={section.title}>
          {section.paragraphs?.map((p) => (
            <Paragraph key={p}>{p}</Paragraph>
          ))}
          {section.bullets?.map((b) => (
            <Bullet key={b}>{b}</Bullet>
          ))}
        </DocSection>
      ))}
    </DocScreen>
  );
}

const styles = StyleSheet.create({
  draft: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderWidth: Stroke.bold,
    borderColor: Colors.ink,
    borderStyle: 'dashed',
    borderRadius: Radius.medium,
  },
  draftTitle: {
    ...Typography.heading,
    fontFamily: Fonts.bold,
  },
});
