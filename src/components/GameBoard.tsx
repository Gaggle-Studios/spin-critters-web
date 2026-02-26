import { useGameStore } from '../store/gameStore.ts';
import { StatusBar } from './StatusBar.tsx';
import { CritterSelect } from './CritterSelect.tsx';
import { DraftView } from './DraftView.tsx';
import { BattleView } from './BattleView.tsx';
import { ShopView } from './ShopView.tsx';
import { MainMenu } from './MainMenu.tsx';
import { LobbyView } from './LobbyView.tsx';
import { MultiplayerGameView } from './MultiplayerGameView.tsx';

export function GameBoard() {
  const mode = useGameStore((s) => s.mode);
  const tournament = useGameStore((s) => s.tournament);
  const playAgain = useGameStore((s) => s.playAgain);
  const roomId = useGameStore((s) => s.roomId);
  const multiplayerState = useGameStore((s) => s.multiplayerState);

  // Main menu
  if (mode === 'menu') {
    return <MainMenu />;
  }

  // Multiplayer mode
  if (mode === 'multiplayer') {
    // Show lobby if no game state yet
    if (!multiplayerState) {
      return <LobbyView />;
    }
    // Show the multiplayer game view
    return <MultiplayerGameView />;
  }

  // Single-player mode (existing behavior)
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
      padding: 60,
            color: '#eee',
      textAlign: 'center',
      maxWidth: 600,
      margin: '0 auto',
    }}>
      <h1 style={{ color: isWinner ? '#f1c40f' : '#e74c3c', fontSize: 48 }}>
        {isWinner ? 'VICTORY!' : 'GAME OVER'}
      </h1>
      <p style={{ fontSize: 24, color: '#aaa' }}>
        {isWinner
          ? 'You defeated all opponents!'
          : `You were eliminated in round ${tournament.round}`}
      </p>

      <div style={{ marginTop: 36, textAlign: 'left' }}>
        <h3>Final Standings</h3>
        {alive.map((p, i) => (
          <div key={p.id} style={{ padding: '8px 0', color: p.isHuman ? '#f1c40f' : '#aaa' }}>
            #{i + 1} {p.name} - Morale: {p.morale}
          </div>
        ))}
        {tournament.eliminationOrder.map((id, i) => {
          const p = tournament.players.find((pl) => pl.id === id)!;
          return (
            <div key={id} style={{ padding: '8px 0', color: p.isHuman ? '#e74c3c' : '#555' }}>
              Eliminated #{i + 1}: {p.name}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 36 }}>
        <h3>Battle History</h3>
        {tournament.matchHistory.map((m, i) => {
          const p1 = tournament.players.find((p) => p.id === m.p1)!;
          const p2 = tournament.players.find((p) => p.id === m.p2)!;
          const winner = tournament.players.find((p) => p.id === m.winner)!;
          return (
            <div key={i} style={{ padding: '4px 0', fontSize: 17, color: '#888' }}>
              {p1.name} vs {p2.name} - Winner: {winner.name}
            </div>
          );
        })}
      </div>

      <button
        onClick={onPlayAgain}
        style={{
          marginTop: 48,
          padding: '18px 48px',
          fontSize: 24,
          fontWeight: 'bold',
          background: '#27ae60',
          color: '#fff',
          border: 'none',
          borderRadius: 9,
          cursor: 'pointer',
                  }}
      >
        Play Again
      </button>
    </div>
  );
}
