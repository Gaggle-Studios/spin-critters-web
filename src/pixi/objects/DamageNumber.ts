import { Container, Text, TextStyle } from 'pixi.js';
import gsap from 'gsap';
import { TEXT_STYLES } from '../utils/TextStyles';

export type DamageNumberType = 'damage' | 'damage-big' | 'damage-crit' | 'heal' | 'poison' | 'resource' | 'thorns';

function getStyle(type: DamageNumberType): TextStyle {
  switch (type) {
    case 'damage': return TEXT_STYLES.damageNumber;
    case 'damage-big': return TEXT_STYLES.damageNumberBig;
    case 'damage-crit': return TEXT_STYLES.damageNumberCrit;
    case 'heal': return TEXT_STYLES.healNumber;
    case 'poison': return TEXT_STYLES.poisonNumber;
    case 'resource': return TEXT_STYLES.resourceNumber;
    case 'thorns': return TEXT_STYLES.damageNumber;
  }
}

function getPrefix(type: DamageNumberType): string {
  switch (type) {
    case 'damage':
    case 'damage-big':
    case 'damage-crit':
    case 'thorns':
      return '-';
    case 'heal':
    case 'resource':
      return '+';
    case 'poison':
      return '';
  }
}

export class DamageNumber extends Container {
  private textObj: Text;

  constructor(value: number | string, type: DamageNumberType) {
    super();

    const prefix = typeof value === 'number' ? getPrefix(type) : '';
    this.textObj = new Text({
      text: `${prefix}${value}`,
      style: getStyle(type),
    });
    this.textObj.anchor.set(0.5, 0.5);
    this.addChild(this.textObj);
  }

  /** Animate: pop-in, float up, fade out. Removes self on complete. */
  animate(parentContainer: Container): gsap.core.Timeline {
    parentContainer.addChild(this);

    const tl = gsap.timeline();

    // Initial state
    this.alpha = 0;
    this.scale.set(0.5);

    tl.to(this, {
      alpha: 1,
      duration: 0.1,
    }, 0);

    tl.to(this.scale, {
      x: 1.2,
      y: 1.2,
      duration: 0.12,
      ease: 'back.out(2)',
    }, 0);

    tl.to(this.scale, {
      x: 1,
      y: 1,
      duration: 0.1,
      ease: 'power1.inOut',
    }, 0.12);

    tl.to(this, {
      y: this.y - 40,
      alpha: 0,
      duration: 0.6,
      ease: 'power2.out',
    }, 0.25);

    tl.call(() => {
      parentContainer.removeChild(this);
      this.destroy();
    });

    return tl;
  }
}
