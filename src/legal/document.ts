// Pages légales rédigées comme des données (sections, paragraphes, puces) :
// faciles à relire et à corriger sans toucher à l'affichage. Une version par
// langue ; le français fait foi (les autres sont des traductions à faire relire).

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
  /** Brouillon non relu : un bandeau le signale en haut de la page. */
  draft: boolean;
  sections: LegalSection[];
}

/** Un document dans chaque langue de l'application. */
export type LegalDocuments = Record<Language, LegalDocument>;

/** Marque d'un champ à compléter par l'éditeur de l'application, dans chaque langue. */
export const PLACEHOLDER_MARKERS: Record<Language, string> = {
  fr: 'À COMPLÉTER',
  en: 'TO BE COMPLETED',
  de: 'ZU ERGÄNZEN',
  es: 'POR COMPLETAR',
};

/** Marque d'un champ à compléter, quelle que soit la langue. */
export const PLACEHOLDER = /\[(?:À COMPLÉTER|TO BE COMPLETED|ZU ERGÄNZEN|POR COMPLETAR)[^\]]*\]/g;

/** Tout le texte d'un document (titres, paragraphes, puces), une ligne par élément. */
export function documentText(doc: LegalDocument): string {
  return doc.sections.flatMap((s) => [s.title, ...(s.paragraphs ?? []), ...(s.bullets ?? [])]).join('\n');
}

/** Champs encore à compléter dans un document (sans doublons, dans l'ordre). */
export function missingFields(doc: LegalDocument): string[] {
  return [...new Set(documentText(doc).match(PLACEHOLDER) ?? [])];
}
