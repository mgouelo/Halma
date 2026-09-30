// Avatars Humation (licence MIT) : configuration, lecture de ce qui est
// enregistré dans `profiles.avatar`, et rendu en SVG autonome pour
// react-native-svg.
//
// @humation/core compose le SVG à partir des morceaux (coiffure, haut, bas,
// accessoire, lunettes) du jeu d'illustrations @humation/assets-humation-1,
// embarqué dans l'application (aucun accès réseau). Ses couleurs sont des
// variables CSS (`fill="var(--hm-hair, #000000)"`), que react-native-svg ne
// comprend pas : on les remplace ici par les couleurs choisies.

import { humation1 } from '@humation/assets-humation-1';
import { createAvatar, type PartOption } from '@humation/core';

export const AVATAR_TEMPLATE = humation1.template.id;

/** Emplacements de morceaux, dans l'ordre de l'éditeur. */
export const AVATAR_SLOTS = ['head', 'body', 'bottom', 'item', 'glasses'] as const;
export type AvatarSlot = (typeof AVATAR_SLOTS)[number];

/**
 * Emplacements proposés dans l'éditeur. Le bas (pantalons, jupes) commence
 * sous le cadrage « avatar » d'Humation (buste) : il ne se voit pas, on ne le
 * propose donc pas.
 */
export const EDITABLE_SLOTS = ['head', 'body', 'item', 'glasses'] as const satisfies readonly AvatarSlot[];

/** Couleurs modifiables (le trait reste noir) et fond. */
export const AVATAR_COLOR_SLOTS = ['skin', 'hair', 'clothes', 'bottom'] as const;
/** Couleurs proposées dans l'éditeur (le bas ne se voit pas, voir `EDITABLE_SLOTS`). */
export const EDITABLE_COLOR_SLOTS = ['skin', 'hair', 'clothes'] as const satisfies readonly AvatarColorSlot[];
export type AvatarColorSlot = (typeof AVATAR_COLOR_SLOTS)[number];

/** Configuration d'un avatar : morceaux (identifiants canoniques) et couleurs (hexadécimal sans « # »). */
export interface AvatarConfig {
  selections: Record<AvatarSlot, string>;
  colors: Record<AvatarColorSlot, string>;
  background: string;
}

/** Version du format enregistré dans `profiles.avatar`. */
const FORMAT_VERSION = 1;
/** Longueur maximale acceptée par la base (voir la migration). */
export const MAX_AVATAR_LENGTH = 1000;

const HEX = /^[0-9A-F]{6}$/;

const PARTS_BY_SLOT: Record<AvatarSlot, PartOption[]> = Object.fromEntries(
  AVATAR_SLOTS.map((slot) => [slot, humation1.parts.filter((p) => p.selectionSlot === slot && !p.deprecated)]),
) as Record<AvatarSlot, PartOption[]>;

const DEFAULT_COLORS = humation1.defaults.colors;

/** Morceaux proposés pour un emplacement, dans l'ordre du jeu d'illustrations. */
export function partsForSlot(slot: AvatarSlot): readonly PartOption[] {
  return PARTS_BY_SLOT[slot];
}

function isPartOf(slot: AvatarSlot, id: unknown): id is string {
  return typeof id === 'string' && PARTS_BY_SLOT[slot].some((p) => p.id === id);
}

function readHex(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const color = value.replace(/^#/, '').toUpperCase();
  return HEX.test(color) ? color : null;
}

/** Avatar tiré d'une graine : toujours le même pour la même graine. */
export function seededAvatar(seed: string): AvatarConfig {
  const picked = createAvatar(humation1, { seed }).toJSON().selections;
  const selections = {} as Record<AvatarSlot, string>;
  for (const slot of AVATAR_SLOTS) selections[slot] = picked[slot] ?? humation1.defaults.selections[slot];
  const colors = {} as Record<AvatarColorSlot, string>;
  for (const slot of AVATAR_COLOR_SLOTS) colors[slot] = DEFAULT_COLORS[slot];
  return { selections, colors, background: humation1.defaults.background as string };
}

/** Avatar au hasard : un morceau par emplacement et des couleurs parmi celles proposées. */
export function randomAvatar(
  palettes: Record<AvatarColorSlot | 'background', readonly string[]>,
  random: () => number = Math.random,
): AvatarConfig {
  const pick = <T,>(items: readonly T[]) => items[Math.floor(random() * items.length)];
  const selections = {} as Record<AvatarSlot, string>;
  for (const slot of AVATAR_SLOTS) selections[slot] = pick(PARTS_BY_SLOT[slot]).id;
  const colors = {} as Record<AvatarColorSlot, string>;
  for (const slot of AVATAR_COLOR_SLOTS) colors[slot] = pick(palettes[slot]);
  return { selections, colors, background: pick(palettes.background) };
}

/**
 * Avatar enregistré dans `profiles.avatar` : configuration JSON (format
 * `{ v: 1, selections, colors, background }`) ou simple graine. Tout ce qui
 * est inconnu ou mal formé est ignoré (la valeur vient d'un autre joueur) :
 * on garde alors l'avatar tiré de `fallbackSeed` pour cet emplacement.
 */
export function parseAvatar(value: string | null | undefined, fallbackSeed: string): AvatarConfig {
  const text = value?.trim();
  if (!text) return seededAvatar(fallbackSeed);
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    // Pas du JSON : c'est une graine.
    return seededAvatar(text.slice(0, 100));
  }
  const base = seededAvatar(fallbackSeed);
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return base;
  const record = data as { selections?: unknown; colors?: unknown; background?: unknown };
  const selections = { ...base.selections };
  if (typeof record.selections === 'object' && record.selections !== null) {
    const given = record.selections as Record<string, unknown>;
    for (const slot of AVATAR_SLOTS) if (isPartOf(slot, given[slot])) selections[slot] = given[slot] as string;
  }
  const colors = { ...base.colors };
  if (typeof record.colors === 'object' && record.colors !== null) {
    const given = record.colors as Record<string, unknown>;
    for (const slot of AVATAR_COLOR_SLOTS) colors[slot] = readHex(given[slot]) ?? colors[slot];
  }
  return { selections, colors, background: readHex(record.background) ?? base.background };
}

/** Valeur à enregistrer dans `profiles.avatar`. */
export function serializeAvatar(config: AvatarConfig): string {
  return JSON.stringify({ v: FORMAT_VERSION, ...config });
}

/** Nom (anglais, unique dans son emplacement) d'un morceau. */
export function partName(id: string): string {
  return humation1.parts.find((p) => p.id === id)?.name ?? id;
}

// --- Rendu -------------------------------------------------------------------

const VAR = /var\(\s*--hm-([a-z]+)\s*,\s*(#[0-9A-Fa-f]{3,8})\s*\)/g;

/**
 * Remplace les variables CSS de couleur par leur valeur, et retire ce que
 * react-native-svg n'utilise pas (attributs `data-hm-*`, identifiants de
 * calques, styles).
 */
function materialize(svg: string, colors: Record<string, string>): string {
  return svg
    .replace(VAR, (_, slot: string, fallback: string) => (colors[slot] ? `#${colors[slot]}` : fallback))
    .replace(/\sdata-hm-[a-z-]+="[^"]*"/g, '')
    .replace(/\sstyle="[^"]*"/g, '')
    .replace(/\sid="_[^"]*"/g, '');
}

/**
 * Ne garde que les morceaux des emplacements donnés. Le contenu rendu par
 * @humation/core est une suite de groupes `<g data-hm-layer-slot=… data-hm-selection-slot=…>`,
 * un par calque de morceau : on le découpe au début de chaque groupe.
 */
function keepSlots(content: string, slots: readonly AvatarSlot[]): string {
  return content
    .split(/(?=<g data-hm-layer-slot=)/)
    .filter((fragment) => {
      const slot = /data-hm-selection-slot="([^"]+)"/.exec(fragment)?.[1];
      return slot !== undefined && (slots as readonly string[]).includes(slot);
    })
    .join('');
}

const cache = new Map<string, string>();
const CACHE_SIZE = 200;

function cached(key: string, render: () => string): string {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const svg = render();
  if (cache.size >= CACHE_SIZE) cache.delete(cache.keys().next().value!);
  cache.set(key, svg);
  return svg;
}

const fmt = (n: number) => String(Number(n.toFixed(4)));

/**
 * SVG complet de l'avatar, avec ses couleurs. `background` remplace le fond
 * choisi (par exemple la couleur du joueur sur le plateau), `'transparent'` l'enlève.
 */
export function renderAvatarSvg(config: AvatarConfig, background?: string, only?: readonly AvatarSlot[]): string {
  const fill = background ?? config.background;
  return cached(`${JSON.stringify(config)}|${fill}|${only?.join(',') ?? ''}`, () => {
    const data = createAvatar(humation1, { selections: config.selections }).toRenderData();
    if (only) data.content = keepSlots(data.content, only);
    const { x, y, width, height } = data.viewBox;
    const box = `${fmt(x)} ${fmt(y)} ${fmt(width)} ${fmt(height)}`;
    const color = readHex(fill);
    const rect = color
      ? `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(width)}" height="${fmt(height)}" fill="#${color}"/>`
      : '';
    const content = materialize(data.content, { ...DEFAULT_COLORS, ...config.colors });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}">${rect}${content}</svg>`;
  });
}

/**
 * Vignette de l'éditeur : l'avatar avec ce morceau à la place du sien, sans
 * fond. Pour une coiffure, un accessoire ou des lunettes, la tête suffit : sans
 * le buste, le SVG est environ deux fois plus léger à lire (les vignettes d'un
 * onglet sont toutes lues d'un coup).
 */
export function renderOptionSvg(config: AvatarConfig, slot: AvatarSlot, partId: string): string {
  const avatar = { ...config, selections: { ...config.selections, [slot]: partId } };
  return renderAvatarSvg(avatar, 'transparent', slot === 'body' ? undefined : HEAD_SLOTS);
}

const HEAD_SLOTS: readonly AvatarSlot[] = ['head', 'item', 'glasses'];

const ANTENNAE = PARTS_BY_SLOT.item.find((p) => p.name === 'antennae')?.id;

/** Avatar d'une IA : tiré de `key` (identifiant du participant), toujours avec des antennes. */
export function aiAvatar(key: string): AvatarConfig {
  const base = seededAvatar(`halma-ia-${key}`);
  return ANTENNAE ? { ...base, selections: { ...base.selections, item: ANTENNAE } } : base;
}
