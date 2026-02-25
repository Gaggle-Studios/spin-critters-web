import { useState } from 'react';
import { useGameStore } from '../store/gameStore.ts';

export function LobbyView() {
  const connectionStatus = useGameStore((s) => s.connectionStatus);
  const roomId = useGameStore((s) => s.roomId);
  const lobbyPlayers = useGameStore((s) => s.lobbyPlayers);
  const playerId = useGameStore((s) => s.playerId);
  const serverError = useGameStore((s) => s.serverError);
  const createRoom = useGameStore((s) => s.createRoom);
  const joinRoom = useGameStore((s) => s.joinRoom);
  const leaveRoom = useGameStore((s) => s.leaveRoom);
  const setReady = useGameStore((s) => s.setReady);
  const goToMenu = useGameStore((s) => s.goToMenu);

  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [view, setView] = useState<'choose' | 'create' | 'join'>('choose');

  const myLobbyInfo = lobbyPlayers.find((p) => p.id === playerId);
  const isReady = myLobbyInfo?.ready ?? false;

  if (connectionStatus === 'connecting') {
    return (
      <div style={containerStyle}>
        <p style={{ color: '#f1c40f', fontSize: 18 }}>Connecting to server...</p>
        <button onClick={goToMenu} style={secondaryBtnStyle}>Back to Menu</button>
      </div>
    );
  }

  if (connectionStatus === 'disconnected') {
    return (
      <div style={containerStyle}>
        <p style={{ color: '#e74c3c', fontSize: 18 }}>Disconnected from server</p>
        {serverError && <p style={{ color: '#e74c3c', fontSize: 12 }}>{serverError}</p>}
        <button onClick={goToMenu} style={secondaryBtnStyle}>Back to Menu</button>
      </div>
    );
  }

  // In a room - show lobby
  if (roomId) {
    return (
      <div style={containerStyle}>
        <h2 style={{ color: '#f1c40f', fontSize: 24, marginBottom: 4 }}>Room: {roomId}</h2>
        <p style={{ color: '#888', fontSize: 12, marginBottom: 24 }}>
          Share this code with a friend to join
        </p>

        {serverError && (
          <p style={{ color: '#e74c3c', fontSize: 12, marginBottom: 12 }}>{serverError}</p>
        )}

        <div style={{ marginBottom: 24, minWidth: 300 }}>
          <h3 style={{ color: '#aaa', marginBottom: 8 }}>Players</h3>
          {lobbyPlayers.map((p) => (
            <div key={p.id} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 12px',
              marginBottom: 4,
              background: p.id === playerId ? 'rgba(52, 152, 219, 0.2)' : 'rgba(255,255,255,0.05)',
              borderRadius: 4,
              border: p.id === playerId ? '1px solid #3498db' : '1px solid transparent',
            }}>
              <span style={{ color: '#eee' }}>
                {p.name} {p.id === playerId ? '(you)' : ''} {p.isAI ? '(AI)' : ''}
              </span>
              <span style={{
                color: p.ready ? '#27ae60' : '#e74c3c',
                fontSize: 12,
                fontWeight: 'bold',
              }}>
                {p.ready ? 'READY' : 'NOT READY'}
              </span>
            </div>
          ))}

          {lobbyPlayers.length < 2 && (
            <p style={{ color: '#888', fontSize: 12, marginTop: 8, fontStyle: 'italic' }}>
              Waiting for another player to join...
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => setReady(!isReady)}
            style={{
              ...primaryBtnStyle,
              background: isReady ? '#e74c3c' : '#27ae60',
            }}
          >
            {isReady ? 'Cancel Ready' : 'Ready Up'}
          </button>
          <button onClick={() => { leaveRoom(); }} style={secondaryBtnStyle}>
            Leave Room
          </button>
        </div>

        {lobbyPlayers.length >= 2 && lobbyPlayers.filter(p => !p.isAI).every(p => p.ready) && (
          <p style={{ color: '#f1c40f', fontSize: 14, marginTop: 16 }}>
            All players ready! Starting game...
          </p>
        )}
      </div>
    );
  }

  // Not in a room - show create/join
  if (view === 'choose') {
    return (
      <div style={containerStyle}>
        <h2 style={{ color: '#f1c40f', fontSize: 28, marginBottom: 32 }}>MULTIPLAYER</h2>

        {serverError && (
          <p style={{ color: '#e74c3c', fontSize: 12, marginBottom: 12 }}>{serverError}</p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 280 }}>
          <button onClick={() => setView('create')} style={primaryBtnStyle}>
            Create Room
          </button>
          <button onClick={() => setView('join')} style={{
            ...primaryBtnStyle,
            background: '#8e44ad',
          }}>
            Join Room
          </button>
          <button onClick={goToMenu} style={secondaryBtnStyle}>
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  if (view === 'create') {
    return (
      <div style={containerStyle}>
        <h2 style={{ color: '#f1c40f', fontSize: 24, marginBottom: 24 }}>Create Room</h2>

        {serverError && (
          <p style={{ color: '#e74c3c', fontSize: 12, marginBottom: 12 }}>{serverError}</p>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ color: '#aaa', fontSize: 12, display: 'block', marginBottom: 4 }}>
            Your Name
          </label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name"
            maxLength={20}
            style={inputStyle}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && playerName.trim()) {
                createRoom(playerName.trim());
              }
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => {
              if (playerName.trim()) createRoom(playerName.trim());
            }}
            disabled={!playerName.trim()}
            style={{
              ...primaryBtnStyle,
              opacity: playerName.trim() ? 1 : 0.5,
            }}
          >
            Create
          </button>
          <button onClick={() => setView('choose')} style={secondaryBtnStyle}>
            Back
          </button>
        </div>
      </div>
    );
  }

  // Join view
  return (
    <div style={containerStyle}>
      <h2 style={{ color: '#f1c40f', fontSize: 24, marginBottom: 24 }}>Join Room</h2>

      {serverError && (
        <p style={{ color: '#e74c3c', fontSize: 12, marginBottom: 12 }}>{serverError}</p>
      )}

      <div style={{ marginBottom: 16 }}>
        <label style={{ color: '#aaa', fontSize: 12, display: 'block', marginBottom: 4 }}>
          Your Name
        </label>
        <input
          type="text"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder="Enter your name"
          maxLength={20}
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ color: '#aaa', fontSize: 12, display: 'block', marginBottom: 4 }}>
          Room Code
        </label>
        <input
          type="text"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          placeholder="ABCDEF"
          maxLength={6}
          style={{ ...inputStyle, textTransform: 'uppercase', letterSpacing: 4, textAlign: 'center', fontSize: 20 }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && playerName.trim() && joinCode.trim()) {
              joinRoom(joinCode.trim(), playerName.trim());
            }
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={() => {
            if (playerName.trim() && joinCode.trim()) {
              joinRoom(joinCode.trim(), playerName.trim());
            }
          }}
          disabled={!playerName.trim() || !joinCode.trim()}
          style={{
            ...primaryBtnStyle,
            background: '#8e44ad',
            opacity: (playerName.trim() && joinCode.trim()) ? 1 : 0.5,
          }}
        >
          Join
        </button>
        <button onClick={() => setView('choose')} style={secondaryBtnStyle}>
          Back
        </button>
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#0d0d1a',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'monospace',
  color: '#eee',
  padding: 20,
};

const primaryBtnStyle: React.CSSProperties = {
  padding: '12px 24px',
  fontSize: 16,
  fontWeight: 'bold',
  background: '#27ae60',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  fontFamily: 'monospace',
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '12px 24px',
  fontSize: 14,
  background: 'transparent',
  color: '#888',
  border: '1px solid #444',
  borderRadius: 8,
  cursor: 'pointer',
  fontFamily: 'monospace',
};

const inputStyle: React.CSSProperties = {
  padding: '10px 14px',
  fontSize: 16,
  background: '#1a1a2e',
  color: '#eee',
  border: '1px solid #444',
  borderRadius: 6,
  fontFamily: 'monospace',
  width: '100%',
  boxSizing: 'border-box',
};
