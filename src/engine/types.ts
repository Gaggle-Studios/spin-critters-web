export type Biome = 'Red' | 'Blue' | 'Cream' | 'Brown' | 'Green';
export type Archetype = 'Insect' | 'Mammal' | 'Reptile' | 'Avian' | 'Aquatic';
export type CardCategory = 'Critter' | 'Ally' | 'Location' | 'Relic' | 'Junk';
export type Rarity = 'Common' | 'Uncommon' | 'Rare';
export type BattlePhase = 'spin' | 'on-appear' | 'crit-resolution' | 'fast-attack' | 'regular-attack' | 'slow-attack' | 'cleanup';
export type GamePhase = 'critter-select' | 'initial-draft' | 'battle' | 'shop' | 'game-over';
export type AIPersonality = 'aggressive' | 'defensive' | 'balanced';

export interface KeywordInstance {
  keywordId: number;
  name: string;
  value?: number;
  targetType?: string;
}

export interface CardDefinition {
  cardId: string;
  name: string;
  category: CardCategory;
  rarity: Rarity;
  biome: Biome;
  archetype: Archetype;
  attack: number;
  health: number;
  loyalty: number;
  keywords: KeywordInstance[];
  description: string;
  evolutions?: {
    level: number;
    attack: number;
    health: number;
    keywords: KeywordInstance[];
  }[];
}

export interface CardInstance {
  instanceId: string;
  definitionId: string;
  name: string;
  category: CardCategory;
  rarity: Rarity;
  biome: Biome;
  archetype: Archetype;
  currentHealth: number;
  maxHealth: number;
  currentAttack: number;
  baseAttack: number;
  isKO: boolean;
  isLocked: boolean;
  level: number;
  xp: number;
  poisonCounters: number;
  stunTurns: number;
  trapTurns: number;
  keywords: KeywordInstance[];
}

export interface ReelSlot {
  row: number;
  col: number;
  card: CardInstance | null;
}

export interface PlayerState {
  id: string;
  name: string;
  isHuman: boolean;
  morale: number;
  resources: number;
  reels: ReelSlot[][];
  reelHeight: number;
  critters: CardInstance[];
  activeCritLines: number;
  battlesCompleted: number;
  personality?: AIPersonality;
}

// Discriminated union for typed battle events used by the animation system.
// The engine emits these alongside string log entries so the UI can replay
// each phase visually with timed delays.
export type BattleEvent =
  | { type: 'spin-result'; spin: number; player1Id: string; player2Id: string; player1Active: { col: number; cardName: string; cardId: string; health: number; maxHealth: number; attack: number }[]; player2Active: { col: number; cardName: string; cardId: string; health: number; maxHealth: number; attack: number }[] }
  | { type: 'phase-marker'; spin: number; phase: BattlePhase; label: string }
  | { type: 'resource-grant'; spin: number; playerId: string; amount: number }
  | { type: 'poison-damage'; spin: number; playerId: string; col: number; cardName: string; damage: number; newHealth: number; isKO: boolean }
  | { type: 'regenerate'; spin: number; playerId: string; col: number; cardName: string; amount: number; newHealth: number }
  | { type: 'healing'; spin: number; playerId: string; col: number; cardName: string; targetCol: number; targetName: string; amount: number; targetNewHealth: number }
  | { type: 'produce'; spin: number; playerId: string; col: number; cardName: string; amount: number }
  | { type: 'crit-biome'; spin: number; playerId: string; biome: Biome }
  | { type: 'crit-archetype'; spin: number; playerId: string; archetype: Archetype }
  | { type: 'attack'; spin: number; attackerPlayerId: string; defenderPlayerId: string; attackerCol: number; defenderCol: number; attackerName: string; defenderName: string; damage: number; defenderNewHealth: number; defenderIsKO: boolean }
  | { type: 'thorns'; spin: number; playerId: string; col: number; cardName: string; damage: number; newHealth: number; isKO: boolean; sourceCol: number; sourceName: string }
  | { type: 'venomous'; spin: number; playerId: string; col: number; cardName: string; counters: number; sourceName: string }
  | { type: 'poisonous'; spin: number; playerId: string; col: number; cardName: string; counters: number; sourceName: string }
  | { type: 'overtime-damage'; spin: number; playerId: string; col: number; cardName: string; damage: number; newHealth: number; isKO: boolean }
  | { type: 'column-locked'; spin: number; playerId: string; col: number }
  | { type: 'ko'; spin: number; playerId: string; col: number; cardName: string; cause: string }
  | { type: 'junk-resource'; spin: number; playerId: string; amount: number }
  | { type: 'battle-end'; spin: number; winnerId: string; winnerName: string };

export interface BattleState {
  player1: PlayerState;
  player2: PlayerState;
  currentSpin: number;
  maxSpins: number;
  log: BattleLogEntry[];
  events: BattleEvent[];
  phase: BattlePhase;
  player1ActiveCards: (CardInstance | null)[];
  player2ActiveCards: (CardInstance | null)[];
  isComplete: boolean;
  winnerId: string | null;
}

export interface BattleLogEntry {
  spin: number;
  phase: BattlePhase;
  message: string;
  details?: Record<string, unknown>;
}

export interface ShopPack {
  cards: CardDefinition[];
}

export interface TournamentState {
  phase: GamePhase;
  round: number;
  battleInRound: number;
  players: PlayerState[];
  humanPlayerId: string;
  currentBattle: BattleState | null;
  cardPool: CardDefinition[];
  matchHistory: { p1: string; p2: string; winner: string }[];
  eliminationOrder: string[];
  shopPack: ShopPack | null;
  draftPacks: CardDefinition[][] | null;
  currentDraftPack: number;
  pendingPlacement: CardDefinition | null;
}

export interface CritterJson {
  cardId: string;
  setId: string;
  name: string;
  rarity: string;
  category: string;
  description: string;
  biome: string;
  archetype: string;
  attack: number;
  health: number;
  loyalty: number;
}
