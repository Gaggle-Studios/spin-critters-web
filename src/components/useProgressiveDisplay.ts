import { useMemo } from 'react';
import type { BattleEvent, CardInstance } from '../engine/types.ts';

interface CardOverride {
  health: number;
  maxHealth: number;
  isKO: boolean;
}

// Keyed by "playerId:col"
type DisplayState = Map<string, CardOverride>;

function key(playerId: string, col: number): string {
  return `${playerId}:${col}`;
}

/**
 * Walk events 0..upToIndex, initialize from spin-result, then apply
 * each damage/heal event to produce the HP values the UI should show
 * at this point in the animation.
 */
function computeDisplayState(events: BattleEvent[], upToIndex: number): DisplayState {
  const state: DisplayState = new Map();

  for (let i = 0; i <= upToIndex && i < events.length; i++) {
    const e = events[i];

    switch (e.type) {
      case 'spin-result': {
        for (const card of e.player1Active) {
          state.set(key(e.player1Id, card.col), {
            health: card.health,
            maxHealth: card.maxHealth,
            isKO: false,
          });
        }
        for (const card of e.player2Active) {
          state.set(key(e.player2Id, card.col), {
            health: card.health,
            maxHealth: card.maxHealth,
            isKO: false,
          });
        }
        break;
      }

      case 'attack': {
        const k = key(e.defenderPlayerId, e.defenderCol);
        const cur = state.get(k);
        if (cur) {
          state.set(k, { ...cur, health: e.defenderNewHealth, isKO: e.defenderIsKO });
        }
        break;
      }

      case 'thorns': {
        const k = key(e.playerId, e.col);
        const cur = state.get(k);
        if (cur) {
          state.set(k, { ...cur, health: e.newHealth, isKO: e.isKO });
        }
        break;
      }

      case 'poison-damage': {
        const k = key(e.playerId, e.col);
        const cur = state.get(k);
        if (cur) {
          state.set(k, { ...cur, health: e.newHealth, isKO: e.isKO });
        }
        break;
      }

      case 'overtime-damage': {
        const k = key(e.playerId, e.col);
        const cur = state.get(k);
        if (cur) {
          state.set(k, { ...cur, health: e.newHealth, isKO: e.isKO });
        }
        break;
      }

      case 'regenerate': {
        const k = key(e.playerId, e.col);
        const cur = state.get(k);
        if (cur) {
          state.set(k, { ...cur, health: e.newHealth });
        }
        break;
      }

      case 'healing': {
        const k = key(e.playerId, e.targetCol);
        const cur = state.get(k);
        if (cur) {
          state.set(k, { ...cur, health: e.targetNewHealth });
        }
        break;
      }
    }
  }

  return state;
}

/**
 * During animation, returns card overrides so HP values update progressively
 * as events play. When not animating, returns the real cards unchanged.
 */
export function useProgressiveDisplay(
  isAnimating: boolean,
  events: BattleEvent[],
  eventIndex: number,
) {
  const displayState = useMemo(() => {
    if (!isAnimating || eventIndex < 0) return null;
    return computeDisplayState(events, eventIndex);
  }, [isAnimating, events, eventIndex]);

  /**
   * Returns a card with HP overridden to match the current animation frame,
   * or the real card if not animating.
   */
  function getDisplayCard(
    playerId: string,
    col: number,
    realCard: CardInstance | null,
  ): CardInstance | null {
    if (!realCard || !displayState) return realCard;

    const override = displayState.get(key(playerId, col));
    if (!override) return realCard;

    // Only clone if values actually differ
    if (
      realCard.currentHealth === override.health &&
      realCard.isKO === override.isKO
    ) {
      return realCard;
    }

    return {
      ...realCard,
      currentHealth: override.health,
      isKO: override.isKO,
    };
  }

  return { getDisplayCard };
}
