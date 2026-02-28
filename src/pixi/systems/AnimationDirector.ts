import gsap from 'gsap';
import { Container, Graphics } from 'pixi.js';
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
import type { SfxName } from '../../audio/sfx';
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
  private _timeScale = 1;

  // Progressive HP state (keyed by "playerId-col")
  private hpState = new Map<string, ProgressiveHP>();

  // Persistent electricity effect after CRIT cascade
  private _critElectricity: {
    container: Container;
    loopTl: gsap.core.Timeline;
    isOpp: boolean;
    color: number;
  } | null = null;

  // Tracks crit-charged state separately from the visual electricity
  // (persists after electricity fades so attacks still get boosted)
  private _critCharged: { isOpp: boolean; color: number } | null = null;

  constructor(scene: BattleScene) {
    this.scene = scene;
  }

  /** Set playback speed (1 = normal, 2 = double speed) */
  setTimeScale(scale: number): void {
    this._timeScale = scale;
    // Apply to active timeline immediately
    if (this.masterTimeline) {
      this.masterTimeline.timeScale(scale);
    }
    // Also set global GSAP timeScale to affect reel spins
    gsap.globalTimeline.timeScale(scale);
  }

  get timeScale(): number {
    return this._timeScale;
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
    // Clear any lingering crit state from previous spin
    this.stopCritElectricity();
    this._critCharged = null;

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
    tl.timeScale(this._timeScale);
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
    this.stopCritElectricity(true);
    this._critCharged = null;
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

  /** Update active card + mirror the change to the mini reel for player cards */
  private updateCardAndMiniReel(isOpp: boolean, col: number, data: Partial<PixiCardData>): void {
    this.scene.updateCard(isOpp, col, data);
    if (!isOpp) {
      const cardData = this.scene.getCardData(false, col);
      if (cardData) {
        this.scene.updateMiniReelCard(cardData.instanceId, data);
      }
    }
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
      case 'attack': return this._critCharged ? 0.8 : 0.5;
      case 'thorns': return 0.35;
      case 'venomous':
      case 'poisonous': return 0.3;
      case 'crit-biome':
      case 'crit-archetype': return 2.8;
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

    // Is this a crit-boosted attack? (attacker's side was crit-charged this spin)
    const critCharged = this._critCharged !== null
      && this._critCharged.isOpp === attackerIsOpp;
    const critColor = critCharged ? this._critCharged!.color : 0;

    // Determine attack sound and projectile size
    const isBig = event.damage >= 15 || critCharged;
    const isMedium = event.damage >= 8;

    // Sound
    tl.call(() => {
      if (critCharged) { playSfx('bigHit'); playSfx('critArc'); }
      else if (isBig) playSfx('bigHit');
      else playSfx('attack');
    });

    // Attacker highlight
    tl.call(() => {
      this.scene.updateCard(attackerIsOpp, event.attackerCol, {});
    });

    // Projectile — bigger, colored, and SLOWER when crit-charged for dramatic weight
    const projColor = critCharged ? critColor : 0xFFD700;
    const projSize = critCharged ? 16 : isBig ? 12 : isMedium ? 10 : 8;
    const proj = new AttackProjectile(projColor, projSize);
    const projSpeed = critCharged ? 0.35 : 0.2;
    tl.add(proj.fire(this.scene.vfxLayer, from.x, from.y, to.x, to.y, projSpeed), 0);

    // Damage number — always crit style when charged
    const dmgType: DamageNumberType = critCharged ? 'damage-crit' : isBig ? 'damage-crit' : isMedium ? 'damage-big' : 'damage';
    const dmgNum = new DamageNumber(event.damage, dmgType);
    dmgNum.x = to.x;
    dmgNum.y = to.y - 20;
    const impactTime = critCharged ? 0.3 : 0.15;
    tl.add(dmgNum.animate(this.scene.vfxLayer), impactTime);

    // Screen shake — always shake when charged (heavy!), otherwise only on big hits
    if (critCharged) {
      tl.add(this.scene.screenShake.heavy(), impactTime);
    } else if (isBig) {
      tl.add(this.scene.screenShake.medium(), 0.15);
    }

    // Impact sparks at defender when crit-charged
    if (critCharged) {
      const sparkCount = 12;
      const sparks: Graphics[] = [];
      for (let i = 0; i < sparkCount; i++) {
        const s = new Graphics();
        const isWhite = Math.random() > 0.4;
        s.circle(0, 0, 2 + Math.random() * 4);
        s.fill({ color: isWhite ? 0xFFFFFF : critColor, alpha: 0.9 });
        s.x = to.x;
        s.y = to.y;
        sparks.push(s);
      }
      tl.call(() => {
        for (const s of sparks) this.scene.vfxLayer.addChild(s);
      }, [], impactTime);
      for (let i = 0; i < sparkCount; i++) {
        const angle = (Math.PI * 2 * i) / sparkCount;
        const dist = 35 + Math.random() * 50;
        tl.to(sparks[i], {
          x: to.x + Math.cos(angle) * dist,
          y: to.y + Math.sin(angle) * dist,
          alpha: 0,
          duration: 0.3 + Math.random() * 0.15,
          ease: 'power2.out',
        }, impactTime);
      }
      tl.call(() => {
        for (const s of sparks) {
          if (s.parent) s.parent.removeChild(s);
          s.destroy();
        }
      }, [], impactTime + 0.5);
    }

    // Update defender HP
    tl.call(() => {
      this.setHP(event.defenderPlayerId, event.defenderCol, {
        health: event.defenderNewHealth,
        isKO: event.defenderIsKO,
      });
      this.updateCardAndMiniReel(defenderIsOpp, event.defenderCol, {
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
      this.updateCardAndMiniReel(targetIsOpp, event.col, {
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
      this.updateCardAndMiniReel(isOpp, event.col, {
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
      this.updateCardAndMiniReel(isOpp, event.col, {
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
      this.updateCardAndMiniReel(isOpp, event.col, { health: event.newHealth });
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
      this.updateCardAndMiniReel(isOpp, event.targetCol, { health: event.targetNewHealth });
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
    const isOpp = this.isOpponent(event.playerId, humanPlayerId);
    const color = biomeToNumber(event.biome);
    return this.buildCritCascade(isOpp, color, `${event.biome.toUpperCase()} CRIT!`, 'critBiome');
  }

  private buildCritArchetype(
    event: Extract<BattleEvent, { type: 'crit-archetype' }>,
    humanPlayerId: string,
  ): gsap.core.Timeline {
    const isOpp = this.isOpponent(event.playerId, humanPlayerId);
    return this.buildCritCascade(isOpp, 0x3498DB, `${event.archetype.toUpperCase()} CRIT!`, 'critArchetype');
  }

  /**
   * Sequential CRIT cascade: cards light up 1→2→3→4→5 with ding sounds
   * and escalating intensity, then a massive explosion after the 5th card.
   * Slot-machine jackpot feel.
   */
  private buildCritCascade(
    isOpp: boolean,
    color: number,
    bannerText: string,
    explosionSfx: SfxName,
  ): gsap.core.Timeline {
    const tl = gsap.timeline();
    const STAGGER = 0.22;

    // -- Pre-cascade: darken everything briefly to build contrast --
    const dimOverlay = new Graphics();
    dimOverlay.rect(-2000, -2000, 4000, 4000);
    dimOverlay.fill({ color: 0x000000, alpha: 0 });
    tl.call(() => { this.scene.vfxLayer.addChild(dimOverlay); }, [], 0);
    tl.to(dimOverlay, { alpha: 0.3, duration: 0.15, ease: 'power1.in' }, 0);

    // Collect cleanup refs
    const allParticles: Graphics[] = [];
    const allFlashes: Graphics[] = [];
    const allGlows: Graphics[] = [];

    // -- Phase 1: Sequential card highlights (columns 0-4) --
    for (let col = 0; col < 5; col++) {
      const t = 0.15 + col * STAGGER; // start after dim
      const card = isOpp ? this.scene.getOpponentCard(col) : this.scene.getPlayerCard(col);
      const pos = this.scene.getCardCenter(isOpp, col);
      // Escalating intensity per card
      const intensity = 0.6 + col * 0.1; // 0.6 → 1.0
      const particleCount = 12 + col * 3; // 12 → 24
      const particleSpread = 60 + col * 15; // 60 → 120

      // Ding sound + highlight
      tl.call(() => {
        playSfx('critDing');
        card.setHighlight(color);
      }, [], t);

      // Card flash (white overlay at card position, fades fast)
      const flash = new Graphics();
      flash.roundRect(pos.x - 60, pos.y - 85, 120, 170, 6);
      flash.fill({ color: 0xFFFFFF, alpha: 0 });
      allFlashes.push(flash);
      tl.call(() => { this.scene.vfxLayer.addChild(flash); }, [], t);
      tl.to(flash, { alpha: 0.5 * intensity, duration: 0.04 }, t);
      tl.to(flash, { alpha: 0, duration: 0.2, ease: 'power2.out' }, t + 0.04);

      // Persistent glow behind card (stays until cleanup)
      const glow = new Graphics();
      glow.roundRect(pos.x - 70, pos.y - 95, 140, 190, 10);
      glow.fill({ color, alpha: 0 });
      allGlows.push(glow);
      tl.call(() => { this.scene.vfxLayer.addChildAt(glow, 0); }, [], t);
      tl.to(glow, { alpha: 0.2 * intensity, duration: 0.15, ease: 'power1.out' }, t);

      // Lift up, then slam down with scale pop
      const liftHeight = 18 + col * 4; // 18→34px, escalating
      const scalePeak = 1.15 + col * 0.03; // 1.15 → 1.27
      const baseY = card.y;
      // Lift
      tl.to(card, {
        y: baseY - liftHeight,
        duration: 0.1,
        ease: 'power2.out',
      }, t);
      tl.to(card.scale, {
        x: scalePeak,
        y: scalePeak,
        duration: 0.1,
        ease: 'power2.out',
      }, t);
      // Slam down (overshoot past origin then bounce back)
      tl.to(card, {
        y: baseY + 4,
        duration: 0.08,
        ease: 'power3.in',
      }, t + 0.1);
      tl.to(card, {
        y: baseY,
        duration: 0.06,
        ease: 'power1.out',
      }, t + 0.18);
      // Scale settles on slam
      tl.to(card.scale, {
        x: 1.06,
        y: 1.06,
        duration: 0.08,
        ease: 'power1.inOut',
      }, t + 0.1);

      // Particle burst - bigger, more, with white sparkles mixed in
      const particles: Graphics[] = [];
      for (let i = 0; i < particleCount; i++) {
        const p = new Graphics();
        const isWhite = Math.random() > 0.6;
        const size = 3 + Math.random() * 5;
        p.circle(0, 0, size);
        p.fill({ color: isWhite ? 0xFFFFFF : color, alpha: 0.9 });
        p.x = pos.x;
        p.y = pos.y;
        particles.push(p);
        allParticles.push(p);
      }

      tl.call(() => {
        for (const p of particles) this.scene.vfxLayer.addChild(p);
      }, [], t);

      for (let i = 0; i < particleCount; i++) {
        const angle = (Math.PI * 2 * i) / particleCount;
        const dist = particleSpread + Math.random() * 30;
        tl.to(particles[i], {
          x: pos.x + Math.cos(angle) * dist,
          y: pos.y + Math.sin(angle) * dist,
          alpha: 0,
          duration: 0.4 + Math.random() * 0.2,
          ease: 'power2.out',
        }, t + 0.02);
      }

      // Light screen shake per card (escalating)
      tl.add(this.scene.screenShake.light(), t);
    }

    // -- Phase 2: Brief dramatic pause, then massive explosion --
    const explosionTime = 0.15 + 5 * STAGGER + 0.12; // after last card settles
    const cx = this.scene.layout.width / 2;
    const cy = this.scene.layout.height / 2;

    // Fade out dim overlay before explosion
    tl.to(dimOverlay, { alpha: 0, duration: 0.15, ease: 'power1.out' }, explosionTime - 0.05);

    tl.call(() => playSfx(explosionSfx), [], explosionTime);
    tl.add(this.scene.screenShake.heavy(), explosionTime);
    tl.add(CritExplosion.play(
      this.scene.vfxLayer,
      cx,
      cy,
      bannerText,
      color,
    ), explosionTime);

    // All cards snap back to normal scale on explosion
    tl.call(() => {
      for (let col = 0; col < 5; col++) {
        const card = isOpp ? this.scene.getOpponentCard(col) : this.scene.getPlayerCard(col);
        gsap.to(card.scale, { x: 1, y: 1, duration: 0.2, ease: 'power2.out' });
      }
    }, [], explosionTime);

    // -- Phase 3: Start electricity + cleanup cascade VFX (keep highlights!) --
    const clearTime = explosionTime + 0.5;
    tl.call(() => {
      // Start persistent electricity arcs across the cards
      this.startCritElectricity(isOpp, color);
      // Cleanup cascade-only VFX (particles, flashes, glows, dim)
      for (const p of allParticles) {
        if (p.parent) p.parent.removeChild(p);
        p.destroy();
      }
      for (const f of allFlashes) {
        if (f.parent) f.parent.removeChild(f);
        f.destroy();
      }
      for (const g of allGlows) {
        if (g.parent) g.parent.removeChild(g);
        g.destroy();
      }
      if (dimOverlay.parent) dimOverlay.parent.removeChild(dimOverlay);
      dimOverlay.destroy();
      // NOTE: highlights stay on — cleared by stopCritElectricity()
    }, [], clearTime);

    return tl;
  }

  // ---- CRIT Electricity System ----

  /** Create persistent crackling lightning arcs across all 5 cards */
  private startCritElectricity(isOpp: boolean, color: number): void {
    // Clean up any existing electricity
    this.stopCritElectricity(true);

    const container = new Container();
    this.scene.vfxLayer.addChild(container);

    const g = new Graphics();
    container.addChild(g);

    // Cache card positions
    const positions: { x: number; y: number }[] = [];
    for (let col = 0; col < 5; col++) {
      positions.push(this.scene.getCardCenter(isOpp, col));
    }

    const redraw = () => {
      g.clear();

      // Lightning arcs between adjacent cards
      for (let i = 0; i < 4; i++) {
        this.drawLightningBolt(g, positions[i], positions[i + 1], color, 6, 25);
        // Second thinner arc offset slightly for density
        if (Math.random() > 0.3) {
          this.drawLightningBolt(g, positions[i], positions[i + 1], color, 4, 15, 0.5);
        }
      }

      // Occasional long arc skipping a card
      if (Math.random() > 0.4) {
        const skip = Math.floor(Math.random() * 3);
        this.drawLightningBolt(g, positions[skip], positions[skip + 2], color, 8, 35);
      }

      // Crackling sparks around each card
      for (const pos of positions) {
        this.drawCardSparks(g, pos, color, 3 + Math.floor(Math.random() * 3));
      }

      // Occasional crackle sound
      if (Math.random() > 0.5) {
        playSfx('critArc');
      }
    };

    redraw();

    // Looping timeline: redraw + flicker every 0.1s
    const loopTl = gsap.timeline({ repeat: -1 });
    loopTl.call(redraw, [], 0);
    loopTl.to(container, { alpha: 0.55, duration: 0.03 }, 0.03);
    loopTl.to(container, { alpha: 1, duration: 0.03 }, 0.06);
    loopTl.call(redraw, [], 0.1);
    loopTl.to(container, { alpha: 0.7, duration: 0.02 }, 0.13);
    loopTl.to(container, { alpha: 1, duration: 0.03 }, 0.15);
    loopTl.addLabel('end', 0.18);

    this._critElectricity = { container, loopTl, isOpp, color };
    this._critCharged = { isOpp, color };
  }

  /** Stop the persistent electricity effect and clear highlights */
  private stopCritElectricity(immediate = false): void {
    const elec = this._critElectricity;
    if (!elec) return;
    this._critElectricity = null;

    elec.loopTl.kill();

    // Clear card highlights
    for (let col = 0; col < 5; col++) {
      const card = elec.isOpp
        ? this.scene.getOpponentCard(col)
        : this.scene.getPlayerCard(col);
      card.setHighlight(null);
    }

    if (immediate) {
      if (elec.container.parent) elec.container.parent.removeChild(elec.container);
      elec.container.destroy({ children: true });
    } else {
      // Quick fade out
      gsap.to(elec.container, {
        alpha: 0,
        duration: 0.25,
        ease: 'power2.out',
        onComplete: () => {
          if (elec.container.parent) elec.container.parent.removeChild(elec.container);
          elec.container.destroy({ children: true });
        },
      });
    }
  }

  /** Draw a jagged lightning bolt between two points */
  private drawLightningBolt(
    g: Graphics,
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    color: number,
    segments = 6,
    jitter = 25,
    intensityMul = 1,
  ): void {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;
    const nx = -dy / len; // perpendicular
    const ny = dx / len;

    const points: { x: number; y: number }[] = [p1];
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const mx = p1.x + dx * t;
      const my = p1.y + dy * t;
      const offset = (Math.random() - 0.5) * 2 * jitter;
      points.push({ x: mx + nx * offset, y: my + ny * offset });
    }
    points.push(p2);

    // Glow layer (wide, colored, semi-transparent)
    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y);
    g.stroke({ color, width: 8 * intensityMul, alpha: 0.25 * intensityMul });

    // Bright core (thin, white)
    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y);
    g.stroke({ color: 0xFFFFFF, width: 2.5 * intensityMul, alpha: 0.85 * intensityMul });
  }

  /** Draw small crackling sparks around a card position */
  private drawCardSparks(
    g: Graphics,
    pos: { x: number; y: number },
    color: number,
    count = 4,
  ): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 40 + Math.random() * 40;
      const x1 = pos.x + Math.cos(angle) * r;
      const y1 = pos.y + Math.sin(angle) * r;
      // Small forked spark
      const forkAngle = angle + (Math.random() - 0.5) * 1.2;
      const forkLen = 8 + Math.random() * 16;
      const x2 = x1 + Math.cos(forkAngle) * forkLen;
      const y2 = y1 + Math.sin(forkAngle) * forkLen;

      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
      g.stroke({ color: 0xFFFFFF, width: 1.5, alpha: 0.7 });

      // Tiny fork branch
      if (Math.random() > 0.5) {
        const branchAngle = forkAngle + (Math.random() > 0.5 ? 0.8 : -0.8);
        const bx = x2 + Math.cos(branchAngle) * (forkLen * 0.5);
        const by = y2 + Math.sin(branchAngle) * (forkLen * 0.5);
        g.moveTo(x2, y2);
        g.lineTo(bx, by);
        g.stroke({ color, width: 1, alpha: 0.5 });
      }
    }
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
      this.updateCardAndMiniReel(isOpp, event.col, { isKO: true, health: 0 });
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
      // Kill electricity visual when attack phase starts
      if (this._critElectricity && event.phase.includes('attack')) {
        this.stopCritElectricity();
      }
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
    // Reset global timeScale so other pages aren't affected
    gsap.globalTimeline.timeScale(1);
  }
}
