import { useState, useMemo } from 'react';
import type { CardInstance, Biome } from '../engine/types.ts';
import { BIOME_COLORS } from '../engine/constants.ts';
import { CardSlot } from './CardSlot.tsx';

const PHANTOM_COUNT = 10;
const CARD_H = 150;
const CARD_W = 100;
const BASE_DURATION = 600;
const STAGGER_PER_COL = 150;

const BIOMES: Biome[] = ['Red', 'Blue', 'Cream', 'Brown', 'Green'];

interface PhantomData {
  biome: Biome;
  attack: number;
  health: number;
}

function PhantomCard({ biome, attack, health }: PhantomData) {
  return (
    <div style={{
      width: CARD_W,
      height: CARD_H,
      background: BIOME_COLORS[biome],
      borderRadius: 6,
      border: '2px solid #888',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '6px 4px',
      boxSizing: 'border-box',
      fontFamily: 'monospace',
      flexShrink: 0,
    }}>
      <div style={{
        background: 'rgba(0,0,0,0.5)',
        padding: '2px 4px',
        borderRadius: 3,
        fontSize: 9,
        fontWeight: 'bold',
        color: '#fff',
      }}>
        ???
      </div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        background: 'rgba(0,0,0,0.5)',
        padding: '2px 4px',
        borderRadius: 3,
        fontSize: 9,
        fontWeight: 'bold',
      }}>
        <span style={{ color: '#ff6b6b' }}>{attack}A</span>
        <span style={{ color: '#6bff6b' }}>{health}H</span>
      </div>
    </div>
  );
}

interface ReelSpinnerProps {
  resultCard: CardInstance | null;
  col: number;
}

export function ReelSpinner({ resultCard, col }: ReelSpinnerProps) {
  const [landed, setLanded] = useState(false);

  const phantoms = useMemo<PhantomData[]>(() =>
    Array.from({ length: PHANTOM_COUNT }, () => ({
      biome: BIOMES[Math.floor(Math.random() * BIOMES.length)],
      attack: Math.floor(Math.random() * 7) + 1,
      health: Math.floor(Math.random() * 30) + 5,
    })),
  []);

  // No card = locked/empty column, skip animation
  if (!resultCard) {
    return <CardSlot card={null} isActive />;
  }

  // After landing, show the real card with a bounce
  if (landed) {
    return (
      <div className="reel-landed">
        <CardSlot card={resultCard} isActive />
      </div>
    );
  }

  const duration = BASE_DURATION + col * STAGGER_PER_COL;
  const offset = -(PHANTOM_COUNT * CARD_H);

  return (
    <div style={{
      width: CARD_W,
      height: CARD_H,
      overflow: 'hidden',
      position: 'relative',
      borderRadius: 6,
    }}>
      <div
        onAnimationEnd={() => setLanded(true)}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: CARD_W,
          display: 'flex',
          flexDirection: 'column',
          '--reel-offset': `${offset}px`,
          animation: `reelSpin ${duration}ms cubic-bezier(0.25, 1, 0.5, 1) forwards`,
        } as React.CSSProperties}
      >
        {phantoms.map((p, i) => (
          <PhantomCard key={i} {...p} />
        ))}
        <CardSlot card={resultCard} isActive />
      </div>
    </div>
  );
}
