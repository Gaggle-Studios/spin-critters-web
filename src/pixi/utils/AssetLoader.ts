import { Assets, Texture } from 'pixi.js';

const textureCache = new Map<string, Texture>();
const failedLoads = new Set<string>();

export function getCardImageUrl(cardId: string, category: string): string | null {
  if (category === 'Junk') return null;
  return `/critters/${cardId}.png`;
}

export async function loadCardTexture(cardId: string, category: string): Promise<Texture | null> {
  if (category === 'Junk') return null;

  const cacheKey = cardId;
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey)!;
  if (failedLoads.has(cacheKey)) return null;

  const url = getCardImageUrl(cardId, category);
  if (!url) return null;

  try {
    const texture = await Assets.load<Texture>(url);
    textureCache.set(cacheKey, texture);
    return texture;
  } catch {
    failedLoads.add(cacheKey);
    return null;
  }
}

export function getCachedTexture(cardId: string): Texture | null {
  return textureCache.get(cardId) ?? null;
}

export async function preloadCardTextures(cardIds: Array<{ id: string; category: string }>): Promise<void> {
  const promises = cardIds
    .filter(c => c.category !== 'Junk' && !textureCache.has(c.id) && !failedLoads.has(c.id))
    .map(c => loadCardTexture(c.id, c.category));
  await Promise.allSettled(promises);
}
