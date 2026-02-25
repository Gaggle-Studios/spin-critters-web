import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { CardInstance, CardDefinition } from '../engine/types.ts';
import { BIOME_COLORS, KEYWORD_INFO } from '../engine/constants.ts';

const ZOOM_W = 315;

function getCardImageUrl(cardId: string, category: string): string | null {
  if (category === 'Junk') return null;
  return `/critters/${cardId}.png`;
}

interface CardZoomProps {
  card?: CardInstance | null;
  definition?: CardDefinition | null;
  anchorRect: DOMRect;
}

export function CardZoom({ card, definition, anchorRect }: CardZoomProps) {
  const source = card ?? null;
  const def = definition ?? null;
  const [imgError, setImgError] = useState(false);

  const cardId = source?.definitionId ?? def?.cardId ?? null;
  const name = source?.name ?? def?.name ?? '';
  const category = source?.category ?? def?.category ?? 'Junk';
  const biome = source?.biome ?? def?.biome ?? 'Red';
  const archetype = source?.archetype ?? def?.archetype ?? 'Insect';
  const attack = source?.currentAttack ?? def?.attack ?? 0;
  const health = source?.currentHealth ?? def?.health ?? 0;
  const maxHealth = source?.maxHealth ?? def?.health ?? 0;
  const isKO = source?.isKO ?? false;
  const level = source?.level ?? 1;
  const keywords = source?.keywords ?? def?.keywords ?? [];
  const rarity = def?.rarity ?? 'Common';
  const description = def?.description ?? '';
  const poisonCounters = source?.poisonCounters ?? 0;

  // Position: prefer right side of card, flip to left if near viewport edge
  const GAP = 14;
  let left = anchorRect.right + GAP;
  if (left + ZOOM_W > window.innerWidth - 10) {
    left = anchorRect.left - ZOOM_W - GAP;
  }
  // Clamp left so it never goes off-screen
  left = Math.max(10, left);

  // Vertically center on the card, clamped to viewport
  let top = anchorRect.top + anchorRect.height / 2 - 225;
  top = Math.max(10, Math.min(top, window.innerHeight - 488));

  const bgColor = category === 'Junk' ? '#333' : BIOME_COLORS[biome] || '#444';
  const imageUrl = cardId ? getCardImageUrl(cardId, category) : null;
  const hasImage = imageUrl && !imgError;
  const rarityColor = rarity === 'Rare' ? '#FFD700' : rarity === 'Uncommon' ? '#9B59B6' : '#aaa';

  return createPortal(
    <div
      className="card-zoom-enter"
      style={{
        position: 'fixed',
        left,
        top,
        width: ZOOM_W,
        zIndex: 10000,
        pointerEvents: 'none',
        fontFamily: 'monospace',
      }}
    >
      <div style={{
        background: '#111827',
        border: `3px solid ${bgColor}`,
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: `0 12px 40px rgba(0,0,0,0.85), 0 0 20px ${bgColor}44`,
      }}>
        {/* Header: Name + Level */}
        <div style={{
          background: bgColor,
          padding: '9px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{
            fontWeight: 'bold',
            fontSize: 18,
            color: '#fff',
            textShadow: '1px 1px 3px rgba(0,0,0,0.6)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}>
            {name}
          </span>
          {level > 1 && (
            <span style={{
              fontSize: 14,
              color: '#FFD700',
              fontWeight: 'bold',
              marginLeft: 8,
              textShadow: '0 0 4px rgba(255,215,0,0.5)',
            }}>
              Lv{level}
            </span>
          )}
        </div>

        {/* Image */}
        <div style={{
          height: 180,
          background: `linear-gradient(180deg, ${bgColor}, ${bgColor}88)`,
          position: 'relative',
          overflow: 'hidden',
        }}>
          {hasImage && (
            <img
              src={imageUrl}
              alt={name}
              onError={() => setImgError(true)}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: isKO ? 0.3 : 1,
              }}
            />
          )}
          {isKO && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              fontSize: 60,
              color: '#f00',
              fontWeight: 'bold',
              opacity: 0.7,
              textShadow: '0 0 10px rgba(255,0,0,0.5)',
            }}>
              KO
            </div>
          )}
        </div>

        {/* Type bar: Category / Archetype / Rarity */}
        <div style={{
          padding: '6px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 14,
          color: '#aaa',
          borderBottom: '1px solid #1f2937',
          background: '#0d1117',
        }}>
          <span>{category} / {archetype}</span>
          <span style={{ color: rarityColor, fontWeight: 'bold' }}>{rarity}</span>
        </div>

        {/* Stats: Attack / Health */}
        <div style={{
          padding: '9px 12px',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          borderBottom: '1px solid #1f2937',
          background: '#0d1117',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 27, fontWeight: 'bold', color: '#ff6b6b' }}>{attack}</div>
            <div style={{ fontSize: 11, color: '#888', letterSpacing: 1 }}>ATTACK</div>
          </div>
          <div style={{ width: 1, height: 38, background: '#333' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 27, fontWeight: 'bold', color: '#6bff6b' }}>
              {health}<span style={{ fontSize: 17, color: '#4a9' }}>/{maxHealth}</span>
            </div>
            <div style={{ fontSize: 11, color: '#888', letterSpacing: 1 }}>HEALTH</div>
          </div>
          {poisonCounters > 0 && (
            <>
              <div style={{ width: 1, height: 38, background: '#333' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 23, fontWeight: 'bold', color: '#9B59B6' }}>{poisonCounters}</div>
                <div style={{ fontSize: 11, color: '#888', letterSpacing: 1 }}>POISON</div>
              </div>
            </>
          )}
        </div>

        {/* Keywords with descriptions */}
        {keywords.length > 0 && (
          <div style={{
            padding: '9px 12px',
            borderBottom: '1px solid #1f2937',
            background: '#0d1117',
          }}>
            {keywords.map((kw, i) => {
              const info = KEYWORD_INFO[kw.name];
              return (
                <div key={i} style={{ marginBottom: i < keywords.length - 1 ? 9 : 0 }}>
                  <span style={{
                    display: 'inline-block',
                    background: info?.color || '#666',
                    color: '#fff',
                    padding: '3px 9px',
                    borderRadius: 6,
                    fontSize: 14,
                    fontWeight: 'bold',
                    textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                  }}>
                    {kw.name}{kw.value ? ` ${kw.value}` : ''}
                  </span>
                  {info?.description && (
                    <div style={{
                      fontSize: 12,
                      color: '#9ca3af',
                      marginTop: 4,
                      lineHeight: 1.4,
                      paddingLeft: 4,
                    }}>
                      {info.description}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Flavor text / Description */}
        {description && (
          <div style={{
            padding: '9px 12px',
            fontSize: 14,
            color: '#6b7280',
            fontStyle: 'italic',
            lineHeight: 1.5,
            borderBottom: '1px solid #1f2937',
            background: '#0d1117',
          }}>
            "{description}"
          </div>
        )}

        {/* Biome footer */}
        <div style={{
          padding: '6px 12px',
          fontSize: 12,
          color: bgColor,
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: '#0d1117',
        }}>
          <span style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: bgColor,
            display: 'inline-block',
            boxShadow: `0 0 4px ${bgColor}`,
          }} />
          {biome} Biome
        </div>
      </div>
    </div>,
    document.body
  );
}
