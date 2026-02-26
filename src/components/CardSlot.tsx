import { useEffect, useState, useRef } from 'react';
import type { CardInstance, CardDefinition } from '../engine/types.ts';
import { BIOME_COLORS, KEYWORD_INFO } from '../engine/constants.ts';
import { CardZoom } from './CardZoom.tsx';

interface CardSlotProps {
  card?: CardInstance | null;
  definition?: CardDefinition | null;
  isActive?: boolean;
  onClick?: () => void;
  compact?: boolean;
  selected?: boolean;
  highlight?: string;
  shake?: boolean;
  koFlash?: boolean;
}

function getCardImageUrl(cardId: string, category: string): string | null {
  if (category === 'Junk') return null;
  return `/critters/${cardId}.png`;
}

const FULL_W = 150;
const FULL_H = 225;
const COMPACT_W = 114;
const COMPACT_H = 165;

export function CardSlot({ card, definition, isActive, onClick, compact, selected, highlight, shake, koFlash }: CardSlotProps) {
  const source = card ?? null;
  const def = definition ?? null;

  const cardId = source?.definitionId ?? def?.cardId ?? null;
  const name = source?.name ?? def?.name ?? '';
  const category = source?.category ?? def?.category ?? 'Junk';
  const biome = source?.biome ?? def?.biome ?? 'Red';
  const rarity = source?.rarity ?? def?.rarity ?? 'Common';
  const attack = source?.currentAttack ?? def?.attack ?? 0;
  const health = source?.currentHealth ?? def?.health ?? 0;
  const maxHealth = source?.maxHealth ?? def?.health ?? 0;
  const isKO = source?.isKO ?? false;
  const level = source?.level ?? 1;
  const keywords = source?.keywords ?? def?.keywords ?? [];

  const [imgError, setImgError] = useState(false);
  const [hovered, setHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setImgError(false);
  }, [cardId]);

  // Cleanup hover timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    };
  }, []);

  const handleMouseEnter = () => {
    // Small delay to prevent flicker on quick mouse-through
    hoverTimeout.current = setTimeout(() => setHovered(true), 120);
  };

  const handleMouseLeave = () => {
    if (hoverTimeout.current) {
      clearTimeout(hoverTimeout.current);
      hoverTimeout.current = null;
    }
    setHovered(false);
  };

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
          fontSize: 17,
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

  // Build CSS class names for rarity, biome glow, shake, and KO flash
  const classNames: string[] = [];
  if (shake) classNames.push('battle-shake');
  if (koFlash) classNames.push('card-ko-flash');

  // Rarity effects (only for non-junk, non-KO cards)
  if (!isKO && category !== 'Junk') {
    if (rarity === 'Uncommon') classNames.push('card-rarity-uncommon');
    if (rarity === 'Rare') classNames.push('card-rarity-rare');
  }

  // Biome glow for active battle cards (not KO'd)
  const useBiomeGlow = isActive && !isKO && !highlight && !selected;
  if (useBiomeGlow) classNames.push('card-battle-active');

  // Determine border and glow colors
  const borderColor = highlight || (selected ? '#FFD700' : isKO ? '#555' : useBiomeGlow ? bgColor : '#888');
  const glowColor = highlight || (selected ? '#FFD700' : undefined);

  const hasKeywords = keywords.length > 0;

  return (
    <>
      <div
        ref={cardRef}
        onClick={onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={classNames.length > 0 ? classNames.join(' ') : undefined}
        style={{
          width: w,
          height: h,
          background: isKO ? '#2a2a2a' : bgColor,
          border: `2px solid ${borderColor}`,
          borderRadius: 6,
          cursor: onClick ? 'pointer' : 'default',
          opacity: isKO ? 0.5 : 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
          boxShadow: glowColor ? `0 0 8px ${glowColor}` : 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.1s',
          transform: hovered ? 'scale(1.05)' : 'scale(1)',
          zIndex: hovered ? 10 : 1,
          // CSS variable for biome glow animation
          '--biome-color': bgColor,
        } as React.CSSProperties}
      >
        {/* KO overlay */}
        {isKO && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: 48,
            fontWeight: 'bold',
            color: '#f00',
            opacity: 0.7,
            zIndex: 3,
          }}>
            X
          </div>
        )}

        {/* Top: Name + Level */}
        <div style={{
          padding: '4px 6px 3px',
          background: 'rgba(0,0,0,0.5)',
          flexShrink: 0,
          zIndex: 1,
        }}>
          <div className="font-display" style={{
            fontWeight: 'bold',
            fontSize: compact ? 13 : 15,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            color: isKO ? '#666' : '#fff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
            {level > 1 && (
              <span style={{ fontSize: compact ? 11 : 12, color: '#FFD700', flexShrink: 0, marginLeft: 3 }}>
                L{level}
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

        {/* Keyword badges */}
        {hasKeywords && (
          <div style={{
            padding: compact ? '1px 3px' : '3px 5px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: compact ? 2 : 3,
            background: 'rgba(0,0,0,0.55)',
            flexShrink: 0,
            zIndex: 1,
          }}>
            {keywords.map((kw, i) => {
              const info = KEYWORD_INFO[kw.name];
              return (
                <span
                  key={i}
                  style={{
                    background: info?.color || '#666',
                    color: '#fff',
                    padding: compact ? '0 3px' : '0 5px',
                    borderRadius: 4,
                    fontSize: compact ? 10 : 11,
                    fontWeight: 'bold',
                    whiteSpace: 'nowrap',
                    textShadow: '0 1px 1px rgba(0,0,0,0.6)',
                    lineHeight: compact ? '1.2' : '1.4',
                  }}
                >
                  {compact
                    ? (kw.name.length > 4 ? kw.name.substring(0, 3) : kw.name)
                    : kw.name
                  }
                  {kw.value ? ` ${kw.value}` : ''}
                </span>
              );
            })}
          </div>
        )}

        {/* Bottom: Attack / Health */}
        <div className="font-stats" style={{
          padding: '5px 6px',
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'space-between',
          fontWeight: 'bold',
          fontSize: compact ? 14 : 17,
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

      {/* Hover zoom overlay */}
      {hovered && cardRef.current && (
        <CardZoom
          card={source}
          definition={def}
          anchorRect={cardRef.current.getBoundingClientRect()}
        />
      )}
    </>
  );
}
