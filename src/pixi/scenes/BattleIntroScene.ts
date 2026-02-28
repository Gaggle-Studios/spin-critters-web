import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import gsap from 'gsap';
import { playSfx } from '../../audio/sfx';

const DISPLAY_FONT = "'Rajdhani', system-ui, sans-serif";

export class BattleIntroScene extends Container {
  private bg: Graphics;
  private leftPanel: Container;
  private rightPanel: Container;
  private vsText: Text;
  private _w: number;
  private _h: number;

  constructor(
    width: number,
    height: number,
    playerName: string,
    opponentName: string,
  ) {
    super();
    this._w = width;
    this._h = height;

    // Dark background
    this.bg = new Graphics();
    this.bg.rect(0, 0, width, height);
    this.bg.fill({ color: 0x0d0d1a, alpha: 0.95 });
    this.addChild(this.bg);

    // Gradient accents
    const gradient = new Graphics();
    gradient.rect(0, 0, width / 2, height);
    gradient.fill({ color: 0xE74C3C, alpha: 0.1 });
    gradient.rect(width / 2, 0, width / 2, height);
    gradient.fill({ color: 0x3498DB, alpha: 0.1 });
    this.addChild(gradient);

    // Left panel (player)
    this.leftPanel = new Container();
    const leftText = new Text({
      text: playerName,
      style: new TextStyle({
        fontFamily: DISPLAY_FONT,
        fontSize: 36,
        fontWeight: 'bold',
        fill: 0xFFFFFF,
      }),
    });
    leftText.anchor.set(0.5, 0.5);
    leftText.x = width * 0.25;
    leftText.y = height / 2;
    this.leftPanel.addChild(leftText);
    this.leftPanel.x = -width; // Start offscreen
    this.addChild(this.leftPanel);

    // Right panel (opponent)
    this.rightPanel = new Container();
    const rightText = new Text({
      text: opponentName,
      style: new TextStyle({
        fontFamily: DISPLAY_FONT,
        fontSize: 36,
        fontWeight: 'bold',
        fill: 0xFFFFFF,
      }),
    });
    rightText.anchor.set(0.5, 0.5);
    rightText.x = width * 0.75;
    rightText.y = height / 2;
    this.rightPanel.addChild(rightText);
    this.rightPanel.x = width; // Start offscreen
    this.addChild(this.rightPanel);

    // VS text
    this.vsText = new Text({
      text: 'VS',
      style: new TextStyle({
        fontFamily: DISPLAY_FONT,
        fontSize: 72,
        fontWeight: 'bold',
        fill: 0xF1C40F,
        stroke: { color: 0x000000, width: 4 },
        dropShadow: {
          color: 0xF1C40F,
          blur: 10,
          distance: 0,
        },
      }),
    });
    this.vsText.anchor.set(0.5, 0.5);
    this.vsText.x = width / 2;
    this.vsText.y = height / 2;
    this.vsText.scale.set(0);
    this.vsText.alpha = 0;
    this.addChild(this.vsText);
  }

  /** Play the intro animation and resolve when done */
  async play(): Promise<void> {
    playSfx('battleStart');

    return new Promise<void>((resolve) => {
      const tl = gsap.timeline({
        onComplete: () => resolve(),
      });

      // Slide in panels
      tl.to(this.leftPanel, {
        x: 0,
        duration: 0.5,
        ease: 'power2.out',
      }, 0);

      tl.to(this.rightPanel, {
        x: 0,
        duration: 0.5,
        ease: 'power2.out',
      }, 0.1);

      // VS pop-in
      tl.to(this.vsText, {
        alpha: 1,
        duration: 0.1,
      }, 0.4);
      tl.to(this.vsText.scale, {
        x: 1.4,
        y: 1.4,
        duration: 0.2,
        ease: 'back.out(3)',
      }, 0.4);
      tl.to(this.vsText.scale, {
        x: 1,
        y: 1,
        duration: 0.15,
        ease: 'power1.inOut',
      }, 0.6);

      // Hold
      tl.to({}, { duration: 0.8 });

      // Fade out
      tl.to(this, {
        alpha: 0,
        duration: 0.3,
        ease: 'power2.in',
      });
    });
  }
}
