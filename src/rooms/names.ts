import { aiAvatar, type AvatarConfig } from '@/avatar/avatar';
import { aiName } from '@/hooks/game-setup';
import type { Translator } from '@/i18n';

import type { RoomPlayer } from './room-service';

/**
 * Nom d'un participant vu par le joueur `userId` : « Toi », son pseudo,
 * « IA · Moyen », ou « Compte supprimé ».
 */
export function participantName(t: Translator, player: RoomPlayer | undefined, userId: string): string {
  if (!player) return t('common.unknownPlayer');
  if (player.aiLevel) return aiName(t, player.aiLevel);
  if (player.userId === null) return t('common.deletedAccount');
  if (player.userId === userId) return t('common.you');
  return player.pseudo ?? t('common.player');
}

/** Avatar d'un participant : celui de son profil, ou celui d'une IA (avec antennes). */
export function participantAvatar(player: RoomPlayer | undefined): AvatarConfig | string | null {
  if (!player) return null;
  return player.aiLevel ? aiAvatar(player.id) : player.avatar;
}
