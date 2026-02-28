import { Container, Graphics } from 'pixi.js';
import gsap from 'gsap';

const PARTICLE_COUNT = 12;

export class KOExplosion {
  /** Create an explosion of particles at the given position. Self-cleaning. */
  static play(parent: Container, x: number, y: number, color: number = 0xFF4444): gsap.core.Timeline {
    const tl = gsap.timeline();
    const particles: Graphics[] = [];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = new Graphics();
      const size = 3 + Math.random() * 5;
      p.rect(-size / 2, -size / 2, size, size);
      p.fill({ color, alpha: 0.9 });
      p.x = x;
      p.y = y;
      p.rotation = Math.random() * Math.PI * 2;
      parent.addChild(p);
      particles.push(p);

      const angle = (Math.PI * 2 * i) / PARTICLE_COUNT + (Math.random() - 0.5) * 0.5;
      const dist = 40 + Math.random() * 60;
      const targetX = x + Math.cos(angle) * dist;
      const targetY = y + Math.sin(angle) * dist;

      tl.to(p, {
        x: targetX,
        y: targetY,
        alpha: 0,
        rotation: p.rotation + Math.PI * 2 * (Math.random() > 0.5 ? 1 : -1),
        duration: 0.4 + Math.random() * 0.3,
        ease: 'power2.out',
      }, 0);
    }

    // Red flash circle
    const flash = new Graphics();
    flash.circle(0, 0, 30);
    flash.fill({ color: 0xFF0000, alpha: 0.5 });
    flash.x = x;
    flash.y = y;
    parent.addChild(flash);

    tl.to(flash, {
      alpha: 0,
      duration: 0.3,
      ease: 'power2.out',
      onUpdate: () => {
        const s = 1 + (1 - flash.alpha) * 2;
        flash.scale.set(s);
      },
    }, 0);

    // Cleanup
    tl.call(() => {
      for (const p of particles) {
        parent.removeChild(p);
        p.destroy();
      }
      parent.removeChild(flash);
      flash.destroy();
    });

    return tl;
  }
}
