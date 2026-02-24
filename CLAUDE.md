# CLAUDE.md - Spin Critters Prototype

## Project Overview

Build a **playable single-player web prototype** of "Spin Critters", a slot-machine-meets-card-battler game. The goal is to validate whether the core game loop is fun: spinning reels, drafting cards, resolving battles, and shopping between rounds.

This is a PROTOTYPE. Prioritize gameplay feel and functional correctness over visual polish. Colored rectangles with text labels are perfectly fine. Do not spend time on animations, particle effects, or cosmetic features unless the core loop is fully working first.

## Tech Stack

- **Vite + React 18 + TypeScript**
- **Zustand** for game state management
- **CSS Modules or Tailwind** for styling (your choice, keep it simple)
- **No backend** - everything runs client-side
- **No Three.js** - use plain DOM/CSS for the prototype. Slot reel spinning can be CSS animations.

```bash
# Project setup
npm create vite@latest spin-critters -- --template react-ts
cd spin-critters
npm install zustand immer
npm run dev
```

## Architecture

Structure the project with a clear separation between game logic and UI:

```
src/
  engine/           # Pure game logic, zero React dependencies
    types.ts        # All TypeScript interfaces and enums
    constants.ts    # Game constants (reel size, morale, resource values)
    cards.ts        # Card database and card pool generation
    battle.ts       # Battle resolution engine
    shop.ts         # Shop/draft logic
    ai.ts           # AI opponent decision making
    gameState.ts    # Master game state machine
  components/       # React UI components
    GameBoard.tsx   # Main game container
    ReelGrid.tsx    # The 5xN slot machine grid
    CardSlot.tsx    # Individual card in a reel slot
    BattleView.tsx  # Battle phase UI (your reels vs opponent reels)
    ShopView.tsx    # Shop/draft phase UI
    DraftView.tsx   # Initial card draft UI
    StatusBar.tsx   # Morale, resources, round info
    BattleLog.tsx   # Scrollable log of what happened each spin
  store/
    gameStore.ts    # Zustand store wrapping the game engine
  data/
    critters.json   # The 25 starter critters (provided below)
    allies.json     # Generated ally cards
    locations.json  # Generated location cards
    relics.json     # Generated relic cards
    keywords.json   # Keyword definitions
  App.tsx
  main.tsx
```

**Critical rule**: The `engine/` folder must have ZERO imports from React, Zustand, or any UI library. It should be pure functions and classes that take state in and return new state out. This makes it testable and portable.

## Game Constants

```typescript
// constants.ts
export const REEL_WIDTH = 5;           // 5 columns
export const INITIAL_REEL_HEIGHT = 3;  // Start with 3 rows
export const MAX_REEL_HEIGHT = 10;     // Grows to 10 rows over tournament
export const STARTING_MORALE = 50;
export const MORALE_LOSS_BASE = 6;     // Base morale loss on battle loss
export const MORALE_LOSS_PER_LIVING = 2; // Extra per surviving enemy critter
export const STARTING_RESOURCES = 3;   // Resources at start of each spin
export const RESOURCE_BONUS_THRESHOLD = 10; // Bonus 1 per 10 resources at shop
export const MAX_SPINS_PER_BATTLE = 10; // Base battle length
export const OVERTIME_DAMAGE_START = 10; // After spin 10, cards take (spin - 10) damage
export const MAX_SAME_BIOME_CRITTERS = 2; // Max 2 of same biome in starting 3
export const CRIT_LINE_COUNT = 5;      // Total possible CRIT lines (middle, +/-1, 2 diagonals)
export const NUM_AI_OPPONENTS = 3;     // Start with 3 AI opponents for prototype (not full 7)
export const INITIAL_DRAFT_COMMON = 5; // 5 common packs in initial draft
export const INITIAL_DRAFT_UNCOMMON = 2; // 2 uncommon packs in initial draft
```

## Core Types

```typescript
// types.ts

export type Biome = 'Red' | 'Blue' | 'Cream' | 'Brown' | 'Green';
export type Archetype = 'Insect' | 'Mammal' | 'Reptile' | 'Avian' | 'Aquatic';
export type CardCategory = 'Critter' | 'Ally' | 'Location' | 'Relic' | 'Junk';
export type Rarity = 'Common' | 'Uncommon' | 'Rare';
export type BattlePhase = 'spin' | 'on-appear' | 'crit-resolution' | 'fast-attack' | 'regular-attack' | 'slow-attack';
export type GamePhase = 'critter-select' | 'initial-draft' | 'battle' | 'shop' | 'game-over';

export interface CardDefinition {
  cardId: string;
  name: string;
  category: CardCategory;
  rarity: Rarity;
  biome: Biome;
  archetype: Archetype;
  attack: number;
  health: number;
  loyalty: number;
  keywords: KeywordInstance[];
  description: string;
  // Evolution data (critters only)
  evolutions?: {
    level: number;
    attack: number;
    health: number;
    keywords: KeywordInstance[];
  }[];
}

export interface KeywordInstance {
  keywordId: number;
  name: string;
  value?: number;       // The X in "Thorns X", "Regenerate X", etc.
  targetType?: string;  // For type-specific keywords like "Strength Red"
}

export interface CardInstance {
  instanceId: string;      // Unique per card in play
  definitionId: string;    // Reference to CardDefinition
  currentHealth: number;
  maxHealth: number;
  currentAttack: number;
  isKO: boolean;
  isLocked: boolean;       // Column locked when all cards in it are KO'd
  level: number;           // Current evolution level (1-5, critters only)
  xp: number;              // XP toward next evolution
  poisonCounters: number;
  stunTurns: number;
  trapTurns: number;
  keywords: KeywordInstance[]; // Active keywords (may change with evolution)
}

export interface ReelSlot {
  row: number;
  col: number;
  card: CardInstance | null; // null = empty slot
}

export interface PlayerState {
  id: string;
  name: string;
  isHuman: boolean;
  morale: number;
  resources: number;
  reels: ReelSlot[][];     // [row][col]
  reelHeight: number;       // Current number of rows
  critters: CardInstance[]; // The 3 starting critters
  activeCritLines: number;  // How many CRIT lines are active (1, 3, or 5)
  battlesCompleted: number;
}

export interface BattleState {
  player1: PlayerState;
  player2: PlayerState;
  currentSpin: number;
  maxSpins: number;
  log: BattleLogEntry[];
  phase: BattlePhase;
  // The 5 cards that are on the active row after a spin, per player
  player1ActiveCards: (CardInstance | null)[];
  player2ActiveCards: (CardInstance | null)[];
}

export interface BattleLogEntry {
  spin: number;
  phase: BattlePhase;
  message: string;
  details?: Record<string, unknown>;
}

export interface TournamentState {
  phase: GamePhase;
  round: number;
  players: PlayerState[];
  currentBattle: BattleState | null;
  cardPool: CardDefinition[];
  matchHistory: { p1: string; p2: string; winner: string }[];
  eliminationOrder: string[];
}
```

## Game Flow Implementation

### Phase 1: Critter Selection (critter-select)

1. Display all 25 critters organized by biome
2. Player selects exactly 3 critters
3. Enforce: max 2 of the same biome
4. Player places each critter into one of the 5 reel columns (one critter per column, 2 columns start empty)
5. AI opponents also select 3 critters (simple: random selection respecting the biome rule)

### Phase 2: Initial Draft (initial-draft)

1. Generate the shared card pool: 300 Common, 150 Uncommon, 75 Rare (from the ally/location/relic cards)
2. Player is shown 7 packs (5 common, 2 uncommon), each containing 3 cards
3. Player picks 1 card from each pack
4. Each picked card is placed into a reel column of the player's choosing
5. Remaining reel slots (5w x 3h = 15 slots, minus 3 critters minus 7 drafted = 5 remaining) are filled with Junk cards
6. AI opponents also draft (random picks)

**Junk Card Definition:**
```typescript
const JUNK_CARD: CardDefinition = {
  cardId: 'JUNK',
  name: 'Junk',
  category: 'Junk',
  rarity: 'Common',
  biome: 'Red',        // Doesn't matter, junk is colorless
  archetype: 'Insect', // Doesn't matter
  attack: 0,
  health: 1,
  loyalty: 0,
  keywords: [],
  description: 'Worthless junk. Awards opponent 1 resource when destroyed.',
};
```

### Phase 3: Battle (battle)

This is the core loop. Each battle runs for up to 10 spins (plus overtime).

**Per-Spin Resolution Order:**

1. **SPIN**: For each column, randomly select which row's card appears on the activation line (the middle row). This simulates the slot machine spin. Cards that are KO'd cannot be selected. If a column has no living cards, it is locked.

2. **RESOURCE GRANT**: Player receives 3 base resources.

3. **ON-APPEAR**: Activate any "on appear" effects from the 5 active cards (resource generation from Locations, Produce keyword, etc.)

4. **CRIT CHECK**: Check the active row for CRITs.
   - **Biome CRIT**: All 5 active cards share the same biome -> Trigger a powerful biome effect
   - **Archetype CRIT**: All 5 active cards share the same archetype -> All critters of that archetype in your reels gain XP
   - For the prototype, a CRIT on the activation line is sufficient. Don't implement the additional CRIT lines above/below yet.

5. **FAST ATTACK PHASE**: Cards with the "Fast" keyword attack first. Each active card attacks the opposing card in the same column. If no opposing card, damage goes to a random adjacent column's card.

6. **REGULAR ATTACK PHASE**: All remaining active cards (without Fast or Slow) attack simultaneously.

7. **SLOW ATTACK PHASE**: Cards with the "Slow" keyword attack last.

8. **CLEANUP**: Check for KO'd cards (health <= 0). Remove them from the reel. Check if a column is now fully dead (locked). Apply poison counter damage.

9. **OVERTIME CHECK**: If spin > 10, all activated cards take (currentSpin - 10) damage.

10. **BATTLE END CHECK**: If either player has no activatable cards remaining, the battle ends.

**Attack Resolution:**
- Each active card deals its attack value as damage to the opposing card in the same column
- If there is no opposing card in that column (empty or locked), redirect damage to a random adjacent column's active card
- If there are no adjacent targets, damage is wasted

**After Battle:**
- Losing player loses: MORALE_LOSS_BASE + (MORALE_LOSS_PER_LIVING * opponent's surviving critters)
- If morale <= 0, player is eliminated
- All cards are revived to full health
- Critters evolve if they have enough XP

### Phase 4: Shop (shop)

After each battle:

1. Every other battle: add one new row to the reel (filled with Junk). Max 10 rows.
2. All cards revive to full health
3. Process critter evolution (if XP thresholds met)
4. Present 1 pack of 3 cards from the card pool (rarity distribution based on current round, see table below)
5. Player can:
   - Purchase a card (costs resources, varies by rarity: Common=2, Uncommon=4, Rare=7)
   - Reroll the pack for 2 resources
   - Skip
6. Purchased cards are placed in a reel column of the player's choosing
7. After shopping, next battle begins

**Rarity Distribution by Round:**

| Round | Common % | Uncommon % | Rare % |
|-------|----------|------------|--------|
| 1     | 100      | 0          | 0      |
| 2     | 95       | 5          | 0      |
| 3     | 90       | 10         | 0      |
| 4     | 80       | 20         | 0      |
| 5     | 70       | 25         | 5      |
| 6     | 60       | 30         | 10     |
| 7     | 50       | 35         | 15     |
| 8     | 40       | 40         | 20     |
| 9     | 25       | 45         | 25     |
| 10    | 15       | 50         | 35     |

### Phase 5: Game Over

- Display final standings
- Show battle log summary
- "Play Again" button

## AI Opponent Logic

Keep this simple for the prototype. Each AI has a "personality" that affects drafting:

```typescript
type AIPersonality = 'aggressive' | 'defensive' | 'balanced';

// Aggressive: prefers high attack cards
// Defensive: prefers high health cards, healing keywords
// Balanced: picks randomly weighted by rarity

// AI Draft: pick the highest-value card from each pack based on personality
// AI Reel Placement: distribute cards evenly across columns
// AI does NOT re-spin or use resources strategically (keep it dumb for now)
```

## Card Generation

Since only 25 critters exist, you need to GENERATE ally, location, and relic cards for the prototype. Create them programmatically with sensible stat distributions:

### Allies (generate ~60 cards)
- Common (35): Attack 2-4, Health 5-15, 0-1 keywords
- Uncommon (20): Attack 3-6, Health 10-25, 1-2 keywords  
- Rare (5): Attack 5-8, Health 20-35, 2-3 keywords
- Distribute evenly across all 5 biomes and 5 archetypes
- Give them generated names based on biome+archetype (e.g., "Flame Beetle", "Frost Hawk")

### Locations (generate ~15 cards)
- Attack: 0 (locations don't attack)
- Health: 5-20
- All have "Produce" keyword (generate 1-3 resources on appear)
- Some have secondary keywords like Healing, Bolster
- Distribute across biomes

### Relics (generate ~15 cards)
- Attack: 0 (relics don't attack directly)
- Health: 3-10
- Have powerful keywords like Bolster, Thorns, Regenerate
- Distribute across biomes

### Keyword Implementation Priority

Implement these keywords first (they create the most interesting gameplay):

1. **Produce X** - Generates X resources on activation. Essential for economy.
2. **Fast** - Attacks before normal phase. Simple flag check.
3. **Slow** - Attacks after normal phase. Simple flag check.
4. **Regenerate X** - Heals self for X each spin. Counter to chip damage.
5. **Thorns X** - Deals X damage back to attacker. Defensive counter-play.
6. **Bolster X** - Adjacent cards deal +X damage. Positioning matters.
7. **Healing X** - Heals adjacent cards for X. Positioning matters.
8. **Venomous X** - Applies X poison counters on hit. Damage over time.
9. **Poisonous X** - Applies X poison counters to attacker. Defensive DOT.
10. **Angry** - Deals bonus damage when injured. Comeback mechanic.

Skip these for the prototype: Elusive, Immune, Powerful/Stun, Hibernate, Trapper, Slippery, Last Stand, Loner, Multicolored, Colorless, Growth, Pacifist, Hoarder, Parasitic, Defender, Transient, Mulligan, Guarded, Timeless, Hinder.

## UI Layout

The UI should be functional, not pretty. Use a single-page layout:

```
+--------------------------------------------------+
|  SPIN CRITTERS - Round X / Battle Y              |
|  Morale: ██████░░░░ 35/50  Resources: 12         |
+--------------------------------------------------+
|                                                    |
|  OPPONENT REELS (5 columns, show active row)       |
|  [Card] [Card] [Card] [Card] [Card]               |
|                                                    |
|  ---- BATTLE LINE ----                             |
|                                                    |
|  YOUR REELS (5 columns, show all rows)             |
|  [Card] [Card] [Card] [Card] [Card]  <- Active    |
|  [Card] [Card] [Card] [Card] [Card]               |
|  [Card] [Card] [Card] [Card] [Card]               |
|                                                    |
+--------------------------------------------------+
|  BATTLE LOG (scrollable)                           |
|  > Spin 3: Fiammor attacks Marisect for 4 damage  |
|  > Spin 3: Marisect is KO'd!                      |
|  > Spin 3: Biome CRIT! All Red cards active!       |
+--------------------------------------------------+
|  [SPIN]  [END TURN]                                |
+--------------------------------------------------+
```

### Card Display

Each card in the reel should show:
- Name (truncated if needed)
- Attack / Health numbers
- Background color based on biome (Red=#E74C3C, Blue=#3498DB, Cream=#F5E6CC, Brown=#8B4513, Green=#27AE60)
- Border or badge for archetype
- KO'd cards shown grayed out with an X
- Active row cards highlighted with a bright border

### Shop UI

```
+--------------------------------------------------+
|  SHOP PHASE - Round X                             |
|  Resources: 12                                     |
+--------------------------------------------------+
|  PACK:                                             |
|  [Card 1]  [Card 2]  [Card 3]                     |
|  Cost: 2   Cost: 4   Cost: 7                      |
|  [BUY]     [BUY]     [BUY]                        |
|                                                    |
|  [REROLL PACK - 2 resources]  [SKIP]               |
+--------------------------------------------------+
|  YOUR REELS (click column to place purchased card) |
|  Col 1    Col 2    Col 3    Col 4    Col 5         |
+--------------------------------------------------+
```

## Implementation Order

**FOLLOW THIS ORDER. Do not skip ahead.**

### Step 1: Data Layer
- Create all type definitions in `types.ts`
- Create constants in `constants.ts`
- Load the 25 critters from the JSON data file
- Generate the ally/location/relic cards programmatically
- Write the card pool generation function

### Step 2: Battle Engine
- Implement the spin mechanic (random card selection per column)
- Implement basic attack resolution (card vs opposing column card)
- Implement KO and column locking
- Implement the 6-phase battle flow (spin, on-appear, crit, fast, regular, slow)
- Implement overtime damage
- Implement battle end detection
- **TEST**: Write a simple function that runs a battle between two random players and prints the log to console. Verify it works before moving on.

### Step 3: Core Game State Machine
- Implement TournamentState transitions: critter-select -> initial-draft -> battle -> shop -> battle -> ... -> game-over
- Implement morale tracking and elimination
- Implement the round/battle counter
- Implement reel height growth every other battle

### Step 4: AI Opponents
- Implement critter selection (random with biome constraint)
- Implement draft picks (weighted random by personality)
- Implement reel placement (distribute evenly)
- Implement shop decisions (buy best available if affordable)

### Step 5: UI - Critter Selection Screen
- Display the 25 critters in a grid organized by biome
- Click to select (max 3, enforce biome rule)
- After selection, show 5 columns and let player drag/click to place critters
- "Start Tournament" button

### Step 6: UI - Battle Screen
- Show both players' active cards (opponent top, player bottom)
- Show the player's full reel grid below
- "Spin" button to advance one spin
- Battle log panel showing what happened
- Morale and resource counters

### Step 7: UI - Shop Screen
- Show pack of 3 cards with costs
- Buy/reroll/skip buttons
- Column selector for placement

### Step 8: UI - Draft Screen
- Show 7 packs sequentially
- Pick 1 from each
- Place in columns

### Step 9: Polish and Bug Fixes
- Make sure game flows smoothly from phase to phase
- Fix edge cases (all cards KO'd, no valid targets, etc.)
- Add "Play Again" to game over screen
- Make sure the battle log is informative enough to understand what's happening

## Provided Card Data

The 25 starter critters are in `src/data/critters.json`. Here they are for reference (copy this file into the project):

```json
[
  {"cardId":"000001","name":"Fiammor","category":"Critter","rarity":"Common","biome":"Red","archetype":"Insect","attack":4,"health":30,"loyalty":10,"keywords":[],"description":"Bug that eats lava and uses heat to defend itself."},
  {"cardId":"000002","name":"Hareed","category":"Critter","rarity":"Common","biome":"Red","archetype":"Mammal","attack":4,"health":30,"loyalty":10,"keywords":[],"description":"Burrows into shifting dunes, super fast."},
  {"cardId":"000003","name":"Kurzharn","category":"Critter","rarity":"Common","biome":"Red","archetype":"Reptile","attack":4,"health":30,"loyalty":10,"keywords":[],"description":"Dark Obsidian looking reptile with thick skin."},
  {"cardId":"000004","name":"Vulcana","category":"Critter","rarity":"Common","biome":"Red","archetype":"Avian","attack":4,"health":30,"loyalty":10,"keywords":[],"description":"LARGE Bird that lives near fiery mountains."},
  {"cardId":"000005","name":"Saharidon","category":"Critter","rarity":"Common","biome":"Red","archetype":"Aquatic","attack":4,"health":30,"loyalty":10,"keywords":[],"description":"Chonky oasis dwelling creature that lives in pools of water."},
  {"cardId":"000006","name":"Marisect","category":"Critter","rarity":"Common","biome":"Blue","archetype":"Insect","attack":4,"health":30,"loyalty":10,"keywords":[],"description":"A gossamer winged swimmer with bright colors."},
  {"cardId":"000007","name":"Oceanicet","category":"Critter","rarity":"Common","biome":"Blue","archetype":"Mammal","attack":4,"health":30,"loyalty":10,"keywords":[],"description":"Deep ocean dwelling water mammal with webbed limbs."},
  {"cardId":"000008","name":"Skyvern","category":"Critter","rarity":"Common","biome":"Blue","archetype":"Reptile","attack":4,"health":30,"loyalty":10,"keywords":[],"description":"Lives way above the clouds, sharp talons like a mini water-whelp."},
  {"cardId":"000009","name":"Aerornith","category":"Critter","rarity":"Common","biome":"Blue","archetype":"Avian","attack":4,"health":30,"loyalty":10,"keywords":[],"description":"Large wingspan bird never needs to touch the ground. Keen eye-sight."},
  {"cardId":"000010","name":"Aquarai","category":"Critter","rarity":"Common","biome":"Blue","archetype":"Aquatic","attack":4,"health":30,"loyalty":10,"keywords":[],"description":"Iridescent scales, long, semi-translucent. Moves fast through water."},
  {"cardId":"000011","name":"Qannuc","category":"Critter","rarity":"Common","biome":"Cream","archetype":"Insect","attack":4,"health":30,"loyalty":10,"keywords":[],"description":"Thick exoskeleton, anti-freeze like chemicals in its blood."},
  {"cardId":"000012","name":"Taivassu","category":"Critter","rarity":"Common","biome":"Cream","archetype":"Mammal","attack":4,"health":30,"loyalty":10,"keywords":[],"description":"Majestic mammal, long legs, thick coat, keen smell."},
  {"cardId":"000013","name":"Kivik","category":"Critter","rarity":"Common","biome":"Cream","archetype":"Reptile","attack":4,"health":30,"loyalty":10,"keywords":[],"description":"Razor sharp claws, armored hide, powerful jaws."},
  {"cardId":"000014","name":"Jaasi","category":"Critter","rarity":"Common","biome":"Cream","archetype":"Avian","attack":4,"health":30,"loyalty":10,"keywords":[],"description":"Snowy white feathers, sharp talons and beak."},
  {"cardId":"000015","name":"Aqsiktac","category":"Critter","rarity":"Common","biome":"Cream","archetype":"Aquatic","attack":4,"health":30,"loyalty":10,"keywords":[],"description":"A large cat with claws that gleam like sapphires."},
  {"cardId":"000016","name":"Varvas","category":"Critter","rarity":"Common","biome":"Brown","archetype":"Insect","attack":4,"health":30,"loyalty":10,"keywords":[],"description":"Razor sharp claws, antennae to navigate in dark."},
  {"cardId":"000017","name":"Grottohund","category":"Critter","rarity":"Common","biome":"Brown","archetype":"Mammal","attack":4,"health":30,"loyalty":10,"keywords":[],"description":"Tunneling mammal with good sense of smell, dense, small."},
  {"cardId":"000018","name":"Suomu","category":"Critter","rarity":"Common","biome":"Brown","archetype":"Reptile","attack":4,"health":30,"loyalty":10,"keywords":[],"description":"Retractable claws, dark scales, forked tongue."},
  {"cardId":"000019","name":"Darter","category":"Critter","rarity":"Common","biome":"Brown","archetype":"Avian","attack":4,"health":30,"loyalty":10,"keywords":[],"description":"Small agile bird, sturdy wings, can camouflage."},
  {"cardId":"000020","name":"Duskscale","category":"Critter","rarity":"Common","biome":"Brown","archetype":"Aquatic","attack":4,"health":30,"loyalty":10,"keywords":[],"description":"Built for water, long fins and flowing. Glowing eyes."},
  {"cardId":"000021","name":"Densarvi","category":"Critter","rarity":"Common","biome":"Green","archetype":"Insect","attack":4,"health":30,"loyalty":10,"keywords":[],"description":"Bright green, blends in, can fly short distances, horned."},
  {"cardId":"000022","name":"Ardob","category":"Critter","rarity":"Common","biome":"Green","archetype":"Mammal","attack":4,"health":30,"loyalty":10,"keywords":[],"description":"Bear like creature, forager, thick brown fur."},
  {"cardId":"000023","name":"Verdilo","category":"Critter","rarity":"Common","biome":"Green","archetype":"Reptile","attack":4,"health":30,"loyalty":10,"keywords":[],"description":"Bright colored lizard, large expressive eyes, speedy."},
  {"cardId":"000024","name":"Azuquila","category":"Critter","rarity":"Common","biome":"Green","archetype":"Avian","attack":4,"health":30,"loyalty":10,"keywords":[],"description":"Blue/Green plumage, flies at high speeds, social bird."},
  {"cardId":"000025","name":"Fluvinix","category":"Critter","rarity":"Common","biome":"Green","archetype":"Aquatic","attack":4,"health":30,"loyalty":10,"keywords":[],"description":"Sleek, long flattened head, deep rich greenish scales."}
]
```

## Keyword Definitions Reference

```json
[
  {"id":0,"name":"Produce","description":"Generates X resources when activated","hasValue":true},
  {"id":1,"name":"Steal","description":"Steals X resources from opponent","hasValue":true},
  {"id":2,"name":"Fast","description":"Attacks before normal combat phase","hasValue":false},
  {"id":3,"name":"Slow","description":"Attacks after normal combat phase","hasValue":false},
  {"id":8,"name":"Venomous","description":"Applies X poison counters on hit. Poisoned cards take damage equal to counters each activation, then reduce by 1","hasValue":true},
  {"id":9,"name":"Poisonous","description":"Applies X poison counters to attacker when damaged","hasValue":true},
  {"id":10,"name":"Thorns","description":"Deals X damage back to attacker when damaged","hasValue":true},
  {"id":11,"name":"Angry","description":"Deals +50% damage when below 50% health","hasValue":false},
  {"id":12,"name":"Regenerate","description":"Heals self for X at start of each spin","hasValue":true},
  {"id":14,"name":"Healing","description":"Heals adjacent cards for X at start of each spin","hasValue":true},
  {"id":15,"name":"Bolster","description":"Adjacent cards deal +X damage","hasValue":true}
]
```

## Evolution System (Simplified for Prototype)

Critters gain XP from Archetype CRITs. When XP threshold is met, they evolve:

| Level | XP Required | Attack Bonus | Health Bonus |
|-------|-------------|-------------|-------------|
| 1     | 0 (base)    | +0          | +0          |
| 2     | 3           | +2          | +10         |
| 3     | 8           | +4          | +20         |
| 4     | 15          | +7          | +35         |
| 5     | 25          | +10         | +50         |

When evolving, the critter heals by the amount of the health increase.

## Key Design Decisions (Don't Deviate)

1. **Slot spin is random selection, not animation**: When you "spin", you randomly pick one living card per column to be on the activation line. No animated reel spinning needed for the prototype.
2. **Combat is column-vs-column**: Your column 1 card fights their column 1 card.
3. **CRITs only check the activation line**: Don't implement the above/below CRIT lines for prototype.
4. **4 players total for prototype**: 1 human + 3 AI. Not the full 8. Faster testing.
5. **No fatigue system**: Skip it for prototype.
6. **No re-spins**: Skip the re-spin mechanic for prototype.
7. **No critter abilities/special rules on base critters**: They all have the same stats (4/30). Differentiation comes from the allies/locations/relics you draft.
8. **Resources are visible**: Show both players' resource counts during battle.

## Testing the Build

After each major step, verify:
- `npm run dev` starts without errors
- No TypeScript errors
- The game state transitions correctly (check console logs)
- Battles resolve to completion without infinite loops
- Cards can be KO'd and columns can lock
- Shop purchases work and cards appear in reels
- AI opponents take turns and make decisions
- Game ends when morale hits 0

## Final Checklist

Before considering this done, the following should work end to end:

- [ ] Player can select 3 critters from the 25 available
- [ ] Player can place critters in reel columns
- [ ] Initial draft of 7 cards works
- [ ] Battle resolves spin by spin with a log of events
- [ ] KO'd cards are removed, columns lock when empty
- [ ] Overtime damage kicks in after spin 10
- [ ] Battle ends, morale is deducted
- [ ] Shop phase presents cards and allows purchasing
- [ ] Reel height grows every other battle
- [ ] AI opponents make decisions and participate in battles
- [ ] Game ends when only 1 player remains
- [ ] "Play Again" resets everything
- [ ] At least 5 keywords are functional in battle (Produce, Fast, Slow, Thorns, Regenerate)
