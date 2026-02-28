import gsap from 'gsap';
import type { BattleEvent, BattleState, Biome } from '../../engine/types';
import { BattleScene } from '../scenes/BattleScene';
import { DamageNumber, type DamageNumberType } from '../objects/DamageNumber';
import { AttackProjectile } from '../objects/AttackProjectile';
import { KOExplosion } from '../effects/KOExplosion';
import { CritExplosion } from '../effects/CritExplosion';
import { KeywordVFX } from '../effects/KeywordVFX';
import { biomeToNumber } from '../utils/BiomeTheme';
import { cardToPixiData, getActiveCardsData } from './CardStateSync';
import { playSfx } from '../../audio/sfx';
import type { PixiCardData } from '../objects/PixiCard';

/** Tracks progressive HP during animation playback */
interface ProgressiveHP {
  health: number;
  maxHealth: number;
  isKO: boolean;
}

export class AnimationDirector {
  private scene: BattleScene;
  private masterTimeline: gsap.core.Timeline | null = null;
  private _isPlaying = false;
  private onComplete: (() => void) | null = null;

  // Progressive HP state (keyed by "playerId-col")
  private hpState = new Map<string, ProgressiveHP>();

  constructor(scene: BattleScene) {
    this.scene = scene;
  }

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  /**
   * Build and play animations from a batch of BattleEvents.
   * Handles spin-result separately (awaits reel animation), then plays
   * remaining events via GSAP timeline.
   */
  play(
    events: BattleEvent[],
    battle: BattleState,
    humanPlayerId: string,
    onComplete: () => void,
  ): void {
    this.stop();
    this._isPlaying = true;
    this.onComplete = onComplete;

    // Initialize HP state from battle state
    this.initHPState(battle);

    // Handle spin-result first (needs async await for reel animation)
    const spinEvent = events.find(e => e.type === 'spin-result') as Extract<BattleEvent, { type: 'spin-result' }> | undefined;
    const remainingEvents = events.filter(e => e.type !== 'spin-result');

    if (spinEvent) {
      this.playSpinThenEvents(spinEvent, remainingEvents, battle, humanPlayerId);
    } else {
      this.playEventTimeline(remainingEvents, battle, humanPlayerId);
    }
  }

  /** Play the reel spin animation, then the attack/effect timeline */
  private async playSpinThenEvents(
    spinEvent: Extract<BattleEvent, { type: 'spin-result' }>,
    remainingEvents: BattleEvent[],
    battle: BattleState,
    humanPlayerId: string,
  ): Promise<void> {
    // Build card data from the spin event
    const { oppResults, plrResults } = this.buildSpinData(spinEvent, battle, humanPlayerId);

    // Play sound + update battle line
    playSfx('spin');
    const overtime = spinEvent.spin > 10 ? ` (OVERTIME! +${spinEvent.spin - 10} dmg)` : '';
    this.scene.setBattleLineText(`BATTLE LINE - Spin ${spinEvent.spin}${overtime}`);

    // Await the full reel spin animation (slot machine effect)
    await this.scene.spinReels(oppResults, plrResults);

    // If we were stopped during the spin, bail out
    if (!this._isPlaying) return;

    // Initialize HP state from spin results (pre-combat values)
    this.initHPFromSpinEvent(spinEvent, battle, humanPlayerId);

    // Now play the remaining events (attacks, KOs, etc.)
    this.playEventTimeline(remainingEvents, battle, humanPlayerId);
  }

  /** Build and play a GSAP timeline for non-spin events */
  private playEventTimeline(
    events: BattleEvent[],
    battle: BattleState,
    humanPlayerId: string,
  ): void {
    const tl = gsap.timeline({
      onComplete: () => {
        this._isPlaying = false;
        this.masterTimeline = null;
        this.onComplete?.();
      },
    });
    this.masterTimeline = tl;

    let timeOffset = 0;

    for (const event of events) {
      const eventTl = this.buildEventTimeline(event, battle, humanPlayerId);
      if (eventTl) {
        tl.add(eventTl, timeOffset);
        timeOffset += this.getEventDuration(event);
      }
    }

    // If no events produced any timeline, complete immediately
    if (timeOffset === 0) {
      this._isPlaying = false;
      this.masterTimeline = null;
      this.onComplete?.();
    }
  }

  /** Skip all remaining animation instantly */
  skipAll(events: BattleEvent[], battle: BattleState, humanPlayerId: string): void {
    this.stop();

    // Apply all events to final state
    this.initHPState(battle);
    for (const event of events) {
      this.applyEventToHP(event, humanPlayerId);
    }

    // Set final card states
    const oppData = getActiveCardsData(battle, battle.player2.id);
    const plrData = getActiveCardsData(battle, battle.player1.id);
    this.scene.setActiveCards(oppData, plrData);

    this.onComplete?.();
  }

  stop(): void {
    if (this.masterTimeline) {
      this.masterTimeline.kill();
      this.masterTimeline = null;
    }
    this._isPlaying = false;
    // Clear any lingering VFX
    this.scene.vfxLayer.removeChildren();
  }

  private initHPState(battle: BattleState): void {
    this.hpState.clear();
    for (let col = 0; col < 5; col++) {
      const p1Card = battle.player1ActiveCards[col];
      if (p1Card) {
        this.hpState.set(`${battle.player1.id}-${col}`, {
          health: p1Card.currentHealth,
          maxHealth: p1Card.maxHealth,
          isKO: p1Card.isKO,
        });
      }
      const p2Card = battle.player2ActiveCards[col];
      if (p2Card) {
        this.hpState.set(`${battle.player2.id}-${col}`, {
          health: p2Card.currentHealth,
          maxHealth: p2Card.maxHealth,
          isKO: p2Card.isKO,
        });
      }
    }
  }

  private getHP(playerId: string, col: number): ProgressiveHP | undefined {
    return this.hpState.get(`${playerId}-${col}`);
  }

  private setHP(playerId: string, col: number, hp: Partial<ProgressiveHP>): void {
    const current = this.hpState.get(`${playerId}-${col}`);
    if (current) {
      Object.assign(current, hp);
    }
  }

  private isOpponent(playerId: string, humanPlayerId: string): boolean {
    return playerId !== humanPlayerId;
  }

  private buildEventTimeline(
    event: BattleEvent,
    battle: BattleState,
    humanPlayerId: string,
  ): gsap.core.Timeline | null {
    switch (event.type) {
      case 'spin-result':
        return null; // Handled separately in playSpinThenEvents
      case 'attack':
        return this.buildAttack(event, battle, humanPlayerId);
      case 'thorns':
        return this.buildThorns(event, humanPlayerId);
      case 'venomous':
      case 'poisonous':
        return this.buildPoison(event, humanPlayerId);
      case 'poison-damage':
        return this.buildPoisonDamage(event, humanPlayerId);
      case 'overtime-damage':
        return this.buildOvertimeDamage(event, humanPlayerId);
      case 'regenerate':
        return this.buildRegenerate(event, humanPlayerId);
      case 'healing':
        return this.buildHealing(event, humanPlayerId);
      case 'produce':
        return this.buildProduce(event, humanPlayerId);
      case 'crit-biome':
        return this.buildCritBiome(event, humanPlayerId);
      case 'crit-archetype':
        return this.buildCritArchetype(event, humanPlayerId);
      case 'ko':
        return this.buildKO(event, humanPlayerId);
      case 'battle-end':
        return this.buildBattleEnd(event);
      case 'phase-marker':
        return this.buildPhaseMarker(event);
      default:
        return null;
    }
  }

  private getEventDuration(event: BattleEvent): number {
    switch (event.type) {
      case 'spin-result': return 0.6;
      case 'attack': return 0.5;
      case 'thorns': return 0.35;
      case 'venomous':
      case 'poisonous': return 0.3;
      case 'crit-biome':
      case 'crit-archetype': return 1.0;
      case 'battle-end': return 1.2;
      case 'phase-marker': return 0.3;
      case 'overtime-damage': return 0.35;
      case 'poison-damage': return 0.35;
      case 'ko': return 0.5;
      case 'regenerate': return 0.3;
      case 'healing': return 0.3;
      case 'produce': return 0.25;
      default: return 0.2;
    }
  }

  // ---- Event Builders ----

  /** Build PixiCardData arrays from a spin-result event */
  private buildSpinData(
    event: Extract<BattleEvent, { type: 'spin-result' }>,
    battle: BattleState,
    humanPlayerId: string,
  ): { oppResults: (PixiCardData | null)[]; plrResults: (PixiCardData | null)[] } {
    const oppResults: (PixiCardData | null)[] = [null, null, null, null, null];
    const plrResults: (PixiCardData | null)[] = [null, null, null, null, null];

    const isP1Human = battle.player1.id === humanPlayerId;
    const humanActive = isP1Human ? event.player1Active : event.player2Active;
    const oppActive = isP1Human ? event.player2Active : event.player1Active;
    const humanActiveCards = isP1Human ? battle.player1ActiveCards : battle.player2ActiveCards;
    const oppActiveCards = isP1Human ? battle.player2ActiveCards : battle.player1ActiveCards;

    for (const ac of humanActive) {
      const fullCard = humanActiveCards[ac.col];
      plrResults[ac.col] = {
        instanceId: fullCard?.instanceId ?? `ev-${ac.col}`,
        definitionId: ac.cardId,
        name: ac.cardName,
        category: fullCard?.category ?? 'Ally',
        biome: fullCard?.biome ?? ('Red' as const),
        rarity: fullCard?.rarity ?? ('Common' as const),
        attack: ac.attack,
        health: ac.health,
        maxHealth: ac.maxHealth,
        isKO: false,
        level: fullCard?.level ?? 1,
        keywords: fullCard?.keywords.map(k => ({ name: k.name, value: k.value })) ?? [],
      };
    }

    for (const ac of oppActive) {
      const fullCard = oppActiveCards[ac.col];
      oppResults[ac.col] = {
        instanceId: fullCard?.instanceId ?? `ev-${ac.col}`,
        definitionId: ac.cardId,
        name: ac.cardName,
        category: fullCard?.category ?? 'Ally',
        biome: fullCard?.biome ?? ('Red' as const),
        rarity: fullCard?.rarity ?? ('Common' as const),
        attack: ac.attack,
        health: ac.health,
        maxHealth: ac.maxHealth,
        isKO: false,
        level: fullCard?.level ?? 1,
        keywords: fullCard?.keywords.map(k => ({ name: k.name, value: k.value })) ?? [],
      };
    }

    return { oppResults, plrResults };
  }

  /** Initialize progressive HP tracking from a spin-result event */
  private initHPFromSpinEvent(
    event: Extract<BattleEvent, { type: 'spin-result' }>,
    battle: BattleState,
    humanPlayerId: string,
  ): void {
    const isP1Human = battle.player1.id === humanPlayerId;
    const humanActive = isP1Human ? event.player1Active : event.player2Active;
    const oppActive = isP1Human ? event.player2Active : event.player1Active;

    for (const ac of humanActive) {
      this.hpState.set(`${humanPlayerId}-${ac.col}`, {
        health: ac.health,
        maxHealth: ac.maxHealth,
        isKO: false,
      });
    }
    const oppId = isP1Human ? battle.player2.id : battle.player1.id;
    for (const ac of oppActive) {
      this.hpState.set(`${oppId}-${ac.col}`, {
        health: ac.health,
        maxHealth: ac.maxHealth,
        isKO: false,
      });
    }
  }

  private buildAttack(
    event: Extract<BattleEvent, { type: 'attack' }>,
    battle: BattleState,
    humanPlayerId: string,
  ): gsap.core.Timeline {
    const tl = gsap.timeline();

    const attackerIsOpp = this.isOpponent(event.attackerPlayerId, humanPlayerId);
    const defenderIsOpp = this.isOpponent(event.defenderPlayerId, humanPlayerId);
    const from = this.scene.getCardCenter(attackerIsOpp, event.attackerCol);
    const to = this.scene.getCardCenter(defenderIsOpp, event.defenderCol);

    // Determine attack sound and projectile size
    const isBig = event.damage >= 15;
    const isMedium = event.damage >= 8;

    // Sound
    tl.call(() => {
      if (isBig) playSfx('bigHit');
      else playSfx('attack');
    });

    // Attacker highlight
    tl.call(() => {
      this.scene.updateCard(attackerIsOpp, event.attackerCol, {});
    });

    // Projectile
    const proj = new AttackProjectile(0xFFD700, isBig ? 12 : isMedium ? 10 : 8);
    tl.add(proj.fire(this.scene.vfxLayer, from.x, from.y, to.x, to.y, 0.2), 0);

    // Damage number
    const dmgType: DamageNumberType = isBig ? 'damage-crit' : isMedium ? 'damage-big' : 'damage';
    const dmgNum = new DamageNumber(event.damage, dmgType);
    dmgNum.x = to.x;
    dmgNum.y = to.y - 20;
    tl.add(dmgNum.animate(this.scene.vfxLayer), 0.15);

    // Screen shake on big hits
    if (isBig) {
      tl.add(this.scene.screenShake.medium(), 0.15);
    }

    // Update defender HP
    tl.call(() => {
      this.setHP(event.defenderPlayerId, event.defenderCol, {
        health: event.defenderNewHealth,
        isKO: event.defenderIsKO,
      });
      this.scene.updateCard(defenderIsOpp, event.defenderCol, {
        health: event.defenderNewHealth,
        isKO: event.defenderIsKO,
      });
    }, [], 0.2);

    return tl;
  }

  private buildThorns(
    event: Extract<BattleEvent, { type: 'thorns' }>,
    humanPlayerId: string,
  ): gsap.core.Timeline {
    const tl = gsap.timeline();

    const targetIsOpp = this.isOpponent(event.playerId, humanPlayerId);
    const sourceIsOpp = !targetIsOpp; // Thorns source is the opponent of who takes damage
    const to = this.scene.getCardCenter(targetIsOpp, event.col);
    const from = this.scene.getCardCenter(sourceIsOpp, event.sourceCol);

    tl.call(() => playSfx('thorns'));

    // Thorns VFX
    tl.add(KeywordVFX.thorns(this.scene.vfxLayer, from.x, from.y, to.x, to.y), 0);

    // Damage number
    const dmgNum = new DamageNumber(event.damage, 'thorns');
    dmgNum.x = to.x;
    dmgNum.y = to.y - 20;
    tl.add(dmgNum.animate(this.scene.vfxLayer), 0.1);

    // Update HP
    tl.call(() => {
      this.setHP(event.playerId, event.col, { health: event.newHealth, isKO: event.isKO });
      this.scene.updateCard(targetIsOpp, event.col, {
        health: event.newHealth,
        isKO: event.isKO,
      });
    }, [], 0.15);

    return tl;
  }

  private buildPoison(
    event: Extract<BattleEvent, { type: 'venomous' | 'poisonous' }>,
    humanPlayerId: string,
  ): gsap.core.Timeline {
    const tl = gsap.timeline();
    const isOpp = this.isOpponent(event.playerId, humanPlayerId);
    const pos = this.scene.getCardCenter(isOpp, event.col);

    tl.call(() => playSfx('poison'));
    tl.add(KeywordVFX.poison(this.scene.vfxLayer, pos.x, pos.y), 0);

    const num = new DamageNumber(`${event.counters} PSN`, 'poison');
    num.x = pos.x;
    num.y = pos.y - 20;
    tl.add(num.animate(this.scene.vfxLayer), 0.05);

    return tl;
  }

  private buildPoisonDamage(
    event: Extract<BattleEvent, { type: 'poison-damage' }>,
    humanPlayerId: string,
  ): gsap.core.Timeline {
    const tl = gsap.timeline();
    const isOpp = this.isOpponent(event.playerId, humanPlayerId);
    const pos = this.scene.getCardCenter(isOpp, event.col);

    tl.call(() => playSfx('poison'));

    const num = new DamageNumber(event.damage, 'poison');
    num.x = pos.x;
    num.y = pos.y - 20;
    tl.add(num.animate(this.scene.vfxLayer), 0);

    tl.call(() => {
      this.setHP(event.playerId, event.col, { health: event.newHealth, isKO: event.isKO });
      this.scene.updateCard(isOpp, event.col, {
        health: event.newHealth,
        isKO: event.isKO,
      });
    }, [], 0.15);

    return tl;
  }

  private buildOvertimeDamage(
    event: Extract<BattleEvent, { type: 'overtime-damage' }>,
    humanPlayerId: string,
  ): gsap.core.Timeline {
    const tl = gsap.timeline();
    const isOpp = this.isOpponent(event.playerId, humanPlayerId);
    const pos = this.scene.getCardCenter(isOpp, event.col);

    tl.call(() => playSfx('overtime'));

    const num = new DamageNumber(event.damage, 'damage');
    num.x = pos.x;
    num.y = pos.y - 20;
    tl.add(num.animate(this.scene.vfxLayer), 0);

    // Update overtime overlay intensity
    tl.call(() => {
      const overtimeSpins = event.spin - 10;
      this.scene.overtimeOverlay.setIntensity(overtimeSpins);
    });

    tl.call(() => {
      this.setHP(event.playerId, event.col, { health: event.newHealth, isKO: event.isKO });
      this.scene.updateCard(isOpp, event.col, {
        health: event.newHealth,
        isKO: event.isKO,
      });
    }, [], 0.15);

    return tl;
  }

  private buildRegenerate(
    event: Extract<BattleEvent, { type: 'regenerate' }>,
    humanPlayerId: string,
  ): gsap.core.Timeline {
    const tl = gsap.timeline();
    const isOpp = this.isOpponent(event.playerId, humanPlayerId);
    const pos = this.scene.getCardCenter(isOpp, event.col);

    tl.call(() => playSfx('heal'));
    tl.add(KeywordVFX.regenerate(this.scene.vfxLayer, pos.x, pos.y), 0);

    const num = new DamageNumber(event.amount, 'heal');
    num.x = pos.x;
    num.y = pos.y - 20;
    tl.add(num.animate(this.scene.vfxLayer), 0.05);

    tl.call(() => {
      this.setHP(event.playerId, event.col, { health: event.newHealth });
      this.scene.updateCard(isOpp, event.col, { health: event.newHealth });
    }, [], 0.15);

    return tl;
  }

  private buildHealing(
    event: Extract<BattleEvent, { type: 'healing' }>,
    humanPlayerId: string,
  ): gsap.core.Timeline {
    const tl = gsap.timeline();
    const isOpp = this.isOpponent(event.playerId, humanPlayerId);
    const from = this.scene.getCardCenter(isOpp, event.col);
    const to = this.scene.getCardCenter(isOpp, event.targetCol);

    tl.call(() => playSfx('heal'));
    tl.add(KeywordVFX.healing(this.scene.vfxLayer, from.x, from.y, to.x, to.y), 0);

    const num = new DamageNumber(event.amount, 'heal');
    num.x = to.x;
    num.y = to.y - 20;
    tl.add(num.animate(this.scene.vfxLayer), 0.1);

    tl.call(() => {
      this.setHP(event.playerId, event.targetCol, { health: event.targetNewHealth });
      this.scene.updateCard(isOpp, event.targetCol, { health: event.targetNewHealth });
    }, [], 0.15);

    return tl;
  }

  private buildProduce(
    event: Extract<BattleEvent, { type: 'produce' }>,
    humanPlayerId: string,
  ): gsap.core.Timeline {
    const tl = gsap.timeline();
    const isOpp = this.isOpponent(event.playerId, humanPlayerId);
    const pos = this.scene.getCardCenter(isOpp, event.col);

    tl.call(() => playSfx('resource'));
    tl.add(KeywordVFX.produce(this.scene.vfxLayer, pos.x, pos.y, event.amount), 0);

    const num = new DamageNumber(`+${event.amount}`, 'resource');
    num.x = pos.x;
    num.y = pos.y - 30;
    tl.add(num.animate(this.scene.vfxLayer), 0.05);

    return tl;
  }

  private buildCritBiome(
    event: Extract<BattleEvent, { type: 'crit-biome' }>,
    humanPlayerId: string,
  ): gsap.core.Timeline {
    const tl = gsap.timeline();
    const color = biomeToNumber(event.biome);
    const cx = this.scene.layout.width / 2;
    const cy = this.scene.layout.height / 2;

    tl.call(() => playSfx('critBiome'));
    tl.add(CritExplosion.play(
      this.scene.vfxLayer,
      cx,
      cy,
      `${event.biome.toUpperCase()} CRIT!`,
      color,
    ), 0);

    return tl;
  }

  private buildCritArchetype(
    event: Extract<BattleEvent, { type: 'crit-archetype' }>,
    humanPlayerId: string,
  ): gsap.core.Timeline {
    const tl = gsap.timeline();
    const cx = this.scene.layout.width / 2;
    const cy = this.scene.layout.height / 2;

    tl.call(() => playSfx('critArchetype'));
    tl.add(CritExplosion.play(
      this.scene.vfxLayer,
      cx,
      cy,
      `${event.archetype.toUpperCase()} CRIT!`,
      0x3498DB,
    ), 0);

    return tl;
  }

  private buildKO(
    event: Extract<BattleEvent, { type: 'ko' }>,
    humanPlayerId: string,
  ): gsap.core.Timeline {
    const tl = gsap.timeline();
    const isOpp = this.isOpponent(event.playerId, humanPlayerId);
    const pos = this.scene.getCardCenter(isOpp, event.col);

    tl.call(() => playSfx('ko'));

    // KO explosion particles
    tl.add(KOExplosion.play(this.scene.vfxLayer, pos.x, pos.y), 0);

    // Screen shake
    tl.add(this.scene.screenShake.heavy(), 0);

    // Mark card as KO
    tl.call(() => {
      this.setHP(event.playerId, event.col, { isKO: true, health: 0 });
      this.scene.updateCard(isOpp, event.col, { isKO: true, health: 0 });
    }, [], 0.1);

    return tl;
  }

  private buildBattleEnd(
    event: Extract<BattleEvent, { type: 'battle-end' }>,
  ): gsap.core.Timeline {
    const tl = gsap.timeline();
    const cx = this.scene.layout.width / 2;
    const cy = this.scene.layout.height / 2;

    tl.call(() => playSfx('victory'));
    tl.add(CritExplosion.play(
      this.scene.vfxLayer,
      cx,
      cy,
      `${event.winnerName} WINS!`,
      0xFFD700,
    ), 0);

    return tl;
  }

  private buildPhaseMarker(
    event: Extract<BattleEvent, { type: 'phase-marker' }>,
  ): gsap.core.Timeline {
    const tl = gsap.timeline();
    tl.call(() => {
      this.scene.setBattleLineText(event.label);
    });
    return tl;
  }

  /** Apply an event's HP changes without animation (for skip) */
  private applyEventToHP(event: BattleEvent, humanPlayerId: string): void {
    switch (event.type) {
      case 'attack':
        this.setHP(event.defenderPlayerId, event.defenderCol, {
          health: event.defenderNewHealth,
          isKO: event.defenderIsKO,
        });
        break;
      case 'thorns':
      case 'poison-damage':
      case 'overtime-damage':
        this.setHP(event.playerId, event.col, {
          health: event.newHealth,
          isKO: event.isKO,
        });
        break;
      case 'regenerate':
        this.setHP(event.playerId, event.col, { health: event.newHealth });
        break;
      case 'healing':
        this.setHP(event.playerId, event.targetCol, { health: event.targetNewHealth });
        break;
      case 'ko':
        this.setHP(event.playerId, event.col, { isKO: true, health: 0 });
        break;
    }
  }

  destroy(): void {
    this.stop();
  }
}
