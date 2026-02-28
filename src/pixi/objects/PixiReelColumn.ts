import { Container, Graphics } from 'pixi.js';
import gsap from 'gsap';
import { PixiCard, CARD_W, CARD_H, type PixiCardData } from './PixiCard';
import { biomeToNumber } from '../utils/BiomeTheme';
import type { Biome } from '../../engine/types';

const PHANTOM_COUNT = 8;
const BASE_SPIN_DURATION = 0.6;
const STAGGER_PER_COL = 0.15;

const BIOME_LIST: Biome[] = ['Red', 'Blue', 'Cream', 'Brown', 'Green'];

function randomBiome(): Biome {
  return BIOME_LIST[Math.floor(Math.random() * BIOME_LIST.length)];
}

function randomPhantomCard(): PixiCardData {
  const biome = randomBiome();
  return {
    instanceId: `phantom-${Math.random()}`,
    definitionId: 'phantom',
    name: '???',
    category: 'Ally',
    biome,
    rarity: 'Common',
    attack: Math.floor(Math.random() * 6) + 1,
    health: Math.floor(Math.random() * 20) + 5,
    maxHealth: 25,
    isKO: false,
    level: 1,
    keywords: [],
  };
}

export class PixiReelColumn extends Container {
  private resultCard: PixiCard;
  private phantomCards: PixiCard[] = [];
  private scrollContainer: Container;
  private maskGraphics: Graphics;
  private col: number;

  constructor(col: number) {
    super();
    this.col = col;

    // Mask to clip the spinning area
    this.maskGraphics = new Graphics();
    this.maskGraphics.roundRect(0, 0, CARD_W, CARD_H, 6);
    this.maskGraphics.fill({ color: 0xFFFFFF });
    this.addChild(this.maskGraphics);

    this.scrollContainer = new Container();
    this.scrollContainer.mask = this.maskGraphics;
    this.addChild(this.scrollContainer);

    this.resultCard = new PixiCard();
    // Create phantom cards
    for (let i = 0; i < PHANTOM_COUNT; i++) {
      const phantom = new PixiCard();
      phantom.setData(randomPhantomCard());
      this.phantomCards.push(phantom);
    }
  }

  /**
   * Run the reel spin animation.
   * Phantom cards scroll down, decelerating, and the result card bounces into place.
   */
  async spin(resultData: PixiCardData | null): Promise<void> {
    if (!resultData) {
      this.resultCard.setData(null);
      return;
    }

    // Set up scroll container with phantom cards stacked above result
    this.scrollContainer.removeChildren();

    // Refresh phantom data
    for (const phantom of this.phantomCards) {
      phantom.setData(randomPhantomCard());
    }

    // Layout: phantom cards stacked vertically, result card at bottom
    const spacing = CARD_H + 4;
    for (let i = 0; i < PHANTOM_COUNT; i++) {
      this.phantomCards[i].x = 0;
      this.phantomCards[i].y = i * spacing;
      this.scrollContainer.addChild(this.phantomCards[i]);
    }

    this.resultCard.setData(resultData);
    this.resultCard.x = 0;
    this.resultCard.y = PHANTOM_COUNT * spacing;
    this.scrollContainer.addChild(this.resultCard);

    // Start with scroll container positioned so first phantom is visible
    const startY = 0;
    const endY = -(PHANTOM_COUNT * spacing); // Scroll up to reveal result
    this.scrollContainer.y = startY;

    const duration = BASE_SPIN_DURATION + this.col * STAGGER_PER_COL;

    return new Promise<void>((resolve) => {
      gsap.to(this.scrollContainer, {
        y: endY,
        duration,
        ease: 'power2.out', // Decelerating ease
        onComplete: () => {
          // Bounce effect
          gsap.to(this.resultCard, {
            y: this.resultCard.y - 6,
            duration: 0.08,
            yoyo: true,
            repeat: 1,
            ease: 'power1.inOut',
            onComplete: () => {
              // Flash glow on land
              this.flashLand(resultData);
              resolve();
            },
          });
        },
      });
    });
  }

  private flashLand(data: PixiCardData): void {
    const color = data.category === 'Junk' ? 0x888888 : biomeToNumber(data.biome);
    const flash = new Graphics();
    flash.roundRect(-2, -2, CARD_W + 4, CARD_H + 4, 8);
    flash.fill({ color, alpha: 0.4 });
    this.addChild(flash);

    gsap.to(flash, {
      alpha: 0,
      duration: 0.4,
      ease: 'power2.out',
      onComplete: () => {
        this.removeChild(flash);
        flash.destroy();
      },
    });
  }

  /** Immediately show a card without animation */
  showStatic(data: PixiCardData | null): void {
    this.scrollContainer.removeChildren();
    this.resultCard.setData(data);
    this.resultCard.x = 0;
    this.resultCard.y = 0;
    this.scrollContainer.y = 0;
    this.scrollContainer.addChild(this.resultCard);
  }

  getResultCard(): PixiCard {
    return this.resultCard;
  }
}
