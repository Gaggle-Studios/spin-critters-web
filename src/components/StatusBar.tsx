import { useState } from 'react';
import type { PlayerState, TournamentState } from '../engine/types.ts';
import { isMuted, setMuted } from '../audio/sfx.ts';

interface StatusBarProps {
  tournament: TournamentState;
}

export function StatusBar({ tournament }: StatusBarProps) {
  const human = tournament.players.find((p) => p.id === tournament.humanPlayerId);
  const [muted, setMutedState] = useState(isMuted());
  if (!human) return null;

  const moralePct = (human.morale / 50) * 100;

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  }

  return (
    <div style={{
      background: '#1a1a2e',
      padding: '24px 48px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottom: '3px solid #333',
      fontFamily: 'monospace',
      color: '#eee',
    }}>
      <div>
        <strong>SPIN CRITTERS</strong>
        <span style={{ marginLeft: 24, color: '#aaa' }}>
          Round {tournament.round} | Battle {tournament.battleInRound + 1}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 36, alignItems: 'center' }}>
        <div>
          <span style={{ color: '#aaa', marginRight: 8 }}>Morale:</span>
          <div style={{
            display: 'inline-block',
            width: 150,
            height: 21,
            background: '#333',
            borderRadius: 10,
            overflow: 'hidden',
            verticalAlign: 'middle',
          }}>
            <div style={{
              width: `${moralePct}%`,
              height: '100%',
              background: moralePct > 50 ? '#27ae60' : moralePct > 25 ? '#f39c12' : '#e74c3c',
              borderRadius: 10,
            }} />
          </div>
          <span style={{ marginLeft: 8 }}>{human.morale}/50</span>
        </div>
        <div>
          <span style={{ color: '#aaa', marginRight: 8 }}>Resources:</span>
          <span style={{ color: '#f1c40f', fontWeight: 'bold' }}>{human.resources}</span>
        </div>
        <div style={{ color: '#aaa' }}>
          Players alive: {tournament.players.filter((p) => p.morale > 0).length}/{tournament.players.length}
        </div>
        <button
          onClick={toggleMute}
          style={{
            background: 'none', border: '2px solid #555', borderRadius: 6,
            color: '#aaa', cursor: 'pointer', fontFamily: 'monospace',
            fontSize: 21, padding: '3px 12px',
          }}
          title={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? 'Sound OFF' : 'Sound ON'}
        </button>
      </div>
    </div>
  );
}
