import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const CRITTERS_JSON = path.join(PROJECT_ROOT, 'src', 'data', 'critters.json');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'public', 'critters');

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error('Error: GEMINI_API_KEY environment variable is required.');
  console.error('Usage: GEMINI_API_KEY=your-key npx tsx scripts/generate-art.ts');
  process.exit(1);
}

const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${API_KEY}`;

const DELAY_MS = 3000;

interface CardEntry {
  cardId: string;
  name: string;
  category: string;
  biome: string;
  archetype: string;
  description: string;
}

// ── Replicate the deterministic name generation from cards.ts ──

const BIOMES = ['Red', 'Blue', 'Cream', 'Brown', 'Green'];
const ARCHETYPES = ['Insect', 'Mammal', 'Reptile', 'Avian', 'Aquatic'];

const ALLY_NAME_PREFIX: Record<string, string[]> = {
  Red: ['Flame', 'Ember', 'Ash', 'Magma', 'Scorch', 'Cinder', 'Blaze'],
  Blue: ['Frost', 'Tide', 'Mist', 'Wave', 'Storm', 'Ice', 'Splash'],
  Cream: ['Snow', 'Pale', 'Frost', 'Tundra', 'Sleet', 'Hail', 'Glaze'],
  Brown: ['Stone', 'Cave', 'Dust', 'Clay', 'Ore', 'Gravel', 'Flint'],
  Green: ['Vine', 'Leaf', 'Moss', 'Fern', 'Thorn', 'Root', 'Bloom'],
};

const ALLY_NAME_SUFFIX: Record<string, string[]> = {
  Insect: ['Beetle', 'Moth', 'Ant', 'Wasp', 'Mantis', 'Spider', 'Weevil'],
  Mammal: ['Wolf', 'Fox', 'Hare', 'Lynx', 'Otter', 'Shrew', 'Badger'],
  Reptile: ['Gecko', 'Viper', 'Skink', 'Drake', 'Newt', 'Croc', 'Cobra'],
  Avian: ['Hawk', 'Wren', 'Crow', 'Owl', 'Jay', 'Swift', 'Finch'],
  Aquatic: ['Eel', 'Pike', 'Ray', 'Crab', 'Squid', 'Trout', 'Perch'],
};

const LOCATION_NAMES: Record<string, string[]> = {
  Red: ['Volcano Vent', 'Lava Pool', 'Ash Fields'],
  Blue: ['Coral Reef', 'Deep Trench', 'Tidal Cave'],
  Cream: ['Frozen Lake', 'Ice Cavern', 'Snow Peak'],
  Brown: ['Crystal Mine', 'Deep Tunnel', 'Stone Hall'],
  Green: ['Ancient Grove', 'Fungal Glade', 'Canopy Nest'],
};

const RELIC_NAMES: Record<string, string[]> = {
  Red: ['Ember Shard', 'Flame Totem', 'Magma Core'],
  Blue: ['Frost Gem', 'Tidal Charm', 'Storm Orb'],
  Cream: ['Ice Crystal', 'Snow Rune', 'Pale Stone'],
  Brown: ['Cave Pearl', 'Stone Idol', 'Earth Sigil'],
  Green: ['Life Seed', 'Vine Crown', 'Root Charm'],
};

function generateAllCardEntries(): CardEntry[] {
  const entries: CardEntry[] = [];
  let nextId = 100;
  const genId = () => String(nextId++).padStart(6, '0');

  let biomeIdx = 0;
  let archIdx = 0;

  // 35 Common allies
  for (let i = 0; i < 35; i++) {
    const biome = BIOMES[biomeIdx % 5];
    const arch = ARCHETYPES[archIdx % 5];
    const prefix = ALLY_NAME_PREFIX[biome][i % ALLY_NAME_PREFIX[biome].length];
    const suffix = ALLY_NAME_SUFFIX[arch][i % ALLY_NAME_SUFFIX[arch].length];
    entries.push({
      cardId: genId(),
      name: `${prefix} ${suffix}`,
      category: 'Ally',
      biome,
      archetype: arch,
      description: `A small ${arch.toLowerCase()} creature from the ${biome} biome. It fights alongside your critters.`,
    });
    biomeIdx++;
    archIdx++;
  }

  // 20 Uncommon allies
  for (let i = 0; i < 20; i++) {
    const biome = BIOMES[biomeIdx % 5];
    const arch = ARCHETYPES[archIdx % 5];
    const prefix = ALLY_NAME_PREFIX[biome][(i + 2) % ALLY_NAME_PREFIX[biome].length];
    const suffix = ALLY_NAME_SUFFIX[arch][(i + 2) % ALLY_NAME_SUFFIX[arch].length];
    entries.push({
      cardId: genId(),
      name: `${prefix} ${suffix}`,
      category: 'Ally',
      biome,
      archetype: arch,
      description: `A powerful ${arch.toLowerCase()} warrior from the ${biome} biome. Stronger than common allies.`,
    });
    biomeIdx++;
    archIdx++;
  }

  // 5 Rare allies
  for (let i = 0; i < 5; i++) {
    const biome = BIOMES[i];
    const arch = ARCHETYPES[i];
    const prefix = ALLY_NAME_PREFIX[biome][(i + 4) % ALLY_NAME_PREFIX[biome].length];
    const suffix = ALLY_NAME_SUFFIX[arch][(i + 4) % ALLY_NAME_SUFFIX[arch].length];
    entries.push({
      cardId: genId(),
      name: `${prefix} ${suffix}`,
      category: 'Ally',
      biome,
      archetype: arch,
      description: `A legendary ${arch.toLowerCase()} champion from the ${biome} biome. Extremely rare and powerful.`,
    });
  }

  // 15 Locations (5 biomes * 3)
  for (const biome of BIOMES) {
    const names = LOCATION_NAMES[biome];
    for (let i = 0; i < 3; i++) {
      entries.push({
        cardId: genId(),
        name: names[i],
        category: 'Location',
        biome,
        archetype: ARCHETYPES[i % 5],
        description: `A mystical ${biome} location. ${names[i]} - a place of power that generates resources.`,
      });
    }
  }

  // 15 Relics (5 biomes * 3)
  for (const biome of BIOMES) {
    const names = RELIC_NAMES[biome];
    for (let i = 0; i < 3; i++) {
      entries.push({
        cardId: genId(),
        name: names[i],
        category: 'Relic',
        biome,
        archetype: ARCHETYPES[i % 5],
        description: `A magical artifact from the ${biome} biome. ${names[i]} - glowing with ancient energy.`,
      });
    }
  }

  return entries;
}

// ── Prompt builders per category ──

const BIOME_THEMES: Record<string, string> = {
  Red: 'volcanic, fiery, desert, lava, ember',
  Blue: 'oceanic, aquatic, icy water, deep sea, stormy',
  Cream: 'arctic, snowy, frozen tundra, icy, glacial',
  Brown: 'underground, cave, earthy, stone, subterranean',
  Green: 'forest, jungle, lush vegetation, mossy, verdant',
};

function buildPrompt(card: CardEntry): string {
  const biomeTheme = BIOME_THEMES[card.biome] || 'fantasy';

  if (card.category === 'Critter' || card.category === 'Ally') {
    return [
      'Game character portrait, creature design, digital art style.',
      `Name: ${card.name}. Biome: ${card.biome}. Type: ${card.archetype}.`,
      `Description: ${card.description}`,
      `Theme: ${biomeTheme}.`,
      'Square portrait, centered, dark background, vibrant colors.',
      'No text, no words, no letters in the image.',
    ].join('\n');
  }

  if (card.category === 'Location') {
    return [
      'Fantasy game environment art, landscape illustration, digital painting.',
      `Name: ${card.name}. Biome: ${card.biome}.`,
      `Description: ${card.description}`,
      `Theme: ${biomeTheme}.`,
      'Wide landscape view, atmospheric lighting, vibrant colors, dark moody edges.',
      'No text, no words, no letters in the image.',
    ].join('\n');
  }

  // Relic
  return [
    'Fantasy game item art, magical artifact illustration, digital painting.',
    `Name: ${card.name}. Biome: ${card.biome}.`,
    `Description: ${card.description}`,
    `Theme: ${biomeTheme}.`,
    'Centered magical object, glowing energy, dark background, vibrant colors.',
    'No text, no words, no letters in the image.',
  ].join('\n');
}

// ── API call ──

async function generateImage(card: CardEntry): Promise<Buffer | null> {
  const prompt = buildPrompt(card);

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ['IMAGE', 'TEXT'],
      responseMimeType: 'text/plain',
    },
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`  API error (${response.status}): ${errorText.slice(0, 200)}`);
      return null;
    }

    const data = await response.json();
    const candidates = data.candidates;
    if (!candidates || candidates.length === 0) {
      console.error('  No candidates in response');
      return null;
    }

    const parts = candidates[0].content?.parts;
    if (!parts) {
      console.error('  No parts in response');
      return null;
    }

    for (const part of parts) {
      if (part.inlineData) {
        return Buffer.from(part.inlineData.data, 'base64');
      }
    }

    console.error('  No image data found in response parts');
    return null;
  } catch (err) {
    console.error(`  Fetch error: ${err}`);
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Load critters
  const raw = fs.readFileSync(CRITTERS_JSON, 'utf-8');
  const data = JSON.parse(raw);
  const critters: CardEntry[] = data.critters.map((c: any) => ({
    cardId: c.cardId,
    name: c.name,
    category: 'Critter',
    biome: c.biome,
    archetype: c.archetype,
    description: c.description,
  }));

  // Generate non-critter card entries
  const nonCritters = generateAllCardEntries();

  const allCards = [...critters, ...nonCritters];

  console.log(`Total cards: ${allCards.length} (${critters.length} critters, ${nonCritters.length} allies/locations/relics)`);
  console.log(`Output directory: ${OUTPUT_DIR}`);

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const card of allCards) {
    const outPath = path.join(OUTPUT_DIR, `${card.cardId}.png`);

    if (fs.existsSync(outPath)) {
      console.log(`[SKIP] ${card.name} (${card.cardId}) - ${card.category}`);
      skipped++;
      continue;
    }

    console.log(`[GEN]  ${card.name} (${card.cardId}) - ${card.category} - ${card.biome} ${card.archetype}`);

    const imageBuffer = await generateImage(card);

    if (imageBuffer) {
      fs.writeFileSync(outPath, imageBuffer);
      console.log(`  Saved (${(imageBuffer.length / 1024).toFixed(1)} KB)`);
      generated++;
    } else {
      console.error(`  FAILED to generate image for ${card.name}`);
      failed++;
    }

    await sleep(DELAY_MS);
  }

  console.log('\n--- Summary ---');
  console.log(`Generated: ${generated}`);
  console.log(`Skipped:   ${skipped}`);
  console.log(`Failed:    ${failed}`);
  console.log(`Total:     ${allCards.length}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
