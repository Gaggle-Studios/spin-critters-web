import { useState, useRef } from 'react';
import { useGameStore } from '../store/gameStore.ts';
import { SHOP_COST, REEL_WIDTH } from '../engine/constants.ts';
import { CardSlot } from './CardSlot.tsx';
import { playSfx } from '../audio/sfx.ts';

export function ShopView() {
  const tournament = useGameStore((s) => s.tournament);
  const buyCard = useGameStore((s) => s.buyCard);
  const rerollShop = useGameStore((s) => s.rerollShop);
  const skipShop = useGameStore((s) => s.skipShop);
  const [selectedCard, setSelectedCard] = useState<number | null>(null);

  // Placement animation state
  const [placedSlot, setPlacedSlot] = useState<{ row: number; col: number } | null>(null);
  const [placedName, setPlacedName] = useState<string | null>(null);
  const placingRef = useRef(false);

  const human = tournament.players.find((p) => p.id === tournament.humanPlayerId)!;
  const pack = tournament.shopPack;
  if (!pack) return null;

  function handleSlotClick(row: number, col: number) {
    if (selectedCard === null || placingRef.current) return;

    // Show placement animation before committing
    placingRef.current = true;
    const cardName = pack!.cards[selectedCard].name;
    setPlacedSlot({ row, col });
    setPlacedName(cardName);
    playSfx('purchase');
    playSfx('place');

    const cardIdx = selectedCard;
    setSelectedCard(null);

    // Delay the actual state transition so the player sees what happened
    setTimeout(() => {
      buyCard(cardIdx, col, row);
      placingRef.current = false;
      setPlacedSlot(null);
      setPlacedName(null);
    }, 1200);
  }

  function handleReroll() {
    playSfx('reroll');
    rerollShop();
  }

  // Build a set of placeable slots: empty or junk
  const placeableSlots = new Set<string>();
  if (selectedCard !== null && !placingRef.current) {
    for (let row = 0; row < human.reelHeight; row++) {
      for (let col = 0; col < REEL_WIDTH; col++) {
        const card = human.reels[row]?.[col]?.card;
        if (!card || card.category === 'Junk') {
          placeableSlots.add(`${row},${col}`);
        }
      }
    }
  }

  return (
    <div style={{ padding: 30, fontFamily: 'monospace', color: '#eee', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <h2>Shop Phase - Round {tournament.round}</h2>
      <p style={{ color: '#aaa', fontSize: 18 }}>
        Resources: <span style={{ color: '#f1c40f', fontWeight: 'bold' }}>{human.resources}</span>
      </p>

      {/* Placement confirmation banner */}
      {placedName && (
        <div style={{
          marginTop: 12,
          padding: '10px 28px',
          background: 'linear-gradient(90deg, rgba(39,174,96,0.15), rgba(39,174,96,0.3), rgba(39,174,96,0.15))',
          border: '1px solid #27ae60',
          borderRadius: 8,
          color: '#27ae60',
          fontWeight: 'bold',
          fontSize: 16,
          textAlign: 'center',
          animation: 'tutorialFadeIn 0.3s ease-out',
        }}>
          Placed {placedName}!
        </div>
      )}

      {/* Pack cards */}
      <div style={{
        display: 'flex',
        gap: 18,
        marginTop: 24,
        opacity: placingRef.current ? 0.4 : 1,
        pointerEvents: placingRef.current ? 'none' : 'auto',
        transition: 'opacity 0.3s',
      }}>
        {pack.cards.map((card, idx) => {
          const cost = SHOP_COST[card.rarity] || 2;
          const canAfford = human.resources >= cost;
          return (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9 }}>
              <div style={{ opacity: canAfford ? 1 : 0.4 }}>
                <CardSlot
                  definition={card}
                  onClick={() => { if (canAfford && !placingRef.current) { playSfx('click'); setSelectedCard(idx); } }}
                  selected={selectedCard === idx}
                />
              </div>
              <div style={{
                padding: '3px 12px',
                background: canAfford ? '#27ae60' : '#555',
                borderRadius: 6,
                fontSize: 17,
                fontWeight: 'bold',
                color: '#fff',
              }}>
                Cost: {cost}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{
        marginTop: 24,
        display: 'flex',
        gap: 12,
        justifyContent: 'center',
        opacity: placingRef.current ? 0.4 : 1,
        pointerEvents: placingRef.current ? 'none' : 'auto',
        transition: 'opacity 0.3s',
      }}>
        <button
          onClick={handleReroll}
          disabled={human.resources < 2}
          style={{
            padding: '12px 24px',
            background: human.resources >= 2 ? '#e67e22' : '#555',
            color: '#fff',
            border: 'none',
            borderRadius: 7,
            cursor: human.resources >= 2 ? 'pointer' : 'not-allowed',
            fontWeight: 'bold',
          }}
        >
          Reroll (2 res)
        </button>
        <button
          onClick={skipShop}
          style={{
            padding: '12px 24px',
            background: '#555',
            color: '#fff',
            border: 'none',
            borderRadius: 7,
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          Skip
        </button>
      </div>

      {/* Reel grid with clickable placement slots */}
      <div style={{ marginTop: 30 }}>
        <div style={{
          fontSize: 12,
          color: '#aaa',
          marginBottom: 4,
          fontWeight: 'bold',
          textAlign: 'center',
        }}>
          Your Reels{selectedCard !== null && !placingRef.current ? ' — click a highlighted slot to place card' : ''}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
          {Array.from({ length: human.reelHeight }, (_, row) => (
            <div key={row} style={{ display: 'flex', gap: 3 }}>
              {Array.from({ length: REEL_WIDTH }, (_, col) => {
                const slot = human.reels[row]?.[col];
                const card = slot?.card ?? null;
                const isPlaceable = placeableSlots.has(`${row},${col}`);
                const isPlacedHere = placedSlot?.row === row && placedSlot?.col === col;

                return (
                  <div
                    key={col}
                    onClick={() => { if (isPlaceable) handleSlotClick(row, col); }}
                    style={{
                      cursor: isPlaceable ? 'pointer' : 'default',
                      position: 'relative',
                    }}
                  >
                    <CardSlot
                      card={card}
                      compact
                      highlight={isPlaceable ? '#27ae60' : undefined}
                    />
                    {/* Placement animation overlay */}
                    {isPlacedHere && (
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: 6,
                        border: '3px solid #f1c40f',
                        boxShadow: '0 0 20px rgba(241, 196, 15, 0.6), inset 0 0 20px rgba(241, 196, 15, 0.2)',
                        animation: 'shopPlaceGlow 1.2s ease-out forwards',
                        pointerEvents: 'none',
                        zIndex: 5,
                      }} />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
