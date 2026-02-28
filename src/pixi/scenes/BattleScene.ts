import { Container, Graphics, Text } from 'pixi.js';
import { PixiCard, CARD_W, CARD_H, type PixiCardData } from '../objects/PixiCard';
import { PixiReelColumn } from '../objects/PixiReelColumn';
import { ParticleManager } from '../effects/ParticleManager';
import { OvertimeOverlay } from '../effects/OvertimeOverlay';
import { ScreenShake } from '../effects/ScreenShake';
import { computeLayout, colX, colCenterX, playerRowCenterY, type BattleLayout } from '../systems/LayoutManager';
import { TEXT_STYLES } from '../utils/TextStyles';
import type { Biome } from '../../engine/types';

const COLUMNS = 5;

export class BattleScene extends Container {
  // Layout
  layout!: BattleLayout;

  // Containers for layering
  private bgLayer: Container;
  private cardLayer: Container;
  vfxLayer: Container; // Public so AnimationDirector can add effects
  private uiLayer: Container;

  // Card display objects
  private opponentColumns: PixiReelColumn[] = [];
  private playerColumns: PixiReelColumn[] = [];

  // Static card displays (when not spinning)
  private opponentCards: PixiCard[] = [];
  private playerCards: PixiCard[] = [];

  // Battle line
  private battleLine: Graphics;
  private battleLineText: Text;

  // Sub-systems
  particleManager!: ParticleManager;
  overtimeOverlay!: OvertimeOverlay;
  screenShake: ScreenShake;

  // State tracking
  private _isSpinning = false;
  private _currentBiome: Biome = 'Red';

  // Mini reel grid (compact cards below player row)
  private miniReelContainer: Container;
  private miniReelCards: PixiCard[][] = []; // [row][col]

  constructor(width: number, height: number) {
    super();

    this.layout = computeLayout(width, height);

    // Layer setup
    this.bgLayer = new Container();
    this.cardLayer = new Container();
    this.vfxLayer = new Container();
    this.uiLayer = new Container();
    this.addChild(this.bgLayer);
    this.addChild(this.cardLayer);
    this.addChild(this.vfxLayer);
    this.addChild(this.uiLayer);

    // DEBUG: bright test rectangle to confirm rendering works
    const debugRect = new Graphics();
    debugRect.rect(10, 10, 200, 30);
    debugRect.fill({ color: 0xFF0000 });
    this.uiLayer.addChild(debugRect);
    const debugText = new Text({ text: `PIXI OK ${width}x${height}`, style: { fill: 0xFFFFFF, fontSize: 16 } });
    debugText.x = 15;
    debugText.y = 12;
    this.uiLayer.addChild(debugText);

    // Particles
    this.particleManager = new ParticleManager(this.bgLayer, width, height);

    // Overtime overlay
    this.overtimeOverlay = new OvertimeOverlay(this.bgLayer, width, height);

    // Screen shake target is the card layer
    this.screenShake = new ScreenShake(this.cardLayer);

    // Battle line
    this.battleLine = new Graphics();
    this.battleLineText = new Text({ text: '', style: TEXT_STYLES.phaseLabel });
    this.battleLineText.anchor.set(0.5, 0.5);
    this.uiLayer.addChild(this.battleLine);
    this.uiLayer.addChild(this.battleLineText);

    // Create reel columns
    for (let col = 0; col < COLUMNS; col++) {
      const oppCol = new PixiReelColumn(col);
      this.opponentColumns.push(oppCol);
      this.cardLayer.addChild(oppCol);

      const plrCol = new PixiReelColumn(col);
      this.playerColumns.push(plrCol);
      this.cardLayer.addChild(plrCol);

      // Static card displays
      const oppCard = new PixiCard();
      this.opponentCards.push(oppCard);
      this.cardLayer.addChild(oppCard);

      const plrCard = new PixiCard();
      this.playerCards.push(plrCard);
      this.cardLayer.addChild(plrCard);
    }

    // Mini reel container
    this.miniReelContainer = new Container();
    this.cardLayer.addChild(this.miniReelContainer);

    this.updateLayout();
  }

  updateLayout(): void {
    const l = this.layout;

    // Battle line
    this.battleLine.clear();
    this.battleLine.moveTo(l.rowOffsetX - 10, l.battleLineY);
    this.battleLine.lineTo(l.rowOffsetX + l.rowWidth + 10, l.battleLineY);
    this.battleLine.stroke({ color: 0xF1C40F, width: 2, alpha: 0.8 });
    this.battleLine.moveTo(l.rowOffsetX - 10, l.battleLineY + 24);
    this.battleLine.lineTo(l.rowOffsetX + l.rowWidth + 10, l.battleLineY + 24);
    this.battleLine.stroke({ color: 0xF1C40F, width: 2, alpha: 0.8 });

    this.battleLineText.x = l.width / 2;
    this.battleLineText.y = l.battleLineY + 12;

    // Position columns
    for (let col = 0; col < COLUMNS; col++) {
      const x = colX(l, col);
      this.opponentColumns[col].x = x;
      this.opponentColumns[col].y = l.opponentRowY;
      this.playerColumns[col].x = x;
      this.playerColumns[col].y = l.playerRowY;

      this.opponentCards[col].x = x;
      this.opponentCards[col].y = l.opponentRowY;
      this.playerCards[col].x = x;
      this.playerCards[col].y = l.playerRowY;
    }

    // Mini reel positioning
    this.miniReelContainer.x = 0;
    this.miniReelContainer.y = l.miniReelY;
  }

  resize(width: number, height: number): void {
    this.layout = computeLayout(width, height);
    this.particleManager.resize(width, height);
    this.overtimeOverlay.resize(width, height);
    this.updateLayout();
  }

  setBiome(biome: Biome): void {
    if (biome === this._currentBiome) return;
    this._currentBiome = biome;
    this.particleManager.setBiome(biome);
  }

  setBattleLineText(text: string): void {
    this.battleLineText.text = text;
  }

  /** Set static cards (not spinning) */
  setActiveCards(
    opponentData: (PixiCardData | null)[],
    playerData: (PixiCardData | null)[],
  ): void {
    for (let col = 0; col < COLUMNS; col++) {
      // Hide reel columns, show static cards
      this.opponentColumns[col].visible = false;
      this.playerColumns[col].visible = false;

      this.opponentCards[col].visible = true;
      this.opponentCards[col].setData(opponentData[col] ?? null);
      this.opponentCards[col].setActive(true);

      this.playerCards[col].visible = true;
      this.playerCards[col].setData(playerData[col] ?? null);
      this.playerCards[col].setActive(true);
    }
    this._isSpinning = false;
  }

  /** Start reel spin animation, returning promise that resolves when all columns have landed */
  async spinReels(
    opponentResults: (PixiCardData | null)[],
    playerResults: (PixiCardData | null)[],
  ): Promise<void> {
    this._isSpinning = true;

    // Hide static cards, show reel columns
    for (let col = 0; col < COLUMNS; col++) {
      this.opponentCards[col].visible = false;
      this.playerCards[col].visible = false;
      this.opponentColumns[col].visible = true;
      this.playerColumns[col].visible = true;
    }

    // Spin all columns concurrently
    const spinPromises: Promise<void>[] = [];
    for (let col = 0; col < COLUMNS; col++) {
      spinPromises.push(this.opponentColumns[col].spin(opponentResults[col]));
      spinPromises.push(this.playerColumns[col].spin(playerResults[col]));
    }

    await Promise.all(spinPromises);

    // After spin, switch to static card display
    this.setActiveCards(opponentResults, playerResults);
  }

  /** Update a single card's data (e.g., HP change during animation) */
  updateCard(isOpponent: boolean, col: number, data: Partial<PixiCardData>): void {
    const card = isOpponent ? this.opponentCards[col] : this.playerCards[col];
    if (card.data) {
      card.setData({ ...card.data, ...data });
    }
  }

  /** Get center position of a card for VFX targeting */
  getCardCenter(isOpponent: boolean, col: number): { x: number; y: number } {
    return {
      x: colCenterX(this.layout, col),
      y: playerRowCenterY(this.layout, isOpponent),
    };
  }

  /** Get card data for a specific position */
  getCardData(isOpponent: boolean, col: number): PixiCardData | null {
    const card = isOpponent ? this.opponentCards[col] : this.playerCards[col];
    return card.data;
  }

  /** Get the PixiCard object for direct manipulation */
  getPlayerCard(col: number): PixiCard { return this.playerCards[col]; }
  getOpponentCard(col: number): PixiCard { return this.opponentCards[col]; }

  /** Set mini reel grid (compact view of all player cards) */
  setMiniReel(reelData: (PixiCardData | null)[][], activeRow: number): void {
    const compactW = 95;
    const compactH = 132;
    const gap = 4;
    const totalW = COLUMNS * compactW + (COLUMNS - 1) * gap;
    const offsetX = (this.layout.width - totalW) / 2;

    // Reuse existing cards when possible, create new ones when grid grows
    for (let row = 0; row < reelData.length; row++) {
      if (!this.miniReelCards[row]) this.miniReelCards[row] = [];
      for (let col = 0; col < COLUMNS; col++) {
        let card = this.miniReelCards[row][col];
        if (!card) {
          card = new PixiCard(true);
          card.x = offsetX + col * (compactW + gap);
          card.y = row * (compactH + gap);
          this.miniReelContainer.addChild(card);
          this.miniReelCards[row][col] = card;
        }
        card.setData(reelData[row]?.[col] ?? null);
      }
    }

    // Remove excess rows if grid shrunk
    while (this.miniReelCards.length > reelData.length) {
      const row = this.miniReelCards.pop()!;
      for (const card of row) {
        this.miniReelContainer.removeChild(card);
        card.destroy();
      }
    }
  }

  /** Ticker update for ambient effects */
  update(dt: number): void {
    this.particleManager.update(dt);

    // Pulse active card glows
    for (let col = 0; col < COLUMNS; col++) {
      this.opponentCards[col].updatePulse(dt);
      this.playerCards[col].updatePulse(dt);
    }
  }

  destroy(): void {
    this.particleManager.destroy();
    this.overtimeOverlay.destroy();
    super.destroy({ children: true });
  }
}
