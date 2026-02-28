import { Container, Graphics } from 'pixi.js';
import gsap from 'gsap';

/** Particle helpers */
function createParticle(parent: Container, x: number, y: number, color: number, size: number): Graphics {
  const p = new Graphics();
  p.circle(0, 0, size);
  p.fill({ color, alpha: 0.8 });
  p.x = x;
  p.y = y;
  parent.addChild(p);
  return p;
}

function cleanupParticles(parent: Container, particles: Graphics[]): void {
  for (const p of particles) {
    parent.removeChild(p);
    p.destroy();
  }
}

export class KeywordVFX {
  /** Orange spike particles burst toward attacker position */
  static thorns(parent: Container, fromX: number, fromY: number, toX: number, toY: number): gsap.core.Timeline {
    const tl = gsap.timeline();
    const particles: Graphics[] = [];
    const count = 6;

    for (let i = 0; i < count; i++) {
      const p = createParticle(parent, fromX, fromY, 0xE67E22, 3 + Math.random() * 3);
      particles.push(p);

      const spread = 20;
      const tx = toX + (Math.random() - 0.5) * spread;
      const ty = toY + (Math.random() - 0.5) * spread;

      tl.to(p, {
        x: tx,
        y: ty,
        alpha: 0,
        duration: 0.25 + Math.random() * 0.1,
        ease: 'power2.in',
        delay: i * 0.02,
      }, 0);
    }

    tl.call(() => cleanupParticles(parent, particles));
    return tl;
  }

  /** Green droplets + purple glow for poison/venomous */
  static poison(parent: Container, x: number, y: number): gsap.core.Timeline {
    const tl = gsap.timeline();
    const particles: Graphics[] = [];
    const count = 8;

    for (let i = 0; i < count; i++) {
      const color = Math.random() > 0.5 ? 0x9B59B6 : 0x27AE60;
      const p = createParticle(parent, x + (Math.random() - 0.5) * 30, y, color, 2 + Math.random() * 3);
      particles.push(p);

      tl.to(p, {
        y: y - 20 - Math.random() * 20,
        alpha: 0,
        duration: 0.5 + Math.random() * 0.3,
        ease: 'power1.out',
        delay: i * 0.03,
      }, 0);
    }

    tl.call(() => cleanupParticles(parent, particles));
    return tl;
  }

  /** Green sparkles rising for regenerate */
  static regenerate(parent: Container, x: number, y: number): gsap.core.Timeline {
    const tl = gsap.timeline();
    const particles: Graphics[] = [];
    const count = 8;

    for (let i = 0; i < count; i++) {
      const p = createParticle(parent, x + (Math.random() - 0.5) * 40, y + 10, 0x2ECC71, 2 + Math.random() * 2);
      particles.push(p);

      tl.to(p, {
        y: y - 30 - Math.random() * 20,
        alpha: 0,
        duration: 0.6 + Math.random() * 0.2,
        ease: 'power1.out',
        delay: i * 0.04,
      }, 0);
    }

    tl.call(() => cleanupParticles(parent, particles));
    return tl;
  }

  /** Golden sparkle arc to adjacent cards for healing */
  static healing(parent: Container, fromX: number, fromY: number, toX: number, toY: number): gsap.core.Timeline {
    const tl = gsap.timeline();
    const particles: Graphics[] = [];
    const count = 6;

    for (let i = 0; i < count; i++) {
      const p = createParticle(parent, fromX, fromY, 0xFFD700, 2 + Math.random() * 2);
      particles.push(p);

      const targetX = toX + (Math.random() - 0.5) * 15;
      const delay = i * 0.04;

      // Simple arc: animate x linearly, y with a parabolic ease
      tl.to(p, {
        x: targetX,
        duration: 0.4,
        ease: 'power1.inOut',
        delay,
      }, 0);

      // Y goes up first (arc peak), then down to target
      const peakY = Math.min(fromY, toY) - 30;
      tl.to(p, {
        y: peakY,
        duration: 0.2,
        ease: 'power1.out',
        delay,
      }, 0);
      tl.to(p, {
        y: toY,
        duration: 0.2,
        ease: 'power1.in',
        delay: delay + 0.2,
      }, 0);

      tl.to(p, {
        alpha: 0,
        duration: 0.15,
        delay: delay + 0.3,
      }, 0);
    }

    tl.call(() => cleanupParticles(parent, particles));
    return tl;
  }

  /** Blue power-up aura for bolster */
  static bolster(parent: Container, x: number, y: number): gsap.core.Timeline {
    const tl = gsap.timeline();

    const aura = new Graphics();
    aura.roundRect(-10, -10, 20, 20, 4);
    aura.fill({ color: 0x2980B9, alpha: 0.4 });
    aura.x = x;
    aura.y = y;
    parent.addChild(aura);

    tl.from(aura.scale, { x: 0, y: 0, duration: 0.2, ease: 'back.out(2)' }, 0);
    tl.to(aura, {
      alpha: 0,
      duration: 0.4,
      ease: 'power2.out',
      onUpdate: () => {
        const s = 1 + (1 - aura.alpha) * 2;
        aura.scale.set(s);
      },
    }, 0.2);

    tl.call(() => {
      parent.removeChild(aura);
      aura.destroy();
    });

    return tl;
  }

  /** Gold coin orbs floating up for produce */
  static produce(parent: Container, x: number, y: number, amount: number): gsap.core.Timeline {
    const tl = gsap.timeline();
    const particles: Graphics[] = [];
    const count = Math.min(amount, 5);

    for (let i = 0; i < count; i++) {
      const p = new Graphics();
      p.circle(0, 0, 5);
      p.fill({ color: 0xFFD700, alpha: 0.9 });
      // Small inner highlight
      p.circle(-1, -1, 2);
      p.fill({ color: 0xFFFFFF, alpha: 0.4 });
      p.x = x + (Math.random() - 0.5) * 20;
      p.y = y;
      parent.addChild(p);
      particles.push(p);

      tl.to(p, {
        y: y - 40 - Math.random() * 20,
        alpha: 0,
        duration: 0.6 + Math.random() * 0.2,
        ease: 'power1.out',
        delay: i * 0.08,
      }, 0);
    }

    tl.call(() => cleanupParticles(parent, particles));
    return tl;
  }

  /** Speed lines for fast attack */
  static speedLines(parent: Container, x: number, y: number, direction: number): gsap.core.Timeline {
    const tl = gsap.timeline();
    const lines: Graphics[] = [];
    const count = 5;

    for (let i = 0; i < count; i++) {
      const line = new Graphics();
      const lineY = y - 20 + i * 10;
      line.moveTo(x, lineY);
      line.lineTo(x + direction * 40, lineY);
      line.stroke({ color: 0xFFFFFF, width: 2, alpha: 0.6 });
      parent.addChild(line);
      lines.push(line);

      tl.to(line, {
        x: direction * 30,
        alpha: 0,
        duration: 0.2,
        ease: 'power2.out',
        delay: i * 0.02,
      }, 0);
    }

    tl.call(() => {
      for (const l of lines) {
        parent.removeChild(l);
        l.destroy();
      }
    });
    return tl;
  }

  /** Red pulsing flame aura for angry */
  static angry(parent: Container, x: number, y: number): gsap.core.Timeline {
    const tl = gsap.timeline();
    const particles: Graphics[] = [];
    const count = 6;

    for (let i = 0; i < count; i++) {
      const p = createParticle(
        parent,
        x + (Math.random() - 0.5) * 30,
        y + 15 + Math.random() * 10,
        Math.random() > 0.3 ? 0xFF3300 : 0xFF6600,
        3 + Math.random() * 3,
      );
      particles.push(p);

      tl.to(p, {
        y: y - 10 - Math.random() * 15,
        alpha: 0,
        duration: 0.4 + Math.random() * 0.2,
        ease: 'power1.out',
        delay: i * 0.03,
      }, 0);
    }

    tl.call(() => cleanupParticles(parent, particles));
    return tl;
  }
}
