import type { CardInstance, BattleState } from '../../engine/types';
import type { PixiCardData } from '../objects/PixiCard';

/** Convert a CardInstance (or null) to PixiCardData (or null) */
export function cardToPixiData(card: CardInstance | null): PixiCardData | null {
  if (!card) return null;
  return {
    instanceId: card.instanceId,
    definitionId: card.definitionId,
    name: card.name,
    category: card.category,
    biome: card.biome,
    rarity: card.rarity,
    attack: card.currentAttack,
    health: card.currentHealth,
    maxHealth: card.maxHealth,
    isKO: card.isKO,
    level: card.level,
    keywords: card.keywords.map(k => ({ name: k.name, value: k.value })),
  };
}

/** Convert spin-result event active cards to PixiCardData array */
export function spinResultToPixiData(
  activeCards: { col: number; cardName: string; cardId: string; health: number; maxHealth: number; attack: number }[],
  battle: BattleState,
  playerId: string,
): (PixiCardData | null)[] {
  const result: (PixiCardData | null)[] = [null, null, null, null, null];
  const isPlayer1 = battle.player1.id === playerId;
  const playerActiveCards = isPlayer1 ? battle.player1ActiveCards : battle.player2ActiveCards;

  for (const ac of activeCards) {
    const fullCard = playerActiveCards[ac.col];
    if (fullCard) {
      result[ac.col] = cardToPixiData(fullCard);
    } else {
      // Fallback: construct minimal data from event
      result[ac.col] = {
        instanceId: `event-${ac.col}`,
        definitionId: ac.cardId,
        name: ac.cardName,
        category: 'Ally',
        biome: 'Red',
        rarity: 'Common',
        attack: ac.attack,
        health: ac.health,
        maxHealth: ac.maxHealth,
        isKO: false,
        level: 1,
        keywords: [],
      };
    }
  }

  return result;
}

/** Get all active card data for a player from the battle state */
export function getActiveCardsData(battle: BattleState, playerId: string): (PixiCardData | null)[] {
  const isPlayer1 = battle.player1.id === playerId;
  const activeCards = isPlayer1 ? battle.player1ActiveCards : battle.player2ActiveCards;
  return activeCards.map(c => cardToPixiData(c));
}

/** Convert a player's full reel grid to PixiCardData[][] for the mini reel display */
export function getReelGridData(battle: BattleState, playerId: string): (PixiCardData | null)[][] {
  const isPlayer1 = battle.player1.id === playerId;
  const player = isPlayer1 ? battle.player1 : battle.player2;
  const result: (PixiCardData | null)[][] = [];
  for (let row = 0; row < player.reels.length; row++) {
    const rowData: (PixiCardData | null)[] = [];
    for (let col = 0; col < 5; col++) {
      const slot = player.reels[row]?.[col];
      rowData.push(slot?.card ? cardToPixiData(slot.card) : null);
    }
    result.push(rowData);
  }
  return result;
}
