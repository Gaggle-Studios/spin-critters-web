import type { BattleEvent } from '../engine/types.ts';
import { REEL_WIDTH } from '../engine/constants.ts';

interface BattleEventOverlayProps {
  currentEvent: BattleEvent | null;
  humanPlayerId: string;
}

// Each column takes ~155px (150px card + 5px gap). The overlay positions
// floating numbers relative to the card grid containers.
const COL_WIDTH = 155;

function FloatingNumber({ col, text, color, isOpponent, damageSize }: {
  col: number;
  text: string;
  color: string;
  isOpponent: boolean;
  damageSize?: 'normal' | 'big' | 'crit';
}) {
  const sizeClass = damageSize === 'crit' ? 'damage-crit' : damageSize === 'big' ? 'damage-big' : '';
  const classes = ['battle-float-up', 'font-stats', sizeClass].filter(Boolean).join(' ');

  return (
    <div
      className={classes}
      style={{
        position: 'absolute',
        left: col * COL_WIDTH + COL_WIDTH / 2,
        top: isOpponent ? '25%' : '75%',
        transform: 'translateX(-50%)',
        fontSize: 27,
        fontWeight: 'bold',
        color,
        textShadow: `0 0 12px ${color}, 0 4px 8px rgba(0,0,0,0.8)`,
        pointerEvents: 'none',
        zIndex: 20,
      }}
    >
      {text}
    </div>
  );
}

// Arrow connector drawn as an SVG line between attacker and defender columns
// across the battle line area.
function AttackArrow({ attackerCol, defenderCol, attackerIsTop }: {
  attackerCol: number;
  defenderCol: number;
  attackerIsTop: boolean;
}) {
  const x1 = attackerCol * COL_WIDTH + COL_WIDTH / 2;
  const x2 = defenderCol * COL_WIDTH + COL_WIDTH / 2;
  const y1 = attackerIsTop ? '35%' : '65%';
  const y2 = attackerIsTop ? '65%' : '35%';

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 18,
      }}
    >
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#ffd700" />
        </marker>
      </defs>
      <line
        x1={x1} y1={y1}
        x2={x2} y2={y2}
        stroke="#ffd700"
        strokeWidth="2"
        strokeDasharray="6 3"
        markerEnd="url(#arrowhead)"
        opacity="0.8"
      />
    </svg>
  );
}

// Text banner shown on the battle line during attacks:  "Fiammor → Marisect  -4"
function AttackBanner({ attackerName, defenderName, damage, isKO }: {
  attackerName: string;
  defenderName: string;
  damage: number;
  isKO: boolean;
}) {
  return (
    <div
      className="battle-crit-flash font-display"
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
        background: 'rgba(0,0,0,0.75)',
        border: '2px solid #ffd700',
        borderRadius: 6,
        padding: '5px 15px',
        pointerEvents: 'none',
        zIndex: 22,
        whiteSpace: 'nowrap',
              }}
    >
      <span style={{ color: '#ffd700' }}>{attackerName}</span>
      <span style={{ color: '#888', margin: '0 8px' }}>{'\u2192'}</span>
      <span style={{ color: isKO ? '#ff4444' : '#eee' }}>{defenderName}</span>
      <span style={{ color: '#ff4444', marginLeft: 12 }}>-{damage}</span>
      {isKO && <span style={{ color: '#ff4444', marginLeft: 8 }}>KO!</span>}
    </div>
  );
}

function CritBanner({ text, color }: { text: string; color: string }) {
  return (
    <div
      className="battle-crit-flash font-display"
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        fontSize: 33,
        fontWeight: 'bold',
        color,
        textShadow: `0 0 24px ${color}, 0 0 48px ${color}`,
        pointerEvents: 'none',
        zIndex: 25,
        whiteSpace: 'nowrap',
                letterSpacing: 3,
      }}
    >
      {text}
    </div>
  );
}

function PhaseLabel({ label }: { label: string }) {
  return (
    <div
      className="battle-float-up font-display"
      style={{
        position: 'absolute',
        top: 8,
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: 17,
        fontWeight: 'bold',
        color: '#f1c40f',
        textShadow: '0 0 12px rgba(241,196,15,0.5)',
        pointerEvents: 'none',
        zIndex: 20,
        whiteSpace: 'nowrap',
                textTransform: 'uppercase',
        letterSpacing: 2,
      }}
    >
      {label}
    </div>
  );
}

function BattleEndBanner({ winnerName }: { winnerName: string }) {
  return (
    <div
      className="battle-crit-flash font-display"
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        fontSize: 39,
        fontWeight: 'bold',
        color: '#2ecc71',
        textShadow: '0 0 24px #2ecc71, 0 0 48px #2ecc71',
        pointerEvents: 'none',
        zIndex: 30,
        whiteSpace: 'nowrap',
              }}
    >
      {winnerName} WINS!
    </div>
  );
}

export function BattleEventOverlay({ currentEvent, humanPlayerId }: BattleEventOverlayProps) {
  if (!currentEvent) return null;

  const isOpponentSide = (playerId: string) => playerId !== humanPlayerId;

  switch (currentEvent.type) {
    case 'attack': {
      const defOnOpp = isOpponentSide(currentEvent.defenderPlayerId);
      const atkOnOpp = isOpponentSide(currentEvent.attackerPlayerId);
      const dmg = currentEvent.damage;
      const damageSize: 'normal' | 'big' | 'crit' = dmg >= 15 ? 'crit' : dmg >= 8 ? 'big' : 'normal';
      return (
        <>
          {/* Arrow from attacker to defender */}
          <AttackArrow
            attackerCol={currentEvent.attackerCol}
            defenderCol={currentEvent.defenderCol}
            attackerIsTop={atkOnOpp}
          />
          {/* Floating damage on defender */}
          <FloatingNumber
            col={currentEvent.defenderCol}
            text={`-${currentEvent.damage}`}
            color="#ff4444"
            isOpponent={defOnOpp}
            damageSize={damageSize}
          />
          {/* Banner on battle line: "Fiammor → Marisect  -4" */}
          <AttackBanner
            attackerName={currentEvent.attackerName}
            defenderName={currentEvent.defenderName}
            damage={currentEvent.damage}
            isKO={currentEvent.defenderIsKO}
          />
        </>
      );
    }

    case 'thorns': {
      const onOpp = isOpponentSide(currentEvent.playerId);
      return (
        <>
          <FloatingNumber
            col={currentEvent.col}
            text={`-${currentEvent.damage} Thorns`}
            color="#e67e22"
            isOpponent={onOpp}
          />
          <AttackArrow
            attackerCol={currentEvent.sourceCol}
            defenderCol={currentEvent.col}
            attackerIsTop={!onOpp}
          />
        </>
      );
    }

    case 'poison-damage': {
      const onOpp = isOpponentSide(currentEvent.playerId);
      return (
        <FloatingNumber
          col={currentEvent.col}
          text={`-${currentEvent.damage} Poison`}
          color="#9b59b6"
          isOpponent={onOpp}
        />
      );
    }

    case 'regenerate': {
      const onOpp = isOpponentSide(currentEvent.playerId);
      return (
        <FloatingNumber
          col={currentEvent.col}
          text={`+${currentEvent.amount}`}
          color="#2ecc71"
          isOpponent={onOpp}
        />
      );
    }

    case 'healing': {
      const onOpp = isOpponentSide(currentEvent.playerId);
      return (
        <FloatingNumber
          col={currentEvent.targetCol}
          text={`+${currentEvent.amount}`}
          color="#2ecc71"
          isOpponent={onOpp}
        />
      );
    }

    case 'produce': {
      const onOpp = isOpponentSide(currentEvent.playerId);
      return (
        <FloatingNumber
          col={currentEvent.col}
          text={`+${currentEvent.amount} res`}
          color="#f1c40f"
          isOpponent={onOpp}
        />
      );
    }

    case 'overtime-damage': {
      const onOpp = isOpponentSide(currentEvent.playerId);
      return (
        <FloatingNumber
          col={currentEvent.col}
          text={`-${currentEvent.damage} OT`}
          color="#e74c3c"
          isOpponent={onOpp}
        />
      );
    }

    case 'venomous': {
      const onOpp = isOpponentSide(currentEvent.playerId);
      return (
        <FloatingNumber
          col={currentEvent.col}
          text={`+${currentEvent.counters} Venom`}
          color="#8e44ad"
          isOpponent={onOpp}
        />
      );
    }

    case 'poisonous': {
      const onOpp = isOpponentSide(currentEvent.playerId);
      return (
        <FloatingNumber
          col={currentEvent.col}
          text={`+${currentEvent.counters} Poison`}
          color="#8e44ad"
          isOpponent={onOpp}
        />
      );
    }

    case 'crit-biome':
      return <CritBanner text={`BIOME CRIT! ${currentEvent.biome}`} color="#f39c12" />;

    case 'crit-archetype':
      return <CritBanner text={`ARCHETYPE CRIT! ${currentEvent.archetype}`} color="#3498db" />;

    case 'phase-marker':
      return <PhaseLabel label={currentEvent.label} />;

    case 'spin-result':
      return <PhaseLabel label={`Spin ${currentEvent.spin}`} />;

    case 'battle-end':
      return <BattleEndBanner winnerName={currentEvent.winnerName} />;

    case 'column-locked': {
      const onOpp = isOpponentSide(currentEvent.playerId);
      return (
        <FloatingNumber
          col={currentEvent.col}
          text="LOCKED"
          color="#e74c3c"
          isOpponent={onOpp}
        />
      );
    }

    default:
      return null;
  }
}

// Returns highlight/shake info for cards based on the current event
export function getCardEffects(
  currentEvent: BattleEvent | null,
  humanPlayerId: string,
): {
  highlightCols: Map<string, { col: number; color: string }[]>;
  shakeCols: Map<string, number[]>;
} {
  const highlightCols = new Map<string, { col: number; color: string }[]>();
  const shakeCols = new Map<string, number[]>();

  if (!currentEvent) return { highlightCols, shakeCols };

  const addHighlight = (playerId: string, col: number, color: string) => {
    const list = highlightCols.get(playerId) || [];
    list.push({ col, color });
    highlightCols.set(playerId, list);
  };

  const addShake = (playerId: string, col: number) => {
    const list = shakeCols.get(playerId) || [];
    list.push(col);
    shakeCols.set(playerId, list);
  };

  switch (currentEvent.type) {
    case 'attack':
      addHighlight(currentEvent.attackerPlayerId, currentEvent.attackerCol, '#ffd700');
      addShake(currentEvent.defenderPlayerId, currentEvent.defenderCol);
      if (currentEvent.defenderIsKO) {
        addHighlight(currentEvent.defenderPlayerId, currentEvent.defenderCol, '#ff0000');
      }
      break;

    case 'thorns':
      addShake(currentEvent.playerId, currentEvent.col);
      if (currentEvent.isKO) {
        addHighlight(currentEvent.playerId, currentEvent.col, '#ff0000');
      }
      break;

    case 'poison-damage':
      addShake(currentEvent.playerId, currentEvent.col);
      addHighlight(currentEvent.playerId, currentEvent.col, '#9b59b6');
      break;

    case 'overtime-damage':
      addShake(currentEvent.playerId, currentEvent.col);
      addHighlight(currentEvent.playerId, currentEvent.col, '#e74c3c');
      break;

    case 'regenerate':
      addHighlight(currentEvent.playerId, currentEvent.col, '#2ecc71');
      break;

    case 'healing':
      addHighlight(currentEvent.playerId, currentEvent.targetCol, '#2ecc71');
      break;

    case 'produce':
      addHighlight(currentEvent.playerId, currentEvent.col, '#f1c40f');
      break;

    case 'crit-biome':
    case 'crit-archetype':
      // Highlight all columns for the player
      for (let c = 0; c < REEL_WIDTH; c++) {
        addHighlight(currentEvent.playerId, c, currentEvent.type === 'crit-biome' ? '#f39c12' : '#3498db');
      }
      break;
  }

  // Ensure humanPlayerId is used to avoid lint warning
  void humanPlayerId;

  return { highlightCols, shakeCols };
}
