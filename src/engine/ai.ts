import type {
  AIPersonality,
  CardDefinition,
  CardInstance,
  PlayerState,
} from './types.ts';
import {
  REEL_WIDTH,
  INITIAL_REEL_HEIGHT,
  STARTING_MORALE,
  MAX_SAME_BIOME_CRITTERS,
  SHOP_COST,
} from './constants.ts';
import { createCardInstance, JUNK_CARD } from './cards.ts';

const AI_NAMES = ['Bot Alpha', 'Bot Beta', 'Bot Gamma'];
const PERSONALITIES: AIPersonality[] = ['aggressive', 'defensive', 'balanced'];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function createAIPlayer(index: number): PlayerState {
  return {
    id: `ai_${index}`,
    name: AI_NAMES[index] || `Bot ${index}`,
    isHuman: false,
    morale: STARTING_MORALE,
    resources: 0,
    reels: [],
    reelHeight: INITIAL_REEL_HEIGHT,
    critters: [],
    activeCritLines: 1,
    battlesCompleted: 0,
    personality: PERSONALITIES[index % PERSONALITIES.length],
  };
}

export function aiSelectCritters(
  player: PlayerState,
  allCritters: CardDefinition[]
): CardDefinition[] {
  const selected: CardDefinition[] = [];
  const biomeCounts: Record<string, number> = {};
  const shuffled = [...allCritters].sort(() => Math.random() - 0.5);

  for (const critter of shuffled) {
    if (selected.length >= 3) break;
    const biomeCount = biomeCounts[critter.biome] || 0;
    if (biomeCount < MAX_SAME_BIOME_CRITTERS) {
      selected.push(critter);
      biomeCounts[critter.biome] = biomeCount + 1;
    }
  }

  return selected;
}

export function aiPlaceCritters(
  player: PlayerState,
  critterDefs: CardDefinition[]
): void {
  // Initialize reels
  player.reels = [];
  for (let row = 0; row < player.reelHeight; row++) {
    player.reels[row] = [];
    for (let col = 0; col < REEL_WIDTH; col++) {
      player.reels[row][col] = { row, col, card: null };
    }
  }

  // Place critters in columns 0, 1, 2 (or spread out)
  const columns = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5).slice(0, 3);
  player.critters = [];
  for (let i = 0; i < critterDefs.length; i++) {
    const instance = createCardInstance(critterDefs[i]);
    player.critters.push(instance);
    player.reels[0][columns[i]].card = instance;
  }
}

export function aiDraftPick(
  player: PlayerState,
  pack: CardDefinition[]
): CardDefinition {
  if (pack.length === 0) return JUNK_CARD;

  const personality = player.personality || 'balanced';
  const scored = pack.map((card) => {
    let score = 0;
    switch (personality) {
      case 'aggressive':
        score = card.attack * 3 + card.health;
        break;
      case 'defensive':
        score = card.attack + card.health * 3;
        break;
      case 'balanced':
        score = card.attack * 2 + card.health * 2 + Math.random() * 5;
        break;
    }
    // Rarity bonus
    if (card.rarity === 'Uncommon') score += 5;
    if (card.rarity === 'Rare') score += 15;
    return { card, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].card;
}

export function aiPlaceCard(player: PlayerState, cardDef: CardDefinition): void {
  const instance = createCardInstance(cardDef);
  // Find column with fewest cards
  const colCounts: number[] = [];
  for (let col = 0; col < REEL_WIDTH; col++) {
    let count = 0;
    for (let row = 0; row < player.reelHeight; row++) {
      if (player.reels[row]?.[col]?.card) count++;
    }
    colCounts.push(count);
  }

  const minCount = Math.min(...colCounts);
  const bestCols = colCounts.map((c, i) => (c === minCount ? i : -1)).filter((i) => i >= 0);
  const col = pickRandom(bestCols);

  // Find first empty row in this column
  for (let row = 0; row < player.reelHeight; row++) {
    if (!player.reels[row][col].card) {
      player.reels[row][col].card = instance;
      return;
    }
  }

  // No empty slot — replace a Junk card in this column
  for (let row = 0; row < player.reelHeight; row++) {
    const existing = player.reels[row][col].card;
    if (existing && existing.category === 'Junk') {
      player.reels[row][col].card = instance;
      return;
    }
  }

  // Still no slot in preferred column — try any column (replace junk)
  for (let c = 0; c < REEL_WIDTH; c++) {
    for (let row = 0; row < player.reelHeight; row++) {
      const existing = player.reels[row][c].card;
      if (existing && existing.category === 'Junk') {
        player.reels[row][c].card = instance;
        return;
      }
    }
  }
}

export function aiFillWithJunk(player: PlayerState): void {
  for (let row = 0; row < player.reelHeight; row++) {
    for (let col = 0; col < REEL_WIDTH; col++) {
      if (!player.reels[row][col].card) {
        player.reels[row][col].card = createCardInstance(JUNK_CARD);
      }
    }
  }
}

export function aiShopDecision(
  player: PlayerState,
  pack: CardDefinition[]
): { action: 'buy'; index: number } | { action: 'skip' } {
  // Try to buy the best affordable card
  const personality = player.personality || 'balanced';

  const affordable = pack
    .map((card, index) => ({
      card,
      index,
      cost: SHOP_COST[card.rarity] || 2,
    }))
    .filter((c) => c.cost <= player.resources);

  if (affordable.length === 0) return { action: 'skip' };

  const scored = affordable.map((item) => {
    let score = 0;
    switch (personality) {
      case 'aggressive':
        score = item.card.attack * 3 + item.card.health;
        break;
      case 'defensive':
        score = item.card.attack + item.card.health * 3;
        break;
      case 'balanced':
        score = item.card.attack * 2 + item.card.health * 2;
        break;
    }
    if (item.card.rarity === 'Rare') score += 10;
    if (item.card.rarity === 'Uncommon') score += 5;
    return { ...item, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return { action: 'buy', index: scored[0].index };
}
