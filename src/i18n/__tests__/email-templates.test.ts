// Modèles d'e-mails (docs/emails/) : mêmes liens et variables dans chaque
// langue, et modèles multilingues à jour (scripts/email-templates.cjs).

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type Builder = {
  TEMPLATES: string[];
  OTHER_LANGUAGES: string[];
  OUT: string;
  readSource: (name: string, language: string) => { subject: string; body: string };
  buildTemplate: (name: string) => { subject: string; fallbackSubject: string; html: string };
  buildSubjects: () => string;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const builder = require('../../../scripts/email-templates.cjs') as Builder;

const LANGUAGES = ['fr', ...builder.OTHER_LANGUAGES];

/** Variables Go du modèle ({{ .Email }}, {{ .TokenHash }}…), avec leurs répétitions. */
const variables = (html: string) => (html.match(/\{\{[^}]*\}\}/g) ?? []).sort();
const links = (html: string) => (html.match(/href="[^"]*"/g) ?? []).sort();
const read = (file: string) => readFileSync(join(builder.OUT, file), 'utf8').replace(/\r\n/g, '\n');

describe('modèles d’e-mails', () => {
  it.each(builder.TEMPLATES)('%s : mêmes variables, liens et couleurs dans les quatre langues', (name) => {
    const fr = builder.readSource(name, 'fr');
    for (const language of LANGUAGES) {
      const source = builder.readSource(name, language);
      expect(variables(source.body)).toEqual(variables(fr.body));
      expect(links(source.body)).toEqual(links(fr.body));
      expect(source.body.match(/background:#[0-9A-F]{6}/g)).toEqual(fr.body.match(/background:#[0-9A-F]{6}/g));
      expect(source.body).toContain(`lang="${language}"`);
      expect(source.subject.length).toBeGreaterThan(5);
    }
  });

  it.each(builder.TEMPLATES)('%s : le modèle multilingue est à jour (node scripts/email-templates.cjs)', (name) => {
    expect(read(`${name}.html`)).toBe(builder.buildTemplate(name).html);
  });

  it('les sujets multilingues sont à jour', () => {
    expect(read('sujets.md')).toBe(builder.buildSubjects());
  });

  it.each(builder.TEMPLATES)('%s : le français est la valeur par défaut, chaque langue a sa branche', (name) => {
    const { html, subject } = builder.buildTemplate(name);
    for (const language of builder.OTHER_LANGUAGES) {
      expect(html).toContain(`eq $lang "${language}"`);
      expect(subject).toContain(`"${language}" }}`);
    }
    // Le français vient après « else » : un compte sans langue (ou ancienne version) reçoit le français.
    expect(html.indexOf('{{- else }}')).toBeLessThan(html.indexOf('lang="fr"'));
    // Autant d'ouvertures que de fermetures (if / end).
    expect((html.match(/\{\{-? if /g) ?? []).length).toBe((html.match(/\{\{-? end/g) ?? []).length);
  });
});
