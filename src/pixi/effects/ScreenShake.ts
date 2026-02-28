import { Container } from 'pixi.js';
import gsap from 'gsap';

export class ScreenShake {
  private stage: Container;

  constructor(stage: Container) {
    this.stage = stage;
  }

  /** Small shake for normal hits */
  light(): gsap.core.Timeline {
    return this.shake(3, 0.3);
  }

  /** Medium shake for big hits */
  medium(): gsap.core.Timeline {
    return this.shake(6, 0.4);
  }

  /** Heavy shake for KOs and crits */
  heavy(): gsap.core.Timeline {
    return this.shake(10, 0.5);
  }

  private shake(intensity: number, duration: number): gsap.core.Timeline {
    const tl = gsap.timeline();
    const steps = 8;
    const stepDur = duration / steps;

    for (let i = 0; i < steps; i++) {
      const decay = 1 - (i / steps);
      const x = (Math.random() - 0.5) * 2 * intensity * decay;
      const y = (Math.random() - 0.5) * 2 * intensity * decay;
      tl.to(this.stage, {
        x,
        y,
        duration: stepDur,
        ease: 'power1.inOut',
      });
    }

    // Return to origin
    tl.to(this.stage, { x: 0, y: 0, duration: stepDur, ease: 'power1.out' });

    return tl;
  }
}
