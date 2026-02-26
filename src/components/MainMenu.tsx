import { useState } from 'react';
import { useGameStore } from '../store/gameStore.ts';
import { APP_VERSION } from '../version.ts';
import { HowToPlay } from './HowToPlay.tsx';

export function MainMenu() {
  const startSinglePlayer = useGameStore((s) => s.startSinglePlayer);
  const startMultiplayer = useGameStore((s) => s.startMultiplayer);
  const setTutorialEnabled = useGameStore((s) => s.setTutorialEnabled);
  const [showHowToPlay, setShowHowToPlay] = useState(false);

  function handleStartWithTutorial() {
    setTutorialEnabled(true);
    startSinglePlayer();
  }

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
      <p style={{ color: '#888', fontSize: 14, marginBottom: 8, letterSpacing: 2 }}>
        Slot Machine Card Battler
      </p>
      <p style={{ color: '#555', fontSize: 11, marginBottom: 48 }}>
        {APP_VERSION}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 280 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={startSinglePlayer}
            className="font-display"
            style={{ ...primaryBtnStyle('#27ae60', '#219a52', 'rgba(39, 174, 96, 0.3)'), flex: 1 }}
          >
            Single Player
          </button>
          <button
            onClick={handleStartWithTutorial}
            className="font-display"
            title="Start with interactive tutorial"
            style={{
              padding: '16px 14px',
              fontSize: 13,
              fontWeight: 'bold',
              background: 'linear-gradient(180deg, #f39c12, #e67e22)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              transition: 'filter 0.2s',
              boxShadow: '0 4px 15px rgba(243, 156, 18, 0.3)',
              whiteSpace: 'nowrap',
            }}
          >
            Tutorial
          </button>
        </div>

        <button
          onClick={startMultiplayer}
          className="font-display"
          style={primaryBtnStyle('#3498db', '#2980b9', 'rgba(52, 152, 219, 0.3)')}
        >
          Multiplayer
        </button>

        <button
          onClick={() => setShowHowToPlay(true)}
          className="font-display"
          style={{
            padding: '12px 32px',
            fontSize: 16,
            fontWeight: 'bold',
            background: 'transparent',
            color: '#aaa',
            border: '2px solid #444',
            borderRadius: 8,
            cursor: 'pointer',
            transition: 'border-color 0.2s, color 0.2s',
            letterSpacing: 1,
          }}
        >
          How to Play
        </button>
      </div>

      {showHowToPlay && (
        <HowToPlay
          onClose={() => setShowHowToPlay(false)}
          onStartTutorial={handleStartWithTutorial}
        />
      )}
    </div>
  );
}

function primaryBtnStyle(from: string, to: string, shadow: string): React.CSSProperties {
  return {
    padding: '16px 32px',
    fontSize: 20,
    fontWeight: 'bold',
    background: `linear-gradient(180deg, ${from}, ${to})`,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'filter 0.2s',
    letterSpacing: 1,
    boxShadow: `0 4px 15px ${shadow}`,
  };
}
