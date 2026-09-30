// Libellés français de l'éditeur d'avatar (les noms Humation sont en anglais).

import { partName, type AvatarColorSlot, type AvatarSlot } from './avatar';

export const SLOT_LABELS: Record<AvatarSlot, string> = {
  head: 'Coiffure',
  body: 'Haut',
  bottom: 'Bas',
  item: 'Accessoire',
  glasses: 'Lunettes',
};

export const COLOR_LABELS: Record<AvatarColorSlot | 'background', string> = {
  skin: 'Peau',
  hair: 'Cheveux',
  clothes: 'Haut',
  bottom: 'Bas',
  background: 'Fond',
};

const PART_LABELS: Record<string, string> = {
  // Coiffures
  'fluffy-bob': 'Carré bouffant',
  'round-bob': 'Carré arrondi',
  short: 'Court',
  'curly-short': 'Court bouclé',
  'short-bangs': 'Court à frange',
  'side-swept-short': 'Court sur le côté',
  'messy-short': 'Court en bataille',
  'wavy-medium': 'Mi-long ondulé',
  'flipped-long': 'Long retroussé',
  lob: 'Carré long',
  'long-straight': 'Long raide',
  'side-swept-lob': 'Carré long sur le côté',
  'blunt-bob': 'Carré net',
  bun: 'Chignon',
  'low-side-bun': 'Chignon bas sur le côté',
  'low-twin-buns': 'Deux chignons bas',
  ponytail: 'Queue de cheval',
  'low-ponytail': 'Queue de cheval basse',
  'low-twin-tails': 'Couettes basses',
  braids: 'Tresses',
  'blunt-long': 'Long net',
  'side-swept-long': 'Long sur le côté',
  'wavy-long': 'Long ondulé',
  'curly-long': 'Long bouclé',
  // Hauts
  'cropped-shirt': 'Haut court',
  'tank-top': 'Débardeur',
  'drape-tee': 'Tee-shirt drapé',
  polo: 'Polo',
  tee: 'Tee-shirt',
  shirt: 'Chemise',
  jacket: 'Veste',
  hoodie: 'Sweat à capuche',
  // Bas
  'wide-pants': 'Pantalon large',
  'tapered-pants': 'Pantalon fuselé',
  culottes: 'Jupe-culotte',
  'long-skirt': 'Jupe longue',
  'mini-skirt': 'Minijupe',
  'midi-skirt': 'Jupe midi',
  'flared-skirt': 'Jupe évasée',
  'cropped-pants': 'Pantacourt',
  // Accessoires
  none: 'Aucun',
  'crab-headband': 'Serre-tête crabe',
  'tuna-sushi': 'Sushi au thon',
  'shrimp-sushi': 'Sushi à la crevette',
  sprout: 'Pousse',
  beer: 'Bière',
  antennae: 'Antennes',
  'bunny-ears': 'Oreilles de lapin',
  halo: 'Auréole',
  crown: 'Couronne',
  flower: 'Fleur',
  'ice-cream': 'Glace',
  duck: 'Canard',
  'santa-hat': 'Bonnet de Noël',
  camera: 'Appareil photo',
  'wind-chime': 'Carillon',
  'frog-alt': 'Grenouille',
  ramune: 'Ramune',
  takoyaki: 'Takoyaki',
  'chocolate-banana': 'Banane au chocolat',
  yoyo: 'Yoyo',
  'beach-ball': 'Ballon de plage',
  sunflower: 'Tournesol',
  eggplant: 'Aubergine',
  shark: 'Requin',
  'fox-mask': 'Masque de renard',
  banana: 'Banane',
  watermelon: 'Pastèque',
  pineapple: 'Ananas',
  'candied-apple': 'Pomme d’amour',
  sunglasses: 'Lunettes de soleil',
  goggles: 'Lunettes de plongée',
  'tabby-cat': 'Chat tigré',
  'cream-cat': 'Chat crème',
  'ginger-cat': 'Chat roux',
  'white-cat': 'Chat blanc',
  'black-cat': 'Chat noir',
  'tuxedo-cat': 'Chat smoking',
  'siamese-cat': 'Chat siamois',
  'gray-cat': 'Chat gris',
  'tabby-tuxedo-cat': 'Chat tigré smoking',
  'calico-cat': 'Chat calico',
  'brown-tabby-cat': 'Chat tigré brun',
  // Lunettes
  round: 'Rondes',
  tiny: 'Petites',
};

/** Libellé français d'un morceau (le nom anglais s'il manque une traduction). */
export function partLabel(slot: AvatarSlot, id: string): string {
  const name = partName(id);
  if (slot === 'glasses' && name === 'none') return 'Aucunes';
  return PART_LABELS[name] ?? name;
}
