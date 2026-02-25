import { useState } from 'react';
import { useGameStore } from '../store/gameStore.ts';
import { SHOP_COST, REEL_WIDTH } from '../engine/constants.ts';
import { ReelGrid } from './ReelGrid.tsx';
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

  function handleColumnClick(col: number) {
    if (selectedCard === null) return;
    playSfx('purchase');
    buyCard(selectedCard, col);
    setSelectedCard(null);
  }

  function handleReroll() {
    playSfx('reroll');
    rerollShop();
  }

  return (
    <div style={{ padding: 30, fontFamily: 'monospace', color: '#eee', maxWidth: 600, margin: '0 auto' }}>
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

      {selectedCard !== null && (
        <div style={{ marginTop: 24 }}>
          <p style={{ color: '#aaa' }}>Place in column:</p>
          <div style={{ display: 'flex', gap: 12 }}>
            {Array.from({ length: REEL_WIDTH }, (_, col) => {
              let cardCount = 0;
              let hasJunk = false;
              for (let row = 0; row < human.reelHeight; row++) {
                if (human.reels[row]?.[col]?.card) {
                  cardCount++;
                  if (human.reels[row][col].card!.category === 'Junk') hasJunk = true;
                }
              }
              const canPlace = cardCount < human.reelHeight || hasJunk;
              return (
                <button
                  key={col}
                  onClick={() => canPlace && handleColumnClick(col)}
                  disabled={!canPlace}
                  style={{
                    width: 120,
                    height: 75,
                    border: '3px solid #555',
                    borderRadius: 7,
                    background: '#1a1a2e',
                    color: '#eee',
                    cursor: canPlace ? 'pointer' : 'not-allowed',
                    fontFamily: 'monospace',
                    fontSize: 17,
                    opacity: canPlace ? 1 : 0.4,
                  }}
                >
                  Col {col + 1}<br />({cardCount}/{human.reelHeight})
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
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

      <div style={{ marginTop: 30 }}>
        <ReelGrid player={human} label="Your Reels" compact />
      </div>
    </div>
  );
}
