import { create } from 'zustand';
import type { TournamentState, CardDefinition, BattleEvent, GamePhase } from '../engine/types.ts';
import {
  createInitialState,
  getAllCritters,
  humanSelectCritters,
  humanDraftPick,
  advanceSpin,
  finishBattle,
  shopBuy,
  shopReroll,
  shopSkip,
} from '../engine/gameState.ts';
import { socketManager, type ConnectionStatus } from '../networking/SocketManager.ts';
import type { ServerMessage, LobbyPlayer, SanitizedGameState } from '../shared/protocol.ts';

type AppMode = 'menu' | 'singleplayer' | 'multiplayer';

interface GameStore {
  // Mode
  mode: AppMode;

  // Single-player state (used when mode === 'singleplayer')
  tournament: TournamentState;
  allCritters: CardDefinition[];
  pendingEvents: BattleEvent[];
  isAnimating: boolean;

  // Multiplayer state (used when mode === 'multiplayer')
  connectionStatus: ConnectionStatus;
  playerId: string | null;
  roomId: string | null;
  lobbyPlayers: LobbyPlayer[];
  multiplayerState: SanitizedGameState | null;
  waitingFor: { playerIds: string[]; action: string; timeoutMs?: number } | null;
  serverError: string | null;

  // Mode actions
  goToMenu: () => void;
  startSinglePlayer: () => void;
  startMultiplayer: () => void;

  // Single-player actions
  initGame: () => void;
  selectCritters: (critterIds: string[], columns: number[]) => void;
  draftPick: (cardIndex: number, column: number) => void;
  spin: () => void;
  endBattle: () => void;
  buyCard: (cardIndex: number, column: number) => void;
  rerollShop: () => void;
  skipShop: () => void;
  playAgain: () => void;
  finishAnimation: () => void;

  // Multiplayer actions
  createRoom: (playerName: string) => void;
  joinRoom: (roomId: string, playerName: string) => void;
  leaveRoom: () => void;
  setReady: (ready: boolean) => void;
  mpSelectCritters: (critterIds: string[], columns: number[]) => void;
  mpDraftPick: (cardIndex: number, column: number) => void;
  mpSpin: () => void;
  mpBuyCard: (cardIndex: number, column: number) => void;
  mpRerollShop: () => void;
  mpSkipShop: () => void;
}

export const useGameStore = create<GameStore>((set, get) => {
  // Set up socket message handler
  let unsubMessage: (() => void) | null = null;
  let unsubStatus: (() => void) | null = null;

  function setupSocketListeners() {
    if (unsubMessage) unsubMessage();
    if (unsubStatus) unsubStatus();

    unsubMessage = socketManager.onMessage((msg: ServerMessage) => {
      handleServerMessage(msg);
    });

    unsubStatus = socketManager.onStatusChange((status: ConnectionStatus) => {
      set({ connectionStatus: status });
    });
  }

  function handleServerMessage(msg: ServerMessage) {
    switch (msg.type) {
      case 'connected':
        set({
          playerId: msg.playerId,
          connectionStatus: 'connected',
        });
        break;

      case 'room-created':
        set({ roomId: msg.roomId });
        break;

      case 'room-joined':
        set({
          roomId: msg.roomId,
          lobbyPlayers: msg.players,
        });
        break;

      case 'room-updated':
        set({ lobbyPlayers: msg.players });
        break;

      case 'game-state':
        set({
          multiplayerState: msg.state,
          serverError: null,
        });
        break;

      case 'battle-events':
        set({
          pendingEvents: [...msg.events],
          isAnimating: msg.events.length > 0,
        });
        break;

      case 'phase-change':
        set({ multiplayerState: msg.state });
        break;

      case 'waiting-for':
        set({
          waitingFor: {
            playerIds: msg.playerIds,
            action: msg.action,
            timeoutMs: msg.timeoutMs,
          },
        });
        break;

      case 'error':
        console.error(`[Server Error] ${msg.code}: ${msg.message}`);
        set({ serverError: `${msg.code}: ${msg.message}` });
        break;

      case 'player-disconnected':
        console.log(`Player disconnected: ${msg.playerId}`);
        break;

      case 'player-reconnected':
        console.log(`Player reconnected: ${msg.playerId}`);
        break;

      case 'room-list':
        // Could store this for a room browser
        break;
    }
  }

  return {
    // Default state
    mode: 'menu',
    tournament: createInitialState(),
    allCritters: getAllCritters(),
    pendingEvents: [],
    isAnimating: false,
    connectionStatus: 'disconnected',
    playerId: null,
    roomId: null,
    lobbyPlayers: [],
    multiplayerState: null,
    waitingFor: null,
    serverError: null,

    // Mode actions
    goToMenu: () => {
      socketManager.disconnect();
      set({
        mode: 'menu',
        roomId: null,
        lobbyPlayers: [],
        multiplayerState: null,
        waitingFor: null,
        serverError: null,
        connectionStatus: 'disconnected',
        playerId: null,
      });
    },

    startSinglePlayer: () => set({
      mode: 'singleplayer',
      tournament: createInitialState(),
      allCritters: getAllCritters(),
      pendingEvents: [],
      isAnimating: false,
    }),

    startMultiplayer: () => {
      setupSocketListeners();
      socketManager.connect();
      set({
        mode: 'multiplayer',
        connectionStatus: 'connecting',
        roomId: null,
        lobbyPlayers: [],
        multiplayerState: null,
        waitingFor: null,
        serverError: null,
      });
    },

    // ---- Single-player actions (unchanged) ----

    initGame: () => set({
      tournament: createInitialState(),
      allCritters: getAllCritters(),
      pendingEvents: [],
      isAnimating: false,
    }),

    selectCritters: (critterIds, columns) => set((s) => ({
      tournament: { ...humanSelectCritters(s.tournament, critterIds, columns) },
    })),

    draftPick: (cardIndex, column) => set((s) => ({
      tournament: { ...humanDraftPick(s.tournament, cardIndex, column) },
    })),

    spin: () => {
      if (get().isAnimating) return;
      const newTournament = { ...advanceSpin(get().tournament) };
      const events = newTournament.currentBattle?.events ?? [];
      set({
        tournament: newTournament,
        pendingEvents: [...events],
        isAnimating: events.length > 0,
      });
    },

    endBattle: () => set((s) => ({
      tournament: { ...finishBattle(s.tournament) },
      pendingEvents: [],
      isAnimating: false,
    })),

    buyCard: (cardIndex, column) => set((s) => ({
      tournament: { ...shopBuy(s.tournament, cardIndex, column) },
    })),

    rerollShop: () => set((s) => ({
      tournament: { ...shopReroll(s.tournament) },
    })),

    skipShop: () => set((s) => ({
      tournament: { ...shopSkip(s.tournament) },
    })),

    playAgain: () => {
      if (get().mode === 'multiplayer') {
        // In multiplayer, go back to menu
        socketManager.disconnect();
        set({
          mode: 'menu',
          roomId: null,
          lobbyPlayers: [],
          multiplayerState: null,
          waitingFor: null,
          serverError: null,
        });
      } else {
        set({
          tournament: createInitialState(),
          allCritters: getAllCritters(),
          pendingEvents: [],
          isAnimating: false,
        });
      }
    },

    finishAnimation: () => set({
      pendingEvents: [],
      isAnimating: false,
    }),

    // ---- Multiplayer actions ----

    createRoom: (playerName: string) => {
      socketManager.send({ type: 'create-room', playerName });
    },

    joinRoom: (roomId: string, playerName: string) => {
      socketManager.send({ type: 'join-room', roomId: roomId.toUpperCase(), playerName });
    },

    leaveRoom: () => {
      socketManager.send({ type: 'leave-room' });
      set({ roomId: null, lobbyPlayers: [], multiplayerState: null });
    },

    setReady: (ready: boolean) => {
      socketManager.send({ type: 'set-ready', ready });
    },

    mpSelectCritters: (critterIds: string[], columns: number[]) => {
      socketManager.send({ type: 'select-critters', critterIds, columnPlacements: columns });
    },

    mpDraftPick: (cardIndex: number, column: number) => {
      socketManager.send({ type: 'draft-pick', cardIndex, column });
    },

    mpSpin: () => {
      if (get().isAnimating) return;
      socketManager.send({ type: 'request-spin' });
    },

    mpBuyCard: (cardIndex: number, column: number) => {
      socketManager.send({ type: 'shop-buy', cardIndex, column });
    },

    mpRerollShop: () => {
      socketManager.send({ type: 'shop-reroll' });
    },

    mpSkipShop: () => {
      socketManager.send({ type: 'shop-skip' });
    },
  };
});
