import { describe, expect, it } from '@jest/globals';
import { parse } from 'react-native-svg';

import { seededRandom } from '@/game/__test-utils__/helpers';
import { AvatarPalettes } from '@/constants/theme';

import {
  aiAvatar,
  AVATAR_COLOR_SLOTS,
  AVATAR_SLOTS,
  MAX_AVATAR_LENGTH,
  parseAvatar,
  partsForSlot,
  randomAvatar,
  renderAvatarSvg,
  renderOptionSvg,
  seededAvatar,
  serializeAvatar,
  type AvatarConfig,
} from '../avatar';
import { partLabel } from '../labels';

/** Balises et attributs du SVG, pour vérifier ce que reçoit react-native-svg. */
type Node = { tag: string; props: Record<string, unknown>; children: (Node | string)[] | null };
function walk(node: Node | string | null, visit: (n: Node) => void) {
  if (!node || typeof node === 'string') return;
  visit(node);
  node.children?.forEach((child) => walk(child, visit));
}

describe('seededAvatar', () => {
  it('donne toujours le même avatar pour la même graine', () => {
    expect(seededAvatar('u1')).toEqual(seededAvatar('u1'));
    expect(seededAvatar('u1')).not.toEqual(seededAvatar('u2'));
  });

  it('choisit un morceau existant pour chaque emplacement', () => {
    const avatar = seededAvatar('abc');
    for (const slot of AVATAR_SLOTS) {
      expect(partsForSlot(slot).map((p) => p.id)).toContain(avatar.selections[slot]);
    }
  });
});

describe('parseAvatar', () => {
  const custom: AvatarConfig = {
    selections: { head: 'hm1-p-000020', body: 'hm1-p-000032', bottom: 'hm1-p-000036', item: 'hm1-p-000041', glasses: 'hm1-p-000057' },
    colors: { skin: 'F3C9A6', hair: '4A3728', clothes: 'A9CBEF', bottom: '3B4A6B' },
    background: 'FDECF1',
  };

  it('relit ce qui a été enregistré', () => {
    const text = serializeAvatar(custom);
    expect(text.length).toBeLessThanOrEqual(MAX_AVATAR_LENGTH);
    expect(parseAvatar(text, 'u1')).toEqual(custom);
  });

  it('sans avatar, utilise la graine de secours (l’identifiant du joueur)', () => {
    expect(parseAvatar(null, 'u1')).toEqual(seededAvatar('u1'));
    expect(parseAvatar('   ', 'u1')).toEqual(seededAvatar('u1'));
  });

  it('accepte une simple graine', () => {
    expect(parseAvatar('felix', 'u1')).toEqual(seededAvatar('felix'));
  });

  it('ignore les morceaux inconnus ou d’un autre emplacement, et les couleurs invalides', () => {
    const base = seededAvatar('u1');
    const parsed = parseAvatar(
      JSON.stringify({
        v: 1,
        selections: { head: 'hm1-p-000032', body: 'n’importe quoi', item: 'hm1-p-000050', extra: 'x' },
        colors: { skin: '"/><script>', hair: '#abcdef', clothes: 12 },
        background: 'url(#evil)',
      }),
      'u1',
    );
    expect(parsed.selections.head).toBe(base.selections.head); // 000032 est un haut, pas une coiffure
    expect(parsed.selections.body).toBe(base.selections.body);
    expect(parsed.selections.item).toBe('hm1-p-000050');
    expect(parsed.colors).toEqual({ ...base.colors, hair: 'ABCDEF' });
    expect(parsed.background).toBe(base.background);
  });

  it('résiste aux valeurs qui ne sont pas des objets', () => {
    for (const value of ['[]', '42', 'null', '"texte"', '{"selections": 3}']) {
      expect(() => parseAvatar(value, 'u1')).not.toThrow();
    }
  });
});

describe('rendu pour react-native-svg', () => {
  it('remplace toutes les variables de couleur par les couleurs choisies', () => {
    const avatar = { ...seededAvatar('u1'), colors: { skin: 'F3C9A6', hair: '4A3728', clothes: 'A9CBEF', bottom: '3B4A6B' } };
    const svg = renderAvatarSvg(avatar);
    expect(svg).not.toMatch(/var\(/);
    expect(svg).not.toMatch(/data-hm-|style=/);
    expect(svg).toContain('#F3C9A6');
    expect(svg).toContain(`fill="#${avatar.background}"`);
  });

  it('permet de remplacer ou d’enlever le fond', () => {
    const avatar = seededAvatar('u1');
    expect(renderAvatarSvg(avatar, 'EAF3FC')).toContain('fill="#EAF3FC"');
    expect(renderAvatarSvg(avatar, 'transparent')).not.toContain('<rect');
  });

  it('chaque morceau se lit avec le parseur de react-native-svg (iOS, Android et web)', () => {
    const colors = { skin: 'F3C9A6', hair: '4A3728', clothes: 'A9CBEF', bottom: '3B4A6B' };
    const tags = new Set<string>();
    for (const slot of AVATAR_SLOTS) {
      for (const part of partsForSlot(slot)) {
        const avatar: AvatarConfig = { ...seededAvatar('u1'), colors };
        avatar.selections[slot] = part.id;
        for (const svg of [renderAvatarSvg(avatar), renderOptionSvg(avatar, slot, part.id)]) {
          const ast = parse(svg) as unknown as Node;
          expect(ast).not.toBeNull();
          walk(ast, (node) => {
            tags.add(node.tag);
            for (const value of Object.values(node.props)) {
              if (typeof value === 'string') expect(value).not.toMatch(/var\(/);
            }
          });
        }
      }
    }
    // Rien d'exotique : tout est géré par react-native-svg.
    const supported = ['svg', 'g', 'path', 'circle', 'rect', 'line', 'polygon', 'polyline', 'ellipse', 'clipPath', 'defs'];
    expect([...tags].filter((tag) => !supported.includes(tag))).toEqual([]);
  });

  it('la vignette d’une option montre l’avatar avec ce morceau, sans fond (la tête seule, sauf pour le haut)', () => {
    const avatar = seededAvatar('u1');
    const hat = partsForSlot('item').find((p) => p.name === 'santa-hat')!.id;
    const svg = renderOptionSvg(avatar, 'item', hat);
    const full = renderAvatarSvg({ ...avatar, selections: { ...avatar.selections, item: hat } }, 'transparent');
    expect(svg).not.toContain('<rect');
    // Tête, accessoire et lunettes seulement : le buste est retiré.
    expect(svg.length).toBeLessThan(full.length * 0.8);
    expect(parse(svg)).not.toBeNull();
    const shirt = partsForSlot('body')[3].id;
    expect(renderOptionSvg(avatar, 'body', shirt)).toBe(
      renderAvatarSvg({ ...avatar, selections: { ...avatar.selections, body: shirt } }, 'transparent'),
    );
  });

  it('un avatar au hasard n’utilise que les couleurs proposées', () => {
    const random = seededRandom(4);
    for (let i = 0; i < 20; i++) {
      const avatar = randomAvatar(AvatarPalettes, random);
      for (const slot of AVATAR_COLOR_SLOTS) expect(AvatarPalettes[slot]).toContain(avatar.colors[slot]);
      expect(parseAvatar(serializeAvatar(avatar), 'x')).toEqual(avatar);
    }
  });
});

describe('libellés', () => {
  it('chaque morceau a un libellé français', () => {
    for (const slot of AVATAR_SLOTS) {
      for (const part of partsForSlot(slot)) expect(partLabel(slot, part.id)).not.toBe(part.name);
    }
  });
});

describe('aiAvatar', () => {
  it('reconnaissable (antennes) et stable pour une même IA', () => {
    expect(aiAvatar('p1')).toEqual(aiAvatar('p1'));
    expect(partLabel('item', aiAvatar('p1').selections.item)).toBe('Antennes');
    expect(partLabel('item', aiAvatar('p2').selections.item)).toBe('Antennes');
  });
});
