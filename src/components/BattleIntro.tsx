import { useEffect, useState } from 'react';
import type { CardInstance } from '../engine/types.ts';
import { BIOME_COLORS } from '../engine/constants.ts';
import { playSfx } from '../audio/sfx.ts';

interface BattleIntroProps {
  playerName: string;
  opponentName: string;
  playerCritters: CardInstance[];
  opponentCritters: CardInstance[];
  onComplete: () => void;
}

function CritterPortrait({ critter }: { critter: CardInstance }) {
  const bgColor = BIOME_COLORS[critter.biome] || '#444';
  const imageUrl = `/critters/${critter.definitionId}.png`;
  const [imgError, setImgError] = useState(false);

  return (
    <div style={{
      width: 80,
      height: 80,
      borderRadius: '50%',
      border: `3px solid ${bgColor}`,
      background: bgColor,
      overflow: 'hidden',
      boxShadow: `0 0 15px ${bgColor}88`,
      flexShrink: 0,
    }}>
      {!imgError ? (
        <img
          src={imageUrl}
          alt={critter.name}
          onError={() => setImgError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 'bold',
          color: '#fff',
          textShadow: '0 1px 2px rgba(0,0,0,0.5)',
        }}>
          {critter.name}
        </div>
      )}
    </div>
  );
}

export function BattleIntro({ playerName, opponentName, playerCritters, opponentCritters, onComplete }: BattleIntroProps) {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    playSfx('battleStart');

    const fadeTimer = setTimeout(() => setFadeOut(true), 1900);
    const completeTimer = setTimeout(() => onComplete(), 2200);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div
      className={`battle-intro-overlay${fadeOut ? ' fade-out' : ''}`}
      onClick={() => { setFadeOut(true); setTimeout(onComplete, 200); }}
    >
      {/* Background pulse */}
      <div className="battle-intro-bg" />

      {/* Player side (left) */}
      <div
        className="battle-intro-left"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 12,
          padding: '0 40px',
          flex: 1,
          maxWidth: 400,
        }}
      >
        <div className="font-display" style={{
          fontSize: 32,
          color: '#3498db',
          textShadow: '0 0 20px rgba(52, 152, 219, 0.5)',
          textAlign: 'right',
        }}>
          {playerName}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          {playerCritters.map((c) => (
            <CritterPortrait key={c.instanceId} critter={c} />
          ))}
        </div>
      </div>

      {/* VS */}
      <div
        className="battle-intro-vs font-display"
        style={{
          fontSize: 72,
          color: '#FFD700',
          textShadow: '0 0 30px rgba(255, 215, 0, 0.6), 0 0 60px rgba(255, 215, 0, 0.3)',
          userSelect: 'none',
          lineHeight: 1,
        }}
      >
        VS
      </div>

      {/* Opponent side (right) */}
      <div
        className="battle-intro-right"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 12,
          padding: '0 40px',
          flex: 1,
          maxWidth: 400,
        }}
      >
        <div className="font-display" style={{
          fontSize: 32,
          color: '#e74c3c',
          textShadow: '0 0 20px rgba(231, 76, 60, 0.5)',
        }}>
          {opponentName}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {opponentCritters.map((c) => (
            <CritterPortrait key={c.instanceId} critter={c} />
          ))}
        </div>
      </div>
    </div>
  );
}
