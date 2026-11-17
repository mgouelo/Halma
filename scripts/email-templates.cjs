// Modèles d'e-mails multilingues pour Supabase Auth.
//
// Supabase n'accepte qu'un modèle par type d'e-mail. On en fabrique un qui
// contient les quatre langues et choisit la bonne avec les Go templates de
// Supabase, à partir de la langue gardée dans les métadonnées du compte
// (`user_metadata.language`, lue par `{{ .Data.language }}`) ; sans langue
// connue, le français. Sources : docs/emails/<modèle>.html (français) et
// docs/emails/<modèle>.<langue>.html ; résultat : docs/emails/multilingue/.
//
// Usage : node scripts/email-templates.cjs   (régénère docs/emails/multilingue/)
// Le test src/i18n/__tests__/email-templates.test.ts vérifie que le résultat est à jour.

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const EMAILS = path.join(ROOT, 'docs', 'emails');
const OUT = path.join(EMAILS, 'multilingue');

/** Modèles Supabase, dans l'ordre du tableau de bord. */
const TEMPLATES = ['confirmation', 'changement-email', 'reinitialisation'];
/** Langues autres que le français (le français est la valeur par défaut). */
const OTHER_LANGUAGES = ['en', 'de', 'es'];
/** Noms des modèles dans le tableau de bord de Supabase. */
const DASHBOARD_NAMES = {
  confirmation: 'Confirm signup',
  'changement-email': 'Change Email Address',
  reinitialisation: 'Reset Password',
};

/**
 * Langue du compte, toujours une chaîne : `printf "%v"` évite une erreur de
 * comparaison quand la métadonnée manque (compte créé avant la traduction).
 */
const LANG = '{{- $lang := printf "%v" .Data.language -}}';

function sourcePath(name, language) {
  return path.join(EMAILS, language === 'fr' ? `${name}.html` : `${name}.${language}.html`);
}

/** Corps HTML et sujet d'un modèle source (le sujet est noté dans le commentaire de tête). */
function readSource(name, language) {
  const text = fs.readFileSync(sourcePath(name, language), 'utf8').replace(/\r\n/g, '\n');
  const comment = /^<!--([\s\S]*?)-->\n?/.exec(text);
  if (!comment) throw new Error(`${name} (${language}) : commentaire de tête manquant`);
  const subject = /Sujet : « (.+?) »/.exec(comment[1]);
  if (!subject) throw new Error(`${name} (${language}) : sujet manquant dans le commentaire de tête`);
  return { subject: subject[1], body: text.slice(comment[0].length).trim() };
}

/** `{{ if eq $lang "en" }}…{{ else if … }}…{{ else }}français{{ end }}` */
function choose(values) {
  const branches = OTHER_LANGUAGES.map(
    (language, index) => `{{- ${index === 0 ? 'if' : 'else if'} eq $lang "${language}" }}\n${values[language]}\n`,
  ).join('');
  return `${branches}{{- else }}\n${values.fr}\n{{- end }}`;
}

/** Sujet multilingue, sur une ligne (à coller dans le champ « Subject »). */
function subjectTemplate(subjects) {
  const branches = OTHER_LANGUAGES.map(
    (language, index) =>
      `{{ ${index === 0 ? 'if' : 'else if'} eq (printf "%v" .Data.language) "${language}" }}${subjects[language]}`,
  ).join('');
  return `${branches}{{ else }}${subjects.fr}{{ end }}`;
}

/** Modèle multilingue complet d'un type d'e-mail : sujet, sujet de secours, HTML. */
function buildTemplate(name) {
  const languages = ['fr', ...OTHER_LANGUAGES];
  const sources = Object.fromEntries(languages.map((language) => [language, readSource(name, language)]));
  const subjects = Object.fromEntries(languages.map((language) => [language, sources[language].subject]));
  const bodies = Object.fromEntries(languages.map((language) => [language, sources[language].body]));
  // Pas de variable de modèle dans ce commentaire : Supabase l'interpréterait aussi.
  const html = [
    `<!-- FICHIER GÉNÉRÉ par scripts/email-templates.cjs à partir de docs/emails/${name}*.html : ne pas le modifier à la main.`,
    '     Sujet : voir docs/emails/multilingue/sujets.md -->',
    LANG,
    choose(bodies),
    '',
  ].join('\n');
  return { subject: subjectTemplate(subjects), fallbackSubject: `${subjects.fr} · ${subjects.en}`, html };
}

/** Contenu de docs/emails/multilingue/sujets.md : le sujet de chaque modèle, à coller tel quel. */
function buildSubjects() {
  const lines = [
    '<!-- FICHIER GÉNÉRÉ par scripts/email-templates.cjs : ne pas le modifier à la main. -->',
    '',
    '# Sujets des e-mails multilingues',
    '',
    'À coller dans le champ *Subject* de chaque modèle (*Authentication → Email Templates*). Si l’e-mail reçu',
    'affiche ce code au lieu du texte, utiliser le sujet de secours, en deux langues. Voir docs/emails/README.md.',
    '',
  ];
  for (const name of TEMPLATES) {
    const { subject, fallbackSubject } = buildTemplate(name);
    lines.push(`## ${DASHBOARD_NAMES[name]} (${name}.html)`, '', '```', subject, '```', '', `Secours : ${fallbackSubject}`, '');
  }
  return lines.join('\n');
}

/** Écrit docs/emails/multilingue/<modèle>.html pour chaque modèle, et sujets.md. */
function writeAll() {
  fs.mkdirSync(OUT, { recursive: true });
  for (const name of TEMPLATES) {
    fs.writeFileSync(path.join(OUT, `${name}.html`), buildTemplate(name).html);
  }
  fs.writeFileSync(path.join(OUT, 'sujets.md'), buildSubjects());
}

module.exports = { buildSubjects, buildTemplate, readSource, sourcePath, OTHER_LANGUAGES, OUT, TEMPLATES };

if (require.main === module) {
  writeAll();
  console.log(`Modèles multilingues écrits dans ${path.relative(ROOT, OUT)}/`);
}
