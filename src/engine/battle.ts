import type {
  BattleState,
  BattleEvent,
  BattleLogEntry,
  BattlePhase,
  CardInstance,
  PlayerState,
} from './types.ts';
import {
  STARTING_RESOURCES,
  MAX_SPINS_PER_BATTLE,
  OVERTIME_DAMAGE_START,
  MORALE_LOSS_BASE,
  MORALE_LOSS_PER_LIVING,
  REEL_WIDTH,
} from './constants.ts';

function hasKeyword(card: CardInstance, name: string): boolean {
  return card.keywords.some((k) => k.name === name);
}

function getKeywordValue(card: CardInstance, name: string): number {
  const kw = card.keywords.find((k) => k.name === name);
  return kw?.value ?? 0;
}

function getLivingCardsInColumn(player: PlayerState, col: number): CardInstance[] {
  const cards: CardInstance[] = [];
  for (let row = 0; row < player.reelHeight; row++) {
    const slot = player.reels[row]?.[col];
    if (slot?.card && !slot.card.isKO) {
      cards.push(slot.card);
    }
  }
  return cards;
}

function isColumnLocked(player: PlayerState, col: number): boolean {
  return getLivingCardsInColumn(player, col).length === 0;
}

function spinReels(player: PlayerState): (CardInstance | null)[] {
  const active: (CardInstance | null)[] = [];
  for (let col = 0; col < REEL_WIDTH; col++) {
    const living = getLivingCardsInColumn(player, col);
    if (living.length === 0) {
      active.push(null);
    } else {
      const pick = living[Math.floor(Math.random() * living.length)];
      active.push(pick);
    }
  }
  return active;
}

function findTarget(
  opponentActive: (CardInstance | null)[],
  col: number
): { card: CardInstance; col: number } | null {
  // Direct opponent
  const direct = opponentActive[col];
  if (direct && !direct.isKO) return { card: direct, col };

  // Adjacent columns
  const offsets = [1, -1, 2, -2, 3, -3, 4, -4];
  for (const offset of offsets) {
    const adjCol = col + offset;
    if (adjCol >= 0 && adjCol < REEL_WIDTH) {
      const adj = opponentActive[adjCol];
      if (adj && !adj.isKO) return { card: adj, col: adjCol };
    }
  }
  return null;
}

function resolveAttack(
  attacker: CardInstance,
  attackerCol: number,
  targetInfo: { card: CardInstance; col: number },
  log: BattleLogEntry[],
  events: BattleEvent[],
  spin: number,
  phase: BattlePhase,
  attackerOwner: string,
  attackerOwnerId: string,
  defenderOwner: string,
  defenderOwnerId: string,
  attackerPlayer: PlayerState
): void {
  const target = targetInfo.card;
  let damage = attacker.currentAttack;

  // Angry: +50% damage when below 50% health
  if (hasKeyword(attacker, 'Angry') && attacker.currentHealth < attacker.maxHealth * 0.5) {
    damage = Math.floor(damage * 1.5);
  }

  if (damage <= 0) return;

  target.currentHealth -= damage;
  log.push({
    spin,
    phase,
    message: `${attackerOwner}'s ${attacker.name} attacks ${defenderOwner}'s ${target.name} for ${damage} damage`,
  });

  const defenderIsKO = target.currentHealth <= 0;
  if (defenderIsKO) {
    target.currentHealth = 0;
    target.isKO = true;
    log.push({
      spin,
      phase,
      message: `${defenderOwner}'s ${target.name} is KO'd!`,
    });
    // Junk gives opponent 1 resource
    if (target.category === 'Junk') {
      attackerPlayer.resources += 1;
      log.push({
        spin,
        phase,
        message: `${attackerOwner} gains 1 resource from destroying Junk`,
      });
      events.push({ type: 'junk-resource', spin, playerId: attackerOwnerId, amount: 1 });
    }
  }

  events.push({
    type: 'attack',
    spin,
    attackerPlayerId: attackerOwnerId,
    defenderPlayerId: defenderOwnerId,
    attackerCol,
    defenderCol: targetInfo.col,
    attackerName: attacker.name,
    defenderName: target.name,
    damage,
    defenderNewHealth: target.currentHealth,
    defenderIsKO,
  });

  // Thorns: damage back to attacker
  if (hasKeyword(target, 'Thorns') && !target.isKO) {
    const thornDmg = getKeywordValue(target, 'Thorns');
    attacker.currentHealth -= thornDmg;
    log.push({
      spin,
      phase,
      message: `${defenderOwner}'s ${target.name}'s Thorns deals ${thornDmg} damage to ${attacker.name}`,
    });
    const attackerKO = attacker.currentHealth <= 0;
    if (attackerKO) {
      attacker.currentHealth = 0;
      attacker.isKO = true;
      log.push({ spin, phase, message: `${attackerOwner}'s ${attacker.name} is KO'd by Thorns!` });
    }
    events.push({
      type: 'thorns',
      spin,
      playerId: attackerOwnerId,
      col: attackerCol,
      cardName: attacker.name,
      damage: thornDmg,
      newHealth: attacker.currentHealth,
      isKO: attackerKO,
      sourceCol: targetInfo.col,
      sourceName: target.name,
    });
  }

  // Venomous: apply poison counters
  if (hasKeyword(attacker, 'Venomous') && !target.isKO) {
    const venomVal = getKeywordValue(attacker, 'Venomous');
    target.poisonCounters += venomVal;
    log.push({
      spin,
      phase,
      message: `${target.name} receives ${venomVal} poison counters from ${attacker.name}'s Venomous`,
    });
    events.push({
      type: 'venomous',
      spin,
      playerId: defenderOwnerId,
      col: targetInfo.col,
      cardName: target.name,
      counters: venomVal,
      sourceName: attacker.name,
    });
  }

  // Poisonous: apply poison to attacker when target is hit
  if (hasKeyword(target, 'Poisonous') && !attacker.isKO) {
    const poisVal = getKeywordValue(target, 'Poisonous');
    attacker.poisonCounters += poisVal;
    log.push({
      spin,
      phase,
      message: `${attacker.name} receives ${poisVal} poison counters from ${target.name}'s Poisonous`,
    });
    events.push({
      type: 'poisonous',
      spin,
      playerId: attackerOwnerId,
      col: attackerCol,
      cardName: attacker.name,
      counters: poisVal,
      sourceName: target.name,
    });
  }
}

function applyBolster(activeCards: (CardInstance | null)[]): void {
  for (let col = 0; col < REEL_WIDTH; col++) {
    const card = activeCards[col];
    if (!card || card.isKO) continue;
    if (hasKeyword(card, 'Bolster')) {
      const bolsterVal = getKeywordValue(card, 'Bolster');
      // Boost adjacent cards
      if (col > 0 && activeCards[col - 1] && !activeCards[col - 1]!.isKO) {
        activeCards[col - 1]!.currentAttack += bolsterVal;
      }
      if (col < REEL_WIDTH - 1 && activeCards[col + 1] && !activeCards[col + 1]!.isKO) {
        activeCards[col + 1]!.currentAttack += bolsterVal;
      }
    }
  }
}

function removeBolster(activeCards: (CardInstance | null)[]): void {
  for (let col = 0; col < REEL_WIDTH; col++) {
    const card = activeCards[col];
    if (!card || card.isKO) continue;
    if (hasKeyword(card, 'Bolster')) {
      const bolsterVal = getKeywordValue(card, 'Bolster');
      if (col > 0 && activeCards[col - 1] && !activeCards[col - 1]!.isKO) {
        activeCards[col - 1]!.currentAttack -= bolsterVal;
      }
      if (col < REEL_WIDTH - 1 && activeCards[col + 1] && !activeCards[col + 1]!.isKO) {
        activeCards[col + 1]!.currentAttack -= bolsterVal;
      }
    }
  }
}

function runAttackPhase(
  phase: BattlePhase,
  p1Active: (CardInstance | null)[],
  p2Active: (CardInstance | null)[],
  p1: PlayerState,
  p2: PlayerState,
  log: BattleLogEntry[],
  events: BattleEvent[],
  spin: number,
  filter: (card: CardInstance) => boolean
): void {
  // Player 1 attacks
  for (let col = 0; col < REEL_WIDTH; col++) {
    const card = p1Active[col];
    if (!card || card.isKO || card.currentAttack <= 0 || !filter(card)) continue;
    const target = findTarget(p2Active, col);
    if (target) {
      resolveAttack(card, col, target, log, events, spin, phase, p1.name, p1.id, p2.name, p2.id, p1);
    }
  }

  // Player 2 attacks
  for (let col = 0; col < REEL_WIDTH; col++) {
    const card = p2Active[col];
    if (!card || card.isKO || card.currentAttack <= 0 || !filter(card)) continue;
    const target = findTarget(p1Active, col);
    if (target) {
      resolveAttack(card, col, target, log, events, spin, phase, p2.name, p2.id, p1.name, p1.id, p2);
    }
  }
}

function playerHasActivatableCards(player: PlayerState): boolean {
  for (let col = 0; col < REEL_WIDTH; col++) {
    if (getLivingCardsInColumn(player, col).length > 0) return true;
  }
  return false;
}

function countSurvivingCritters(player: PlayerState): number {
  let count = 0;
  for (const critter of player.critters) {
    if (!critter.isKO) count++;
  }
  return count;
}

export function initBattle(player1: PlayerState, player2: PlayerState): BattleState {
  return {
    player1: player1,
    player2: player2,
    currentSpin: 0,
    maxSpins: MAX_SPINS_PER_BATTLE,
    log: [],
    events: [],
    phase: 'spin',
    player1ActiveCards: Array(REEL_WIDTH).fill(null),
    player2ActiveCards: Array(REEL_WIDTH).fill(null),
    isComplete: false,
    winnerId: null,
  };
}

export function executeSpin(battle: BattleState): BattleState {
  if (battle.isComplete) return battle;

  battle.currentSpin++;
  const spin = battle.currentSpin;
  const log = battle.log;
  const events: BattleEvent[] = [];
  battle.events = events;
  const p1 = battle.player1;
  const p2 = battle.player2;

  log.push({ spin, phase: 'spin', message: `--- Spin ${spin} ---` });

  // SPIN: Random card per column
  battle.player1ActiveCards = spinReels(p1);
  battle.player2ActiveCards = spinReels(p2);
  const p1Active = battle.player1ActiveCards;
  const p2Active = battle.player2ActiveCards;

  // Log active cards and snapshot their starting stats for progressive display
  const p1ActiveSnapshot: { col: number; cardName: string; cardId: string; health: number; maxHealth: number; attack: number }[] = [];
  const p2ActiveSnapshot: { col: number; cardName: string; cardId: string; health: number; maxHealth: number; attack: number }[] = [];
  for (let col = 0; col < REEL_WIDTH; col++) {
    const c1 = p1Active[col];
    const c2 = p2Active[col];
    if (c1) {
      log.push({ spin, phase: 'spin', message: `${p1.name} Col ${col + 1}: ${c1.name} (${c1.currentAttack}/${c1.currentHealth})` });
      p1ActiveSnapshot.push({ col, cardName: c1.name, cardId: c1.definitionId, health: c1.currentHealth, maxHealth: c1.maxHealth, attack: c1.currentAttack });
    }
    if (c2) {
      log.push({ spin, phase: 'spin', message: `${p2.name} Col ${col + 1}: ${c2.name} (${c2.currentAttack}/${c2.currentHealth})` });
      p2ActiveSnapshot.push({ col, cardName: c2.name, cardId: c2.definitionId, health: c2.currentHealth, maxHealth: c2.maxHealth, attack: c2.currentAttack });
    }
  }
  events.push({ type: 'spin-result', spin, player1Id: p1.id, player2Id: p2.id, player1Active: p1ActiveSnapshot, player2Active: p2ActiveSnapshot });

  // RESOURCE GRANT
  p1.resources += STARTING_RESOURCES;
  p2.resources += STARTING_RESOURCES;
  events.push({ type: 'resource-grant', spin, playerId: p1.id, amount: STARTING_RESOURCES });
  events.push({ type: 'resource-grant', spin, playerId: p2.id, amount: STARTING_RESOURCES });

  // ON-APPEAR: Regenerate, Healing, Produce
  events.push({ type: 'phase-marker', spin, phase: 'on-appear', label: 'On-Appear Effects' });
  const onAppearPhase: BattlePhase = 'on-appear';
  for (const [active, player] of [[p1Active, p1], [p2Active, p2]] as [((CardInstance | null)[]), PlayerState][]) {
    for (let col = 0; col < REEL_WIDTH; col++) {
      const card = active[col];
      if (!card || card.isKO) continue;

      // Poison damage at start
      if (card.poisonCounters > 0) {
        const poisonDmg = card.poisonCounters;
        card.currentHealth -= poisonDmg;
        log.push({ spin, phase: onAppearPhase, message: `${player.name}'s ${card.name} takes ${poisonDmg} poison damage` });
        card.poisonCounters = Math.max(0, card.poisonCounters - 1);
        const isKO = card.currentHealth <= 0;
        if (isKO) {
          card.currentHealth = 0;
          card.isKO = true;
          log.push({ spin, phase: onAppearPhase, message: `${player.name}'s ${card.name} is KO'd by poison!` });
        }
        events.push({ type: 'poison-damage', spin, playerId: player.id, col, cardName: card.name, damage: poisonDmg, newHealth: card.currentHealth, isKO });
        if (isKO) continue;
      }

      // Regenerate
      if (hasKeyword(card, 'Regenerate')) {
        const regen = getKeywordValue(card, 'Regenerate');
        const healed = Math.min(regen, card.maxHealth - card.currentHealth);
        if (healed > 0) {
          card.currentHealth += healed;
          log.push({ spin, phase: onAppearPhase, message: `${player.name}'s ${card.name} regenerates ${healed} HP` });
          events.push({ type: 'regenerate', spin, playerId: player.id, col, cardName: card.name, amount: healed, newHealth: card.currentHealth });
        }
      }

      // Healing adjacent
      if (hasKeyword(card, 'Healing')) {
        const healVal = getKeywordValue(card, 'Healing');
        for (const offset of [-1, 1]) {
          const adjCol = col + offset;
          if (adjCol >= 0 && adjCol < REEL_WIDTH) {
            const adj = active[adjCol];
            if (adj && !adj.isKO) {
              const healed = Math.min(healVal, adj.maxHealth - adj.currentHealth);
              if (healed > 0) {
                adj.currentHealth += healed;
                log.push({ spin, phase: onAppearPhase, message: `${player.name}'s ${card.name} heals ${adj.name} for ${healed} HP` });
                events.push({ type: 'healing', spin, playerId: player.id, col, cardName: card.name, targetCol: adjCol, targetName: adj.name, amount: healed, targetNewHealth: adj.currentHealth });
              }
            }
          }
        }
      }

      // Produce resources
      if (hasKeyword(card, 'Produce')) {
        const produced = getKeywordValue(card, 'Produce');
        player.resources += produced;
        log.push({ spin, phase: onAppearPhase, message: `${player.name}'s ${card.name} produces ${produced} resources` });
        events.push({ type: 'produce', spin, playerId: player.id, col, cardName: card.name, amount: produced });
      }
    }
  }

  // CRIT CHECK
  const critPhase: BattlePhase = 'crit-resolution';
  const critBonusCards: CardInstance[] = [];
  for (const [active, player] of [[p1Active, p1], [p2Active, p2]] as [((CardInstance | null)[]), PlayerState][]) {
    const activeNonNull = active.filter((c): c is CardInstance => c !== null && !c.isKO);
    if (activeNonNull.length === REEL_WIDTH) {
      // Biome CRIT
      const biome = activeNonNull[0].biome;
      if (activeNonNull.every((c) => c.biome === biome)) {
        log.push({ spin, phase: critPhase, message: `BIOME CRIT! All ${player.name}'s active cards are ${biome}!` });
        events.push({ type: 'crit-biome', spin, playerId: player.id, biome });
        for (const c of activeNonNull) {
          c.currentAttack += 2;
          critBonusCards.push(c);
        }
      }
      // Archetype CRIT
      const arch = activeNonNull[0].archetype;
      if (activeNonNull.every((c) => c.archetype === arch)) {
        log.push({ spin, phase: critPhase, message: `ARCHETYPE CRIT! All ${player.name}'s active cards are ${arch}!` });
        events.push({ type: 'crit-archetype', spin, playerId: player.id, archetype: arch });
        for (const critter of player.critters) {
          if (critter.archetype === arch && !critter.isKO) {
            critter.xp += 1;
            log.push({ spin, phase: critPhase, message: `${critter.name} gains 1 XP (now ${critter.xp})` });
          }
        }
      }
    }
  }

  // Apply Bolster before attacks
  applyBolster(p1Active);
  applyBolster(p2Active);

  // FAST ATTACK PHASE
  events.push({ type: 'phase-marker', spin, phase: 'fast-attack', label: 'Fast Attack Phase' });
  runAttackPhase(
    'fast-attack', p1Active, p2Active,
    p1, p2, log, events, spin,
    (card) => hasKeyword(card, 'Fast') && !hasKeyword(card, 'Slow')
  );

  // REGULAR ATTACK PHASE
  events.push({ type: 'phase-marker', spin, phase: 'regular-attack', label: 'Attack Phase' });
  runAttackPhase(
    'regular-attack', p1Active, p2Active,
    p1, p2, log, events, spin,
    (card) => !hasKeyword(card, 'Fast') && !hasKeyword(card, 'Slow')
  );

  // SLOW ATTACK PHASE
  events.push({ type: 'phase-marker', spin, phase: 'slow-attack', label: 'Slow Attack Phase' });
  runAttackPhase(
    'slow-attack', p1Active, p2Active,
    p1, p2, log, events, spin,
    (card) => hasKeyword(card, 'Slow') && !hasKeyword(card, 'Fast')
  );

  // Remove Bolster after attacks
  removeBolster(p1Active);
  removeBolster(p2Active);

  // Remove CRIT bonus after attacks
  for (const c of critBonusCards) {
    c.currentAttack -= 2;
  }

  // CLEANUP: Check KOs in the reels (sync active card state back)
  const cleanupPhase: BattlePhase = 'cleanup';
  for (const player of [p1, p2]) {
    for (let col = 0; col < REEL_WIDTH; col++) {
      const wasLocked = isColumnLocked(player, col);
      if (wasLocked) {
        // Mark all slots in column as locked
        for (let row = 0; row < player.reelHeight; row++) {
          const slot = player.reels[row]?.[col];
          if (slot?.card) slot.card.isLocked = true;
        }
        events.push({ type: 'column-locked', spin, playerId: player.id, col });
      }
    }
  }

  // OVERTIME: damage all active cards
  if (spin > OVERTIME_DAMAGE_START) {
    const overtimeDmg = spin - OVERTIME_DAMAGE_START;
    for (const [active, player] of [[p1Active, p1], [p2Active, p2]] as [((CardInstance | null)[]), PlayerState][]) {
      for (let col = 0; col < REEL_WIDTH; col++) {
        const card = active[col];
        if (card && !card.isKO) {
          card.currentHealth -= overtimeDmg;
          log.push({ spin, phase: cleanupPhase, message: `Overtime! ${player.name}'s ${card.name} takes ${overtimeDmg} damage` });
          const isKO = card.currentHealth <= 0;
          if (isKO) {
            card.currentHealth = 0;
            card.isKO = true;
            log.push({ spin, phase: cleanupPhase, message: `${player.name}'s ${card.name} is KO'd by overtime!` });
          }
          events.push({ type: 'overtime-damage', spin, playerId: player.id, col, cardName: card.name, damage: overtimeDmg, newHealth: card.currentHealth, isKO });
        }
      }
    }
  }

  // BATTLE END CHECK
  const p1CanPlay = playerHasActivatableCards(p1);
  const p2CanPlay = playerHasActivatableCards(p2);

  if (!p1CanPlay || !p2CanPlay) {
    battle.isComplete = true;
    if (!p1CanPlay && !p2CanPlay) {
      // Draw - whoever has more total health remaining wins
      const p1TotalHp = getTotalHealth(p1);
      const p2TotalHp = getTotalHealth(p2);
      battle.winnerId = p1TotalHp >= p2TotalHp ? p1.id : p2.id;
    } else if (!p1CanPlay) {
      battle.winnerId = p2.id;
    } else {
      battle.winnerId = p1.id;
    }
    const winner = battle.winnerId === p1.id ? p1 : p2;
    log.push({ spin, phase: cleanupPhase, message: `Battle over! ${winner.name} wins!` });
    events.push({ type: 'battle-end', spin, winnerId: winner.id, winnerName: winner.name });
  }

  return battle;
}

function getTotalHealth(player: PlayerState): number {
  let total = 0;
  for (let row = 0; row < player.reelHeight; row++) {
    for (let col = 0; col < REEL_WIDTH; col++) {
      const card = player.reels[row]?.[col]?.card;
      if (card && !card.isKO) total += card.currentHealth;
    }
  }
  return total;
}

export function runFullBattle(battle: BattleState): BattleState {
  while (!battle.isComplete) {
    executeSpin(battle);
    // Safety valve
    if (battle.currentSpin > 50) {
      battle.isComplete = true;
      battle.winnerId = battle.player1.id;
      battle.log.push({ spin: battle.currentSpin, phase: 'cleanup', message: 'Battle ended due to safety limit' });
    }
  }
  return battle;
}

export function applyBattleResult(battle: BattleState): void {
  const winner = battle.winnerId === battle.player1.id ? battle.player1 : battle.player2;
  const loser = battle.winnerId === battle.player1.id ? battle.player2 : battle.player1;

  const survivingCritters = countSurvivingCritters(winner);
  const moraleLoss = MORALE_LOSS_BASE + (MORALE_LOSS_PER_LIVING * survivingCritters);
  loser.morale = Math.max(0, loser.morale - moraleLoss);

  battle.log.push({
    spin: battle.currentSpin,
    phase: 'cleanup',
    message: `${loser.name} loses ${moraleLoss} morale (now ${loser.morale})`,
  });
}

export function reviveAllCards(player: PlayerState): void {
  for (let row = 0; row < player.reelHeight; row++) {
    for (let col = 0; col < REEL_WIDTH; col++) {
      const card = player.reels[row]?.[col]?.card;
      if (card) {
        card.currentHealth = card.maxHealth;
        card.currentAttack = card.baseAttack;
        card.isKO = false;
        card.isLocked = false;
        card.poisonCounters = 0;
        card.stunTurns = 0;
        card.trapTurns = 0;
      }
    }
  }
  // Also revive critters reference
  for (const c of player.critters) {
    c.currentHealth = c.maxHealth;
    c.currentAttack = c.baseAttack;
    c.isKO = false;
    c.isLocked = false;
    c.poisonCounters = 0;
    c.stunTurns = 0;
    c.trapTurns = 0;
  }
}
