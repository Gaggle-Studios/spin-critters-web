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
      fontFamily: 'monospace',
      color: '#eee',
    }}>
      <h1 style={{
        fontSize: 48,
        color: '#f1c40f',
        marginBottom: 8,
        textShadow: '0 0 20px rgba(241, 196, 15, 0.3)',
      }}>
        SPIN CRITTERS
      </h1>
      <p style={{ color: '#888', fontSize: 14, marginBottom: 48 }}>
        Slot Machine Card Battler
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 280 }}>
        <button
          onClick={startSinglePlayer}
          style={{
            padding: '16px 32px',
            fontSize: 18,
            fontWeight: 'bold',
            background: '#27ae60',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontFamily: 'monospace',
            transition: 'background 0.2s',
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = '#2ecc71')}
          onMouseOut={(e) => (e.currentTarget.style.background = '#27ae60')}
        >
          Single Player
        </button>

        <button
          onClick={startMultiplayer}
          style={{
            padding: '16px 32px',
            fontSize: 18,
            fontWeight: 'bold',
            background: '#3498db',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontFamily: 'monospace',
            transition: 'background 0.2s',
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = '#2980b9')}
          onMouseOut={(e) => (e.currentTarget.style.background = '#3498db')}
        >
          Multiplayer
        </button>
      </div>
    </div>
  );
}
