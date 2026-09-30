import { StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts, Radius, Spacing, Stroke, Typography } from '@/constants/theme';
import type { LegalDocument } from '@/legal/document';

import { Bullet, DocScreen, DocSection, Paragraph } from './doc-screen';

/** Page légale (confidentialité, conditions), avec un bandeau tant que c'est un brouillon. */
export function LegalScreen({ doc }: { doc: LegalDocument }) {
  return (
    <DocScreen title={doc.title} subtitle={`Version : ${doc.version}`}>
      {doc.draft && (
        <View style={styles.draft} accessibilityRole="alert">
          <Text style={styles.draftTitle}>Brouillon à faire relire</Text>
          <Text style={Typography.body}>
            Ce texte n’a pas encore été relu. Les passages entre crochets [À COMPLÉTER] restent à remplir par
            l’éditeur de l’application.
          </Text>
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
