import { useState, useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../store/gameStore.ts';
import { CardSlot } from './CardSlot.tsx';
import { ReelGrid } from './ReelGrid.tsx';
import { BattleLog } from './BattleLog.tsx';
import { ReelSpinner } from './ReelSpinner.tsx';
import { BattleEventOverlay, getCardEffects } from './BattleEventOverlay.tsx';
import { useAnimationQueue } from './useAnimationQueue.ts';
import { useProgressiveDisplay } from './useProgressiveDisplay.ts';
import { useBattleSounds } from '../audio/useBattleSounds.ts';
import { playSfx } from '../audio/sfx.ts';
import { BIOME_COLORS, MAX_SAME_BIOME_CRITTERS, REEL_WIDTH, SHOP_COST } from '../engine/constants.ts';
import type { Biome, CardDefinition, PlayerState } from '../engine/types.ts';
import type { SanitizedGameState, SanitizedPlayerState } from '../shared/protocol.ts';

const BIOMES: Biome[] = ['Red', 'Blue', 'Cream', 'Brown', 'Green'];

export function MultiplayerGameView() {
  const multiplayerState = useGameStore((s) => s.multiplayerState);
  const playerId = useGameStore((s) => s.playerId);
  const allCritters = useGameStore((s) => s.allCritters);
  const pendingEvents = useGameStore((s) => s.pendingEvents);
  const isStoreAnimating = useGameStore((s) => s.isAnimating);
  const finishAnimation = useGameStore((s) => s.finishAnimation);
  const waitingFor = useGameStore((s) => s.waitingFor);
  const goToMenu = useGameStore((s) => s.goToMenu);

  if (!multiplayerState || !playerId) return null;

  const phase = multiplayerState.phase;

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d1a' }}>
      {/* Status bar */}
      {phase !== 'critter-select' && <MPStatusBar state={multiplayerState} playerId={playerId} />}

      {phase === 'critter-select' && (
        <MPCritterSelect state={multiplayerState} playerId={playerId} allCritters={allCritters} />
      )}
      {phase === 'initial-draft' && (
        <MPDraftView state={multiplayerState} playerId={playerId} />
      )}
      {phase === 'battle' && (
        <MPBattleView
          state={multiplayerState}
          playerId={playerId}
          pendingEvents={pendingEvents}
          isStoreAnimating={isStoreAnimating}
          finishAnimation={finishAnimation}
          waitingFor={waitingFor}
        />
      )}
      {phase === 'shop' && (
        <MPShopView state={multiplayerState} playerId={playerId} />
      )}
      {phase === 'game-over' && (
        <MPGameOver state={multiplayerState} playerId={playerId} onBack={goToMenu} />
      )}
    </div>
  );
}

// ---- Status Bar ----
function MPStatusBar({ state, playerId }: { state: SanitizedGameState; playerId: string }) {
  const me = state.players.find((p) => p.id === playerId);
  if (!me) return null;

  return (
    <div style={{
      padding: '8px 16px',
      background: '#1a1a2e',
      borderBottom: '1px solid #333',
            color: '#eee',
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 13,
    }}>
      <span>SPIN CRITTERS - Round {state.round}</span>
      <span>Morale: <span style={{ color: me.morale > 20 ? '#27ae60' : '#e74c3c' }}>{me.morale}/50</span></span>
      <span>Resources: <span style={{ color: '#f1c40f' }}>{me.resources}</span></span>
      <span style={{ color: '#888' }}>
        {state.players.map((p) => (
          <span key={p.id} style={{ marginLeft: 12, color: p.isYou ? '#3498db' : '#888' }}>
            {p.name}: {p.morale}HP
          </span>
        ))}
      </span>
    </div>
  );
}

// ---- Critter Select ----
function MPCritterSelect({ state, playerId, allCritters }: {
  state: SanitizedGameState;
  playerId: string;
  allCritters: CardDefinition[];
}) {
  const mpSelectCritters = useGameStore((s) => s.mpSelectCritters);
  const [selected, setSelected] = useState<string[]>([]);
  const [placementPhase, setPlacementPhase] = useState(false);
  const [placements, setPlacements] = useState<number[]>([]);

  const biomeCounts: Record<string, number> = {};
  for (const id of selected) {
    const c = allCritters.find((cr) => cr.cardId === id);
    if (c) biomeCounts[c.biome] = (biomeCounts[c.biome] || 0) + 1;
  }

  function toggleCritter(cardId: string) {
    if (selected.includes(cardId)) {
      setSelected(selected.filter((id) => id !== cardId));
    } else if (selected.length < 3) {
      const critter = allCritters.find((c) => c.cardId === cardId)!;
      if ((biomeCounts[critter.biome] || 0) < MAX_SAME_BIOME_CRITTERS) {
        setSelected([...selected, cardId]);
      }
    }
  }

  function placeInColumn(col: number) {
    if (placements.includes(col)) return;
    const newPlacements = [...placements, col];
    setPlacements(newPlacements);

    if (newPlacements.length === 3) {
      mpSelectCritters(selected, newPlacements);
    }
  }

  if (placementPhase) {
    const currentIdx = placements.length;
    const currentCritter = currentIdx < 3 ? allCritters.find((c) => c.cardId === selected[currentIdx]) : null;

    return (
      <div style={{ padding: 20, fontFamily: 'monospace', color: '#eee', maxWidth: 700, margin: '0 auto' }}>
        <h2>Place Your Critters</h2>
        {currentCritter ? (
          <p>
            Place <strong style={{ color: BIOME_COLORS[currentCritter.biome] }}>{currentCritter.name}</strong> in a column:
          </p>
        ) : (
          <p style={{ color: '#f1c40f' }}>Waiting for other players...</p>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {Array.from({ length: REEL_WIDTH }, (_, col) => {
            const placedIdx = placements.indexOf(col);
            const placedCritter = placedIdx >= 0 ? allCritters.find((c) => c.cardId === selected[placedIdx]) : null;
            if (placedCritter) {
              return <CardSlot key={col} definition={placedCritter} />;
            }
            return (
              <div
                key={col}
                onClick={() => currentIdx < 3 && placeInColumn(col)}
                style={{
                  width: 100, height: 150,
                  border: '2px dashed #555', borderRadius: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: currentIdx < 3 ? 'pointer' : 'default',
                  background: '#1a1a2e', color: '#eee', fontSize: 12, fontWeight: 'bold',
                }}
              >
                Col {col + 1}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, fontFamily: 'monospace', color: '#eee', maxWidth: 800, margin: '0 auto' }}>
      <h2>Select 3 Critters</h2>
      <p style={{ color: '#aaa', fontSize: 12 }}>
        Max {MAX_SAME_BIOME_CRITTERS} from the same biome. Selected: {selected.length}/3
      </p>

      {BIOMES.map((biome) => {
        const critters = allCritters.filter((c) => c.biome === biome);
        return (
          <div key={biome} style={{ marginBottom: 16 }}>
            <h3 style={{ color: BIOME_COLORS[biome], margin: '8px 0 4px' }}>{biome} Biome</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {critters.map((critter) => {
                const isSelected = selected.includes(critter.cardId);
                const biomeCount = biomeCounts[critter.biome] || 0;
                const disabled = !isSelected && (selected.length >= 3 || biomeCount >= MAX_SAME_BIOME_CRITTERS);
                return (
                  <div
                    key={critter.cardId}
                    style={{ opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
                    onClick={() => !disabled && toggleCritter(critter.cardId)}
                  >
                    <CardSlot definition={critter} selected={isSelected} />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {selected.length === 3 && (
        <button
          onClick={() => setPlacementPhase(true)}
          style={{
            marginTop: 16, padding: '10px 24px', fontSize: 14, fontWeight: 'bold',
            background: '#27ae60', color: '#fff', border: 'none', borderRadius: 6,
            cursor: 'pointer',           }}
        >
          Place Critters in Columns
        </button>
      )}
    </div>
  );
}

// ---- Draft View ----
function MPDraftView({ state, playerId }: { state: SanitizedGameState; playerId: string }) {
  const mpDraftPick = useGameStore((s) => s.mpDraftPick);
  const [selectedCard, setSelectedCard] = useState<number | null>(null);

  const packs = state.yourDraftPacks;
  if (!packs) return <div style={{ padding: 20, color: '#f1c40f', fontFamily: 'monospace' }}>Waiting for draft...</div>;

  const currentPackIdx = state.currentDraftPack;
  if (currentPackIdx >= packs.length) {
    return <div style={{ padding: 20, color: '#f1c40f', fontFamily: 'monospace' }}>Draft complete! Waiting for other players...</div>;
  }

  const currentPack = packs[currentPackIdx];
  const me = state.players.find((p) => p.id === playerId);

  function handleColumnClick(col: number) {
    if (selectedCard === null) return;
    mpDraftPick(selectedCard, col);
    setSelectedCard(null);
  }

  return (
    <div style={{ padding: 20, fontFamily: 'monospace', color: '#eee', maxWidth: 700, margin: '0 auto' }}>
      <h2>Initial Draft</h2>
      <p style={{ color: '#aaa', fontSize: 12 }}>
        Pack {currentPackIdx + 1} of {packs.length} ({currentPackIdx < 5 ? 'Common' : 'Uncommon'})
        {' '} - Pick 1 card, then choose a column
      </p>

      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        {currentPack.map((card, idx) => (
          <CardSlot
            key={idx}
            definition={card}
            onClick={() => setSelectedCard(idx)}
            selected={selectedCard === idx}
          />
        ))}
      </div>

      {selectedCard !== null && me?.reels && (
        <div style={{ marginTop: 20 }}>
          <p style={{ color: '#aaa' }}>Place in column:</p>
          <div style={{ display: 'flex', gap: 8 }}>
            {Array.from({ length: REEL_WIDTH }, (_, col) => {
              let cardCount = 0;
              for (let row = 0; row < (me.reelHeight || 3); row++) {
                if (me.reels![row]?.[col]?.card) cardCount++;
              }
              return (
                <button
                  key={col}
                  onClick={() => handleColumnClick(col)}
                  disabled={cardCount >= (me.reelHeight || 3)}
                  style={{
                    width: 80, height: 50, border: '2px solid #555', borderRadius: 6,
                    background: '#1a1a2e', color: '#eee',
                    cursor: cardCount >= (me.reelHeight || 3) ? 'not-allowed' : 'pointer',
                    fontFamily: 'monospace', fontSize: 11,
                    opacity: cardCount >= (me.reelHeight || 3) ? 0.4 : 1,
                  }}
                >
                  Col {col + 1}<br />({cardCount}/{me.reelHeight || 3})
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Battle View ----
function MPBattleView({ state, playerId, pendingEvents, isStoreAnimating, finishAnimation, waitingFor }: {
  state: SanitizedGameState;
  playerId: string;
  pendingEvents: import('../engine/types.ts').BattleEvent[];
  isStoreAnimating: boolean;
  finishAnimation: () => void;
  waitingFor: { playerIds: string[]; action: string; timeoutMs?: number } | null;
}) {
  const mpSpin = useGameStore((s) => s.mpSpin);
  const { currentEvent, eventIndex, isAnimating, startAnimation, skipAnimation } = useAnimationQueue(finishAnimation);
  const { getDisplayCard } = useProgressiveDisplay(isAnimating, pendingEvents, eventIndex);

  // Play sounds for battle events
  useBattleSounds(currentEvent);

  // Auto-battle state
  const [autoPlaying, setAutoPlaying] = useState(false);
  const autoPlayingRef = useRef(false);

  useEffect(() => {
    autoPlayingRef.current = autoPlaying;
  }, [autoPlaying]);

  const prevEventsRef = useRef(pendingEvents);
  useEffect(() => {
    if (pendingEvents.length > 0 && pendingEvents !== prevEventsRef.current) {
      startAnimation(pendingEvents);
    }
    prevEventsRef.current = pendingEvents;
  }, [pendingEvents, startAnimation]);

  const battle = state.currentBattle;

  // Reset auto-play when battle completes or a new battle starts
  const battleSpinRef = useRef(battle?.currentSpin);
  if (battle?.isComplete && autoPlaying) {
    setAutoPlaying(false);
    autoPlayingRef.current = false;
  }
  if (battle && battle.currentSpin === 0 && battleSpinRef.current !== 0) {
    if (autoPlaying) {
      setAutoPlaying(false);
      autoPlayingRef.current = false;
    }
  }
  battleSpinRef.current = battle?.currentSpin;

  const isWaitingForMe = waitingFor?.playerIds.includes(playerId) ?? false;

  // Auto-play: when animation finishes and server is waiting for us, auto-send spin
  const prevAnimatingRef = useRef(isAnimating);
  useEffect(() => {
    const justFinished = prevAnimatingRef.current && !isAnimating && !isStoreAnimating;
    prevAnimatingRef.current = isAnimating;

    if (justFinished && autoPlayingRef.current && isWaitingForMe) {
      const timer = setTimeout(() => {
        if (autoPlayingRef.current) {
          mpSpin();
        }
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [isAnimating, isStoreAnimating, isWaitingForMe, mpSpin]);

  // Also auto-send spin when server first signals waiting (e.g. after opponent is ready)
  useEffect(() => {
    if (autoPlayingRef.current && isWaitingForMe && !isAnimating && !isStoreAnimating) {
      const timer = setTimeout(() => {
        if (autoPlayingRef.current) {
          mpSpin();
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isWaitingForMe, isAnimating, isStoreAnimating, mpSpin]);

  const handleGo = useCallback(() => {
    playSfx('battleStart');
    setAutoPlaying(true);
    autoPlayingRef.current = true;
    mpSpin();
  }, [mpSpin]);

  if (!battle) return <div style={{ padding: 20, color: '#eee', fontFamily: 'monospace' }}>No active battle.</div>;

  // Determine which player is "you" and which is opponent
  const isPlayer1 = battle.player1Id === playerId;
  const myActiveCards = isPlayer1 ? battle.player1ActiveCards : battle.player2ActiveCards;
  const oppActiveCards = isPlayer1 ? battle.player2ActiveCards : battle.player1ActiveCards;
  const myId = playerId;
  const oppId = isPlayer1 ? battle.player2Id : battle.player1Id;

  const me = state.players.find((p) => p.id === playerId);
  const opp = state.players.find((p) => p.id === oppId);

  const isSpinning = currentEvent?.type === 'spin-result';
  const { highlightCols, shakeCols } = getCardEffects(currentEvent, myId);

  const getHighlight = (pid: string, col: number): string | undefined => {
    const list = highlightCols.get(pid);
    return list?.find((e) => e.col === col)?.color;
  };

  const getShake = (pid: string, col: number): boolean => {
    const list = shakeCols.get(pid);
    return list ? list.includes(col) : false;
  };

  return (
    <div style={{ padding: 16, fontFamily: 'monospace', color: '#eee' }}>
      <div style={{ position: 'relative' }}>
        {/* Opponent active row */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: '#aaa', marginBottom: 4, fontWeight: 'bold' }}>
            {opp?.name || 'Opponent'} (Morale: {opp?.morale}) - Resources: {opp?.resources}
          </div>
          <div style={{ display: 'flex', gap: 3 }}>
            {Array.from({ length: REEL_WIDTH }, (_, col) => {
              const card = getDisplayCard(oppId, col, oppActiveCards[col]);
              if (isSpinning) {
                return <ReelSpinner key={`spin-${battle.currentSpin}-opp-${col}`} resultCard={card} col={col} />;
              }
              return (
                <CardSlot key={col} card={card} isActive highlight={getHighlight(oppId, col)} shake={getShake(oppId, col)} />
              );
            })}
          </div>
        </div>

        {/* Battle line */}
        <div style={{
          textAlign: 'center', padding: '4px 0', color: '#f1c40f', fontWeight: 'bold', fontSize: 12,
          borderTop: '2px solid #f1c40f', borderBottom: '2px solid #f1c40f', margin: '8px 0',
        }}>
          BATTLE LINE - Spin {battle.currentSpin}/{battle.maxSpins}
          {battle.currentSpin > 10 && ` (OVERTIME! +${battle.currentSpin - 10} dmg)`}
        </div>

        {/* Player active row */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 3 }}>
            {Array.from({ length: REEL_WIDTH }, (_, col) => {
              const card = getDisplayCard(myId, col, myActiveCards[col]);
              if (isSpinning) {
                return <ReelSpinner key={`spin-${battle.currentSpin}-plr-${col}`} resultCard={card} col={col} />;
              }
              return (
                <CardSlot key={col} card={card} isActive highlight={getHighlight(myId, col)} shake={getShake(myId, col)} />
              );
            })}
          </div>
        </div>

        <BattleEventOverlay currentEvent={currentEvent} humanPlayerId={myId} />
      </div>

      {/* Player reels (if available) */}
      {me?.reels && (
        <ReelGrid
          player={me as unknown as PlayerState}
          activeCards={myActiveCards}
          label={`${me.name}'s Reels`}
          compact
        />
      )}

      {/* Controls */}
      <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
        {!battle.isComplete ? (
          !autoPlaying ? (
            <button
              onClick={handleGo}
              disabled={!isWaitingForMe || isAnimating || isStoreAnimating}
              style={{
                padding: '10px 32px', fontSize: 16, fontWeight: 'bold',
                background: (!isWaitingForMe || isAnimating || isStoreAnimating) ? '#555' : '#3498db',
                color: '#fff', border: 'none', borderRadius: 6,
                cursor: (!isWaitingForMe || isAnimating || isStoreAnimating) ? 'not-allowed' : 'pointer',
                              }}
            >
              GO!
            </button>
          ) : (
            <>
              <div style={{ fontSize: 13, color: '#f1c40f', fontWeight: 'bold' }}>
                Auto-battling...
              </div>
              {isAnimating && (
                <button onClick={skipAnimation} style={{
                  padding: '8px 16px', fontSize: 12, fontWeight: 'bold',
                  background: '#7f8c8d', color: '#fff', border: 'none', borderRadius: 6,
                  cursor: 'pointer',                 }}>
                  SKIP ANIM
                </button>
              )}
              {!isWaitingForMe && !isAnimating && (
                <span style={{ color: '#888', fontSize: 12 }}>
                  Waiting for opponent...
                </span>
              )}
            </>
          )
        ) : (
          <span style={{ color: '#f1c40f', fontSize: 14, fontWeight: 'bold' }}>
            Battle over! {battle.winnerId === playerId ? 'You won!' : 'You lost.'}
          </span>
        )}
      </div>

      {/* Battle log */}
      <div style={{ marginTop: 12 }}>
        <BattleLog log={battle.log} />
      </div>
    </div>
  );
}

// ---- Shop View ----
function MPShopView({ state, playerId }: { state: SanitizedGameState; playerId: string }) {
  const mpBuyCard = useGameStore((s) => s.mpBuyCard);
  const mpRerollShop = useGameStore((s) => s.mpRerollShop);
  const mpSkipShop = useGameStore((s) => s.mpSkipShop);
  const [selectedCard, setSelectedCard] = useState<number | null>(null);

  const me = state.players.find((p) => p.id === playerId);
  const pack = state.yourShopPack;

  if (!pack || !me) {
    return <div style={{ padding: 20, color: '#f1c40f', fontFamily: 'monospace' }}>Waiting for shop...</div>;
  }

  function handleColumnClick(col: number) {
    if (selectedCard === null) return;
    mpBuyCard(selectedCard, col);
    setSelectedCard(null);
  }

  return (
    <div style={{ padding: 20, fontFamily: 'monospace', color: '#eee', maxWidth: 800, margin: '0 auto' }}>
      <h2>Shop Phase - Round {state.round}</h2>
      <p style={{ color: '#aaa', fontSize: 12 }}>
        Resources: <span style={{ color: '#f1c40f', fontWeight: 'bold' }}>{me.resources}</span>
      </p>

      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        {pack.cards.map((card, idx) => {
          const cost = SHOP_COST[card.rarity] || 2;
          const canAfford = me.resources >= cost;
          return (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ opacity: canAfford ? 1 : 0.4 }}>
                <CardSlot definition={card} onClick={() => canAfford && setSelectedCard(idx)} selected={selectedCard === idx} />
              </div>
              <div style={{
                padding: '2px 8px', background: canAfford ? '#27ae60' : '#555',
                borderRadius: 4, fontSize: 11, fontWeight: 'bold', color: '#fff',
              }}>
                Cost: {cost}
              </div>
            </div>
          );
        })}
      </div>

      {selectedCard !== null && me.reels && (
        <div style={{ marginTop: 16 }}>
          <p style={{ color: '#aaa' }}>Place in column:</p>
          <div style={{ display: 'flex', gap: 8 }}>
            {Array.from({ length: REEL_WIDTH }, (_, col) => {
              let cardCount = 0;
              let hasJunk = false;
              for (let row = 0; row < me.reelHeight; row++) {
                if (me.reels![row]?.[col]?.card) {
                  cardCount++;
                  if (me.reels![row][col].card!.category === 'Junk') hasJunk = true;
                }
              }
              const canPlace = cardCount < me.reelHeight || hasJunk;
              return (
                <button
                  key={col}
                  onClick={() => canPlace && handleColumnClick(col)}
                  disabled={!canPlace}
                  style={{
                    width: 80, height: 50, border: '2px solid #555', borderRadius: 6,
                    background: '#1a1a2e', color: '#eee',
                    cursor: canPlace ? 'pointer' : 'not-allowed',
                    fontFamily: 'monospace', fontSize: 11, opacity: canPlace ? 1 : 0.4,
                  }}
                >
                  Col {col + 1}<br />({cardCount}/{me.reelHeight})
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <button
          onClick={mpRerollShop}
          disabled={me.resources < 2}
          style={{
            padding: '8px 16px', background: me.resources >= 2 ? '#e67e22' : '#555',
            color: '#fff', border: 'none', borderRadius: 6,
            cursor: me.resources >= 2 ? 'pointer' : 'not-allowed',
            fontFamily: 'monospace', fontWeight: 'bold',
          }}
        >
          Reroll (2 res)
        </button>
        <button
          onClick={mpSkipShop}
          style={{
            padding: '8px 16px', background: '#555', color: '#fff', border: 'none', borderRadius: 6,
            cursor: 'pointer', fontFamily: 'monospace', fontWeight: 'bold',
          }}
        >
          Skip
        </button>
      </div>

      {me.reels && (
        <div style={{ marginTop: 20 }}>
          <ReelGrid player={me as unknown as PlayerState} label="Your Reels" compact />
        </div>
      )}
    </div>
  );
}

// ---- Game Over ----
function MPGameOver({ state, playerId, onBack }: {
  state: SanitizedGameState;
  playerId: string;
  onBack: () => void;
}) {
  const me = state.players.find((p) => p.id === playerId);
  const alive = state.players.filter((p) => p.morale > 0);
  const isWinner = me && me.morale > 0 && alive.length <= 1;

  return (
    <div style={{
      padding: 40, fontFamily: 'monospace', color: '#eee', textAlign: 'center',
      maxWidth: 600, margin: '0 auto',
    }}>
      <h1 style={{ color: isWinner ? '#f1c40f' : '#e74c3c', fontSize: 32 }}>
        {isWinner ? 'VICTORY!' : 'GAME OVER'}
      </h1>
      <p style={{ fontSize: 16, color: '#aaa' }}>
        {isWinner ? 'You defeated your opponent!' : `You were eliminated in round ${state.round}`}
      </p>

      <div style={{ marginTop: 24, textAlign: 'left' }}>
        <h3>Players</h3>
        {state.players.map((p) => (
          <div key={p.id} style={{ padding: '4px 0', color: p.isYou ? '#f1c40f' : '#aaa' }}>
            {p.name} - Morale: {p.morale} {p.isYou ? '(you)' : ''}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24 }}>
        <h3>Battle History</h3>
        {state.matchHistory.map((m, i) => {
          const p1 = state.players.find((p) => p.id === m.p1);
          const p2 = state.players.find((p) => p.id === m.p2);
          const winner = state.players.find((p) => p.id === m.winner);
          return (
            <div key={i} style={{ padding: '2px 0', fontSize: 11, color: '#888' }}>
              {p1?.name || m.p1} vs {p2?.name || m.p2} - Winner: {winner?.name || m.winner}
            </div>
          );
        })}
      </div>

      <button onClick={onBack} style={{
        marginTop: 32, padding: '12px 32px', fontSize: 16, fontWeight: 'bold',
        background: '#27ae60', color: '#fff', border: 'none', borderRadius: 8,
        cursor: 'pointer',       }}>
        Back to Menu
      </button>
    </div>
  );
}
