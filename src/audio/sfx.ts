// Sound effects using ZzFX - tiny synthesized game audio, no files needed.
// Each sound is an array of ZzFX parameters.
// Design sounds at: https://killedbyapixel.github.io/ZzFX/

// @ts-expect-error - zzfx has no type declarations
import { zzfx, ZZFX } from 'zzfx';

// Set master volume
ZZFX.volume = 0.3;

let muted = false;
let userHasInteracted = false;

// Browsers require a user gesture before audio can play.
// Call this once on any click/tap.
function ensureAudioContext() {
  if (userHasInteracted) return;
  userHasInteracted = true;
  if (ZZFX.audioContext.state === 'suspended') {
    ZZFX.audioContext.resume();
  }
}

// Auto-attach to first user interaction
if (typeof document !== 'undefined') {
  const unlock = () => {
    ensureAudioContext();
    document.removeEventListener('click', unlock);
    document.removeEventListener('keydown', unlock);
    document.removeEventListener('touchstart', unlock);
  };
  document.addEventListener('click', unlock);
  document.addEventListener('keydown', unlock);
  document.addEventListener('touchstart', unlock);
}

// ---- Sound Definitions ----
// Format: [volume, randomness, frequency, attack, sustain, release, shape, shapeCurve,
//          slide, deltaSlide, pitchJump, pitchJumpTime, repeatTime, noise, modulation,
//          bitCrush, delay, sustainVolume, decay, tremolo, filter]

const SOUNDS = {
  // Slot reel spinning — short whoosh
  spin: [.4, .05, 200, , .04, .07, , 1.5, -30, , , , , 1, , , , , .02],

  // Card attacks opponent — punchy hit (regular phase)
  attack: [.6, .05, 450, , .02, .06, 4, 1.8, , , , , , 2, , , , .85],

  // Fast-phase attack — zippy whip/slash, very short with upward pitch slide
  attackFast: [.5, .05, 900, , .01, .03, 2, 1, 40, 5, , , , .8, , , , .95],

  // Slow-phase attack — lower pitch, heavy/weighty
  attackSlow: [.7, .05, 250, , .04, .12, 4, 2.2, -10, , , , , 2.5, , .1, , .75],

  // Big hit (15+ damage) — heavy impact with rumble (regular phase)
  bigHit: [.8, .05, 200, , .04, .2, 4, 2.5, -20, , , , , 3, , .15, , .7, .03],

  // Big hit fast phase — sharp whip crack with echo
  bigHitFast: [.7, .05, 1000, , .02, .12, 2, 1.5, 50, 3, , , , 1.5, , .08, , .8, .02],

  // Big hit slow phase — deep thunderous boom
  bigHitSlow: [.9, .05, 120, , .06, .3, 4, 3, -25, , , , , 3.5, , .2, , .6, .04],

  // Card is KO'd — deep crash with reverb
  ko: [.8, .05, 60, , .1, .4, 4, 2.5, -10, , , , , 3, , .3, .02, .4],

  // Biome CRIT — sparkly power-up
  critBiome: [.6, 0, 600, .02, .15, .25, 0, 1, 20, , 200, .06, , , , , , .85, .02],

  // Archetype CRIT — ascending chime
  critArchetype: [.5, 0, 500, .02, .12, .18, 0, 1, 15, , 150, .08, , , , , , .85],

  // Heal / Regenerate — gentle ascending tone
  heal: [.3, 0, 600, .05, .12, .15, 0, .5, 10, , 100, .05],

  // Poison damage — acidic buzz
  poison: [.3, .1, 150, , .04, .1, 3, 1.5, -5, , , , .05, .5],

  // Thorns reflect — metallic ping
  thorns: [.35, 0, 900, , .02, .12, 2, 1.5, , , 50, .05, , , , , , .65],

  // Resource gained — coin bling
  resource: [.35, 0, 1200, , .03, .08, 0, 1, , , 300, .03],

  // Shop purchase — register cha-ching
  purchase: [.45, 0, 800, , .05, .18, 0, 1, , , 400, .04, .08],

  // Card selected — satisfying pop
  click: [.5, 0, 700, , .04, .06, 0, 1.2, 15, , 80, .02, , , , , , .7],

  // Card deselected — softer reverse pop
  deselect: [.3, 0, 500, , .03, .04, 0, 1, -10, , , , , , , , , .5],

  // Battle starts — louder ascending fanfare with echo
  battleStart: [.7, 0, 250, .03, .2, .4, 0, 1.2, 12, , 150, .08, .12, , , , .04, .8],

  // Victory — happy ascending notes
  victory: [.6, 0, 500, .02, .2, .4, 0, 1, 15, , 200, .08, .1, , , , .03, .8],

  // Defeat — descending sad tone
  defeat: [.4, 0, 400, .05, .15, .4, 0, 1, -15, , -100, .08, , , , , .05, .5],

  // Overtime warning — alarm beep
  overtime: [.35, 0, 700, , .05, .05, 2, 1, , , , , .1],

  // Card placed in reel — deeper satisfying thump
  place: [.65, .05, 180, , .06, .15, 4, 2.5, -20, , , , , .5, , , , .75],

  // Reroll — shuffling whoosh
  reroll: [.35, .1, 300, , .06, .1, , 1, -20, , , , , .5],

  // Bolster buff — power surge
  bolster: [.35, 0, 400, .02, .08, .12, 0, 1, 15, , 80, .04],
} as const;

export type SfxName = keyof typeof SOUNDS;

export function playSfx(name: SfxName): void {
  if (muted || !userHasInteracted) return;
  try {
    const params = SOUNDS[name];
    zzfx(...(params as unknown as number[]));
  } catch {
    // Ignore audio errors silently
  }
}

export function setMuted(value: boolean): void {
  muted = value;
}

export function isMuted(): boolean {
  return muted;
}

export function setVolume(vol: number): void {
  ZZFX.volume = Math.max(0, Math.min(1, vol));
}
