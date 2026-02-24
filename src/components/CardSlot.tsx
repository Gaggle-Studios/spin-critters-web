import { useEffect, useState } from 'react';
import type { CardInstance, CardDefinition } from '../engine/types.ts';
import { BIOME_COLORS } from '../engine/constants.ts';

interface CardSlotProps {
  card?: CardInstance | null;
  definition?: CardDefinition | null;
  isActive?: boolean;
  onClick?: () => void;
  compact?: boolean;
  selected?: boolean;
  highlight?: string;
  shake?: boolean;
}

function getCardImageUrl(cardId: string, category: string): string | null {
  if (category === 'Junk') return null;
  return `/critters/${cardId}.png`;
}

const FULL_W = 100;
const FULL_H = 150;
const COMPACT_W = 76;
const COMPACT_H = 110;

export function CardSlot({ card, definition, isActive, onClick, compact, selected, highlight, shake }: CardSlotProps) {
  // Normalize: extract display data from either card (CardInstance) or definition (CardDefinition)
  const source = card ?? null;
  const def = definition ?? null;

  const cardId = source?.definitionId ?? def?.cardId ?? null;
  const name = source?.name ?? def?.name ?? '';
  const category = source?.category ?? def?.category ?? 'Junk';
  const biome = source?.biome ?? def?.biome ?? 'Red';
  const attack = source?.currentAttack ?? def?.attack ?? 0;
  const health = source?.currentHealth ?? def?.health ?? 0;
  const maxHealth = source?.maxHealth ?? def?.health ?? 0;
  const isKO = source?.isKO ?? false;
  const level = source?.level ?? 1;
  const keywords = source?.keywords ?? def?.keywords ?? [];
  const rarity = def?.rarity ?? null;

  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [cardId]);

  const w = compact ? COMPACT_W : FULL_W;
  const h = compact ? COMPACT_H : FULL_H;

  const isEmpty = !source && !def;

  if (isEmpty) {
    return (
      <div
        onClick={onClick}
        style={{
          width: w,
          height: h,
          border: '1px dashed #555',
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#666',
          fontSize: 11,
          cursor: onClick ? 'pointer' : 'default',
          background: '#1a1a1a',
        }}
      >
        Empty
      </div>
    );
  }

  const bgColor = category === 'Junk' ? '#333' : BIOME_COLORS[biome] || '#444';
  const imageUrl = cardId ? getCardImageUrl(cardId, category) : null;
  const hasImage = imageUrl && !imgError;
  const borderColor = highlight || (selected ? '#FFD700' : isActive ? '#FFD700' : isKO ? '#555' : '#888');
  const glowColor = highlight || ((isActive || selected) ? '#FFD700' : undefined);

  return (
    <div
      onClick={onClick}
      className={shake ? 'battle-shake' : undefined}
      style={{
        width: w,
        height: h,
        background: isKO ? '#2a2a2a' : bgColor,
        border: `2px solid ${borderColor}`,
        borderRadius: 6,
        fontFamily: 'monospace',
        cursor: onClick ? 'pointer' : 'default',
        opacity: isKO ? 0.5 : 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        boxShadow: glowColor ? `0 0 8px ${glowColor}` : 'none',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
    >
      {/* KO overlay */}
      {isKO && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: 32,
          fontWeight: 'bold',
          color: '#f00',
          opacity: 0.7,
          zIndex: 3,
        }}>
          X
        </div>
      )}

      {/* Top: Name + Category/Rarity */}
      <div style={{
        padding: '3px 4px 2px',
        background: 'rgba(0,0,0,0.5)',
        flexShrink: 0,
        zIndex: 1,
      }}>
        <div style={{
          fontWeight: 'bold',
          fontSize: compact ? 8.5 : 10,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          color: isKO ? '#666' : '#fff',
        }}>
          {name}
        </div>
        <div style={{
          fontSize: compact ? 7 : 8,
          color: isKO ? '#555' : '#ccc',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {category}{level > 1 ? ` Lv${level}` : ''}
          {rarity && rarity !== 'Common' ? ` (${rarity})` : ''}
          {keywords.length > 0 && (
            <span style={{ marginLeft: 3, opacity: 0.8 }}>
              {keywords.map((k) => k.name + (k.value ? ` ${k.value}` : '')).join(', ')}
            </span>
          )}
        </div>
      </div>

      {/* Middle: Image or biome color fill */}
      <div style={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        minHeight: 0,
      }}>
        {hasImage && (
          <img
            src={imageUrl}
            alt={name}
            onError={() => setImgError(true)}
            style={{
              display: 'block',
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: isKO ? 0.3 : 1,
            }}
          />
        )}
      </div>

      {/* Bottom: Attack / Health */}
      <div style={{
        padding: '3px 4px',
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        justifyContent: 'space-between',
        fontWeight: 'bold',
        fontSize: compact ? 9.5 : 11,
        flexShrink: 0,
        zIndex: 1,
      }}>
        <span style={{ color: isKO ? '#666' : '#ff6b6b' }}>
          {attack}A
        </span>
        <span style={{ color: isKO ? '#666' : '#6bff6b' }}>
          {health}/{maxHealth}H
        </span>
      </div>
    </div>
  );
}
