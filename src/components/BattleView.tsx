import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useGameStore } from '../store/gameStore.ts';
import { ReelGrid } from './ReelGrid.tsx';
import { BattleLog } from './BattleLog.tsx';
import { REEL_WIDTH, BIOME_COLORS } from '../engine/constants.ts';
import { CardSlot } from './CardSlot.tsx';
import { ReelSpinner } from './ReelSpinner.tsx';
import { BattleEventOverlay, getCardEffects } from './BattleEventOverlay.tsx';
import { useAnimationQueue } from './useAnimationQueue.ts';
import { useProgressiveDisplay } from './useProgressiveDisplay.ts';
import { useBattleSounds } from '../audio/useBattleSounds.ts';
import { playSfx } from '../audio/sfx.ts';
import { BattleIntro } from './BattleIntro.tsx';
import type { Biome } from '../engine/types.ts';

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

  // Battle intro state
  const [showIntro, setShowIntro] = useState(true);
  const introOpponentRef = useRef<string | undefined>(undefined);

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
    // Show intro for new opponent
    if (tournament.currentBattle?.player2?.id !== introOpponentRef.current) {
      introOpponentRef.current = tournament.currentBattle?.player2?.id;
      setShowIntro(true);
    }
  }

  // Screen shake state
  const [screenShake, setScreenShake] = useState(false);
  // KO vignette state
  const [showKOVignette, setShowKOVignette] = useState(false);

  // Trigger screen shake on big hits or KOs
  useEffect(() => {
    if (!currentEvent) return;
    if (currentEvent.type === 'attack') {
      if (currentEvent.damage >= 15 || currentEvent.defenderIsKO) {
        setScreenShake(true);
        const timer = setTimeout(() => setScreenShake(false), 400);
        return () => clearTimeout(timer);
      }
    }
    if (currentEvent.type === 'ko') {
      setShowKOVignette(true);
      setScreenShake(true);
      const timer1 = setTimeout(() => setScreenShake(false), 400);
      const timer2 = setTimeout(() => setShowKOVignette(false), 500);
      return () => { clearTimeout(timer1); clearTimeout(timer2); };
    }
  }, [currentEvent]);

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

  // Determine dominant biome from player's active cards for background
  const dominantBiome = useMemo(() => {
    const biomeCounts: Record<string, number> = {};
    for (const card of battle.player1ActiveCards) {
      if (card && !card.isKO) {
        const b = card.biome;
        biomeCounts[b] = (biomeCounts[b] || 0) + 1;
      }
    }
    let best: Biome = 'Red';
    let bestCount = 0;
    for (const [biome, count] of Object.entries(biomeCounts)) {
      if (count > bestCount) {
        bestCount = count;
        best = biome as Biome;
      }
    }
    return best;
  }, [battle.player1ActiveCards]);

  // Show intro
  if (showIntro) {
    return (
      <BattleIntro
        playerName={human.name}
        opponentName={opponent.name}
        playerCritters={human.critters}
        opponentCritters={opponent.critters}
        onComplete={() => setShowIntro(false)}
      />
    );
  }

  return (
    <div style={{ padding: 24, color: '#eee', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
      {/* Background environment particles */}
      <div className={`battle-bg battle-bg-${dominantBiome}`} />

      {/* KO vignette flash */}
      {showKOVignette && <div className="ko-vignette" />}

      {/* Wrapper for overlay positioning */}
      <div
        className={screenShake ? 'screen-shake' : undefined}
        style={{ position: 'relative', zIndex: 1 }}
      >
        {/* Opponent active row */}
        <div style={{ marginBottom: 16 }}>
          <div className="font-display" style={{ fontSize: 17, color: '#aaa', marginBottom: 8, fontWeight: 'bold', textAlign: 'center' }}>
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
        <div className="font-display" style={{
          textAlign: 'center',
          padding: '8px 0',
          color: '#f1c40f',
          fontWeight: 'bold',
          fontSize: 17,
          borderTop: '3px solid #f1c40f',
          borderBottom: '3px solid #f1c40f',
          margin: '12px 0',
          letterSpacing: 1,
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
      <div style={{ zIndex: 1 }}>
        <ReelGrid
          player={human}
          activeCards={battle.player1ActiveCards}
          label={`${human.name}'s Reels`}
          compact
        />
      </div>

      {/* Controls */}
      <div style={{ marginTop: 18, display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
        {!battle.isComplete ? (
          !autoPlaying ? (
            <button
              onClick={handleGo}
              className="font-display"
              style={{
                padding: '15px 48px',
                fontSize: 24,
                fontWeight: 'bold',
                background: 'linear-gradient(180deg, #3498db, #2980b9)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                letterSpacing: 2,
                textTransform: 'uppercase',
                boxShadow: '0 4px 15px rgba(52, 152, 219, 0.4)',
              }}
            >
              GO!
            </button>
          ) : (
            <>
              <div className="font-display" style={{ fontSize: 18, color: '#f1c40f', fontWeight: 'bold' }}>
                Auto-battling...
              </div>
              <button
                onClick={handleSkipAll}
                className="font-display"
                style={{
                  padding: '12px 30px',
                  fontSize: 18,
                  fontWeight: 'bold',
                  background: 'linear-gradient(180deg, #e67e22, #d35400)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  letterSpacing: 1,
                }}
              >
                SKIP TO END
              </button>
            </>
          )
        ) : (
          <button
            onClick={endBattle}
            className="font-display"
            style={{
              padding: '15px 48px',
              fontSize: 24,
              fontWeight: 'bold',
              background: 'linear-gradient(180deg, #27ae60, #219a52)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              letterSpacing: 1,
              boxShadow: '0 4px 15px rgba(39, 174, 96, 0.4)',
            }}
          >
            Continue to Shop
          </button>
        )}
      </div>

      {/* Battle log */}
      <div style={{ marginTop: 18, zIndex: 1, width: '100%', maxWidth: 790 }}>
        <BattleLog log={battle.log} />
      </div>
    </div>
  );
}
