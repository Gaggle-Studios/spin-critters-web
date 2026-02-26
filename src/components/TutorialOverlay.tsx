import { useState, useCallback } from 'react';
import type { GamePhase } from '../engine/types.ts';

// Each tutorial step: a tooltip with text, positioned relative to the game UI.
// position: where the tooltip appears, anchor: what region to highlight.
interface TutorialStep {
  phase: GamePhase;
  title: string;
  text: string;
  position: 'top' | 'center' | 'bottom';
  highlight?: 'top-cards' | 'bottom-cards' | 'reel-grid' | 'controls' | 'log' | 'pack' | 'columns' | 'biome-grid' | 'status-bar';
}

const STEPS: TutorialStep[] = [
  // ---- Critter Select ----
  {
    phase: 'critter-select',
    title: 'Welcome!',
    text: 'Let\'s build your team. Pick 3 critters from the grid below. Each critter has a biome (color) and archetype. You can pick at most 2 from the same biome.',
    position: 'top',
    highlight: 'biome-grid',
  },
  {
    phase: 'critter-select',
    title: 'Place Your Critters',
    text: 'Now place each critter into one of the 5 reel columns. Think of columns like lanes — your column 1 card will fight the opponent\'s column 1 card. Two columns will start empty.',
    position: 'top',
    highlight: 'columns',
  },

  // ---- Initial Draft ----
  {
    phase: 'initial-draft',
    title: 'Draft Phase',
    text: 'You\'ll open 7 card packs. Pick 1 card from each pack, then click an empty slot in your reel to place it. Allies fight, Locations produce resources, and Relics provide buffs.',
    position: 'top',
    highlight: 'pack',
  },
  {
    phase: 'initial-draft',
    title: 'Reel Placement',
    text: 'After picking a card, click a slot in your reel grid below to place it. Empty slots glow green. Any slots still empty after drafting become Junk — replace them in the shop later.',
    position: 'center',
    highlight: 'reel-grid',
  },

  // ---- Battle ----
  {
    phase: 'battle',
    title: 'Battle Begins!',
    text: 'Press GO to spin. Each spin randomly picks one living card per column for both you and your opponent. Cards on the activation line fight column-vs-column.',
    position: 'center',
    highlight: 'controls',
  },
  {
    phase: 'battle',
    title: 'The Activation Line',
    text: 'Your active cards appear here (bottom row). The opponent\'s active cards appear above. Each card attacks the one in the opposing column. If a column is empty, damage redirects to an adjacent card.',
    position: 'top',
    highlight: 'bottom-cards',
  },
  {
    phase: 'battle',
    title: 'Attack Phases',
    text: 'Attacks happen in 3 phases: Fast cards strike first, then Regular, then Slow. Listen for the different sound effects — quick hits are Fast, heavy thuds are Slow.',
    position: 'center',
  },
  {
    phase: 'battle',
    title: 'Resources & Keywords',
    text: 'You gain 3 resources each spin. Cards with Produce generate extra. Watch the battle log at the bottom for details on damage, heals, and keyword triggers.',
    position: 'bottom',
    highlight: 'log',
  },
  {
    phase: 'battle',
    title: 'Winning & Losing',
    text: 'The battle ends when one side has no living cards, or after overtime. The loser takes morale damage — more for each surviving enemy critter. If morale hits 0, you\'re eliminated.',
    position: 'center',
  },

  // ---- Shop ----
  {
    phase: 'shop',
    title: 'Shop Time',
    text: 'Spend resources to buy new cards. Common costs 2, Uncommon 4, Rare 7. You can reroll the pack for 2 resources, or skip to save for later. Place purchased cards in your reel.',
    position: 'top',
    highlight: 'pack',
  },
  {
    phase: 'shop',
    title: 'Growing Reels',
    text: 'Every other battle, your reel grows by one row (filled with Junk). Replace Junk cards with better ones — Junk gives your opponent free resources when destroyed.',
    position: 'center',
    highlight: 'reel-grid',
  },
];

interface TutorialOverlayProps {
  phase: GamePhase;
  onDismiss: () => void;
}

export function TutorialOverlay({ phase, onDismiss }: TutorialOverlayProps) {
  const [stepIndex, setStepIndex] = useState(0);

  // Find steps for the current phase
  const phaseSteps = STEPS.filter((s) => s.phase === phase);
  const current = phaseSteps[stepIndex] ?? null;

  const next = useCallback(() => {
    if (stepIndex < phaseSteps.length - 1) {
      setStepIndex(stepIndex + 1);
    } else {
      // Auto-advance: reset step index so when phase changes, we start at step 0
      setStepIndex(0);
    }
  }, [stepIndex, phaseSteps.length]);

  const prev = useCallback(() => {
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
  }, [stepIndex]);

  // Reset step index when phase changes
  const [lastPhase, setLastPhase] = useState(phase);
  if (phase !== lastPhase) {
    setLastPhase(phase);
    setStepIndex(0);
  }

  if (!current || phase === 'game-over') return null;

  const isLast = stepIndex === phaseSteps.length - 1;
  const isFirst = stepIndex === 0;

  // Position the tooltip
  const positionStyle = getPositionStyle(current.position);

  return (
    <>
      {/* Subtle overlay to dim background — low opacity so game stays interactive */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.25)',
          zIndex: 500,
          pointerEvents: 'none',
        }}
      />

      {/* Highlight region indicator */}
      {current.highlight && (
        <div
          data-tutorial-highlight={current.highlight}
          style={{
            position: 'fixed',
            ...getHighlightBounds(current.highlight),
            border: '2px solid rgba(241, 196, 15, 0.6)',
            borderRadius: 8,
            boxShadow: '0 0 20px rgba(241, 196, 15, 0.3), inset 0 0 20px rgba(241, 196, 15, 0.05)',
            zIndex: 501,
            pointerEvents: 'none',
            animation: 'tutorialPulse 2s ease-in-out infinite',
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        style={{
          position: 'fixed',
          ...positionStyle,
          zIndex: 502,
          maxWidth: 420,
          background: 'linear-gradient(180deg, #1a1a2e, #16213e)',
          border: '2px solid #f1c40f',
          borderRadius: 10,
          padding: '16px 20px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          animation: 'tutorialFadeIn 0.3s ease-out',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 className="font-display" style={{ color: '#f1c40f', fontSize: 16, margin: 0 }}>
            {current.title}
          </h3>
          <span style={{ color: '#666', fontSize: 11 }}>
            {stepIndex + 1}/{phaseSteps.length}
          </span>
        </div>

        <p style={{ color: '#ccc', fontSize: 14, lineHeight: 1.6, margin: '0 0 14px' }}>
          {current.text}
        </p>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {!isFirst && (
              <button onClick={prev} style={navBtnStyle}>Back</button>
            )}
            <button onClick={next} style={{
              ...navBtnStyle,
              background: isLast ? '#555' : '#f1c40f',
              color: isLast ? '#ccc' : '#000',
            }}>
              {isLast ? 'Got it' : 'Next'}
            </button>
          </div>
          <button
            onClick={onDismiss}
            style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 12 }}
          >
            Skip tutorial
          </button>
        </div>
      </div>
    </>
  );
}

// Tooltip positioning based on 'top', 'center', 'bottom'
function getPositionStyle(position: string): React.CSSProperties {
  switch (position) {
    case 'top':
      return { top: 80, left: '50%', transform: 'translateX(-50%)' };
    case 'bottom':
      return { bottom: 60, left: '50%', transform: 'translateX(-50%)' };
    case 'center':
    default:
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  }
}

// Approximate screen regions to highlight — these are rough bounding boxes.
// They use viewport-relative units since exact element positions depend on layout.
function getHighlightBounds(highlight: string): React.CSSProperties {
  switch (highlight) {
    case 'biome-grid':
      return { top: '15%', left: '5%', right: '5%', bottom: '20%' };
    case 'columns':
      return { bottom: '10%', left: '15%', right: '15%', height: '25%' };
    case 'pack':
      return { top: '12%', left: '20%', right: '20%', height: '30%' };
    case 'top-cards':
      return { top: '10%', left: '15%', right: '15%', height: '15%' };
    case 'bottom-cards':
      return { top: '35%', left: '15%', right: '15%', height: '15%' };
    case 'reel-grid':
      return { top: '50%', left: '10%', right: '10%', bottom: '18%' };
    case 'controls':
      return { bottom: '8%', left: '30%', right: '30%', height: '10%' };
    case 'log':
      return { bottom: '12%', left: '10%', right: '10%', height: '18%' };
    case 'status-bar':
      return { top: 0, left: 0, right: 0, height: '8%' };
    default:
      return {};
  }
}

const navBtnStyle: React.CSSProperties = {
  padding: '6px 16px',
  fontSize: 13,
  fontWeight: 'bold',
  background: '#333',
  color: '#eee',
  border: 'none',
  borderRadius: 5,
  cursor: 'pointer',
};
