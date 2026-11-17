// Libellés de l'éditeur d'avatar (les noms Humation sont en anglais), traduits
// avec les clés `avatar.slot.*`, `avatar.color.*` et `avatar.part.*`.

import { hasMessage, type Translator } from '@/i18n';

import { partName, type AvatarColorSlot, type AvatarSlot } from './avatar';

/** Nom d'une catégorie de morceaux (« Coiffure », « Haut »…). */
export function slotLabel(t: Translator, slot: AvatarSlot): string {
  return t(`avatar.slot.${slot}`);
}

/** Nom d'une couleur réglable (« Peau », « Cheveux »… et « Fond »). */
export function colorLabel(t: Translator, slot: AvatarColorSlot | 'background'): string {
  return t(`avatar.color.${slot}`);
}

/** Libellé d'un morceau (le nom anglais d'Humation s'il manque une traduction). */
export function partLabel(t: Translator, slot: AvatarSlot, id: string): string {
  const name = partName(id);
  if (slot === 'glasses' && name === 'none') return t('avatar.part.noGlasses');
  const key = `avatar.part.${name}`;
  return hasMessage(key) ? t.msg({ key }) : name;
}
