import { Container, Graphics, Text, Sprite } from 'pixi.js';
import type { CardInstance, Biome, Rarity } from '../../engine/types';
import { KEYWORD_INFO } from '../../engine/constants';
import { biomeToNumber } from '../utils/BiomeTheme';
import { TEXT_STYLES } from '../utils/TextStyles';
import { getCachedTexture } from '../utils/AssetLoader';

export const CARD_W = 120;
export const CARD_H = 170;
const CARD_W_COMPACT = 95;
const CARD_H_COMPACT = 132;
const CORNER_RADIUS = 6;

export interface PixiCardData {
  instanceId: string;
  definitionId: string;
  name: string;
  category: string;
  biome: Biome;
  rarity: Rarity;
  attack: number;
  health: number;
  maxHealth: number;
  isKO: boolean;
  level: number;
  keywords: { name: string; value?: number }[];
}

export class PixiCard extends Container {
  data: PixiCardData | null = null;

  private bg: Graphics;
  private artSprite: Sprite | null = null;
  private nameText: Text;
  private levelText: Text;
  private attackText: Text;
  private healthText: Text;
  private koOverlay: Graphics;
  private koText: Text;
  private keywordContainer: Container;
  private glowGraphics: Graphics;
  private highlightGraphics: Graphics;

  private _compact: boolean;
  private _w: number;
  private _h: number;
  private _isActive = false;
  private _highlightColor: number | null = null;
  private _glowPulseTime = 0;

  constructor(compact = false) {
    super();
    this._compact = compact;
    this._w = compact ? CARD_W_COMPACT : CARD_W;
    this._h = compact ? CARD_H_COMPACT : CARD_H;

    // Glow behind card
    this.glowGraphics = new Graphics();
    this.glowGraphics.alpha = 0;
    this.addChild(this.glowGraphics);

    // Highlight border
    this.highlightGraphics = new Graphics();
    this.highlightGraphics.alpha = 0;
    this.addChild(this.highlightGraphics);

    // Background
    this.bg = new Graphics();
    this.addChild(this.bg);

    // Name (clone style so per-card fill changes don't leak)
    this.nameText = new Text({
      text: '',
      style: (compact ? TEXT_STYLES.cardName : TEXT_STYLES.cardNameLarge).clone(),
    });
    this.nameText.x = 4;
    this.nameText.y = 3;
    this.addChild(this.nameText);

    // Level badge
    this.levelText = new Text({ text: '', style: TEXT_STYLES.cardLevel.clone() });
    this.levelText.anchor.set(1, 0);
    this.levelText.x = this._w - 4;
    this.levelText.y = 3;
    this.levelText.visible = false;
    this.addChild(this.levelText);

    // Keyword badges
    this.keywordContainer = new Container();
    this.addChild(this.keywordContainer);

    // Attack / Health (clone styles for per-card fill changes)
    this.attackText = new Text({ text: '', style: TEXT_STYLES.cardAttack.clone() });
    this.attackText.x = 6;
    this.addChild(this.attackText);

    this.healthText = new Text({ text: '', style: TEXT_STYLES.cardHealth.clone() });
    this.healthText.anchor.set(1, 0);
    this.healthText.x = this._w - 6;
    this.addChild(this.healthText);

    // KO overlay
    this.koOverlay = new Graphics();
    this.koOverlay.visible = false;
    this.addChild(this.koOverlay);

    this.koText = new Text({ text: 'X', style: TEXT_STYLES.koText });
    this.koText.anchor.set(0.5, 0.5);
    this.koText.x = this._w / 2;
    this.koText.y = this._h / 2;
    this.koText.visible = false;
    this.addChild(this.koText);
  }

  get cardWidth(): number { return this._w; }
  get cardHeight(): number { return this._h; }

  setData(data: PixiCardData | null): void {
    this.data = data;
    this.redraw();
  }

  setActive(active: boolean): void {
    this._isActive = active;
    this.updateGlow();
  }

  setHighlight(color: number | null): void {
    this._highlightColor = color;
    this.drawHighlight();
  }

  private redraw(): void {
    if (!this.data) {
      // Show empty slot placeholder instead of hiding
      this.visible = true;
      this.drawEmptySlot();
      return;
    }
    this.visible = true;
    this.alpha = 1; // Reset from empty slot dimming

    const d = this.data;
    const w = this._w;
    const h = this._h;
    const isKO = d.isKO;
    const biomeColor = d.category === 'Junk' ? 0x333333 : biomeToNumber(d.biome);

    // Background
    this.bg.clear();
    this.bg.roundRect(0, 0, w, h, CORNER_RADIUS);
    this.bg.fill({ color: isKO ? 0x2a2a2a : biomeColor });

    // Border
    const borderColor = isKO ? 0x555555 : this.getBorderColor();
    this.bg.roundRect(0, 0, w, h, CORNER_RADIUS);
    this.bg.stroke({ color: borderColor, width: 2 });

    // Dark header bar
    this.bg.rect(0, 0, w, 22);
    this.bg.fill({ color: 0x000000, alpha: 0.5 });

    // Dark footer bar (stats)
    this.bg.rect(0, h - 24, w, 24);
    this.bg.fill({ color: 0x000000, alpha: 0.5 });

    // Art sprite
    this.updateArt(d, w);

    // Name
    this.nameText.text = d.name;
    this.nameText.x = 4;
    this.nameText.y = 3;
    this.nameText.style.fill = isKO ? 0x666666 : 0xFFFFFF;
    // Truncate if too wide
    const maxNameW = w - (d.level > 1 ? 30 : 8);
    if (this.nameText.width > maxNameW) {
      const name = d.name;
      for (let i = name.length - 1; i > 0; i--) {
        this.nameText.text = name.substring(0, i) + '..';
        if (this.nameText.width <= maxNameW) break;
      }
    }

    // Level
    if (d.level > 1) {
      this.levelText.text = `L${d.level}`;
      this.levelText.visible = true;
    } else {
      this.levelText.visible = false;
    }

    // Keywords
    this.drawKeywords(d, w, h);

    // Stats
    const statsY = h - 20;
    this.attackText.text = `${d.attack}A`;
    this.attackText.style.fill = isKO ? 0x666666 : 0xFF6B6B;
    this.attackText.y = statsY;

    this.healthText.text = `${d.health}/${d.maxHealth}H`;
    this.healthText.style.fill = isKO ? 0x666666 : 0x6BFF6B;
    this.healthText.y = statsY;

    // KO
    this.koOverlay.clear();
    if (isKO) {
      this.koOverlay.roundRect(0, 0, w, h, CORNER_RADIUS);
      this.koOverlay.fill({ color: 0x000000, alpha: 0.4 });
      this.koOverlay.visible = true;
      this.koText.visible = true;
      this.alpha = 0.6;
    } else {
      this.koOverlay.visible = false;
      this.koText.visible = false;
      this.alpha = 1;
    }

    this.updateGlow();
  }

  private drawEmptySlot(): void {
    const w = this._w;
    const h = this._h;

    // Clear everything
    this.bg.clear();
    if (this.artSprite) {
      this.removeChild(this.artSprite);
      this.artSprite = null;
    }
    this.nameText.text = '';
    this.levelText.visible = false;
    this.keywordContainer.removeChildren();
    this.attackText.text = '';
    this.healthText.text = '';
    this.koOverlay.clear();
    this.koOverlay.visible = false;
    this.koText.visible = false;
    this.glowGraphics.clear();
    this.glowGraphics.alpha = 0;
    this.highlightGraphics.clear();
    this.highlightGraphics.alpha = 0;
    this.alpha = 0.7;

    // Dark empty slot background
    this.bg.roundRect(0, 0, w, h, CORNER_RADIUS);
    this.bg.fill({ color: 0x1e1e3a });

    // Solid border
    this.bg.roundRect(0, 0, w, h, CORNER_RADIUS);
    this.bg.stroke({ color: 0x555588, width: 2 });

    // Question mark in center
    this.nameText.text = '?';
    this.nameText.style.fill = 0x666699;
    this.nameText.x = w / 2 - 6;
    this.nameText.y = h / 2 - 10;
  }

  private updateArt(d: PixiCardData, w: number): void {
    if (this.artSprite) {
      this.removeChild(this.artSprite);
      this.artSprite = null;
    }

    if (d.category === 'Junk') return;

    const tex = getCachedTexture(d.definitionId);
    if (!tex) return;

    this.artSprite = new Sprite(tex);
    const artH = this._h - 22 - 24 - (d.keywords.length > 0 ? 18 : 0);
    this.artSprite.x = 0;
    this.artSprite.y = 22;
    this.artSprite.width = w;
    this.artSprite.height = Math.max(artH, 20);
    if (d.isKO) this.artSprite.alpha = 0.3;
    this.addChildAt(this.artSprite, this.getChildIndex(this.nameText));
  }

  private drawKeywords(d: PixiCardData, w: number, h: number): void {
    this.keywordContainer.removeChildren();

    if (d.keywords.length === 0) return;

    // Dark keyword bar
    const barY = h - 24 - 18;
    const barBg = new Graphics();
    barBg.rect(0, barY, w, 18);
    barBg.fill({ color: 0x000000, alpha: 0.55 });
    this.keywordContainer.addChild(barBg);

    let xPos = 3;
    for (const kw of d.keywords) {
      const info = KEYWORD_INFO[kw.name];
      const kwColor = info ? parseInt(info.color.replace('#', ''), 16) : 0x666666;
      const label = this._compact
        ? (kw.name.length > 4 ? kw.name.substring(0, 3) : kw.name)
        : kw.name;
      const text = kw.value ? `${label} ${kw.value}` : label;

      const badge = new Graphics();
      const txtObj = new Text({ text, style: TEXT_STYLES.keywordBadge });
      const badgeW = txtObj.width + 6;
      badge.roundRect(xPos, barY + 2, badgeW, 14, 3);
      badge.fill({ color: kwColor });
      this.keywordContainer.addChild(badge);

      txtObj.x = xPos + 3;
      txtObj.y = barY + 2;
      this.keywordContainer.addChild(txtObj);

      xPos += badgeW + 3;
      if (xPos > w - 10) break;
    }
  }

  private getBorderColor(): number {
    if (this._highlightColor !== null) return this._highlightColor;
    if (!this.data) return 0x888888;
    if (this.data.rarity === 'Rare') return 0xFFD700;
    if (this._isActive) return biomeToNumber(this.data.biome);
    return 0x888888;
  }

  private updateGlow(): void {
    this.glowGraphics.clear();
    if (!this.data || this.data.isKO) {
      this.glowGraphics.alpha = 0;
      return;
    }

    if (this._isActive && this._highlightColor === null) {
      const color = biomeToNumber(this.data.biome);
      this.glowGraphics.roundRect(-4, -4, this._w + 8, this._h + 8, CORNER_RADIUS + 2);
      this.glowGraphics.fill({ color, alpha: 0.15 });
      this.glowGraphics.roundRect(-2, -2, this._w + 4, this._h + 4, CORNER_RADIUS + 1);
      this.glowGraphics.fill({ color, alpha: 0.08 });
      this.glowGraphics.alpha = 1;
    } else {
      this.glowGraphics.alpha = 0;
    }
  }

  private drawHighlight(): void {
    this.highlightGraphics.clear();
    if (this._highlightColor === null) {
      this.highlightGraphics.alpha = 0;
      return;
    }
    // Outer glow (soft, wide)
    this.highlightGraphics.roundRect(-10, -10, this._w + 20, this._h + 20, CORNER_RADIUS + 6);
    this.highlightGraphics.fill({ color: this._highlightColor, alpha: 0.25 });
    // Mid glow
    this.highlightGraphics.roundRect(-6, -6, this._w + 12, this._h + 12, CORNER_RADIUS + 4);
    this.highlightGraphics.fill({ color: this._highlightColor, alpha: 0.2 });
    // Inner bright border
    this.highlightGraphics.roundRect(-3, -3, this._w + 6, this._h + 6, CORNER_RADIUS + 2);
    this.highlightGraphics.stroke({ color: this._highlightColor, width: 4, alpha: 0.95 });
    // White-hot inner edge
    this.highlightGraphics.roundRect(-1, -1, this._w + 2, this._h + 2, CORNER_RADIUS + 1);
    this.highlightGraphics.stroke({ color: 0xFFFFFF, width: 2, alpha: 0.6 });
    this.highlightGraphics.alpha = 1;
    // Re-draw border
    this.redraw();
  }

  /** Animate a pulsing glow (call from ticker) */
  updatePulse(dt: number): void {
    if (!this._isActive || !this.data || this.data.isKO) return;
    this._glowPulseTime += dt * 0.03;
    const pulse = 0.6 + Math.sin(this._glowPulseTime) * 0.4;
    this.glowGraphics.alpha = pulse;
  }

  static fromCardInstance(card: CardInstance, compact = false): PixiCard {
    const pc = new PixiCard(compact);
    pc.setData({
      instanceId: card.instanceId,
      definitionId: card.definitionId,
      name: card.name,
      category: card.category,
      biome: card.biome,
      rarity: card.rarity,
      attack: card.currentAttack,
      health: card.currentHealth,
      maxHealth: card.maxHealth,
      isKO: card.isKO,
      level: card.level,
      keywords: card.keywords.map(k => ({ name: k.name, value: k.value })),
    });
    return pc;
  }

  static empty(compact = false): PixiCard {
    const pc = new PixiCard(compact);
    pc.visible = false;
    return pc;
  }
}
