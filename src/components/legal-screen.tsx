import { useT } from '@/i18n';
import type { LegalDocument } from '@/legal/document';

import { Bullet, DocScreen, DocSection, Paragraph } from './doc-screen';

/** Page légale (confidentialité, conditions d'utilisation). */
export function LegalScreen({ doc }: { doc: LegalDocument }) {
  const t = useT();
  return (
    <DocScreen title={doc.title} subtitle={t('legal.version', { version: doc.version })} description={doc.description}>
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
