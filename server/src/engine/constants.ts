export const REEL_WIDTH = 5;
export const INITIAL_REEL_HEIGHT = 3;
export const MAX_REEL_HEIGHT = 10;
export const STARTING_MORALE = 50;
export const MORALE_LOSS_BASE = 6;
export const MORALE_LOSS_PER_LIVING = 2;
export const STARTING_RESOURCES = 3;
export const RESOURCE_BONUS_THRESHOLD = 10;
export const MAX_SPINS_PER_BATTLE = 10;
export const OVERTIME_DAMAGE_START = 10;
export const MAX_SAME_BIOME_CRITTERS = 2;
export const CRIT_LINE_COUNT = 5;
export const NUM_AI_OPPONENTS = 3;
export const INITIAL_DRAFT_COMMON = 5;
export const INITIAL_DRAFT_UNCOMMON = 2;

export const SHOP_COST: Record<string, number> = {
  Common: 2,
  Uncommon: 4,
  Rare: 7,
};

export const REROLL_COST = 2;

export const EVOLUTION_TABLE = [
  { level: 1, xpRequired: 0, attackBonus: 0, healthBonus: 0 },
  { level: 2, xpRequired: 3, attackBonus: 2, healthBonus: 10 },
  { level: 3, xpRequired: 8, attackBonus: 4, healthBonus: 20 },
  { level: 4, xpRequired: 15, attackBonus: 7, healthBonus: 35 },
  { level: 5, xpRequired: 25, attackBonus: 10, healthBonus: 50 },
];

export const RARITY_BY_ROUND: { common: number; uncommon: number; rare: number }[] = [
  { common: 100, uncommon: 0, rare: 0 },     // Round 1
  { common: 95, uncommon: 5, rare: 0 },      // Round 2
  { common: 90, uncommon: 10, rare: 0 },     // Round 3
  { common: 80, uncommon: 20, rare: 0 },     // Round 4
  { common: 70, uncommon: 25, rare: 5 },     // Round 5
  { common: 60, uncommon: 30, rare: 10 },    // Round 6
  { common: 50, uncommon: 35, rare: 15 },    // Round 7
  { common: 40, uncommon: 40, rare: 20 },    // Round 8
  { common: 25, uncommon: 45, rare: 25 },    // Round 9
  { common: 15, uncommon: 50, rare: 35 },    // Round 10
];

export const BIOME_COLORS: Record<string, string> = {
  Red: '#E74C3C',
  Blue: '#3498DB',
  Cream: '#F5E6CC',
  Brown: '#8B4513',
  Green: '#27AE60',
};

export const KEYWORD_INFO: Record<string, { color: string; icon: string; description: string }> = {
  Produce:   { color: '#D4A017', icon: '$', description: 'Generates X resources when activated on the battle line.' },
  Steal:     { color: '#FF9800', icon: '$', description: 'Steals X resources from your opponent when activated.' },
  Fast:      { color: '#FFC107', icon: '>', description: 'Attacks before the normal combat phase.' },
  Slow:      { color: '#78909C', icon: '<', description: 'Attacks after the normal combat phase.' },
  Venomous:  { color: '#9B59B6', icon: '~', description: 'Applies X poison counters on hit. Poisoned cards take counter damage each spin, then counters reduce by 1.' },
  Poisonous: { color: '#6A1B9A', icon: '~', description: 'Applies X poison counters to any card that attacks this one.' },
  Thorns:    { color: '#C0392B', icon: '*', description: 'Deals X damage back to any card that attacks this one.' },
  Angry:     { color: '#FF5722', icon: '!', description: 'Deals +50% damage when below 50% health.' },
  Regenerate:{ color: '#2ECC71', icon: '+', description: 'Heals self for X at the start of each spin.' },
  Healing:   { color: '#E91E63', icon: '+', description: 'Heals adjacent cards for X at the start of each spin.' },
  Bolster:   { color: '#2980B9', icon: '^', description: 'Adjacent cards deal +X additional damage.' },
};
