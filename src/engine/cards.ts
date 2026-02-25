import type {
  Biome,
  Archetype,
  CardDefinition,
  CardInstance,
  KeywordInstance,
  CritterJson,
  Rarity,
} from './types.ts';
import crittersData from '../data/critters.json';

const BIOMES: Biome[] = ['Red', 'Blue', 'Cream', 'Brown', 'Green'];
const ARCHETYPES: Archetype[] = ['Insect', 'Mammal', 'Reptile', 'Avian', 'Aquatic'];

const ALLY_NAME_PREFIX: Record<Biome, string[]> = {
  Red: ['Flame', 'Ember', 'Ash', 'Magma', 'Scorch', 'Cinder', 'Blaze'],
  Blue: ['Frost', 'Tide', 'Mist', 'Wave', 'Storm', 'Ice', 'Splash'],
  Cream: ['Snow', 'Pale', 'Frost', 'Tundra', 'Sleet', 'Hail', 'Glaze'],
  Brown: ['Stone', 'Cave', 'Dust', 'Clay', 'Ore', 'Gravel', 'Flint'],
  Green: ['Vine', 'Leaf', 'Moss', 'Fern', 'Thorn', 'Root', 'Bloom'],
};

const ALLY_NAME_SUFFIX: Record<Archetype, string[]> = {
  Insect: ['Beetle', 'Moth', 'Ant', 'Wasp', 'Mantis', 'Spider', 'Weevil'],
  Mammal: ['Wolf', 'Fox', 'Hare', 'Lynx', 'Otter', 'Shrew', 'Badger'],
  Reptile: ['Gecko', 'Viper', 'Skink', 'Drake', 'Newt', 'Croc', 'Cobra'],
  Avian: ['Hawk', 'Wren', 'Crow', 'Owl', 'Jay', 'Swift', 'Finch'],
  Aquatic: ['Eel', 'Pike', 'Ray', 'Crab', 'Squid', 'Trout', 'Perch'],
};

const LOCATION_NAMES: Record<Biome, string[]> = {
  Red: ['Volcano Vent', 'Lava Pool', 'Ash Fields'],
  Blue: ['Coral Reef', 'Deep Trench', 'Tidal Cave'],
  Cream: ['Frozen Lake', 'Ice Cavern', 'Snow Peak'],
  Brown: ['Crystal Mine', 'Deep Tunnel', 'Stone Hall'],
  Green: ['Ancient Grove', 'Fungal Glade', 'Canopy Nest'],
};

const RELIC_NAMES: Record<Biome, string[]> = {
  Red: ['Ember Shard', 'Flame Totem', 'Magma Core'],
  Blue: ['Frost Gem', 'Tidal Charm', 'Storm Orb'],
  Cream: ['Ice Crystal', 'Snow Rune', 'Pale Stone'],
  Brown: ['Cave Pearl', 'Stone Idol', 'Earth Sigil'],
  Green: ['Life Seed', 'Vine Crown', 'Root Charm'],
};

let nextId = 100;
function genId(): string {
  return String(nextId++).padStart(6, '0');
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateKeywords(count: number, category: 'Ally' | 'Location' | 'Relic'): KeywordInstance[] {
  const kws: KeywordInstance[] = [];
  const used = new Set<string>();

  if (category === 'Location') {
    kws.push({ keywordId: 0, name: 'Produce', value: randomInt(1, 3) });
    used.add('Produce');
    count--;
  }

  const allyPool: (() => KeywordInstance)[] = [
    () => ({ keywordId: 2, name: 'Fast' }),
    () => ({ keywordId: 3, name: 'Slow' }),
    () => ({ keywordId: 10, name: 'Thorns', value: randomInt(1, 3) }),
    () => ({ keywordId: 11, name: 'Angry' }),
    () => ({ keywordId: 12, name: 'Regenerate', value: randomInt(1, 3) }),
    () => ({ keywordId: 8, name: 'Venomous', value: randomInt(1, 2) }),
    () => ({ keywordId: 9, name: 'Poisonous', value: randomInt(1, 2) }),
  ];

  const locationPool: (() => KeywordInstance)[] = [
    () => ({ keywordId: 14, name: 'Healing', value: randomInt(1, 3) }),
    () => ({ keywordId: 15, name: 'Bolster', value: randomInt(1, 2) }),
    () => ({ keywordId: 12, name: 'Regenerate', value: randomInt(1, 2) }),
  ];

  const relicPool: (() => KeywordInstance)[] = [
    () => ({ keywordId: 15, name: 'Bolster', value: randomInt(1, 3) }),
    () => ({ keywordId: 10, name: 'Thorns', value: randomInt(2, 4) }),
    () => ({ keywordId: 12, name: 'Regenerate', value: randomInt(2, 4) }),
    () => ({ keywordId: 14, name: 'Healing', value: randomInt(2, 4) }),
    () => ({ keywordId: 0, name: 'Produce', value: randomInt(1, 2) }),
  ];

  const pool = category === 'Ally' ? allyPool : category === 'Location' ? locationPool : relicPool;

  for (let i = 0; i < count; i++) {
    let attempts = 0;
    while (attempts < 20) {
      const gen = pickRandom(pool);
      const kw = gen();
      if (!used.has(kw.name)) {
        // Fast and Slow are mutually exclusive
        if (kw.name === 'Fast' && used.has('Slow')) { attempts++; continue; }
        if (kw.name === 'Slow' && used.has('Fast')) { attempts++; continue; }
        used.add(kw.name);
        kws.push(kw);
        break;
      }
      attempts++;
    }
  }

  return kws;
}

function generateAllies(): CardDefinition[] {
  const allies: CardDefinition[] = [];
  let biomeIdx = 0;
  let archIdx = 0;

  // 35 Common
  for (let i = 0; i < 35; i++) {
    const biome = BIOMES[biomeIdx % 5];
    const arch = ARCHETYPES[archIdx % 5];
    const prefix = ALLY_NAME_PREFIX[biome][i % ALLY_NAME_PREFIX[biome].length];
    const suffix = ALLY_NAME_SUFFIX[arch][i % ALLY_NAME_SUFFIX[arch].length];
    allies.push({
      cardId: genId(),
      name: `${prefix} ${suffix}`,
      category: 'Ally',
      rarity: 'Common',
      biome,
      archetype: arch,
      attack: randomInt(2, 4),
      health: randomInt(5, 15),
      loyalty: 0,
      keywords: generateKeywords(randomInt(0, 1), 'Ally'),
      description: `A common ${biome} ${arch.toLowerCase()} ally.`,
    });
    biomeIdx++;
    archIdx++;
  }

  // 20 Uncommon
  for (let i = 0; i < 20; i++) {
    const biome = BIOMES[biomeIdx % 5];
    const arch = ARCHETYPES[archIdx % 5];
    const prefix = ALLY_NAME_PREFIX[biome][(i + 2) % ALLY_NAME_PREFIX[biome].length];
    const suffix = ALLY_NAME_SUFFIX[arch][(i + 2) % ALLY_NAME_SUFFIX[arch].length];
    allies.push({
      cardId: genId(),
      name: `${prefix} ${suffix}`,
      category: 'Ally',
      rarity: 'Uncommon',
      biome,
      archetype: arch,
      attack: randomInt(3, 6),
      health: randomInt(10, 25),
      loyalty: 0,
      keywords: generateKeywords(randomInt(1, 2), 'Ally'),
      description: `An uncommon ${biome} ${arch.toLowerCase()} ally.`,
    });
    biomeIdx++;
    archIdx++;
  }

  // 5 Rare
  for (let i = 0; i < 5; i++) {
    const biome = BIOMES[i];
    const arch = ARCHETYPES[i];
    const prefix = ALLY_NAME_PREFIX[biome][(i + 4) % ALLY_NAME_PREFIX[biome].length];
    const suffix = ALLY_NAME_SUFFIX[arch][(i + 4) % ALLY_NAME_SUFFIX[arch].length];
    allies.push({
      cardId: genId(),
      name: `${prefix} ${suffix}`,
      category: 'Ally',
      rarity: 'Rare',
      biome,
      archetype: arch,
      attack: randomInt(5, 8),
      health: randomInt(20, 35),
      loyalty: 0,
      keywords: generateKeywords(randomInt(2, 3), 'Ally'),
      description: `A rare ${biome} ${arch.toLowerCase()} ally.`,
    });
  }

  return allies;
}

function generateLocations(): CardDefinition[] {
  const locations: CardDefinition[] = [];
  for (const biome of BIOMES) {
    const names = LOCATION_NAMES[biome];
    for (let i = 0; i < 3; i++) {
      const rarity: Rarity = i === 0 ? 'Common' : i === 1 ? 'Uncommon' : 'Rare';
      locations.push({
        cardId: genId(),
        name: names[i],
        category: 'Location',
        rarity,
        biome,
        archetype: ARCHETYPES[i % 5],
        attack: 0,
        health: randomInt(5, 20),
        loyalty: 0,
        keywords: generateKeywords(i === 0 ? 0 : randomInt(0, 1), 'Location'),
        description: `A ${biome} location that produces resources.`,
      });
    }
  }
  return locations;
}

function generateRelics(): CardDefinition[] {
  const relics: CardDefinition[] = [];
  for (const biome of BIOMES) {
    const names = RELIC_NAMES[biome];
    for (let i = 0; i < 3; i++) {
      const rarity: Rarity = i === 0 ? 'Common' : i === 1 ? 'Uncommon' : 'Rare';
      relics.push({
        cardId: genId(),
        name: names[i],
        category: 'Relic',
        rarity,
        biome,
        archetype: ARCHETYPES[i % 5],
        attack: 0,
        health: randomInt(3, 10),
        loyalty: 0,
        keywords: generateKeywords(randomInt(1, 2), 'Relic'),
        description: `A ${biome} relic with powerful effects.`,
      });
    }
  }
  return relics;
}

export function loadCritters(): CardDefinition[] {
  const raw = (crittersData as { critters: CritterJson[] }).critters;
  return raw.map((c) => ({
    cardId: c.cardId,
    name: c.name,
    category: 'Critter' as const,
    rarity: 'Common' as const,
    biome: c.biome as Biome,
    archetype: c.archetype as Archetype,
    attack: c.attack,
    health: c.health,
    loyalty: c.loyalty,
    keywords: [],
    description: c.description,
  }));
}

export function generateCardPool(): CardDefinition[] {
  nextId = 100; // Reset so IDs always match image filenames (000100-000189)
  const allies = generateAllies();
  const locations = generateLocations();
  const relics = generateRelics();
  return [...allies, ...locations, ...relics];
}

export const JUNK_CARD: CardDefinition = {
  cardId: 'JUNK',
  name: 'Junk',
  category: 'Junk',
  rarity: 'Common',
  biome: 'Red',
  archetype: 'Insect',
  attack: 0,
  health: 1,
  loyalty: 0,
  keywords: [],
  description: 'Worthless junk. Awards opponent 1 resource when destroyed.',
};

let instanceCounter = 0;

export function createCardInstance(def: CardDefinition): CardInstance {
  instanceCounter++;
  return {
    instanceId: `inst_${instanceCounter}_${Date.now()}`,
    definitionId: def.cardId,
    name: def.name,
    category: def.category,
    biome: def.biome,
    archetype: def.archetype,
    currentHealth: def.health,
    maxHealth: def.health,
    currentAttack: def.attack,
    baseAttack: def.attack,
    isKO: false,
    isLocked: false,
    level: 1,
    xp: 0,
    poisonCounters: 0,
    stunTurns: 0,
    trapTurns: 0,
    keywords: [...def.keywords],
  };
}

