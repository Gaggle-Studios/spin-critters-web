import type { PlayerState, CardInstance } from '../engine/types.ts';
import { REEL_WIDTH } from '../engine/constants.ts';
import { CardSlot } from './CardSlot.tsx';

interface ReelGridProps {
  player: PlayerState;
  activeCards?: (CardInstance | null)[];
  compact?: boolean;
  label?: string;
}

export function ReelGrid({ player, activeCards, compact, label }: ReelGridProps) {
  return (
    <div>
      {label && (
        <div style={{
          fontFamily: 'monospace',
          fontSize: 12,
          color: '#aaa',
          marginBottom: 4,
          fontWeight: 'bold',
          textAlign: 'center',
        }}>
          {label} (Morale: {player.morale})
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
        {Array.from({ length: player.reelHeight }, (_, row) => (
          <div key={row} style={{ display: 'flex', gap: 3 }}>
            {Array.from({ length: REEL_WIDTH }, (_, col) => {
              const slot = player.reels[row]?.[col];
              const card = slot?.card ?? null;
              const isActive = activeCards
                ? activeCards[col]?.instanceId === card?.instanceId && card !== null
                : false;
              return (
                <CardSlot
                  key={col}
                  card={card}
                  isActive={isActive}
                  compact={compact}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
