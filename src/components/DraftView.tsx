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

  function handleSlotClick(row: number, col: number) {
    if (selectedCard === null) return;
    playSfx('place');
    draftPick(selectedCard, col, row);
    setSelectedCard(null);
  }

  // Build set of placeable slots: any empty slot
  const placeableSlots = new Set<string>();
  if (selectedCard !== null) {
    for (let row = 0; row < human.reelHeight; row++) {
      for (let col = 0; col < REEL_WIDTH; col++) {
        if (!human.reels[row]?.[col]?.card) {
          placeableSlots.add(`${row},${col}`);
        }
      }
    }
  }

  return (
    <div style={{ padding: 30, fontFamily: 'monospace', color: '#eee', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <h2>Initial Draft</h2>
      <p style={{ color: '#aaa', fontSize: 18 }}>
        Pack {currentPackIdx + 1} of {packs.length} ({isCommonPack ? 'Common' : 'Uncommon'})
        {' '} - Pick 1 card, then place it in your reel
      </p>

      <div style={{ display: 'flex', gap: 18, marginTop: 24 }}>
        {currentPack.map((card, idx) => (
          <CardSlot
            key={idx}
            definition={card}
            onClick={() => { playSfx('click'); setSelectedCard(idx); }}
            selected={selectedCard === idx}
          />
        ))}
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
                        card={null}
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
