import type { Biome } from '../../engine/types';

export interface BiomeThemeConfig {
  color: number;
  colorHex: string;
  particleColors: number[];
  glowColor: number;
  bgGradientStops: [string, string];
}

export const BIOME_THEMES: Record<Biome, BiomeThemeConfig> = {
  Red: {
    color: 0xE74C3C,
    colorHex: '#E74C3C',
    particleColors: [0xE74C3C, 0xF39C12, 0xFF6B35],
    glowColor: 0xE74C3C,
    bgGradientStops: ['#2a0a0a', '#0d0d1a'],
  },
  Blue: {
    color: 0x3498DB,
    colorHex: '#3498DB',
    particleColors: [0x3498DB, 0x2980B9, 0x5DADE2],
    glowColor: 0x3498DB,
    bgGradientStops: ['#0a1a2a', '#0d0d1a'],
  },
  Cream: {
    color: 0xF5E6CC,
    colorHex: '#F5E6CC',
    particleColors: [0xF5E6CC, 0xFFFFFF, 0xE8D5B7],
    glowColor: 0xF5E6CC,
    bgGradientStops: ['#1a1a1a', '#0d0d1a'],
  },
  Brown: {
    color: 0x8B4513,
    colorHex: '#8B4513',
    particleColors: [0x8B4513, 0xA0522D, 0x6B3410],
    glowColor: 0x8B4513,
    bgGradientStops: ['#1a0f08', '#0d0d1a'],
  },
  Green: {
    color: 0x27AE60,
    colorHex: '#27AE60',
    particleColors: [0x27AE60, 0x2ECC71, 0x1E8449],
    glowColor: 0x27AE60,
    bgGradientStops: ['#0a1a0f', '#0d0d1a'],
  },
};

export function getBiomeTheme(biome: Biome): BiomeThemeConfig {
  return BIOME_THEMES[biome];
}

export function biomeToNumber(biome: Biome): number {
  return BIOME_THEMES[biome].color;
}

export const RARITY_COLORS = {
  Common: 0x888888,
  Uncommon: 0x9B59B6,
  Rare: 0xFFD700,
} as const;

export const CATEGORY_ICONS: Record<string, string> = {
  Critter: 'C',
  Ally: 'A',
  Location: 'L',
  Relic: 'R',
  Junk: 'J',
};
