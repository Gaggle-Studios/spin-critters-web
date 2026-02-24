import { useRef, useState, useCallback, useEffect } from 'react';
import type { BattleEvent } from '../engine/types.ts';

function getEventDelay(event: BattleEvent): number {
  switch (event.type) {
    case 'spin-result': return 600;
    case 'attack': return 500;
    case 'thorns': return 400;
    case 'venomous': return 300;
    case 'poisonous': return 300;
    case 'crit-biome': return 800;
    case 'crit-archetype': return 800;
    case 'battle-end': return 1000;
    case 'phase-marker': return 400;
    case 'overtime-damage': return 400;
    case 'poison-damage': return 400;
    case 'ko': return 400;
    default: return 300;
  }
}

export interface AnimationQueueState {
  currentEvent: BattleEvent | null;
  eventIndex: number;
  isAnimating: boolean;
}

export function useAnimationQueue(onComplete: () => void) {
  const [state, setState] = useState<AnimationQueueState>({
    currentEvent: null,
    eventIndex: -1,
    isAnimating: false,
  });

  const eventsRef = useRef<BattleEvent[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const cleanup = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const finish = useCallback(() => {
    cleanup();
    eventsRef.current = [];
    setState({ currentEvent: null, eventIndex: -1, isAnimating: false });
    onCompleteRef.current();
  }, [cleanup]);

  const stepNext = useCallback((index: number) => {
    const events = eventsRef.current;
    if (index >= events.length) {
      finish();
      return;
    }
    const event = events[index];
    setState({ currentEvent: event, eventIndex: index, isAnimating: true });
    timerRef.current = setTimeout(() => {
      stepNext(index + 1);
    }, getEventDelay(event));
  }, [finish]);

  const startAnimation = useCallback((events: BattleEvent[]) => {
    cleanup();
    if (events.length === 0) {
      finish();
      return;
    }
    eventsRef.current = events;
    stepNext(0);
  }, [cleanup, finish, stepNext]);

  const skipAnimation = useCallback(() => {
    finish();
  }, [finish]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    currentEvent: state.currentEvent,
    eventIndex: state.eventIndex,
    isAnimating: state.isAnimating,
    startAnimation,
    skipAnimation,
  };
}
