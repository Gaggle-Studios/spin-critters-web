import { Container, Graphics } from 'pixi.js';
import gsap from 'gsap';

export class AttackProjectile extends Container {
  private core: Graphics;
  private trail: Graphics;

  constructor(color: number = 0xFFD700, size: number = 8) {
    super();

    // Trail (elongated blur behind)
    this.trail = new Graphics();
    this.trail.circle(0, 0, size * 1.5);
    this.trail.fill({ color, alpha: 0.3 });
    this.addChild(this.trail);

    // Core (bright center)
    this.core = new Graphics();
    this.core.circle(0, 0, size);
    this.core.fill({ color: 0xFFFFFF, alpha: 0.9 });
    this.core.circle(0, 0, size * 0.6);
    this.core.fill({ color, alpha: 1 });
    this.addChild(this.core);
  }

  /**
   * Fire from startPos to endPos with impact flash.
   * Returns a GSAP timeline. Removes self on complete.
   */
  fire(
    parentContainer: Container,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    duration: number = 0.25,
  ): gsap.core.Timeline {
    parentContainer.addChild(this);
    this.x = startX;
    this.y = startY;
    this.alpha = 1;

    const tl = gsap.timeline();

    // Calculate angle for rotation
    const angle = Math.atan2(endY - startY, endX - startX);
    this.rotation = angle;

    tl.to(this, {
      x: endX,
      y: endY,
      duration,
      ease: 'power2.in',
    }, 0);

    // Scale up slightly as it travels
    tl.to(this.scale, {
      x: 1.3,
      y: 1.3,
      duration: duration * 0.7,
      ease: 'power1.in',
    }, 0);

    // Impact flash
    tl.call(() => {
      this.createImpactFlash(parentContainer, endX, endY);
    });

    // Remove self
    tl.call(() => {
      parentContainer.removeChild(this);
      this.destroy();
    });

    return tl;
  }

  private createImpactFlash(parent: Container, x: number, y: number): void {
    const flash = new Graphics();
    flash.circle(0, 0, 20);
    flash.fill({ color: 0xFFFFFF, alpha: 0.7 });
    flash.x = x;
    flash.y = y;
    parent.addChild(flash);

    gsap.to(flash, {
      alpha: 0,
      duration: 0.2,
      ease: 'power2.out',
      onUpdate: () => {
        flash.scale.set(flash.alpha * -1 + 2); // Expand as it fades
      },
      onComplete: () => {
        parent.removeChild(flash);
        flash.destroy();
      },
    });
  }
}
