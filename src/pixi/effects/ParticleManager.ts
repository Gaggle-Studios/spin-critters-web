import { Container, Graphics } from 'pixi.js';
import type { Biome } from '../../engine/types';
import { BIOME_THEMES } from '../utils/BiomeTheme';

interface Particle {
  gfx: Graphics;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  baseAlpha: number;
}

const MAX_PARTICLES = 40;

export class ParticleManager {
  private container: Container;
  private particles: Particle[] = [];
  private currentBiome: Biome = 'Red';
  private width: number;
  private height: number;
  private spawnTimer = 0;
  private spawnInterval = 0.4; // seconds between spawns

  constructor(parent: Container, width: number, height: number) {
    this.container = new Container();
    this.container.alpha = 0.35;
    parent.addChildAt(this.container, 0); // Behind everything
    this.width = width;
    this.height = height;
  }

  setBiome(biome: Biome): void {
    if (biome === this.currentBiome) return;
    this.currentBiome = biome;
    // Clear old particles
    this.clear();
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  update(dt: number): void {
    const deltaS = dt / 60; // Convert to approximate seconds

    // Spawn new particles
    this.spawnTimer += deltaS;
    if (this.spawnTimer >= this.spawnInterval && this.particles.length < MAX_PARTICLES) {
      this.spawnTimer = 0;
      this.spawnParticle();
    }

    // Update existing particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.gfx.x += p.vx * deltaS;
      p.gfx.y += p.vy * deltaS;
      p.life -= deltaS;

      // Fade in/out
      const lifeRatio = p.life / p.maxLife;
      if (lifeRatio > 0.9) {
        p.gfx.alpha = (1 - lifeRatio) * 10 * p.baseAlpha;
      } else if (lifeRatio < 0.1) {
        p.gfx.alpha = lifeRatio * 10 * p.baseAlpha;
      } else {
        p.gfx.alpha = p.baseAlpha;
      }

      if (p.life <= 0) {
        this.container.removeChild(p.gfx);
        p.gfx.destroy();
        this.particles.splice(i, 1);
      }
    }
  }

  private spawnParticle(): void {
    const theme = BIOME_THEMES[this.currentBiome];
    const color = theme.particleColors[Math.floor(Math.random() * theme.particleColors.length)];

    const p = new Graphics();
    const size = 2 + Math.random() * 4;

    let vx: number, vy: number, x: number, y: number, life: number;

    switch (this.currentBiome) {
      case 'Red': // Embers rising
        p.circle(0, 0, size);
        p.fill({ color });
        x = Math.random() * this.width;
        y = this.height + 10;
        vx = (Math.random() - 0.5) * 15;
        vy = -(30 + Math.random() * 40);
        life = 6 + Math.random() * 4;
        break;
      case 'Blue': // Bubbles rising
        p.circle(0, 0, size * 1.5);
        p.stroke({ color, width: 1 });
        x = Math.random() * this.width;
        y = this.height + 10;
        vx = (Math.random() - 0.5) * 10;
        vy = -(20 + Math.random() * 25);
        life = 8 + Math.random() * 4;
        break;
      case 'Cream': // Snow falling
        p.circle(0, 0, size);
        p.fill({ color });
        x = Math.random() * this.width;
        y = -10;
        vx = (Math.random() - 0.5) * 8 + 3;
        vy = 15 + Math.random() * 20;
        life = 10 + Math.random() * 5;
        break;
      case 'Brown': // Dust drifting right
        p.circle(0, 0, size);
        p.fill({ color });
        x = -10;
        y = Math.random() * this.height;
        vx = 20 + Math.random() * 30;
        vy = (Math.random() - 0.5) * 5;
        life = 7 + Math.random() * 3;
        break;
      case 'Green': // Leaves falling
      default:
        p.rect(-size, -size * 0.6, size * 2, size * 1.2);
        p.fill({ color });
        x = Math.random() * this.width;
        y = -10;
        vx = (Math.random() - 0.5) * 10 - 3;
        vy = 12 + Math.random() * 18;
        life = 9 + Math.random() * 4;
        break;
    }

    p.x = x;
    p.y = y;
    p.alpha = 0;
    this.container.addChild(p);

    this.particles.push({
      gfx: p,
      vx,
      vy,
      life,
      maxLife: life,
      baseAlpha: 0.5 + Math.random() * 0.3,
    });
  }

  clear(): void {
    for (const p of this.particles) {
      this.container.removeChild(p.gfx);
      p.gfx.destroy();
    }
    this.particles = [];
  }

  destroy(): void {
    this.clear();
    this.container.destroy();
  }
}
