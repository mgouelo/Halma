// Pages légales rédigées comme des données (sections, paragraphes, puces) :
// faciles à relire et à corriger sans toucher à l'affichage. Une version par
// langue ; le français fait foi (les autres en sont des traductions).

import type { Language } from '@/i18n';

export interface LegalSection {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface LegalDocument {
  title: string;
  /** Description de la page web (moteurs de recherche, aperçus de liens) : un résumé, pas du texte juridique. */
  description: string;
  /** Date de la version affichée (à mettre à jour à chaque changement). */
  version: string;
  sections: LegalSection[];
}

/** Un document dans chaque langue de l'application. */
export type LegalDocuments = Record<Language, LegalDocument>;

/** Tout le texte d'un document (titres, paragraphes, puces), une ligne par élément. */
export function documentText(doc: LegalDocument): string {
  return doc.sections.flatMap((s) => [s.title, ...(s.paragraphs ?? []), ...(s.bullets ?? [])]).join('\n');
}
