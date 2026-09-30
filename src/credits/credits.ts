// Données de la page /credits, générées par scripts/generate-licenses.mjs
// (npm run licenses) à partir des fichiers de licence de node_modules.

import data from './licenses.json';

export interface CreditEntry {
  name: string;
  version: string;
  license: string;
  /** Avis de copyright tel qu'écrit dans le fichier de licence. */
  copyright: string | null;
  repository: string | null;
  /** Texte complet de la licence. */
  licenseText: string;
  /** Paquet dont vient le texte (un autre du même dépôt si celui-ci n'en publie pas). */
  licenseTextFrom: string;
}

export interface Credits {
  humation: { project: string; authors: string; repository: string; packages: CreditEntry[] };
  font: CreditEntry & { package: string };
  libraries: CreditEntry[];
}

export const CREDITS = data as Credits;
