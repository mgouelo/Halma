// Pages légales rédigées comme des données (sections, paragraphes, puces) :
// faciles à relire et à corriger sans toucher à l'affichage.

export interface LegalSection {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface LegalDocument {
  title: string;
  /** Date de la version affichée (à mettre à jour à chaque changement). */
  version: string;
  /** Brouillon non relu : un bandeau le signale en haut de la page. */
  draft: boolean;
  sections: LegalSection[];
}

/** Marque d'un champ à compléter par l'éditeur de l'application. */
export const PLACEHOLDER = /\[À COMPLÉTER[^\]]*\]/g;

/** Champs encore à compléter dans un document (sans doublons, dans l'ordre). */
export function missingFields(doc: LegalDocument): string[] {
  const text = doc.sections.flatMap((s) => [s.title, ...(s.paragraphs ?? []), ...(s.bullets ?? [])]).join('\n');
  return [...new Set(text.match(PLACEHOLDER) ?? [])];
}
