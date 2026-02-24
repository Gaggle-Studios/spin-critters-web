import { create } from 'zustand';
import type { TournamentState, CardDefinition, BattleEvent } from '../engine/types.ts';
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

interface GameStore {
  tournament: TournamentState;
  allCritters: CardDefinition[];
  pendingEvents: BattleEvent[];
  isAnimating: boolean;

  // Actions
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
}

export const useGameStore = create<GameStore>((set, get) => ({
  tournament: createInitialState(),
  allCritters: getAllCritters(),
  pendingEvents: [],
  isAnimating: false,

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

  playAgain: () => set({
    tournament: createInitialState(),
    allCritters: getAllCritters(),
    pendingEvents: [],
    isAnimating: false,
  }),

  finishAnimation: () => set({
    pendingEvents: [],
    isAnimating: false,
  }),
}));
