import { useState } from 'react';
import { REEL_WIDTH } from '../engine/constants.ts';
import { useGameStore } from '../store/gameStore.ts';
import { CardSlot } from './CardSlot.tsx';
import { playSfx } from '../audio/sfx.ts';

export function DraftView() {
  const tournament = useGameStore((s) => s.tournament);
  const draftPick = useGameStore((s) => s.draftPick);
  const [selectedCard, setSelectedCard] = useState<number | null>(null);

  const packs = tournament.draftPacks;
  if (!packs) return null;

  const currentPackIdx = tournament.currentDraftPack;
  if (currentPackIdx >= packs.length) return null;

  const currentPack = packs[currentPackIdx];
  const isCommonPack = currentPackIdx < 5;
  const human = tournament.players.find((p) => p.id === tournament.humanPlayerId)!;

  function handleColumnClick(col: number) {
    if (selectedCard === null) return;
    playSfx('place');
    draftPick(selectedCard, col);
    setSelectedCard(null);
  }

  return (
    <div style={{ padding: 20, fontFamily: 'monospace', color: '#eee', maxWidth: 700, margin: '0 auto' }}>
      <h2>Initial Draft</h2>
      <p style={{ color: '#aaa', fontSize: 12 }}>
        Pack {currentPackIdx + 1} of {packs.length} ({isCommonPack ? 'Common' : 'Uncommon'})
        {' '} - Pick 1 card, then choose a column
      </p>

      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        {currentPack.map((card, idx) => (
          <CardSlot
            key={idx}
            definition={card}
            onClick={() => { playSfx('click'); setSelectedCard(idx); }}
            selected={selectedCard === idx}
          />
        ))}
      </div>

      {selectedCard !== null && (
        <div style={{ marginTop: 20 }}>
          <p style={{ color: '#aaa' }}>Place in column:</p>
          <div style={{ display: 'flex', gap: 8 }}>
            {Array.from({ length: REEL_WIDTH }, (_, col) => {
              let cardCount = 0;
              for (let row = 0; row < human.reelHeight; row++) {
                if (human.reels[row]?.[col]?.card) cardCount++;
              }
              return (
                <button
                  key={col}
                  onClick={() => handleColumnClick(col)}
                  disabled={cardCount >= human.reelHeight}
                  style={{
                    width: 80,
                    height: 50,
                    border: '2px solid #555',
                    borderRadius: 6,
                    background: '#1a1a2e',
                    color: '#eee',
                    cursor: cardCount >= human.reelHeight ? 'not-allowed' : 'pointer',
                    fontFamily: 'monospace',
                    fontSize: 11,
                    opacity: cardCount >= human.reelHeight ? 0.4 : 1,
                  }}
                >
                  Col {col + 1}<br />({cardCount}/{human.reelHeight})
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
