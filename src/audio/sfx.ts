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

  // Card attacks opponent — punchy hit
  attack: [.5, .05, 400, , .02, .08, 4, 1.5, , , , , , 1.5, , , , .8],

  // Card is KO'd — low thud
  ko: [.6, .05, 80, , .08, .3, 4, 2, , , , , , 2, , .2, , .5],

  // Biome CRIT — sparkly power-up
  critBiome: [.5, 0, 600, .02, .12, .2, 0, 1, 20, , 200, .06, , , , , , .8, .02],

  // Archetype CRIT — ascending chime
  critArchetype: [.4, 0, 500, .02, .1, .15, 0, 1, 15, , 150, .08, , , , , , .8],

  // Heal / Regenerate — gentle ascending tone
  heal: [.3, 0, 600, .05, .12, .15, 0, .5, 10, , 100, .05],

  // Poison damage — acidic buzz
  poison: [.3, .1, 150, , .04, .1, 3, 1.5, -5, , , , .05, .5],

  // Thorns reflect — metallic ping
  thorns: [.3, 0, 900, , .02, .1, 2, 1.5, , , 50, .05, , , , , , .6],

  // Resource gained — coin bling
  resource: [.3, 0, 1200, , .03, .08, 0, 1, , , 300, .03],

  // Shop purchase — register cha-ching
  purchase: [.4, 0, 800, , .05, .15, 0, 1, , , 400, .04, .08],

  // Card selected — satisfying pop
  click: [.5, 0, 700, , .04, .06, 0, 1.2, 15, , 80, .02, , , , , , .7],

  // Card deselected — softer reverse pop
  deselect: [.3, 0, 500, , .03, .04, 0, 1, -10, , , , , , , , , .5],

  // Battle starts — ascending fanfare
  battleStart: [.4, 0, 300, .05, .15, .3, 0, 1, 10, , 100, .1, .1, , , , .05, .7],

  // Victory — happy ascending notes
  victory: [.5, 0, 500, .02, .2, .4, 0, 1, 15, , 200, .08, .1, , , , .03, .8],

  // Defeat — descending sad tone
  defeat: [.4, 0, 400, .05, .15, .4, 0, 1, -15, , -100, .08, , , , , .05, .5],

  // Overtime warning — alarm beep
  overtime: [.3, 0, 700, , .05, .05, 2, 1, , , , , .1],

  // Card placed in reel — solid thump
  place: [.5, .05, 250, , .05, .1, 4, 2, -15, , , , , .3, , , , .7],

  // Reroll — shuffling whoosh
  reroll: [.3, .1, 300, , .06, .1, , 1, -20, , , , , .5],

  // Bolster buff — power surge
  bolster: [.3, 0, 400, .02, .08, .1, 0, 1, 15, , 80, .04],
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
