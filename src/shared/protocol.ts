// Protocol types for client <-> server communication
// Both client and server import from this file

import type {
  TournamentState,
  PlayerState,
  CardDefinition,
  BattleEvent,
  BattleLogEntry,
  GamePhase,
  ShopPack,
  CardInstance,
  ReelSlot,
} from '../engine/types.ts';

// ---- Client -> Server Messages ----

export type ClientMessage =
  | { type: 'create-room'; playerName: string; config?: RoomConfig }
  | { type: 'join-room'; roomId: string; playerName: string }
  | { type: 'leave-room' }
  | { type: 'set-ready'; ready: boolean }
  | { type: 'select-critters'; critterIds: string[]; columnPlacements: number[] }
  | { type: 'draft-pick'; cardIndex: number; column: number }
  | { type: 'request-spin' }
  | { type: 'shop-buy'; cardIndex: number; column: number }
  | { type: 'shop-reroll' }
  | { type: 'shop-skip' }
  | { type: 'reconnect'; token: string; roomId: string };

// ---- Server -> Client Messages ----

export type ServerMessage =
  | { type: 'connected'; playerId: string; reconnectToken: string }
  | { type: 'error'; code: ErrorCode; message: string }
  | { type: 'room-created'; roomId: string }
  | { type: 'room-joined'; roomId: string; players: LobbyPlayer[] }
  | { type: 'room-updated'; players: LobbyPlayer[] }
  | { type: 'game-state'; state: SanitizedGameState }
  | { type: 'battle-events'; events: BattleEvent[] }
  | { type: 'phase-change'; phase: GamePhase; state: SanitizedGameState }
  | { type: 'waiting-for'; playerIds: string[]; action: string; timeoutMs?: number }
  | { type: 'player-disconnected'; playerId: string }
  | { type: 'player-reconnected'; playerId: string }
  | { type: 'room-list'; rooms: RoomInfo[] };

// ---- Error Codes ----

export type ErrorCode =
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'INVALID_ACTION'
  | 'NOT_YOUR_TURN'
  | 'INSUFFICIENT_RESOURCES'
  | 'INVALID_PLACEMENT'
  | 'GAME_NOT_STARTED'
  | 'RECONNECT_FAILED'
  | 'RATE_LIMITED'
  | 'ALREADY_IN_ROOM'
  | 'NAME_REQUIRED';

// ---- Lobby Types ----

export interface RoomConfig {
  maxPlayers: number;      // 2 for prototype
  aiSlots: number;         // Fill remaining with AI
  turnTimeoutMs: number;   // Default 60000
  isPrivate: boolean;
}

export const DEFAULT_ROOM_CONFIG: RoomConfig = {
  maxPlayers: 2,
  aiSlots: 0,
  turnTimeoutMs: 60000,
  isPrivate: false,
};

export interface LobbyPlayer {
  id: string;
  name: string;
  ready: boolean;
  isAI: boolean;
  isConnected: boolean;
}

export interface RoomInfo {
  roomId: string;
  playerCount: number;
  maxPlayers: number;
  inGame: boolean;
}

// ---- Sanitized Game State ----
// This is what the client receives - opponent reel details are hidden

export interface SanitizedPlayerState {
  id: string;
  name: string;
  isHuman: boolean;
  morale: number;
  resources: number;
  reelHeight: number;
  battlesCompleted: number;
  // For the viewing player: full reel data
  // For opponents: only column card counts
  reels: ReelSlot[][] | null;       // null for opponents (hidden)
  critters: CardInstance[] | null;   // null for opponents
  columnCardCounts: number[];        // Always present: living cards per column
  isYou: boolean;                    // Whether this is the viewing player
}

export interface SanitizedGameState {
  phase: GamePhase;
  round: number;
  battleInRound: number;
  players: SanitizedPlayerState[];
  currentBattle: {
    currentSpin: number;
    maxSpins: number;
    isComplete: boolean;
    winnerId: string | null;
    player1Id: string;
    player2Id: string;
    player1ActiveCards: (CardInstance | null)[];
    player2ActiveCards: (CardInstance | null)[];
    log: BattleLogEntry[];
    events: BattleEvent[];
  } | null;
  matchHistory: { p1: string; p2: string; winner: string }[];
  eliminationOrder: string[];
  // Per-player data (only your own)
  yourDraftPacks: CardDefinition[][] | null;
  currentDraftPack: number;
  yourShopPack: ShopPack | null;
  pendingPlacement: CardDefinition | null;
}

// ---- Spin Ready-Check ----
export const SPIN_AUTO_TIMEOUT_MS = 3000; // Auto-spin after 3 seconds
