import { TextStyle } from 'pixi.js';

// Rajdhani-like display font (bold game text)
const DISPLAY_FONT = "'Rajdhani', system-ui, sans-serif";
const STATS_FONT = "'Inter', system-ui, sans-serif";

export const TEXT_STYLES = {
  cardName: new TextStyle({
    fontFamily: DISPLAY_FONT,
    fontSize: 13,
    fontWeight: 'bold',
    fill: 0xFFFFFF,
    wordWrap: false,
  }),

  cardNameLarge: new TextStyle({
    fontFamily: DISPLAY_FONT,
    fontSize: 15,
    fontWeight: 'bold',
    fill: 0xFFFFFF,
    wordWrap: false,
  }),

  cardAttack: new TextStyle({
    fontFamily: STATS_FONT,
    fontSize: 14,
    fontWeight: 'bold',
    fill: 0xFF6B6B,
  }),

  cardHealth: new TextStyle({
    fontFamily: STATS_FONT,
    fontSize: 14,
    fontWeight: 'bold',
    fill: 0x6BFF6B,
  }),

  cardLevel: new TextStyle({
    fontFamily: DISPLAY_FONT,
    fontSize: 11,
    fontWeight: 'bold',
    fill: 0xFFD700,
  }),

  keywordBadge: new TextStyle({
    fontFamily: DISPLAY_FONT,
    fontSize: 10,
    fontWeight: 'bold',
    fill: 0xFFFFFF,
  }),

  damageNumber: new TextStyle({
    fontFamily: DISPLAY_FONT,
    fontSize: 28,
    fontWeight: 'bold',
    fill: 0xFF4444,
    stroke: { color: 0x000000, width: 3 },
    dropShadow: {
      color: 0x000000,
      blur: 4,
      distance: 2,
    },
  }),

  damageNumberBig: new TextStyle({
    fontFamily: DISPLAY_FONT,
    fontSize: 36,
    fontWeight: 'bold',
    fill: 0xFF2222,
    stroke: { color: 0x000000, width: 4 },
    dropShadow: {
      color: 0x000000,
      blur: 6,
      distance: 3,
    },
  }),

  damageNumberCrit: new TextStyle({
    fontFamily: DISPLAY_FONT,
    fontSize: 44,
    fontWeight: 'bold',
    fill: 0xFF0000,
    stroke: { color: 0x000000, width: 5 },
    dropShadow: {
      color: 0xFF0000,
      blur: 10,
      distance: 3,
    },
  }),

  healNumber: new TextStyle({
    fontFamily: DISPLAY_FONT,
    fontSize: 28,
    fontWeight: 'bold',
    fill: 0x44FF44,
    stroke: { color: 0x000000, width: 3 },
    dropShadow: {
      color: 0x000000,
      blur: 4,
      distance: 2,
    },
  }),

  poisonNumber: new TextStyle({
    fontFamily: DISPLAY_FONT,
    fontSize: 24,
    fontWeight: 'bold',
    fill: 0x9B59B6,
    stroke: { color: 0x000000, width: 3 },
  }),

  resourceNumber: new TextStyle({
    fontFamily: DISPLAY_FONT,
    fontSize: 24,
    fontWeight: 'bold',
    fill: 0xFFD700,
    stroke: { color: 0x000000, width: 3 },
  }),

  critBanner: new TextStyle({
    fontFamily: DISPLAY_FONT,
    fontSize: 36,
    fontWeight: 'bold',
    fill: 0xFFD700,
    stroke: { color: 0x000000, width: 4 },
    dropShadow: {
      color: 0xFFD700,
      blur: 12,
      distance: 0,
    },
  }),

  battleEndBanner: new TextStyle({
    fontFamily: DISPLAY_FONT,
    fontSize: 48,
    fontWeight: 'bold',
    fill: 0xFFD700,
    stroke: { color: 0x000000, width: 5 },
    dropShadow: {
      color: 0x000000,
      blur: 8,
      distance: 3,
    },
  }),

  phaseLabel: new TextStyle({
    fontFamily: DISPLAY_FONT,
    fontSize: 16,
    fontWeight: 'bold',
    fill: 0xAAAAAA,
  }),

  koText: new TextStyle({
    fontFamily: DISPLAY_FONT,
    fontSize: 40,
    fontWeight: 'bold',
    fill: 0xFF0000,
    stroke: { color: 0x000000, width: 4 },
  }),
} as const;
