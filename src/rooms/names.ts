import { AI_LEVEL_LABELS } from '@/hooks/game-setup';

import type { RoomPlayer } from './room-service';

/** Nom d'un participant vu par le joueur `userId` : « Toi », son pseudo, ou « IA · Moyen ». */
export function participantName(player: RoomPlayer | undefined, userId: string): string {
  if (!player) return '?';
  if (player.aiLevel) return `IA · ${AI_LEVEL_LABELS[player.aiLevel]}`;
  if (player.userId === userId) return 'Toi';
  return player.pseudo ?? 'Joueur';
}
