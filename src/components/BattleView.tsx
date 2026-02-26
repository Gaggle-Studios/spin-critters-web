import { useEffect, useRef, useState, useCallback } from 'react';
import { useGameStore } from '../store/gameStore.ts';
import { ReelGrid } from './ReelGrid.tsx';
import { BattleLog } from './BattleLog.tsx';
import { REEL_WIDTH } from '../engine/constants.ts';
import { CardSlot } from './CardSlot.tsx';
import { ReelSpinner } from './ReelSpinner.tsx';
import { BattleEventOverlay, getCardEffects } from './BattleEventOverlay.tsx';
import { useAnimationQueue } from './useAnimationQueue.ts';
import { useProgressiveDisplay } from './useProgressiveDisplay.ts';
import { useBattleSounds } from '../audio/useBattleSounds.ts';
import { playSfx } from '../audio/sfx.ts';

export function BattleView() {
  const tournament = useGameStore((s) => s.tournament);
  const spinAction = useGameStore((s) => s.spin);
  const endBattle = useGameStore((s) => s.endBattle);
  const pendingEvents = useGameStore((s) => s.pendingEvents);
  const isStoreAnimating = useGameStore((s) => s.isAnimating);
  const finishAnimation = useGameStore((s) => s.finishAnimation);

  const { currentEvent, eventIndex, isAnimating, startAnimation, skipAnimation } = useAnimationQueue(finishAnimation);

  // Progressive HP display: cards show HP matching current animation frame
  const { getDisplayCard } = useProgressiveDisplay(isAnimating, pendingEvents, eventIndex);

  // Play sounds for battle events
  useBattleSounds(currentEvent);

  // Auto-battle state — reset when a new battle starts
  const [autoPlaying, setAutoPlaying] = useState(false);
  const autoPlayingRef = useRef(false);
  const battleIdRef = useRef(tournament.currentBattle?.player2?.id);
  if (tournament.currentBattle?.player2?.id !== battleIdRef.current) {
    battleIdRef.current = tournament.currentBattle?.player2?.id;
    if (autoPlaying) {
      setAutoPlaying(false);
      autoPlayingRef.current = false;
    }
  }

  // Keep ref in sync
  useEffect(() => {
    autoPlayingRef.current = autoPlaying;
  }, [autoPlaying]);

  // Start animation when new pending events arrive
  const prevEventsRef = useRef(pendingEvents);
  useEffect(() => {
    if (pendingEvents.length > 0 && pendingEvents !== prevEventsRef.current) {
      startAnimation(pendingEvents);
    }
    prevEventsRef.current = pendingEvents;
  }, [pendingEvents, startAnimation]);

  // Auto-play: when animation finishes and battle isn't complete, trigger next spin
  const prevAnimatingRef = useRef(isAnimating);
  useEffect(() => {
    const justFinished = prevAnimatingRef.current && !isAnimating && !isStoreAnimating;
    prevAnimatingRef.current = isAnimating;

    if (justFinished && autoPlayingRef.current) {
      const battle = useGameStore.getState().tournament.currentBattle;
      if (battle && !battle.isComplete) {
        // Small delay between spins so the player can see the board state
        const timer = setTimeout(() => {
          if (autoPlayingRef.current) {
            spinAction();
          }
        }, 600);
        return () => clearTimeout(timer);
      } else {
        setAutoPlaying(false);
      }
    }
  }, [isAnimating, isStoreAnimating, spinAction]);

  const handleGo = useCallback(() => {
    playSfx('battleStart');
    setAutoPlaying(true);
    autoPlayingRef.current = true;
    spinAction();
  }, [spinAction]);

  const handleSkipAll = useCallback(() => {
    setAutoPlaying(false);
    autoPlayingRef.current = false;
    skipAnimation();
    // Run all remaining spins instantly
    let safety = 100;
    while (safety-- > 0) {
      const state = useGameStore.getState().tournament;
      if (!state.currentBattle || state.currentBattle.isComplete) break;
      // Clear pending events before next spin
      useGameStore.getState().finishAnimation();
      useGameStore.getState().spin();
    }
    // Clear final animation
    useGameStore.getState().finishAnimation();
  }, [skipAnimation]);

  const battle = tournament.currentBattle;
  if (!battle) return <div style={{ padding: 20, color: '#eee' }}>No active battle.</div>;

  const human = battle.player1;
  const opponent = battle.player2;
  const humanId = tournament.humanPlayerId;

  const isSpinning = currentEvent?.type === 'spin-result';
  const { highlightCols, shakeCols } = getCardEffects(currentEvent, humanId);

  const getHighlight = (playerId: string, col: number): string | undefined => {
    const list = highlightCols.get(playerId);
    if (!list) return undefined;
    const entry = list.find((e) => e.col === col);
    return entry?.color;
  };

  const getShake = (playerId: string, col: number): boolean => {
    const list = shakeCols.get(playerId);
    if (!list) return false;
    return list.includes(col);
  };

  const spinDisabled = isAnimating || isStoreAnimating;

  return (
    <div style={{ padding: 24, fontFamily: 'monospace', color: '#eee', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Wrapper for overlay positioning */}
      <div style={{ position: 'relative' }}>
        {/* Opponent active row */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 17, color: '#aaa', marginBottom: 8, fontWeight: 'bold', textAlign: 'center' }}>
            {opponent.name} (Morale: {opponent.morale}) - Resources: {opponent.resources}
          </div>
          <div style={{ display: 'flex', gap: 5, justifyContent: 'center' }}>
            {Array.from({ length: REEL_WIDTH }, (_, col) => {
              const card = getDisplayCard(opponent.id, col, battle.player2ActiveCards[col]);
              if (isSpinning) {
                return (
                  <ReelSpinner
                    key={`spin-${battle.currentSpin}-opp-${col}`}
                    resultCard={card}
                    col={col}
                  />
                );
              }
              return (
                <CardSlot
                  key={col}
                  card={card}
                  isActive
                  highlight={getHighlight(opponent.id, col)}
                  shake={getShake(opponent.id, col)}
                />
              );
            })}
          </div>
        </div>

        {/* Battle line */}
        <div style={{
          textAlign: 'center',
          padding: '8px 0',
          color: '#f1c40f',
          fontWeight: 'bold',
          fontSize: 17,
          borderTop: '3px solid #f1c40f',
          borderBottom: '3px solid #f1c40f',
          margin: '12px 0',
        }}>
          BATTLE LINE - Spin {battle.currentSpin}/{battle.maxSpins}
          {battle.currentSpin > 10 && ` (OVERTIME! +${battle.currentSpin - 10} dmg)`}
        </div>

        {/* Player active row */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 5, justifyContent: 'center' }}>
            {Array.from({ length: REEL_WIDTH }, (_, col) => {
              const card = getDisplayCard(human.id, col, battle.player1ActiveCards[col]);
              if (isSpinning) {
                return (
                  <ReelSpinner
                    key={`spin-${battle.currentSpin}-plr-${col}`}
                    resultCard={card}
                    col={col}
                  />
                );
              }
              return (
                <CardSlot
                  key={col}
                  card={card}
                  isActive
                  highlight={getHighlight(human.id, col)}
                  shake={getShake(human.id, col)}
                />
              );
            })}
          </div>
        </div>

        {/* Event overlay */}
        <BattleEventOverlay currentEvent={currentEvent} humanPlayerId={humanId} />
      </div>

      {/* Player full reels */}
      <ReelGrid
        player={human}
        activeCards={battle.player1ActiveCards}
        label={`${human.name}'s Reels`}
        compact
      />

      {/* Controls */}
      <div style={{ marginTop: 18, display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center' }}>
        {!battle.isComplete ? (
          !autoPlaying ? (
            <button
              onClick={handleGo}
              style={{
                padding: '15px 48px',
                fontSize: 21,
                fontWeight: 'bold',
                background: '#3498db',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontFamily: 'monospace',
              }}
            >
              GO!
            </button>
          ) : (
            <>
              <div style={{ fontSize: 18, color: '#f1c40f', fontWeight: 'bold' }}>
                Auto-battling...
              </div>
              <button
                onClick={handleSkipAll}
                style={{
                  padding: '12px 30px',
                  fontSize: 18,
                  fontWeight: 'bold',
                  background: '#e67e22',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                }}
              >
                SKIP TO END
              </button>
            </>
          )
        ) : (
          <button
            onClick={endBattle}
            style={{
              padding: '15px 48px',
              fontSize: 21,
              fontWeight: 'bold',
              background: '#27ae60',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: 'monospace',
            }}
          >
            Continue to Shop
          </button>
        )}
      </div>

      {/* Battle log */}
      <div style={{ marginTop: 18 }}>
        <BattleLog log={battle.log} />
      </div>
    </div>
  );
}
