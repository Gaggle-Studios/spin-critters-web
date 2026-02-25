import type { Server, Socket } from 'socket.io';
import type {
  TournamentState,
  PlayerState,
  CardDefinition,
  ShopPack,
  BattleEvent,
  GamePhase,
} from './engine/types.ts';
import type { ClientMessage, ServerMessage, LobbyPlayer, RoomConfig, SanitizedGameState } from './shared/protocol.ts';
import { DEFAULT_ROOM_CONFIG, SPIN_AUTO_TIMEOUT_MS } from './shared/protocol.ts';
import {
  STARTING_MORALE,
  INITIAL_REEL_HEIGHT,
  REEL_WIDTH,
  INITIAL_DRAFT_COMMON,
  INITIAL_DRAFT_UNCOMMON,
  SHOP_COST,
  EVOLUTION_TABLE,
  MAX_REEL_HEIGHT,
} from './engine/constants.ts';
import { loadCritters, generateCardPool, createCardInstance, JUNK_CARD } from './engine/cards.ts';
import { generateShopPack, generateDraftPacks } from './engine/shop.ts';
import { initBattle, executeSpin, applyBattleResult, reviveAllCards } from './engine/battle.ts';
import {
  createAIPlayer,
  aiSelectCritters,
  aiPlaceCritters,
  aiDraftPick,
  aiPlaceCard,
  aiFillWithJunk,
  aiShopDecision,
} from './engine/ai.ts';
import { sanitizeStateForPlayer } from './StateSanitizer.ts';
import { AI_ACTION_DELAY_MS, SPIN_READY_TIMEOUT_MS } from './config.ts';

interface PlayerConnection {
  playerId: string;
  playerName: string;
  socket: Socket | null;
  reconnectToken: string;
  isConnected: boolean;
  isReady: boolean;
  isAI: boolean;
  disconnectTimer: ReturnType<typeof setTimeout> | null;
}

export class GameRoom {
  readonly roomId: string;
  readonly config: RoomConfig;
  private io: Server;
  private players: Map<string, PlayerConnection> = new Map();
  private state: TournamentState | null = null;
  private cardPool: CardDefinition[] = [];
  private allCritters: CardDefinition[] = [];

  // Per-player phase data
  private playerDraftPacks: Map<string, CardDefinition[][]> = new Map();
  private playerDraftIndex: Map<string, number> = new Map();
  private playerShopPacks: Map<string, ShopPack> = new Map();
  private crittersSelected: Set<string> = new Set();
  private draftComplete: Set<string> = new Set();
  private shopComplete: Set<string> = new Set();

  // Spin ready-check
  private spinReady: Set<string> = new Set();
  private spinTimer: ReturnType<typeof setTimeout> | null = null;

  // Timestamps for cleanup
  createdAt: number = Date.now();
  lastActivityAt: number = Date.now();

  constructor(io: Server, roomId: string, config?: Partial<RoomConfig>) {
    this.io = io;
    this.roomId = roomId;
    this.config = { ...DEFAULT_ROOM_CONFIG, ...config };
    this.allCritters = loadCritters();
    this.cardPool = generateCardPool();
  }

  get playerCount(): number {
    return this.players.size;
  }

  get humanPlayerCount(): number {
    let count = 0;
    for (const p of this.players.values()) {
      if (!p.isAI) count++;
    }
    return count;
  }

  get inGame(): boolean {
    return this.state !== null;
  }

  get isEmpty(): boolean {
    for (const p of this.players.values()) {
      if (!p.isAI && p.isConnected) return false;
    }
    return true;
  }

  getLobbyPlayers(): LobbyPlayer[] {
    return Array.from(this.players.values()).map((p) => ({
      id: p.playerId,
      name: p.playerName,
      ready: p.isReady,
      isAI: p.isAI,
      isConnected: p.isConnected,
    }));
  }

  addPlayer(playerId: string, playerName: string, socket: Socket, reconnectToken: string): boolean {
    if (this.players.size >= this.config.maxPlayers) return false;
    if (this.inGame) return false;

    this.players.set(playerId, {
      playerId,
      playerName,
      socket,
      reconnectToken,
      isConnected: true,
      isReady: false,
      isAI: false,
      disconnectTimer: null,
    });

    socket.join(this.roomId);
    this.lastActivityAt = Date.now();
    this.broadcastLobbyUpdate();
    return true;
  }

  removePlayer(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player) return;

    if (player.socket) {
      player.socket.leave(this.roomId);
    }
    if (player.disconnectTimer) {
      clearTimeout(player.disconnectTimer);
    }
    this.players.delete(playerId);
    this.lastActivityAt = Date.now();

    if (!this.inGame) {
      this.broadcastLobbyUpdate();
    }
  }

  handleDisconnect(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player) return;

    player.isConnected = false;
    player.socket = null;
    this.lastActivityAt = Date.now();

    if (this.inGame) {
      this.broadcast({ type: 'player-disconnected', playerId });
      // Start reconnect timer - if they don't come back, replace with AI
      player.disconnectTimer = setTimeout(() => {
        this.replaceWithAI(playerId);
      }, 5 * 60 * 1000);
    } else {
      this.removePlayer(playerId);
    }
  }

  handleReconnect(playerId: string, socket: Socket, token: string): boolean {
    const player = this.players.get(playerId);
    if (!player || player.reconnectToken !== token) return false;

    if (player.disconnectTimer) {
      clearTimeout(player.disconnectTimer);
      player.disconnectTimer = null;
    }

    player.socket = socket;
    player.isConnected = true;
    socket.join(this.roomId);
    this.lastActivityAt = Date.now();

    this.broadcast({ type: 'player-reconnected', playerId });
    // Send full state to reconnected player
    if (this.state) {
      this.sendToPlayer(playerId, {
        type: 'game-state',
        state: this.getSanitizedState(playerId),
      });
    }
    return true;
  }

  setReady(playerId: string, ready: boolean): void {
    const player = this.players.get(playerId);
    if (!player || this.inGame) return;

    player.isReady = ready;
    this.lastActivityAt = Date.now();
    this.broadcastLobbyUpdate();

    // Check if all players are ready
    if (this.shouldStartGame()) {
      this.startGame();
    }
  }

  private shouldStartGame(): boolean {
    if (this.players.size < 2) return false;
    for (const p of this.players.values()) {
      if (!p.isAI && !p.isReady) return false;
    }
    return true;
  }

  private startGame(): void {
    // Fill remaining slots with AI if needed
    while (this.players.size < this.config.maxPlayers) {
      const aiIndex = this.players.size;
      const aiId = `ai_${aiIndex}`;
      this.players.set(aiId, {
        playerId: aiId,
        playerName: `Bot ${['Alpha', 'Beta', 'Gamma', 'Delta'][aiIndex] || aiIndex}`,
        socket: null,
        reconnectToken: '',
        isConnected: true,
        isReady: true,
        isAI: true,
        disconnectTimer: null,
      });
    }

    // Create tournament state
    const playerStates: PlayerState[] = [];
    for (const p of this.players.values()) {
      const ps: PlayerState = {
        id: p.playerId,
        name: p.playerName,
        isHuman: !p.isAI,
        morale: STARTING_MORALE,
        resources: 0,
        reels: [],
        reelHeight: INITIAL_REEL_HEIGHT,
        critters: [],
        activeCritLines: 1,
        battlesCompleted: 0,
        personality: p.isAI ? (['aggressive', 'defensive', 'balanced'] as const)[Math.floor(Math.random() * 3)] : undefined,
      };
      playerStates.push(ps);
    }

    this.state = {
      phase: 'critter-select',
      round: 1,
      battleInRound: 0,
      players: playerStates,
      humanPlayerId: '', // Not used in multiplayer
      currentBattle: null,
      cardPool: this.cardPool,
      matchHistory: [],
      eliminationOrder: [],
      shopPack: null,
      draftPacks: null,
      currentDraftPack: 0,
      pendingPlacement: null,
    };

    this.crittersSelected.clear();
    this.broadcastGameState();

    // AI selects critters immediately
    this.runAICritterSelection();
  }

  // ---- Critter Selection ----

  handleSelectCritters(playerId: string, critterIds: string[], columnPlacements: number[]): void {
    if (!this.state || this.state.phase !== 'critter-select') {
      this.sendError(playerId, 'INVALID_ACTION', 'Not in critter selection phase');
      return;
    }
    if (this.crittersSelected.has(playerId)) {
      this.sendError(playerId, 'INVALID_ACTION', 'Already selected critters');
      return;
    }
    if (critterIds.length !== 3 || columnPlacements.length !== 3) {
      this.sendError(playerId, 'INVALID_ACTION', 'Must select exactly 3 critters');
      return;
    }

    const player = this.state.players.find((p) => p.id === playerId);
    if (!player) return;

    // Initialize reels
    player.reels = [];
    for (let row = 0; row < player.reelHeight; row++) {
      player.reels[row] = [];
      for (let col = 0; col < REEL_WIDTH; col++) {
        player.reels[row][col] = { row, col, card: null };
      }
    }

    // Place critters
    player.critters = [];
    for (let i = 0; i < critterIds.length; i++) {
      const def = this.allCritters.find((c) => c.cardId === critterIds[i]);
      if (!def) {
        this.sendError(playerId, 'INVALID_ACTION', `Critter ${critterIds[i]} not found`);
        return;
      }
      const instance = createCardInstance(def);
      player.critters.push(instance);
      player.reels[0][columnPlacements[i]].card = instance;
    }

    this.crittersSelected.add(playerId);
    this.lastActivityAt = Date.now();
    this.broadcastGameState();

    // Check if all players have selected
    if (this.allPlayersCompleted(this.crittersSelected)) {
      this.startDraftPhase();
    }
  }

  private runAICritterSelection(): void {
    for (const p of this.players.values()) {
      if (!p.isAI) continue;
      const playerState = this.state!.players.find((ps) => ps.id === p.playerId);
      if (!playerState) continue;

      setTimeout(() => {
        const picks = aiSelectCritters(playerState, this.allCritters);
        aiPlaceCritters(playerState, picks);
        this.crittersSelected.add(p.playerId);

        if (this.allPlayersCompleted(this.crittersSelected)) {
          this.startDraftPhase();
        }
      }, AI_ACTION_DELAY_MS);
    }
  }

  // ---- Draft Phase ----

  private startDraftPhase(): void {
    if (!this.state) return;
    this.state.phase = 'initial-draft';
    this.draftComplete.clear();

    // Generate draft packs per player
    for (const p of this.players.values()) {
      const packs = generateDraftPacks(this.cardPool, INITIAL_DRAFT_COMMON, INITIAL_DRAFT_UNCOMMON);
      this.playerDraftPacks.set(p.playerId, packs);
      this.playerDraftIndex.set(p.playerId, 0);
    }

    this.broadcastGameState();

    // AI does draft
    this.runAIDraft();
  }

  handleDraftPick(playerId: string, cardIndex: number, column: number): void {
    if (!this.state || this.state.phase !== 'initial-draft') {
      this.sendError(playerId, 'INVALID_ACTION', 'Not in draft phase');
      return;
    }
    if (this.draftComplete.has(playerId)) {
      this.sendError(playerId, 'INVALID_ACTION', 'Draft already complete');
      return;
    }

    const packs = this.playerDraftPacks.get(playerId);
    const packIdx = this.playerDraftIndex.get(playerId) ?? 0;
    if (!packs || packIdx >= packs.length) {
      this.sendError(playerId, 'INVALID_ACTION', 'No more packs');
      return;
    }

    const currentPack = packs[packIdx];
    if (cardIndex < 0 || cardIndex >= currentPack.length) {
      this.sendError(playerId, 'INVALID_ACTION', 'Invalid card index');
      return;
    }
    if (column < 0 || column >= REEL_WIDTH) {
      this.sendError(playerId, 'INVALID_PLACEMENT', 'Invalid column');
      return;
    }

    const player = this.state.players.find((p) => p.id === playerId);
    if (!player) return;

    const pickedDef = currentPack[cardIndex];
    const instance = createCardInstance(pickedDef);

    // Find first empty row in column
    for (let row = 0; row < player.reelHeight; row++) {
      if (!player.reels[row][column].card) {
        player.reels[row][column].card = instance;
        break;
      }
    }

    const newIdx = packIdx + 1;
    this.playerDraftIndex.set(playerId, newIdx);
    this.lastActivityAt = Date.now();

    // Check if this player's draft is complete
    if (newIdx >= packs.length) {
      // Fill remaining with junk
      for (let row = 0; row < player.reelHeight; row++) {
        for (let col = 0; col < REEL_WIDTH; col++) {
          if (!player.reels[row][col].card) {
            player.reels[row][col].card = createCardInstance(JUNK_CARD);
          }
        }
      }
      this.draftComplete.add(playerId);
    }

    this.sendToPlayer(playerId, {
      type: 'game-state',
      state: this.getSanitizedState(playerId),
    });

    // Check if all players done
    if (this.allPlayersCompleted(this.draftComplete)) {
      this.startBattlePhase();
    }
  }

  private runAIDraft(): void {
    for (const p of this.players.values()) {
      if (!p.isAI) continue;
      const playerState = this.state!.players.find((ps) => ps.id === p.playerId);
      if (!playerState) continue;

      const packs = this.playerDraftPacks.get(p.playerId);
      if (!packs) continue;

      setTimeout(() => {
        for (const pack of packs) {
          const pick = aiDraftPick(playerState, pack);
          aiPlaceCard(playerState, pick);
        }
        aiFillWithJunk(playerState);
        this.draftComplete.add(p.playerId);

        if (this.allPlayersCompleted(this.draftComplete)) {
          this.startBattlePhase();
        }
      }, AI_ACTION_DELAY_MS);
    }
  }

  // ---- Battle Phase ----

  private startBattlePhase(): void {
    if (!this.state) return;

    const alive = this.state.players.filter((p) => p.morale > 0);
    if (alive.length <= 1) {
      this.endGame();
      return;
    }

    // For 2-player: they always fight each other
    const p1 = alive[0];
    const p2 = alive[1];
    if (!p1 || !p2) {
      this.endGame();
      return;
    }

    this.state.phase = 'battle';
    this.state.currentBattle = initBattle(p1, p2);
    this.spinReady.clear();
    if (this.spinTimer) {
      clearTimeout(this.spinTimer);
      this.spinTimer = null;
    }

    this.broadcastGameState();
    this.sendWaitingForSpin();

    // If both players are AI, auto-run the battle
    if (this.isPlayerAI(p1.id) && this.isPlayerAI(p2.id)) {
      this.autoRunAIBattle();
    }
  }

  handleRequestSpin(playerId: string): void {
    if (!this.state || this.state.phase !== 'battle' || !this.state.currentBattle) {
      this.sendError(playerId, 'INVALID_ACTION', 'Not in battle phase');
      return;
    }
    if (this.state.currentBattle.isComplete) {
      this.sendError(playerId, 'INVALID_ACTION', 'Battle is complete');
      return;
    }

    // Check this player is in the battle
    const battle = this.state.currentBattle;
    if (playerId !== battle.player1.id && playerId !== battle.player2.id) {
      this.sendError(playerId, 'INVALID_ACTION', 'Not in this battle');
      return;
    }

    this.spinReady.add(playerId);
    this.lastActivityAt = Date.now();

    const p1Id = battle.player1.id;
    const p2Id = battle.player2.id;
    const bothReady = this.spinReady.has(p1Id) && this.spinReady.has(p2Id);

    if (bothReady) {
      this.resolveSpinAndBroadcast();
    } else {
      // Start the 3-second auto-spin timer
      if (!this.spinTimer) {
        this.spinTimer = setTimeout(() => {
          this.resolveSpinAndBroadcast();
        }, SPIN_READY_TIMEOUT_MS);
      }

      // Let players know who we're waiting for
      this.sendWaitingForSpin();
    }
  }

  private resolveSpinAndBroadcast(): void {
    if (!this.state?.currentBattle || this.state.currentBattle.isComplete) return;

    if (this.spinTimer) {
      clearTimeout(this.spinTimer);
      this.spinTimer = null;
    }

    executeSpin(this.state.currentBattle);
    this.spinReady.clear();

    const events = this.state.currentBattle.events ?? [];

    // Send battle events to all players
    this.broadcast({ type: 'battle-events', events });
    this.broadcastGameState();

    if (this.state.currentBattle.isComplete) {
      // Battle is over - apply results after a short delay
      setTimeout(() => {
        this.finishCurrentBattle();
      }, 1500);
    } else {
      // Wait for next spin
      this.sendWaitingForSpin();

      // Auto-spin for AI players
      const battle = this.state.currentBattle;
      if (this.isPlayerAI(battle.player1.id)) {
        setTimeout(() => this.handleRequestSpin(battle.player1.id), AI_ACTION_DELAY_MS);
      }
      if (this.isPlayerAI(battle.player2.id)) {
        setTimeout(() => this.handleRequestSpin(battle.player2.id), AI_ACTION_DELAY_MS);
      }
    }
  }

  private sendWaitingForSpin(): void {
    if (!this.state?.currentBattle) return;
    const battle = this.state.currentBattle;
    const waiting: string[] = [];
    if (!this.spinReady.has(battle.player1.id)) waiting.push(battle.player1.id);
    if (!this.spinReady.has(battle.player2.id)) waiting.push(battle.player2.id);

    this.broadcast({
      type: 'waiting-for',
      playerIds: waiting,
      action: 'request-spin',
      timeoutMs: this.spinTimer ? SPIN_READY_TIMEOUT_MS : undefined,
    });
  }

  private autoRunAIBattle(): void {
    if (!this.state?.currentBattle) return;
    const battle = this.state.currentBattle;
    // Both are AI - just spin until done
    setTimeout(() => {
      this.handleRequestSpin(battle.player1.id);
      this.handleRequestSpin(battle.player2.id);
    }, AI_ACTION_DELAY_MS);
  }

  private finishCurrentBattle(): void {
    if (!this.state?.currentBattle) return;

    applyBattleResult(this.state.currentBattle);

    const battle = this.state.currentBattle;
    this.state.matchHistory.push({
      p1: battle.player1.id,
      p2: battle.player2.id,
      winner: battle.winnerId || '',
    });

    // Check eliminations
    for (const player of this.state.players) {
      if (player.morale <= 0 && !this.state.eliminationOrder.includes(player.id)) {
        this.state.eliminationOrder.push(player.id);
      }
    }

    // Check game over
    const alive = this.state.players.filter((p) => p.morale > 0);
    if (alive.length <= 1) {
      this.endGame();
      return;
    }

    // Revive all cards
    for (const player of this.state.players) {
      reviveAllCards(player);
    }

    // Process evolution
    for (const player of this.state.players) {
      this.processEvolution(player);
    }

    this.state.battleInRound++;

    // Grow reel height every other battle for each player
    for (const player of this.state.players) {
      player.battlesCompleted++;
      if (player.battlesCompleted % 2 === 0 && player.reelHeight < MAX_REEL_HEIGHT) {
        player.reelHeight++;
        const newRow = player.reelHeight - 1;
        player.reels[newRow] = [];
        for (let col = 0; col < REEL_WIDTH; col++) {
          player.reels[newRow][col] = { row: newRow, col, card: createCardInstance(JUNK_CARD) };
        }
      }
    }

    this.state.currentBattle = null;

    // Move to shop phase
    this.startShopPhase();
  }

  // ---- Shop Phase ----

  private startShopPhase(): void {
    if (!this.state) return;
    this.state.phase = 'shop';
    this.shopComplete.clear();

    // Generate shop packs per player
    for (const player of this.state.players) {
      if (player.morale <= 0) continue;
      const pack: ShopPack = {
        cards: generateShopPack(this.cardPool, this.state.round),
      };
      this.playerShopPacks.set(player.id, pack);
    }

    this.broadcastGameState();

    // AI does shopping
    this.runAIShopping();
  }

  handleShopBuy(playerId: string, cardIndex: number, column: number): void {
    if (!this.state || this.state.phase !== 'shop') {
      this.sendError(playerId, 'INVALID_ACTION', 'Not in shop phase');
      return;
    }

    const pack = this.playerShopPacks.get(playerId);
    if (!pack) {
      this.sendError(playerId, 'INVALID_ACTION', 'No shop pack');
      return;
    }

    const player = this.state.players.find((p) => p.id === playerId);
    if (!player) return;

    if (cardIndex < 0 || cardIndex >= pack.cards.length) {
      this.sendError(playerId, 'INVALID_ACTION', 'Invalid card index');
      return;
    }
    if (column < 0 || column >= REEL_WIDTH) {
      this.sendError(playerId, 'INVALID_PLACEMENT', 'Invalid column');
      return;
    }

    const card = pack.cards[cardIndex];
    const cost = SHOP_COST[card.rarity] || 2;
    if (player.resources < cost) {
      this.sendError(playerId, 'INSUFFICIENT_RESOURCES', 'Not enough resources');
      return;
    }

    player.resources -= cost;
    const instance = createCardInstance(card);

    // Place in first empty row, or replace junk
    let placed = false;
    for (let row = 0; row < player.reelHeight; row++) {
      if (!player.reels[row][column].card) {
        player.reels[row][column].card = instance;
        placed = true;
        break;
      }
    }
    if (!placed) {
      for (let row = player.reelHeight - 1; row >= 0; row--) {
        const existing = player.reels[row][column].card;
        if (existing && existing.category === 'Junk') {
          player.reels[row][column].card = instance;
          placed = true;
          break;
        }
      }
    }

    this.playerShopPacks.delete(playerId);
    this.shopComplete.add(playerId);
    this.lastActivityAt = Date.now();

    this.sendToPlayer(playerId, {
      type: 'game-state',
      state: this.getSanitizedState(playerId),
    });

    if (this.allPlayersCompleted(this.shopComplete)) {
      this.advanceRound();
    }
  }

  handleShopReroll(playerId: string): void {
    if (!this.state || this.state.phase !== 'shop') {
      this.sendError(playerId, 'INVALID_ACTION', 'Not in shop phase');
      return;
    }

    const player = this.state.players.find((p) => p.id === playerId);
    if (!player || player.resources < 2) {
      this.sendError(playerId, 'INSUFFICIENT_RESOURCES', 'Need 2 resources to reroll');
      return;
    }

    player.resources -= 2;
    const pack: ShopPack = { cards: generateShopPack(this.cardPool, this.state.round) };
    this.playerShopPacks.set(playerId, pack);
    this.lastActivityAt = Date.now();

    this.sendToPlayer(playerId, {
      type: 'game-state',
      state: this.getSanitizedState(playerId),
    });
  }

  handleShopSkip(playerId: string): void {
    if (!this.state || this.state.phase !== 'shop') {
      this.sendError(playerId, 'INVALID_ACTION', 'Not in shop phase');
      return;
    }

    this.playerShopPacks.delete(playerId);
    this.shopComplete.add(playerId);
    this.lastActivityAt = Date.now();

    this.sendToPlayer(playerId, {
      type: 'game-state',
      state: this.getSanitizedState(playerId),
    });

    if (this.allPlayersCompleted(this.shopComplete)) {
      this.advanceRound();
    }
  }

  private runAIShopping(): void {
    for (const p of this.players.values()) {
      if (!p.isAI) continue;
      const playerState = this.state!.players.find((ps) => ps.id === p.playerId);
      if (!playerState || playerState.morale <= 0) continue;

      const pack = this.playerShopPacks.get(p.playerId);
      if (!pack) continue;

      setTimeout(() => {
        const decision = aiShopDecision(playerState, pack.cards);
        if (decision.action === 'buy') {
          const card = pack.cards[decision.index];
          const cost = SHOP_COST[card.rarity] || 2;
          if (playerState.resources >= cost) {
            playerState.resources -= cost;
            aiPlaceCard(playerState, card);
          }
        }
        this.playerShopPacks.delete(p.playerId);
        this.shopComplete.add(p.playerId);

        if (this.allPlayersCompleted(this.shopComplete)) {
          this.advanceRound();
        }
      }, AI_ACTION_DELAY_MS);
    }
  }

  private advanceRound(): void {
    if (!this.state) return;
    this.state.round++;
    this.startBattlePhase();
  }

  // ---- End Game ----

  private endGame(): void {
    if (!this.state) return;
    this.state.phase = 'game-over';
    this.state.currentBattle = null;
    this.broadcastGameState();
  }

  // ---- Utilities ----

  private processEvolution(player: PlayerState): void {
    for (const critter of player.critters) {
      if (critter.level >= 5) continue;
      const nextLevel = EVOLUTION_TABLE[critter.level];
      if (!nextLevel) continue;
      if (critter.xp >= nextLevel.xpRequired) {
        const healthIncrease = nextLevel.healthBonus - (critter.level > 1 ? EVOLUTION_TABLE[critter.level - 1].healthBonus : 0);
        const attackIncrease = nextLevel.attackBonus - (critter.level > 1 ? EVOLUTION_TABLE[critter.level - 1].attackBonus : 0);
        critter.level++;
        critter.maxHealth += healthIncrease;
        critter.currentHealth += healthIncrease;
        critter.baseAttack += attackIncrease;
        critter.currentAttack = critter.baseAttack;
      }
    }
  }

  private allPlayersCompleted(completed: Set<string>): boolean {
    for (const p of this.players.values()) {
      if (!completed.has(p.playerId)) return false;
    }
    return true;
  }

  private isPlayerAI(playerId: string): boolean {
    const p = this.players.get(playerId);
    return p ? p.isAI : false;
  }

  private replaceWithAI(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player) return;
    player.isAI = true;
    player.isConnected = true;

    // If it's this player's turn, auto-act
    if (this.state) {
      if (this.state.phase === 'battle' && this.state.currentBattle) {
        // Auto-spin for this player
        if (!this.spinReady.has(playerId)) {
          this.handleRequestSpin(playerId);
        }
      }
    }
  }

  private getSanitizedState(playerId: string): SanitizedGameState {
    return sanitizeStateForPlayer(
      this.state!,
      playerId,
      this.playerDraftPacks,
      this.playerDraftIndex,
      this.playerShopPacks,
    );
  }

  private sendToPlayer(playerId: string, message: ServerMessage): void {
    const player = this.players.get(playerId);
    if (player?.socket && player.isConnected) {
      player.socket.emit('message', message);
    }
  }

  private sendError(playerId: string, code: import('./shared/protocol.ts').ErrorCode, message: string): void {
    this.sendToPlayer(playerId, { type: 'error', code, message });
  }

  private broadcast(message: ServerMessage): void {
    for (const p of this.players.values()) {
      if (p.socket && p.isConnected && !p.isAI) {
        p.socket.emit('message', message);
      }
    }
  }

  private broadcastGameState(): void {
    if (!this.state) return;
    for (const p of this.players.values()) {
      if (p.socket && p.isConnected && !p.isAI) {
        this.sendToPlayer(p.playerId, {
          type: 'game-state',
          state: this.getSanitizedState(p.playerId),
        });
      }
    }
  }

  private broadcastLobbyUpdate(): void {
    this.broadcast({ type: 'room-updated', players: this.getLobbyPlayers() });
  }

  handleMessage(playerId: string, message: ClientMessage): void {
    this.lastActivityAt = Date.now();

    switch (message.type) {
      case 'set-ready':
        this.setReady(playerId, message.ready);
        break;
      case 'select-critters':
        this.handleSelectCritters(playerId, message.critterIds, message.columnPlacements);
        break;
      case 'draft-pick':
        this.handleDraftPick(playerId, message.cardIndex, message.column);
        break;
      case 'request-spin':
        this.handleRequestSpin(playerId);
        break;
      case 'shop-buy':
        this.handleShopBuy(playerId, message.cardIndex, message.column);
        break;
      case 'shop-reroll':
        this.handleShopReroll(playerId);
        break;
      case 'shop-skip':
        this.handleShopSkip(playerId);
        break;
      default:
        this.sendError(playerId, 'INVALID_ACTION', `Unknown action: ${(message as any).type}`);
    }
  }
}
