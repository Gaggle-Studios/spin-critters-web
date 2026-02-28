import { Container, Graphics } from 'pixi.js';
import gsap from 'gsap';

export class OvertimeOverlay {
  private overlay: Graphics;
  private _intensity = 0;

  constructor(parent: Container, width: number, height: number) {
    this.overlay = new Graphics();
    this.overlay.rect(0, 0, width, height);
    this.overlay.fill({ color: 0x330000 });
    this.overlay.alpha = 0;
    parent.addChild(this.overlay);
  }

  /** Set intensity based on spin number (0 = no overtime, higher = more red) */
  setIntensity(overtimeSpins: number): void {
    const target = Math.min(overtimeSpins * 0.06, 0.4);
    if (Math.abs(target - this._intensity) > 0.01) {
      this._intensity = target;
      gsap.to(this.overlay, {
        alpha: target,
        duration: 0.5,
        ease: 'power1.inOut',
      });
    }
  }

  resize(width: number, height: number): void {
    this.overlay.clear();
    this.overlay.rect(0, 0, width, height);
    this.overlay.fill({ color: 0x330000 });
    this.overlay.alpha = this._intensity;
  }

  destroy(): void {
    this.overlay.destroy();
  }
}
