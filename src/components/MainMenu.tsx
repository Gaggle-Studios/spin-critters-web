import { useGameStore } from '../store/gameStore.ts';

export function MainMenu() {
  const startSinglePlayer = useGameStore((s) => s.startSinglePlayer);
  const startMultiplayer = useGameStore((s) => s.startMultiplayer);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0d0d1a',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
            color: '#eee',
    }}>
      <h1 className="font-display" style={{
        fontSize: 56,
        color: '#f1c40f',
        marginBottom: 8,
        textShadow: '0 0 30px rgba(241, 196, 15, 0.4), 0 0 60px rgba(241, 196, 15, 0.15)',
        letterSpacing: 3,
      }}>
        SPIN CRITTERS
      </h1>
      <p style={{ color: '#888', fontSize: 14, marginBottom: 48, letterSpacing: 2 }}>
        Slot Machine Card Battler
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 280 }}>
        <button
          onClick={startSinglePlayer}
          className="font-display"
          style={{
            padding: '16px 32px',
            fontSize: 20,
            fontWeight: 'bold',
            background: 'linear-gradient(180deg, #27ae60, #219a52)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            transition: 'filter 0.2s',
            letterSpacing: 1,
            boxShadow: '0 4px 15px rgba(39, 174, 96, 0.3)',
          }}
        >
          Single Player
        </button>

        <button
          onClick={startMultiplayer}
          className="font-display"
          style={{
            padding: '16px 32px',
            fontSize: 20,
            fontWeight: 'bold',
            background: 'linear-gradient(180deg, #3498db, #2980b9)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            transition: 'filter 0.2s',
            letterSpacing: 1,
            boxShadow: '0 4px 15px rgba(52, 152, 219, 0.3)',
          }}
        >
          Multiplayer
        </button>
      </div>
    </div>
  );
}
