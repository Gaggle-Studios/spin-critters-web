import { useEffect, useRef, useState, useCallback } from 'react';
import { useGameStore } from '../store/gameStore';
import { BattleLog } from '../components/BattleLog';
import { BattleIntro } from '../components/BattleIntro';
import { CardZoom } from '../components/CardZoom';
import { playSfx } from '../audio/sfx';
import { PixiBattleApp } from './PixiBattleApp';
import { BattleScene } from './scenes/BattleScene';
import { AnimationDirector } from './systems/AnimationDirector';
import { getActiveCardsData, getReelGridData } from './systems/CardStateSync';
import { preloadCardTextures } from './utils/AssetLoader';
import { CARD_W, CARD_H } from './objects/PixiCard';
import { loadCritters } from '../engine/cards';
import type { Biome, BattleEvent, CardInstance, CardDefinition } from '../engine/types';

// Cache critter definitions (they never change)
let critterDefsCache: CardDefinition[] | null = null;
function getCritterDefs(): CardDefinition[] {
  if (!critterDefsCache) critterDefsCache = loadCritters();
  return critterDefsCache;
}

const COMPACT_W = 95;
const COMPACT_H = 132;
const COMPACT_GAP = 4;

/** Compute canvas height based on reel rows */
function computeCanvasHeight(reelHeight: number): number {
  // opponent row(170) + gap(16) + battleline(24) + gap(6) + player row(170) + gap(24) + mini reel
  const miniReelH = reelHeight * (132 + 4) - 4;
  return 20 + 170 + 16 + 24 + 6 + 170 + 24 + miniReelH + 20;
}

export function PixiBattleCanvas() {
  const tournament = useGameStore((s) => s.tournament);
  const spinAction = useGameStore((s) => s.spin);
  const endBattle = useGameStore((s) => s.endBattle);
  const pendingEvents = useGameStore((s) => s.pendingEvents);
  const isStoreAnimating = useGameStore((s) => s.isAnimating);
  const finishAnimation = useGameStore((s) => s.finishAnimation);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<PixiBattleApp | null>(null);
  const sceneRef = useRef<BattleScene | null>(null);
  const directorRef = useRef<AnimationDirector | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [sceneReady, setSceneReady] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const introOpponentRef = useRef<string | undefined>(undefined);
  const [autoPlaying, setAutoPlaying] = useState(false);
  const autoPlayingRef = useRef(false);
  const battleIdRef = useRef(tournament.currentBattle?.player2?.id);
  const prevEventsRef = useRef<BattleEvent[]>([]);
  const [isDirectorPlaying, setIsDirectorPlaying] = useState(false);
  const [texturesLoaded, setTexturesLoaded] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<{
    card: CardInstance;
    def: CardDefinition | null;
    rect: DOMRect;
  } | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const battle = tournament.currentBattle;
  const humanId = tournament.humanPlayerId;

  // Detect new opponent -> show intro, reset auto-play
  if (battle?.player2?.id !== battleIdRef.current) {
    battleIdRef.current = battle?.player2?.id;
    if (autoPlaying) {
      setAutoPlaying(false);
      autoPlayingRef.current = false;
    }
    if (battle?.player2?.id !== introOpponentRef.current) {
      introOpponentRef.current = battle?.player2?.id;
      setShowIntro(true);
    }
  }

  useEffect(() => {
    autoPlayingRef.current = autoPlaying;
  }, [autoPlaying]);

  // Initialize PixiJS
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let app: PixiBattleApp;
    try {
      app = new PixiBattleApp();
    } catch (e) {
      console.error('[PixiJS] Failed to create app:', e);
      return;
    }
    appRef.current = app;

    // Use requestAnimationFrame to ensure container has layout dimensions
    requestAnimationFrame(() => {
      if (app.destroyed) return;
      const width = container.clientWidth || 800;
      const height = container.clientHeight || 520;

      app.init(canvas, width, height).then(() => {
        if (app.destroyed) return;

        const scene = new BattleScene(width, height);
        app.stage.addChild(scene);
        sceneRef.current = scene;

        const director = new AnimationDirector(scene);
        directorRef.current = director;

        app.app.ticker.add((ticker) => {
          scene.update(ticker.deltaTime);
        });

        setSceneReady(true);
      }).catch((e) => {
        console.error('[PixiJS] Failed to initialize:', e);
      });
    });

    const onResize = () => {
      if (app.destroyed || !container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        app.resize(w, h);
        sceneRef.current?.resize(w, h);
      }
    };
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      directorRef.current?.destroy();
      directorRef.current = null;
      sceneRef.current = null;
      app.destroy();
      appRef.current = null;
      setSceneReady(false);
    };
  }, []);

  // Preload card textures when battle starts
  useEffect(() => {
    if (!battle) return;
    const cardIds: Array<{ id: string; category: string }> = [];
    for (const player of [battle.player1, battle.player2]) {
      for (const row of player.reels) {
        for (const slot of row) {
          if (slot.card) cardIds.push({ id: slot.card.definitionId, category: slot.card.category });
        }
      }
    }
    setTexturesLoaded(false);
    preloadCardTextures(cardIds).then(() => setTexturesLoaded(true));
  }, [battle?.player1.id, battle?.player2.id]);

  // Sync card state to scene whenever battle state changes and scene is ready
  // Always sync - even during animation - so cards are always visible
  useEffect(() => {
    if (!battle || !sceneReady || !sceneRef.current) return;

    const scene = sceneRef.current;
    const oppData = getActiveCardsData(battle, battle.player2.id);
    const plrData = getActiveCardsData(battle, battle.player1.id);
    scene.setActiveCards(oppData, plrData);

    // Mini reel grid
    const reelGrid = getReelGridData(battle, battle.player1.id);
    scene.setMiniReel(reelGrid, -1);

    // Dominant biome for background particles
    const biomeCounts: Record<string, number> = {};
    for (const card of battle.player1ActiveCards) {
      if (card && !card.isKO) {
        biomeCounts[card.biome] = (biomeCounts[card.biome] || 0) + 1;
      }
    }
    let best: Biome = 'Red';
    let bestCount = 0;
    for (const [biome, count] of Object.entries(biomeCounts)) {
      if (count > bestCount) { bestCount = count; best = biome as Biome; }
    }
    scene.setBiome(best);

    // Battle line text
    const overtime = battle.currentSpin > 10 ? ` (OVERTIME! +${battle.currentSpin - 10} dmg)` : '';
    scene.setBattleLineText(`BATTLE LINE - Spin ${battle.currentSpin}/${battle.maxSpins}${overtime}`);

    // Overtime overlay
    scene.overtimeOverlay.setIntensity(battle.currentSpin > 10 ? battle.currentSpin - 10 : 0);
  }, [battle, sceneReady, texturesLoaded]);

  // Handle pending events -> animate via AnimationDirector
  useEffect(() => {
    if (!sceneReady || pendingEvents.length === 0 || pendingEvents === prevEventsRef.current || !battle) return;
    prevEventsRef.current = pendingEvents;

    const director = directorRef.current;
    if (director && !director.isPlaying) {
      setIsDirectorPlaying(true);
      director.play(pendingEvents, battle, humanId, () => {
        setIsDirectorPlaying(false);
        finishAnimation();
      });
    }
  }, [pendingEvents, battle, humanId, finishAnimation, sceneReady]);

  // Auto-play: trigger next spin when animation finishes
  useEffect(() => {
    if (!isDirectorPlaying && !isStoreAnimating && autoPlayingRef.current && battle && !battle.isComplete) {
      const timer = setTimeout(() => {
        if (autoPlayingRef.current) spinAction();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [isDirectorPlaying, isStoreAnimating, battle, spinAction]);

  const handleGo = useCallback(() => {
    playSfx('battleStart');
    setAutoPlaying(true);
    autoPlayingRef.current = true;
    spinAction();
  }, [spinAction]);

  const handleSkipAll = useCallback(() => {
    setAutoPlaying(false);
    autoPlayingRef.current = false;

    directorRef.current?.stop();
    setIsDirectorPlaying(false);

    // Run all remaining spins instantly
    let safety = 100;
    while (safety-- > 0) {
      const state = useGameStore.getState().tournament;
      if (!state.currentBattle || state.currentBattle.isComplete) break;
      useGameStore.getState().finishAnimation();
      useGameStore.getState().spin();
    }
    useGameStore.getState().finishAnimation();

    // Sync final state to scene
    const finalBattle = useGameStore.getState().tournament.currentBattle;
    if (finalBattle && sceneRef.current) {
      const oppData = getActiveCardsData(finalBattle, finalBattle.player2.id);
      const plrData = getActiveCardsData(finalBattle, finalBattle.player1.id);
      sceneRef.current.setActiveCards(oppData, plrData);
      const reelGrid = getReelGridData(finalBattle, finalBattle.player1.id);
      sceneRef.current.setMiniReel(reelGrid, -1);
    }
  }, []);

  const handleIntroComplete = useCallback(() => {
    setShowIntro(false);
  }, []);

  // Card hover: hit-test mouse position against card layout positions
  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    const scene = sceneRef.current;
    const currentBattle = useGameStore.getState().tournament.currentBattle;
    if (!container || !scene || !currentBattle) {
      if (hoveredCard) setHoveredCard(null);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const layout = scene.layout;

    // Convert client coords to scene coords (accounting for CSS scaling)
    const scaleX = layout.width / containerRect.width;
    const scaleY = layout.height / containerRect.height;
    const sx = (e.clientX - containerRect.left) * scaleX;
    const sy = (e.clientY - containerRect.top) * scaleY;

    // Helper: determine column from x position for the active rows
    const getActiveCol = (x: number): number => {
      const relX = x - layout.rowOffsetX;
      if (relX < 0) return -1;
      const colSlot = relX / (CARD_W + layout.cardGap);
      const col = Math.floor(colSlot);
      if (col >= 5) return -1;
      // Check we're within the card, not in the gap
      const withinCard = relX - col * (CARD_W + layout.cardGap);
      if (withinCard > CARD_W) return -1;
      return col;
    };

    // Helper: determine mini reel card from position
    const getMiniReelPos = (x: number, y: number): { row: number; col: number } | null => {
      const miniY = y - layout.miniReelY;
      if (miniY < 0) return null;
      const totalW = 5 * COMPACT_W + 4 * COMPACT_GAP;
      const offsetX = (layout.width - totalW) / 2;
      const relX = x - offsetX;
      if (relX < 0) return null;
      const col = Math.floor(relX / (COMPACT_W + COMPACT_GAP));
      if (col >= 5) return null;
      const withinCard = relX - col * (COMPACT_W + COMPACT_GAP);
      if (withinCard > COMPACT_W) return null;
      const row = Math.floor(miniY / (COMPACT_H + COMPACT_GAP));
      const withinRow = miniY - row * (COMPACT_H + COMPACT_GAP);
      if (withinRow > COMPACT_H) return null;
      return { row, col };
    };

    let foundCard: CardInstance | null = null;
    let cardScreenRect: DOMRect | null = null;

    // Check opponent active row
    if (sy >= layout.opponentRowY && sy <= layout.opponentRowY + CARD_H) {
      const col = getActiveCol(sx);
      if (col >= 0) {
        foundCard = currentBattle.player2ActiveCards[col] ?? null;
        if (foundCard) {
          const cardX = layout.rowOffsetX + col * (CARD_W + layout.cardGap);
          cardScreenRect = new DOMRect(
            containerRect.left + cardX / scaleX,
            containerRect.top + layout.opponentRowY / scaleY,
            CARD_W / scaleX,
            CARD_H / scaleY,
          );
        }
      }
    }
    // Check player active row
    else if (sy >= layout.playerRowY && sy <= layout.playerRowY + CARD_H) {
      const col = getActiveCol(sx);
      if (col >= 0) {
        foundCard = currentBattle.player1ActiveCards[col] ?? null;
        if (foundCard) {
          const cardX = layout.rowOffsetX + col * (CARD_W + layout.cardGap);
          cardScreenRect = new DOMRect(
            containerRect.left + cardX / scaleX,
            containerRect.top + layout.playerRowY / scaleY,
            CARD_W / scaleX,
            CARD_H / scaleY,
          );
        }
      }
    }
    // Check mini reel grid
    else if (sy >= layout.miniReelY) {
      const pos = getMiniReelPos(sx, sy);
      if (pos) {
        const slot = currentBattle.player1.reels[pos.row]?.[pos.col];
        foundCard = slot?.card ?? null;
        if (foundCard) {
          const totalW = 5 * COMPACT_W + 4 * COMPACT_GAP;
          const offsetX = (layout.width - totalW) / 2;
          const cardX = offsetX + pos.col * (COMPACT_W + COMPACT_GAP);
          const cardY = layout.miniReelY + pos.row * (COMPACT_H + COMPACT_GAP);
          cardScreenRect = new DOMRect(
            containerRect.left + cardX / scaleX,
            containerRect.top + cardY / scaleY,
            COMPACT_W / scaleX,
            COMPACT_H / scaleY,
          );
        }
      }
    }

    if (foundCard && cardScreenRect) {
      // Debounce hover to prevent flicker
      if (hoveredCard?.card.instanceId !== foundCard.instanceId) {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = setTimeout(() => {
          const allDefs = [...getCritterDefs(), ...useGameStore.getState().tournament.cardPool];
          const def = allDefs.find(d => d.cardId === foundCard!.definitionId) ?? null;
          setHoveredCard({ card: foundCard!, def, rect: cardScreenRect! });
        }, 80);
      }
    } else {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
      if (hoveredCard) setHoveredCard(null);
    }
  }, [hoveredCard]);

  const handleCanvasMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setHoveredCard(null);
  }, []);

  if (!battle) return <div style={{ padding: 20, color: '#eee' }}>No active battle.</div>;

  const human = battle.player1;
  const opponent = battle.player2;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#eee', position: 'relative', padding: '24px 0' }}>
      {/* DOM Battle Intro overlay */}
      {showIntro && (
        <BattleIntro
          playerName={human.name}
          opponentName={opponent.name}
          playerCritters={human.critters}
          opponentCritters={opponent.critters}
          onComplete={handleIntroComplete}
        />
      )}

      {/* Canvas container */}
      <div
        ref={containerRef}
        onMouseMove={handleCanvasMouseMove}
        onMouseLeave={handleCanvasMouseLeave}
        style={{
          width: '100%',
          maxWidth: 800,
          height: computeCanvasHeight(human.reelHeight),
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ display: 'block', width: '100%', height: '100%' }}
        />

        {/* HUD Overlay - Positioned absolute over canvas */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          pointerEvents: 'none',
          padding: '8px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          zIndex: 10,
        }}>
          <div className="font-display" style={{
            fontSize: 14,
            color: '#aaa',
            background: 'rgba(0,0,0,0.6)',
            padding: '4px 10px',
            borderRadius: 6,
          }}>
            {opponent.name} | Morale: {opponent.morale} | Res: {opponent.resources}
          </div>
          <div className="font-display" style={{
            fontSize: 14,
            color: '#eee',
            background: 'rgba(0,0,0,0.6)',
            padding: '4px 10px',
            borderRadius: 6,
          }}>
            {human.name} | Morale: {human.morale} | Res: {human.resources}
          </div>
        </div>
      </div>

      {/* Card hover zoom overlay */}
      {hoveredCard && (
        <CardZoom
          card={hoveredCard.card}
          definition={hoveredCard.def}
          anchorRect={hoveredCard.rect}
        />
      )}

      {/* Controls */}
      <div style={{ marginTop: 14, display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
        {!battle.isComplete ? (
          !autoPlaying ? (
            <button
              onClick={handleGo}
              disabled={showIntro || !sceneReady}
              className="font-display"
              style={{
                padding: '14px 44px',
                fontSize: 22,
                fontWeight: 'bold',
                background: 'linear-gradient(180deg, #3498db, #2980b9)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                letterSpacing: 2,
                textTransform: 'uppercase',
                boxShadow: '0 4px 15px rgba(52, 152, 219, 0.4)',
                opacity: (showIntro || !sceneReady) ? 0.5 : 1,
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
              padding: '14px 44px',
              fontSize: 22,
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
      <div style={{ marginTop: 14, zIndex: 1, width: '100%', maxWidth: 790 }}>
        <BattleLog log={battle.log} />
      </div>
    </div>
  );
}
