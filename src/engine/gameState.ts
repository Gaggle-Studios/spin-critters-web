import type {
  TournamentState,
  PlayerState,
  CardDefinition,
  GamePhase,
} from './types.ts';
import {
  NUM_AI_OPPONENTS,
  STARTING_MORALE,
  INITIAL_REEL_HEIGHT,
  REEL_WIDTH,
  INITIAL_DRAFT_COMMON,
  INITIAL_DRAFT_UNCOMMON,
  SHOP_COST,
} from './constants.ts';
import { loadCritters, generateCardPool, createCardInstance, JUNK_CARD } from './cards.ts';
import { generateShopPack, generateDraftPacks } from './shop.ts';
import { initBattle, executeSpin, applyBattleResult, reviveAllCards } from './battle.ts';
import {
  createAIPlayer,
  aiSelectCritters,
  aiPlaceCritters,
  aiDraftPick,
  aiPlaceCard,
  aiFillWithJunk,
  aiShopDecision,
} from './ai.ts';
import { EVOLUTION_TABLE } from './constants.ts';

export function createInitialState(): TournamentState {
  const cardPool = generateCardPool();
  const humanPlayer: PlayerState = {
    id: 'human',
    name: 'Player',
    isHuman: true,
    morale: STARTING_MORALE,
    resources: 0,
    reels: [],
    reelHeight: INITIAL_REEL_HEIGHT,
    critters: [],
    activeCritLines: 1,
    battlesCompleted: 0,
  };

  const aiPlayers = Array.from({ length: NUM_AI_OPPONENTS }, (_, i) => createAIPlayer(i));

  return {
    phase: 'critter-select',
    round: 1,
    battleInRound: 0,
    players: [humanPlayer, ...aiPlayers],
    humanPlayerId: 'human',
    currentBattle: null,
    cardPool,
    matchHistory: [],
    eliminationOrder: [],
    shopPack: null,
    draftPacks: null,
    currentDraftPack: 0,
    pendingPlacement: null,
  };
}

export function getAllCritters(): CardDefinition[] {
  return loadCritters();
}

export function humanSelectCritters(
  state: TournamentState,
  selectedCritterIds: string[],
  columnPlacements: number[] // column index for each selected critter
): TournamentState {
  const allCritters = loadCritters();
  const human = state.players.find((p) => p.id === state.humanPlayerId)!;

  // Init reels
  human.reels = [];
  for (let row = 0; row < human.reelHeight; row++) {
    human.reels[row] = [];
    for (let col = 0; col < REEL_WIDTH; col++) {
      human.reels[row][col] = { row, col, card: null };
    }
  }

  // Place critters
  human.critters = [];
  for (let i = 0; i < selectedCritterIds.length; i++) {
    const def = allCritters.find((c) => c.cardId === selectedCritterIds[i])!;
    const instance = createCardInstance(def);
    human.critters.push(instance);
    human.reels[0][columnPlacements[i]].card = instance;
  }

  // AI selects critters
  for (const ai of state.players.filter((p) => !p.isHuman)) {
    const picks = aiSelectCritters(ai, allCritters);
    aiPlaceCritters(ai, picks);
  }

  // Move to draft phase
  state.phase = 'initial-draft';
  state.draftPacks = generateDraftPacks(
    state.cardPool,
    INITIAL_DRAFT_COMMON,
    INITIAL_DRAFT_UNCOMMON
  );
  state.currentDraftPack = 0;

  // AI does their draft
  for (const ai of state.players.filter((p) => !p.isHuman)) {
    const packs = generateDraftPacks(state.cardPool, INITIAL_DRAFT_COMMON, INITIAL_DRAFT_UNCOMMON);
    for (const pack of packs) {
      const pick = aiDraftPick(ai, pack);
      aiPlaceCard(ai, pick);
    }
    aiFillWithJunk(ai);
  }

  return state;
}

export function humanDraftPick(
  state: TournamentState,
  cardIndex: number,
  column: number
): TournamentState {
  const human = state.players.find((p) => p.id === state.humanPlayerId)!;
  const packs = state.draftPacks!;
  const currentPack = packs[state.currentDraftPack];
  const pickedDef = currentPack[cardIndex];

  // Place the card
  const instance = createCardInstance(pickedDef);
  // Find first empty row in column
  for (let row = 0; row < human.reelHeight; row++) {
    if (!human.reels[row][column].card) {
      human.reels[row][column].card = instance;
      break;
    }
  }

  state.currentDraftPack++;

  // Check if draft is complete
  if (state.currentDraftPack >= packs.length) {
    // Fill remaining slots with junk
    for (let row = 0; row < human.reelHeight; row++) {
      for (let col = 0; col < REEL_WIDTH; col++) {
        if (!human.reels[row][col].card) {
          human.reels[row][col].card = createCardInstance(JUNK_CARD);
        }
      }
    }
    // Start first battle
    startNextBattle(state);
  }

  return state;
}

function getAlivePlayers(state: TournamentState): PlayerState[] {
  return state.players.filter((p) => p.morale > 0);
}

function getNextOpponent(state: TournamentState): PlayerState | null {
  const alive = getAlivePlayers(state);
  const human = alive.find((p) => p.id === state.humanPlayerId);
  if (!human) return null;

  const opponents = alive.filter((p) => p.id !== state.humanPlayerId);
  if (opponents.length === 0) return null;

  // Round-robin: pick based on battle count
  return opponents[state.battleInRound % opponents.length];
}

export function startNextBattle(state: TournamentState): TournamentState {
  const alive = getAlivePlayers(state);

  if (alive.length <= 1) {
    state.phase = 'game-over';
    return state;
  }

  const human = alive.find((p) => p.id === state.humanPlayerId);
  if (!human || human.morale <= 0) {
    state.phase = 'game-over';
    return state;
  }

  const opponent = getNextOpponent(state);
  if (!opponent) {
    state.phase = 'game-over';
    return state;
  }

  state.phase = 'battle';
  state.currentBattle = initBattle(human, opponent);

  // Also run AI vs AI battles in the background
  runAIBattles(state);

  return state;
}

function runAIBattles(state: TournamentState): void {
  const alive = getAlivePlayers(state).filter((p) => !p.isHuman);
  // Pair up AI players for background battles
  for (let i = 0; i < alive.length - 1; i += 2) {
    const a = alive[i];
    const b = alive[i + 1];
    if (!a || !b) continue;

    // Simple simulation: random winner based on total stats
    const aStrength = getTotalStrength(a);
    const bStrength = getTotalStrength(b);
    const aWinChance = aStrength / (aStrength + bStrength);

    if (Math.random() < aWinChance) {
      // a wins
      b.morale = Math.max(0, b.morale - 8);
      if (b.morale <= 0 && !state.eliminationOrder.includes(b.id)) {
        state.eliminationOrder.push(b.id);
      }
    } else {
      a.morale = Math.max(0, a.morale - 8);
      if (a.morale <= 0 && !state.eliminationOrder.includes(a.id)) {
        state.eliminationOrder.push(a.id);
      }
    }
  }
}

function getTotalStrength(player: PlayerState): number {
  let total = 0;
  for (let row = 0; row < player.reelHeight; row++) {
    for (let col = 0; col < REEL_WIDTH; col++) {
      const card = player.reels[row]?.[col]?.card;
      if (card && !card.isKO) {
        total += card.currentAttack + card.maxHealth;
      }
    }
  }
  return Math.max(total, 1);
}

export function advanceSpin(state: TournamentState): TournamentState {
  if (!state.currentBattle || state.currentBattle.isComplete) return state;
  executeSpin(state.currentBattle);
  return state;
}

export function finishBattle(state: TournamentState): TournamentState {
  if (!state.currentBattle || !state.currentBattle.isComplete) return state;

  applyBattleResult(state.currentBattle);

  const battle = state.currentBattle;
  state.matchHistory.push({
    p1: battle.player1.id,
    p2: battle.player2.id,
    winner: battle.winnerId || '',
  });

  // Check eliminations
  for (const player of state.players) {
    if (player.morale <= 0 && !state.eliminationOrder.includes(player.id)) {
      state.eliminationOrder.push(player.id);
    }
  }

  // Check game over
  const alive = getAlivePlayers(state);
  const humanAlive = alive.some((p) => p.id === state.humanPlayerId);

  if (alive.length <= 1 || !humanAlive) {
    state.phase = 'game-over';
    state.currentBattle = null;
    return state;
  }

  // Revive all cards for all players
  for (const player of state.players) {
    reviveAllCards(player);
  }

  // Process evolution
  for (const player of state.players) {
    processEvolution(player);
  }

  state.battleInRound++;
  const human = state.players.find((p) => p.id === state.humanPlayerId)!;
  human.battlesCompleted++;

  // Grow reel height every other battle
  if (human.battlesCompleted % 2 === 0) {
    growReelHeight(state);
  }

  // Move to shop
  state.phase = 'shop';
  state.shopPack = { cards: generateShopPack(state.cardPool, state.round) };
  state.currentBattle = null;

  return state;
}

function processEvolution(player: PlayerState): void {
  for (const critter of player.critters) {
    if (critter.level >= 5) continue;
    const nextLevel = EVOLUTION_TABLE[critter.level]; // level is 1-indexed, array is 0-indexed
    if (!nextLevel) continue;
    if (critter.xp >= nextLevel.xpRequired) {
      const healthIncrease = nextLevel.healthBonus - (critter.level > 1 ? EVOLUTION_TABLE[critter.level - 1].healthBonus : 0);
      const attackIncrease = nextLevel.attackBonus - (critter.level > 1 ? EVOLUTION_TABLE[critter.level - 1].attackBonus : 0);
      critter.level++;
      critter.maxHealth += healthIncrease;
      critter.currentHealth += healthIncrease; // Heal by increase amount
      critter.baseAttack += attackIncrease;
      critter.currentAttack = critter.baseAttack;
    }
  }
}

function growReelHeight(state: TournamentState): void {
  for (const player of state.players) {
    if (player.reelHeight >= 10) continue;
    player.reelHeight++;
    const newRow = player.reelHeight - 1;
    player.reels[newRow] = [];
    for (let col = 0; col < REEL_WIDTH; col++) {
      const card = createCardInstance(JUNK_CARD);
      player.reels[newRow][col] = { row: newRow, col, card };
    }
  }
}

export function shopBuy(
  state: TournamentState,
  cardIndex: number,
  column: number,
  row?: number
): TournamentState {
  const human = state.players.find((p) => p.id === state.humanPlayerId)!;
  if (!state.shopPack) return state;

  const card = state.shopPack.cards[cardIndex];
  const cost = SHOP_COST[card.rarity] || 2;
  if (human.resources < cost) return state;

  human.resources -= cost;
  const instance = createCardInstance(card);

  let placed = false;

  // If a specific row is provided, place there (replacing junk or filling empty)
  if (row !== undefined) {
    const slot = human.reels[row]?.[column];
    if (slot) {
      const existing = slot.card;
      if (!existing || existing.category === 'Junk') {
        slot.card = instance;
        placed = true;
      }
    }
  }

  // Fallback: find first empty row in column, or replace last junk
  if (!placed) {
    for (let r = 0; r < human.reelHeight; r++) {
      if (!human.reels[r][column].card) {
        human.reels[r][column].card = instance;
        placed = true;
        break;
      }
    }
  }
  if (!placed) {
    for (let r = human.reelHeight - 1; r >= 0; r--) {
      const existing = human.reels[r][column].card;
      if (existing && existing.category === 'Junk') {
        human.reels[r][column].card = instance;
        placed = true;
        break;
      }
    }
  }

  // AI shop
  for (const ai of state.players.filter((p) => !p.isHuman && p.morale > 0)) {
    const aiPack = generateShopPack(state.cardPool, state.round);
    const decision = aiShopDecision(ai, aiPack);
    if (decision.action === 'buy') {
      const aiCard = aiPack[decision.index];
      const aiCost = SHOP_COST[aiCard.rarity] || 2;
      if (ai.resources >= aiCost) {
        ai.resources -= aiCost;
        aiPlaceCard(ai, aiCard);
      }
    }
  }

  state.shopPack = null;
  state.round++;
  startNextBattle(state);
  return state;
}

export function shopReroll(state: TournamentState): TournamentState {
  const human = state.players.find((p) => p.id === state.humanPlayerId)!;
  if (human.resources < 2) return state;
  human.resources -= 2;
  state.shopPack = { cards: generateShopPack(state.cardPool, state.round) };
  return state;
}

export function shopSkip(state: TournamentState): TournamentState {
  // AI shop
  for (const ai of state.players.filter((p) => !p.isHuman && p.morale > 0)) {
    const aiPack = generateShopPack(state.cardPool, state.round);
    const decision = aiShopDecision(ai, aiPack);
    if (decision.action === 'buy') {
      const aiCard = aiPack[decision.index];
      const aiCost = SHOP_COST[aiCard.rarity] || 2;
      if (ai.resources >= aiCost) {
        ai.resources -= aiCost;
        aiPlaceCard(ai, aiCard);
      }
    }
  }

  state.shopPack = null;
  state.round++;
  startNextBattle(state);
  return state;
}
