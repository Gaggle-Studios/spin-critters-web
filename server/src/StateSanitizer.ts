import type { TournamentState, PlayerState, CardInstance } from './engine/types.ts';
import type { SanitizedGameState, SanitizedPlayerState } from './shared/protocol.ts';
import { REEL_WIDTH } from './engine/constants.ts';

function getColumnCardCounts(player: PlayerState): number[] {
  const counts: number[] = [];
  for (let col = 0; col < REEL_WIDTH; col++) {
    let living = 0;
    for (let row = 0; row < player.reelHeight; row++) {
      const card = player.reels[row]?.[col]?.card;
      if (card && !card.isKO) living++;
    }
    counts.push(living);
  }
  return counts;
}

export function sanitizeStateForPlayer(
  state: TournamentState,
  viewingPlayerId: string,
  playerDraftPacks: Map<string, import('./engine/types.ts').CardDefinition[][]>,
  playerDraftIndex: Map<string, number>,
  playerShopPacks: Map<string, import('./engine/types.ts').ShopPack>,
): SanitizedGameState {
  const sanitizedPlayers: SanitizedPlayerState[] = state.players.map((player) => {
    const isYou = player.id === viewingPlayerId;
    return {
      id: player.id,
      name: player.name,
      isHuman: player.isHuman,
      morale: player.morale,
      resources: player.resources,
      reelHeight: player.reelHeight,
      battlesCompleted: player.battlesCompleted,
      reels: isYou ? player.reels : null,
      critters: isYou ? player.critters : null,
      columnCardCounts: getColumnCardCounts(player),
      isYou,
    };
  });

  const draftPacks = playerDraftPacks.get(viewingPlayerId) ?? null;
  const draftIndex = playerDraftIndex.get(viewingPlayerId) ?? 0;
  const shopPack = playerShopPacks.get(viewingPlayerId) ?? null;

  return {
    phase: state.phase,
    round: state.round,
    battleInRound: state.battleInRound,
    players: sanitizedPlayers,
    currentBattle: state.currentBattle ? {
      currentSpin: state.currentBattle.currentSpin,
      maxSpins: state.currentBattle.maxSpins,
      isComplete: state.currentBattle.isComplete,
      winnerId: state.currentBattle.winnerId,
      player1Id: state.currentBattle.player1.id,
      player2Id: state.currentBattle.player2.id,
      player1ActiveCards: state.currentBattle.player1ActiveCards,
      player2ActiveCards: state.currentBattle.player2ActiveCards,
      log: state.currentBattle.log,
      events: state.currentBattle.events,
    } : null,
    matchHistory: state.matchHistory,
    eliminationOrder: state.eliminationOrder,
    yourDraftPacks: draftPacks,
    currentDraftPack: draftIndex,
    yourShopPack: shopPack ?? null,
    pendingPlacement: state.pendingPlacement,
  };
}
