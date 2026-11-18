import { Text, View, StyleSheet } from 'react-native';

import { AboutLinks } from '@/components/about-links';
import { Collapsible, DocScreen, DocSection, ExternalLink, Paragraph } from '@/components/doc-screen';
import { Spacing, Typography } from '@/constants/theme';
import { CREDITS, type CreditEntry } from '@/credits/credits';
import { useT } from '@/i18n';

function Entry({ entry, title }: { entry: CreditEntry; title?: string }) {
  const t = useT();
  return (
    <View style={styles.entry}>
      <Text style={Typography.heading}>
        {title ?? entry.name} <Text style={Typography.caption}>{entry.version}</Text>
      </Text>
      <Text style={Typography.body}>{t('credits.license', { name: entry.license })}</Text>
      {entry.copyright && <Text style={Typography.caption}>{entry.copyright}</Text>}
      {entry.repository && <ExternalLink url={entry.repository} label={entry.repository.replace(/^https:\/\//, '')} />}
      {entry.licenseTextFrom !== entry.name && (
        <Text style={Typography.caption}>{t('credits.licenseFrom', { name: entry.licenseTextFrom })}</Text>
      )}
      <Collapsible label={t('credits.licenseOf', { name: title ?? entry.name })}>{entry.licenseText}</Collapsible>
    </View>
  );
}

/** Crédits et licences : avatars Humation, police, bibliothèques open source. */
export default function CreditsScreen() {
  const t = useT();
  const { humation, font, libraries } = CREDITS;
  return (
    <DocScreen title={t('credits.title')} subtitle={t('credits.subtitle')} description={t('credits.description')}>
      <DocSection title={t('credits.avatarsTitle')}>
        <Paragraph>{t('credits.avatarsText', { project: humation.project, authors: humation.authors })}</Paragraph>
        <ExternalLink url={humation.repository} label="github.com/humation-labs/humation" />
        <Text style={Typography.caption}>{t('credits.mitNotice')}</Text>
        {humation.packages.map((entry) => (
          <Entry key={entry.name} entry={entry} />
        ))}
      </DocSection>

      <DocSection title={t('credits.fontTitle', { name: font.name })}>
        <Paragraph>{t('credits.fontText', { name: font.name, package: font.package })}</Paragraph>
        <Entry entry={font} title={font.name} />
      </DocSection>

      <DocSection title={t('credits.librariesTitle')}>
        <Paragraph>{t('credits.librariesText')}</Paragraph>
        {libraries.map((entry) => (
          <Entry key={entry.name} entry={entry} />
        ))}
      </DocSection>
      <AboutLinks exclude="/credits" />
    </DocScreen>
  );
}

const styles = StyleSheet.create({
  entry: {
    gap: Spacing.one,
    paddingTop: Spacing.two,
  },
});
