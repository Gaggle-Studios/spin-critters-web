import { useGameStore } from '../store/gameStore.ts';
import { StatusBar } from './StatusBar.tsx';
import { CritterSelect } from './CritterSelect.tsx';
import { DraftView } from './DraftView.tsx';
import { BattleView } from './BattleView.tsx';
import { ShopView } from './ShopView.tsx';

export function GameBoard() {
  const tournament = useGameStore((s) => s.tournament);
  const playAgain = useGameStore((s) => s.playAgain);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0d0d1a',
    }}>
      {tournament.phase !== 'critter-select' && (
        <StatusBar tournament={tournament} />
      )}

      {tournament.phase === 'critter-select' && <CritterSelect />}
      {tournament.phase === 'initial-draft' && <DraftView />}
      {tournament.phase === 'battle' && <BattleView />}
      {tournament.phase === 'shop' && <ShopView />}
      {tournament.phase === 'game-over' && (
        <GameOver tournament={tournament} onPlayAgain={playAgain} />
      )}
    </div>
  );
}

function GameOver({ tournament, onPlayAgain }: {
  tournament: ReturnType<typeof useGameStore.getState>['tournament'];
  onPlayAgain: () => void;
}) {
  const human = tournament.players.find((p) => p.id === tournament.humanPlayerId)!;
  const isWinner = human.morale > 0 && tournament.players.filter((p) => p.morale > 0).length <= 1;
  const alive = tournament.players.filter((p) => p.morale > 0);

  return (
    <div style={{
      padding: 40,
      fontFamily: 'monospace',
      color: '#eee',
      textAlign: 'center',
      maxWidth: 600,
      margin: '0 auto',
    }}>
      <h1 style={{ color: isWinner ? '#f1c40f' : '#e74c3c', fontSize: 32 }}>
        {isWinner ? 'VICTORY!' : 'GAME OVER'}
      </h1>
      <p style={{ fontSize: 16, color: '#aaa' }}>
        {isWinner
          ? 'You defeated all opponents!'
          : `You were eliminated in round ${tournament.round}`}
      </p>

      <div style={{ marginTop: 24, textAlign: 'left' }}>
        <h3>Final Standings</h3>
        {alive.map((p, i) => (
          <div key={p.id} style={{ padding: '4px 0', color: p.isHuman ? '#f1c40f' : '#aaa' }}>
            #{i + 1} {p.name} - Morale: {p.morale}
          </div>
        ))}
        {tournament.eliminationOrder.map((id, i) => {
          const p = tournament.players.find((pl) => pl.id === id)!;
          return (
            <div key={id} style={{ padding: '4px 0', color: p.isHuman ? '#e74c3c' : '#555' }}>
              Eliminated #{i + 1}: {p.name}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 24 }}>
        <h3>Battle History</h3>
        {tournament.matchHistory.map((m, i) => {
          const p1 = tournament.players.find((p) => p.id === m.p1)!;
          const p2 = tournament.players.find((p) => p.id === m.p2)!;
          const winner = tournament.players.find((p) => p.id === m.winner)!;
          return (
            <div key={i} style={{ padding: '2px 0', fontSize: 11, color: '#888' }}>
              {p1.name} vs {p2.name} - Winner: {winner.name}
            </div>
          );
        })}
      </div>

      <button
        onClick={onPlayAgain}
        style={{
          marginTop: 32,
          padding: '12px 32px',
          fontSize: 16,
          fontWeight: 'bold',
          background: '#27ae60',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
          fontFamily: 'monospace',
        }}
      >
        Play Again
      </button>
    </div>
  );
}
