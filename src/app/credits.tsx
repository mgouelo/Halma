import { Text, View, StyleSheet } from 'react-native';

import { AboutLinks } from '@/components/about-links';
import { Collapsible, DocScreen, DocSection, ExternalLink, Paragraph } from '@/components/doc-screen';
import { Spacing, Typography } from '@/constants/theme';
import { CREDITS, type CreditEntry } from '@/credits/credits';

function Entry({ entry, title }: { entry: CreditEntry; title?: string }) {
  return (
    <View style={styles.entry}>
      <Text style={Typography.heading}>
        {title ?? entry.name} <Text style={Typography.caption}>{entry.version}</Text>
      </Text>
      <Text style={Typography.body}>Licence {entry.license}</Text>
      {entry.copyright && <Text style={Typography.caption}>{entry.copyright}</Text>}
      {entry.repository && <ExternalLink url={entry.repository} label={entry.repository.replace(/^https:\/\//, '')} />}
      {entry.licenseTextFrom !== entry.name && (
        <Text style={Typography.caption}>Texte de la licence publié avec {entry.licenseTextFrom} (même dépôt).</Text>
      )}
      <Collapsible label={`la licence de ${title ?? entry.name}`}>{entry.licenseText}</Collapsible>
    </View>
  );
}

/** Crédits et licences : avatars Humation, police, bibliothèques open source. */
export default function CreditsScreen() {
  const { humation, font, libraries } = CREDITS;
  return (
    <DocScreen title="Crédits et licences" subtitle="Halma est fait avec des projets libres. Merci à leurs auteurs.">
      <DocSection title="Avatars : Humation">
        <Paragraph>
          Les avatars sont dessinés avec {humation.project}, de {humation.authors}, sous licence MIT : le moteur
          (@humation/core) et les illustrations (@humation/assets-humation-1), embarqués dans l’application.
        </Paragraph>
        <ExternalLink url={humation.repository} label="github.com/humation-labs/humation" />
        <Text style={Typography.caption}>
          La licence MIT demande de joindre l’avis de copyright et le texte de la licence à toute copie : les voici.
        </Text>
        {humation.packages.map((entry) => (
          <Entry key={entry.name} entry={entry} />
        ))}
      </DocSection>

      <DocSection title={`Police : ${font.name}`}>
        <Paragraph>
          Les textes utilisent la police {font.name}, sous licence SIL Open Font License 1.1, fournie par le paquet{' '}
          {font.package}.
        </Paragraph>
        <Entry entry={font} title={font.name} />
      </DocSection>

      <DocSection title="Bibliothèques open source">
        <Paragraph>Les principales bibliothèques utilisées par l’application, et leur licence.</Paragraph>
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
