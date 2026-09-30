#!/usr/bin/env node
// Génère src/credits/licenses.json (page /credits) à partir de node_modules :
// nom, version, licence, avis de copyright, dépôt et texte complet de la
// licence de chaque projet crédité. Le fichier est versionné ; à relancer après
// une mise à jour des dépendances :
//
//   npm run licenses          (réécrit le fichier)
//   npm run licenses -- --check   (échoue si le fichier n'est plus à jour)

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'src/credits/licenses.json');

/** Illustrations et moteur des avatars : embarqués dans l'application. */
const HUMATION = ['@humation/core', '@humation/assets-humation-1'];

/** Police de l'application : fichiers de police (licence OFL) fournis par le paquet. */
const FONT = { package: '@expo-google-fonts/fredoka', name: 'Fredoka', licenseFile: 'LICENSE_FONT', license: 'OFL-1.1' };

/** Principales bibliothèques open source de l'application. */
const LIBRARIES = [
  'expo',
  'expo-router',
  'expo-font',
  'expo-splash-screen',
  'react',
  'react-native',
  'react-native-web',
  '@supabase/supabase-js',
  '@react-native-async-storage/async-storage',
  'react-native-svg',
  'react-native-reanimated',
  'react-native-worklets',
  'react-native-gesture-handler',
  'react-native-safe-area-context',
  'react-native-screens',
  '@expo-google-fonts/fredoka',
];

function readPackage(name) {
  const dir = join(root, 'node_modules', name);
  if (!existsSync(join(dir, 'package.json'))) {
    throw new Error(`${name} n'est pas installé : lance npm install.`);
  }
  return { dir, json: JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) };
}

function licenseFileOf(dir) {
  return readdirSync(dir).find((file) => /^licen[cs]e(\.(md|txt))?$/i.test(file)) ?? null;
}

/** Texte de licence, sans titre Markdown ni espaces superflus. */
function cleanText(text) {
  return text
    .replace(/^﻿/, '')
    .replace(/\r\n/g, '\n')
    .replace(/^#\s*(.+)\n/, '$1\n')
    .trim();
}

function copyrightOf(text) {
  return (
    text
      .split('\n')
      .map((line) => line.trim())
      .find((line) => /^copyright\b/i.test(line) && !/notice|holder|statement/i.test(line)) ?? null
  );
}

function repositoryOf(json) {
  const raw = typeof json.repository === 'string' ? json.repository : json.repository?.url;
  if (!raw) return json.homepage ?? null;
  return raw
    .replace(/^git\+/, '')
    .replace(/^git:\/\//, 'https://')
    .replace(/\.git$/, '')
    .replace(/^github:/, 'https://github.com/');
}

function entry(name, { licenseFile, license } = {}) {
  const { dir, json } = readPackage(name);
  const file = licenseFile ?? licenseFileOf(dir);
  const text = file && existsSync(join(dir, file)) ? cleanText(readFileSync(join(dir, file), 'utf8')) : null;
  return {
    name,
    version: json.version,
    license: license ?? json.license,
    copyright: text ? copyrightOf(text) : null,
    repository: repositoryOf(json),
    licenseText: text,
    licenseTextFrom: text ? name : null,
  };
}

/**
 * Paquet publié sans fichier de licence (expo-router, par exemple) : on
 * reprend le texte d'un autre paquet du même dépôt et de même licence, en le
 * signalant (`licenseTextFrom`).
 */
function fillMissingTexts(entries) {
  for (const item of entries) {
    if (item.licenseText) continue;
    const sibling = entries.find(
      (other) => other.licenseText && other.repository === item.repository && other.license === item.license,
    );
    if (!sibling) throw new Error(`${item.name} : aucun texte de licence trouvé.`);
    item.licenseText = sibling.licenseText;
    item.copyright = sibling.copyright;
    item.licenseTextFrom = sibling.name;
  }
  return entries;
}

const humation = HUMATION.map((name) => entry(name));
const font = { ...entry(FONT.package, { licenseFile: FONT.licenseFile, license: FONT.license }), name: FONT.name, package: FONT.package };
const libraries = fillMissingTexts(LIBRARIES.map((name) => entry(name)));

const data = {
  // Pas de date : le fichier ne change que si les dépendances changent.
  humation: {
    project: 'Humation',
    authors: 'Humation contributors',
    repository: 'https://github.com/humation-labs/humation',
    packages: humation,
  },
  font,
  libraries,
};

const json = `${JSON.stringify(data, null, 2)}\n`;
if (process.argv.includes('--check')) {
  const current = existsSync(output) ? readFileSync(output, 'utf8') : '';
  if (current !== json) {
    console.error('src/credits/licenses.json n’est plus à jour : lance npm run licenses.');
    process.exit(1);
  }
  console.info('src/credits/licenses.json est à jour.');
} else {
  writeFileSync(output, json);
  console.info(`src/credits/licenses.json : ${humation.length + 1 + libraries.length} entrées.`);
}
