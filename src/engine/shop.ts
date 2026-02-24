import type { CardDefinition, Rarity } from './types.ts';
import { RARITY_BY_ROUND } from './constants.ts';

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getCardsByRarity(pool: CardDefinition[], rarity: Rarity): CardDefinition[] {
  return pool.filter((c) => c.rarity === rarity);
}

export function generateShopPack(pool: CardDefinition[], round: number): CardDefinition[] {
  const dist = RARITY_BY_ROUND[Math.min(round - 1, RARITY_BY_ROUND.length - 1)];
  const cards: CardDefinition[] = [];

  for (let i = 0; i < 3; i++) {
    const roll = Math.random() * 100;
    let rarity: Rarity;
    if (roll < dist.rare) {
      rarity = 'Rare';
    } else if (roll < dist.rare + dist.uncommon) {
      rarity = 'Uncommon';
    } else {
      rarity = 'Common';
    }
    const available = getCardsByRarity(pool, rarity);
    if (available.length > 0) {
      cards.push(pickRandom(available));
    } else {
      const fallback = getCardsByRarity(pool, 'Common');
      if (fallback.length > 0) cards.push(pickRandom(fallback));
    }
  }

  return cards;
}

export function generateDraftPacks(
  pool: CardDefinition[],
  commonPacks: number,
  uncommonPacks: number
): CardDefinition[][] {
  const packs: CardDefinition[][] = [];
  const commons = getCardsByRarity(pool, 'Common');
  const uncommons = getCardsByRarity(pool, 'Uncommon');

  for (let i = 0; i < commonPacks; i++) {
    const pack: CardDefinition[] = [];
    for (let j = 0; j < 3; j++) {
      if (commons.length > 0) pack.push(pickRandom(commons));
    }
    packs.push(pack);
  }

  for (let i = 0; i < uncommonPacks; i++) {
    const pack: CardDefinition[] = [];
    for (let j = 0; j < 3; j++) {
      if (uncommons.length > 0) pack.push(pickRandom(uncommons));
    }
    packs.push(pack);
  }

  return packs;
}
