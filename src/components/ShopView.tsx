import { useState } from 'react';
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

  const human = tournament.players.find((p) => p.id === tournament.humanPlayerId)!;
  const pack = tournament.shopPack;
  if (!pack) return null;

  function handleSlotClick(row: number, col: number) {
    if (selectedCard === null) return;
    playSfx('purchase');
    buyCard(selectedCard, col, row);
    setSelectedCard(null);
  }

  function handleReroll() {
    playSfx('reroll');
    rerollShop();
  }

  // Build a set of placeable slots: empty or junk
  const placeableSlots = new Set<string>();
  if (selectedCard !== null) {
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

      <div style={{ display: 'flex', gap: 18, marginTop: 24 }}>
        {pack.cards.map((card, idx) => {
          const cost = SHOP_COST[card.rarity] || 2;
          const canAfford = human.resources >= cost;
          return (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9 }}>
              <div style={{ opacity: canAfford ? 1 : 0.4 }}>
                <CardSlot
                  definition={card}
                  onClick={() => { if (canAfford) { playSfx('click'); setSelectedCard(idx); } }}
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

      <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'center' }}>
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
            fontFamily: 'monospace',
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
            fontFamily: 'monospace',
            fontWeight: 'bold',
          }}
        >
          Skip
        </button>
      </div>

      {/* Reel grid with clickable placement slots */}
      <div style={{ marginTop: 30 }}>
        <div style={{
          fontFamily: 'monospace',
          fontSize: 12,
          color: '#aaa',
          marginBottom: 4,
          fontWeight: 'bold',
          textAlign: 'center',
        }}>
          Your Reels{selectedCard !== null ? ' — click a highlighted slot to place card' : ''}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
          {Array.from({ length: human.reelHeight }, (_, row) => (
            <div key={row} style={{ display: 'flex', gap: 3 }}>
              {Array.from({ length: REEL_WIDTH }, (_, col) => {
                const slot = human.reels[row]?.[col];
                const card = slot?.card ?? null;
                const isPlaceable = placeableSlots.has(`${row},${col}`);

                if (isPlaceable) {
                  return (
                    <div
                      key={col}
                      onClick={() => handleSlotClick(row, col)}
                      style={{ cursor: 'pointer' }}
                    >
                      <CardSlot
                        card={card}
                        compact
                        highlight="#27ae60"
                      />
                    </div>
                  );
                }

                return (
                  <CardSlot
                    key={col}
                    card={card}
                    compact
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
