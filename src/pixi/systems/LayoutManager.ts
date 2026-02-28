import { CARD_W, CARD_H } from '../objects/PixiCard';

const CARD_GAP = 8;
const COLUMNS = 5;

export interface BattleLayout {
  width: number;
  height: number;
  /** Total width of a 5-card row including gaps */
  rowWidth: number;
  /** X offset to center the row */
  rowOffsetX: number;
  /** Y position of opponent active row */
  opponentRowY: number;
  /** Y position of battle line */
  battleLineY: number;
  /** Y position of player active row */
  playerRowY: number;
  /** Y position of mini reel grid (below player row) */
  miniReelY: number;
  /** Card width/height */
  cardW: number;
  cardH: number;
  /** Gap between cards */
  cardGap: number;
}

export function computeLayout(width: number, height: number): BattleLayout {
  const cardW = CARD_W;
  const cardH = CARD_H;
  const cardGap = CARD_GAP;
  const rowWidth = COLUMNS * cardW + (COLUMNS - 1) * cardGap;
  const rowOffsetX = (width - rowWidth) / 2;

  // Vertical layout: opponent row, battle line, player row, mini reel
  const topPadding = 20;
  const opponentRowY = topPadding;
  const battleLineY = opponentRowY + cardH + 16;
  const playerRowY = battleLineY + 30;
  const miniReelY = playerRowY + cardH + 24;

  return {
    width,
    height,
    rowWidth,
    rowOffsetX,
    opponentRowY,
    battleLineY,
    playerRowY,
    miniReelY,
    cardW,
    cardH,
    cardGap,
  };
}

/** Get the center X position of a column's card */
export function colCenterX(layout: BattleLayout, col: number): number {
  return layout.rowOffsetX + col * (layout.cardW + layout.cardGap) + layout.cardW / 2;
}

/** Get the top-left X position of a column's card */
export function colX(layout: BattleLayout, col: number): number {
  return layout.rowOffsetX + col * (layout.cardW + layout.cardGap);
}

/** Get center Y for a player's active row */
export function playerRowCenterY(layout: BattleLayout, isOpponent: boolean): number {
  const y = isOpponent ? layout.opponentRowY : layout.playerRowY;
  return y + layout.cardH / 2;
}
