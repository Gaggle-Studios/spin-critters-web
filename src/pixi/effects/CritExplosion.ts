import { Container, Graphics, Text } from 'pixi.js';
import gsap from 'gsap';
import { TEXT_STYLES } from '../utils/TextStyles';

const PARTICLE_COUNT = 24;

export class CritExplosion {
  /**
   * Full-screen CRIT burst with text banner.
   * Self-cleaning.
   */
  static play(
    parent: Container,
    centerX: number,
    centerY: number,
    text: string,
    color: number = 0xFFD700,
  ): gsap.core.Timeline {
    const tl = gsap.timeline();

    // Full-screen flash
    const flash = new Graphics();
    flash.rect(-2000, -2000, 4000, 4000);
    flash.fill({ color, alpha: 0.25 });
    parent.addChild(flash);

    tl.to(flash, {
      alpha: 0,
      duration: 0.6,
      ease: 'power2.out',
    }, 0);

    // Particle burst
    const particles: Graphics[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = new Graphics();
      const size = 4 + Math.random() * 6;
      p.circle(0, 0, size);
      p.fill({ color, alpha: 0.8 });
      p.x = centerX;
      p.y = centerY;
      parent.addChild(p);
      particles.push(p);

      const angle = (Math.PI * 2 * i) / PARTICLE_COUNT;
      const dist = 100 + Math.random() * 150;

      tl.to(p, {
        x: centerX + Math.cos(angle) * dist,
        y: centerY + Math.sin(angle) * dist,
        alpha: 0,
        duration: 0.6 + Math.random() * 0.3,
        ease: 'power2.out',
      }, 0);
    }

    // Text banner
    const banner = new Text({
      text,
      style: { ...TEXT_STYLES.critBanner, fill: color },
    });
    banner.anchor.set(0.5, 0.5);
    banner.x = centerX;
    banner.y = centerY;
    banner.scale.set(0);
    banner.alpha = 0;
    parent.addChild(banner);

    // Scale pop-in
    tl.to(banner, {
      alpha: 1,
      duration: 0.1,
    }, 0.1);
    tl.to(banner.scale, {
      x: 1.4,
      y: 1.4,
      duration: 0.2,
      ease: 'back.out(3)',
    }, 0.1);
    tl.to(banner.scale, {
      x: 1,
      y: 1,
      duration: 0.15,
      ease: 'power1.inOut',
    }, 0.3);

    // Hold then fade
    tl.to(banner, {
      alpha: 0,
      y: centerY - 30,
      duration: 0.4,
      ease: 'power2.in',
    }, 0.8);

    // Cleanup
    tl.call(() => {
      parent.removeChild(flash);
      flash.destroy();
      for (const p of particles) {
        parent.removeChild(p);
        p.destroy();
      }
      parent.removeChild(banner);
      banner.destroy();
    });

    return tl;
  }
}
