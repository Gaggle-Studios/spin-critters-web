import { Container, Graphics, Text } from 'pixi.js';
import gsap from 'gsap';
import { TEXT_STYLES } from '../utils/TextStyles';

const PARTICLE_COUNT = 40;

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

    // Expanding shockwave ring
    const ring = new Graphics();
    ring.circle(0, 0, 10);
    ring.stroke({ color, width: 4, alpha: 0.8 });
    ring.x = centerX;
    ring.y = centerY;
    parent.addChild(ring);

    tl.to(ring.scale, {
      x: 20,
      y: 20,
      duration: 0.6,
      ease: 'power2.out',
    }, 0);
    tl.to(ring, {
      alpha: 0,
      duration: 0.6,
      ease: 'power2.out',
    }, 0);

    // Particle burst - two rings (inner fast, outer slow)
    const particles: Graphics[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = new Graphics();
      const isInner = i < PARTICLE_COUNT / 2;
      const size = isInner ? (3 + Math.random() * 5) : (5 + Math.random() * 8);
      p.circle(0, 0, size);
      const pColor = Math.random() > 0.3 ? color : 0xFFFFFF;
      p.fill({ color: pColor, alpha: 0.9 });
      p.x = centerX;
      p.y = centerY;
      parent.addChild(p);
      particles.push(p);

      const angle = (Math.PI * 2 * i) / (PARTICLE_COUNT / 2) + (isInner ? 0 : Math.PI / PARTICLE_COUNT);
      const dist = isInner ? (80 + Math.random() * 120) : (150 + Math.random() * 200);

      tl.to(p, {
        x: centerX + Math.cos(angle) * dist,
        y: centerY + Math.sin(angle) * dist,
        alpha: 0,
        duration: isInner ? (0.5 + Math.random() * 0.2) : (0.7 + Math.random() * 0.4),
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

    // Scale pop-in (bigger, bouncier)
    tl.to(banner, {
      alpha: 1,
      duration: 0.08,
    }, 0.05);
    tl.to(banner.scale, {
      x: 1.6,
      y: 1.6,
      duration: 0.2,
      ease: 'back.out(4)',
    }, 0.05);
    tl.to(banner.scale, {
      x: 1.1,
      y: 1.1,
      duration: 0.15,
      ease: 'power1.inOut',
    }, 0.25);

    // Hold then fade
    tl.to(banner, {
      alpha: 0,
      y: centerY - 40,
      duration: 0.4,
      ease: 'power2.in',
    }, 0.8);

    // Cleanup
    tl.call(() => {
      parent.removeChild(ring);
      ring.destroy();
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
