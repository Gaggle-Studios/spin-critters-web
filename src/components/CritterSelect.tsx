import { useState } from 'react';
import type { Biome } from '../engine/types.ts';
import { BIOME_COLORS, MAX_SAME_BIOME_CRITTERS, REEL_WIDTH } from '../engine/constants.ts';
import { useGameStore } from '../store/gameStore.ts';
import { CardSlot } from './CardSlot.tsx';
import { playSfx } from '../audio/sfx.ts';

const BIOMES: Biome[] = ['Red', 'Blue', 'Cream', 'Brown', 'Green'];

export function CritterSelect() {
  const allCritters = useGameStore((s) => s.allCritters);
  const selectCritters = useGameStore((s) => s.selectCritters);

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
      playSfx('deselect');
    } else if (selected.length < 3) {
      const critter = allCritters.find((c) => c.cardId === cardId)!;
      if ((biomeCounts[critter.biome] || 0) < MAX_SAME_BIOME_CRITTERS) {
        setSelected([...selected, cardId]);
        playSfx('click');
      }
    }
  }

  function startPlacement() {
    if (selected.length === 3) {
      setPlacementPhase(true);
      setPlacements([]);
    }
  }

  function placeInColumn(col: number) {
    if (placements.includes(col)) return;
    playSfx('place');
    const newPlacements = [...placements, col];
    setPlacements(newPlacements);

    if (newPlacements.length === 3) {
      selectCritters(selected, newPlacements);
    }
  }

  if (placementPhase) {
    const currentIdx = placements.length;
    const currentCritter = currentIdx < 3 ? allCritters.find((c) => c.cardId === selected[currentIdx]) : null;

    return (
      <div style={{ padding: 40, fontFamily: 'monospace', color: '#eee', maxWidth: 700, margin: '0 auto' }}>
        <h2>Place Your Critters</h2>
        {currentCritter && (
          <p>
            Place <strong style={{ color: BIOME_COLORS[currentCritter.biome] }}>{currentCritter.name}</strong> in a column:
          </p>
        )}
        <div style={{ display: 'flex', gap: 16, marginTop: 32 }}>
          {Array.from({ length: REEL_WIDTH }, (_, col) => {
            const placedIdx = placements.indexOf(col);
            const placedCritter = placedIdx >= 0 ? allCritters.find((c) => c.cardId === selected[placedIdx]) : null;
            if (placedCritter) {
              return (
                <CardSlot
                  key={col}
                  definition={placedCritter }
                />
              );
            }
            return (
              <div
                key={col}
                onClick={() => placeInColumn(col)}
                style={{
                  width: 200,
                  height: 300,
                  border: '3px dashed #555',
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  background: '#1a1a2e',
                  color: '#eee',
                  fontSize: 24,
                  fontWeight: 'bold',
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
    <div style={{ padding: 40, fontFamily: 'monospace', color: '#eee', maxWidth: 800, margin: '0 auto' }}>
      <h2>Select 3 Critters</h2>
      <p style={{ color: '#aaa', fontSize: 24 }}>
        Max {MAX_SAME_BIOME_CRITTERS} from the same biome. Selected: {selected.length}/3
      </p>

      {BIOMES.map((biome) => {
        const critters = allCritters.filter((c) => c.biome === biome);
        return (
          <div key={biome} style={{ marginBottom: 32 }}>
            <h3 style={{ color: BIOME_COLORS[biome], margin: '16px 0 8px' }}>{biome} Biome</h3>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
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
                    <CardSlot
                      definition={critter }
                      selected={isSelected}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {selected.length === 3 && (
        <button
          onClick={startPlacement}
          style={{
            marginTop: 32,
            padding: '20px 48px',
            fontSize: 28,
            fontWeight: 'bold',
            background: '#27ae60',
            color: '#fff',
            border: 'none',
            borderRadius: 9,
            cursor: 'pointer',
            fontFamily: 'monospace',
          }}
        >
          Place Critters in Columns
        </button>
      )}
    </div>
  );
}
