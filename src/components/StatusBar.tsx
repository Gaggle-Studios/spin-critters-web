import type { PlayerState, TournamentState } from '../engine/types.ts';

interface StatusBarProps {
  tournament: TournamentState;
}

export function StatusBar({ tournament }: StatusBarProps) {
  const human = tournament.players.find((p) => p.id === tournament.humanPlayerId);
  if (!human) return null;

  const moralePct = (human.morale / 50) * 100;

  return (
    <div style={{
      background: '#1a1a2e',
      padding: '8px 16px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottom: '2px solid #333',
      fontFamily: 'monospace',
      color: '#eee',
    }}>
      <div>
        <strong>SPIN CRITTERS</strong>
        <span style={{ marginLeft: 16, color: '#aaa' }}>
          Round {tournament.round} | Battle {tournament.battleInRound + 1}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
        <div>
          <span style={{ color: '#aaa', marginRight: 4 }}>Morale:</span>
          <div style={{
            display: 'inline-block',
            width: 100,
            height: 14,
            background: '#333',
            borderRadius: 7,
            overflow: 'hidden',
            verticalAlign: 'middle',
          }}>
            <div style={{
              width: `${moralePct}%`,
              height: '100%',
              background: moralePct > 50 ? '#27ae60' : moralePct > 25 ? '#f39c12' : '#e74c3c',
              borderRadius: 7,
            }} />
          </div>
          <span style={{ marginLeft: 4 }}>{human.morale}/50</span>
        </div>
        <div>
          <span style={{ color: '#aaa', marginRight: 4 }}>Resources:</span>
          <span style={{ color: '#f1c40f', fontWeight: 'bold' }}>{human.resources}</span>
        </div>
        <div style={{ color: '#aaa' }}>
          Players alive: {tournament.players.filter((p) => p.morale > 0).length}/{tournament.players.length}
        </div>
      </div>
    </div>
  );
}
