import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore.ts';
import { ReelGrid } from './ReelGrid.tsx';
import { BattleLog } from './BattleLog.tsx';
import { REEL_WIDTH } from '../engine/constants.ts';
import { CardSlot } from './CardSlot.tsx';
import { BattleEventOverlay, getCardEffects } from './BattleEventOverlay.tsx';
import { useAnimationQueue } from './useAnimationQueue.ts';
import { useProgressiveDisplay } from './useProgressiveDisplay.ts';

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

  // Start animation when new pending events arrive
  const prevEventsRef = useRef(pendingEvents);
  useEffect(() => {
    if (pendingEvents.length > 0 && pendingEvents !== prevEventsRef.current) {
      startAnimation(pendingEvents);
    }
    prevEventsRef.current = pendingEvents;
  }, [pendingEvents, startAnimation]);

  const battle = tournament.currentBattle;
  if (!battle) return <div style={{ padding: 20, color: '#eee' }}>No active battle.</div>;

  const human = battle.player1;
  const opponent = battle.player2;
  const humanId = tournament.humanPlayerId;

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
    <div style={{ padding: 16, fontFamily: 'monospace', color: '#eee' }}>
      {/* Wrapper for overlay positioning */}
      <div style={{ position: 'relative' }}>
        {/* Opponent active row */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: '#aaa', marginBottom: 4, fontWeight: 'bold' }}>
            {opponent.name} (Morale: {opponent.morale}) - Resources: {opponent.resources}
          </div>
          <div style={{ display: 'flex', gap: 3 }}>
            {Array.from({ length: REEL_WIDTH }, (_, col) => (
              <CardSlot
                key={col}
                card={getDisplayCard(opponent.id, col, battle.player2ActiveCards[col])}
                isActive
                highlight={getHighlight(opponent.id, col)}
                shake={getShake(opponent.id, col)}
              />
            ))}
          </div>
        </div>

        {/* Battle line */}
        <div style={{
          textAlign: 'center',
          padding: '4px 0',
          color: '#f1c40f',
          fontWeight: 'bold',
          fontSize: 12,
          borderTop: '2px solid #f1c40f',
          borderBottom: '2px solid #f1c40f',
          margin: '8px 0',
        }}>
          BATTLE LINE - Spin {battle.currentSpin}/{battle.maxSpins}
          {battle.currentSpin > 10 && ` (OVERTIME! +${battle.currentSpin - 10} dmg)`}
        </div>

        {/* Player active row */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 3 }}>
            {Array.from({ length: REEL_WIDTH }, (_, col) => (
              <CardSlot
                key={col}
                card={getDisplayCard(human.id, col, battle.player1ActiveCards[col])}
                isActive
                highlight={getHighlight(human.id, col)}
                shake={getShake(human.id, col)}
              />
            ))}
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
      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        {!battle.isComplete ? (
          <>
            <button
              onClick={spinAction}
              disabled={spinDisabled}
              style={{
                padding: '8px 24px',
                fontSize: 14,
                fontWeight: 'bold',
                background: spinDisabled ? '#555' : '#3498db',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: spinDisabled ? 'not-allowed' : 'pointer',
                fontFamily: 'monospace',
              }}
            >
              SPIN
            </button>
            {isAnimating && (
              <button
                onClick={skipAnimation}
                style={{
                  padding: '8px 16px',
                  fontSize: 12,
                  fontWeight: 'bold',
                  background: '#7f8c8d',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                }}
              >
                SKIP
              </button>
            )}
          </>
        ) : (
          <button
            onClick={endBattle}
            style={{
              padding: '8px 24px',
              fontSize: 14,
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
      <div style={{ marginTop: 12 }}>
        <BattleLog log={battle.log} />
      </div>
    </div>
  );
}
