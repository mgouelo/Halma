import { aiAvatar, type AvatarConfig } from '@/avatar/avatar';
import { AI_LEVEL_LABELS } from '@/hooks/game-setup';

import type { RoomPlayer } from './room-service';

/**
 * Nom d'un participant vu par le joueur `userId` : « Toi », son pseudo,
 * « IA · Moyen », ou « Compte supprimé ».
 */
export function participantName(player: RoomPlayer | undefined, userId: string): string {
  if (!player) return '?';
  if (player.aiLevel) return `IA · ${AI_LEVEL_LABELS[player.aiLevel]}`;
  if (player.userId === null) return 'Compte supprimé';
  if (player.userId === userId) return 'Toi';
  return player.pseudo ?? 'Joueur';
}

/** Avatar d'un participant : celui de son profil, ou celui d'une IA (avec antennes). */
export function participantAvatar(player: RoomPlayer | undefined): AvatarConfig | string | null {
  if (!player) return null;
  return player.aiLevel ? aiAvatar(player.id) : player.avatar;
}
