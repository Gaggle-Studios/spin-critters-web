import { useEffect, useRef } from 'react';
import type { BattleEvent, BattlePhase } from '../engine/types.ts';
import { playSfx } from './sfx.ts';

/**
 * Plays sound effects in response to battle animation events.
 * Tracks the current attack phase so fast/regular/slow attacks
 * each have distinct audio cues.
 */
export function useBattleSounds(currentEvent: BattleEvent | null): void {
  const prevEventRef = useRef<BattleEvent | null>(null);
  const currentPhaseRef = useRef<BattlePhase>('regular-attack');

  useEffect(() => {
    if (!currentEvent || currentEvent === prevEventRef.current) return;
    prevEventRef.current = currentEvent;

    switch (currentEvent.type) {
      case 'spin-result':
        playSfx('spin');
        break;

      case 'phase-marker':
        // Track the current attack phase for routing attack sounds
        if (
          currentEvent.phase === 'fast-attack' ||
          currentEvent.phase === 'regular-attack' ||
          currentEvent.phase === 'slow-attack'
        ) {
          currentPhaseRef.current = currentEvent.phase;
        }
        break;

      case 'attack': {
        const big = currentEvent.damage >= 15;
        const phase = currentPhaseRef.current;
        if (phase === 'fast-attack') {
          playSfx(big ? 'bigHitFast' : 'attackFast');
        } else if (phase === 'slow-attack') {
          playSfx(big ? 'bigHitSlow' : 'attackSlow');
        } else {
          playSfx(big ? 'bigHit' : 'attack');
        }
        break;
      }

      case 'ko':
        playSfx('ko');
        break;

      case 'crit-biome':
        playSfx('critBiome');
        break;

      case 'crit-archetype':
        playSfx('critArchetype');
        break;

      case 'thorns':
        playSfx('thorns');
        break;

      case 'regenerate':
      case 'healing':
        playSfx('heal');
        break;

      case 'poison-damage':
      case 'venomous':
      case 'poisonous':
        playSfx('poison');
        break;

      case 'overtime-damage':
        playSfx('overtime');
        break;

      case 'battle-end':
        // Delay slightly so it doesn't overlap with final attack sounds
        setTimeout(() => {
          if (currentEvent.type === 'battle-end') {
            playSfx(currentEvent.winnerId ? 'victory' : 'defeat');
          }
        }, 300);
        break;

      case 'resource-grant':
      case 'produce':
      case 'junk-resource':
        playSfx('resource');
        break;

      case 'column-locked':
        playSfx('ko');
        break;
    }
  }, [currentEvent]);
}
