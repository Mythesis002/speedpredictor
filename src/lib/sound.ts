/**
 * Lightweight Web Audio synthesizer for Apex Racing Predictions.
 *
 * - F1 countdown beeps (3-2-1) & lock chime
 * - Engine launch & acceleration roar
 * - Win celebration chime & loss feedback tone
 * - Master mute toggle persisted in localStorage
 */

const MUTE_KEY = "apex_sound_muted";

let audioCtx: AudioContext | null = null;
const listeners = new Set<(muted: boolean) => void>();

export function isSoundMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSoundMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (muted) {
      window.localStorage.setItem(MUTE_KEY, "1");
    } else {
      window.localStorage.removeItem(MUTE_KEY);
      // Warm up AudioContext on unmute gesture
      getCtx();
    }
  } catch {
    /* ignore */
  }
  for (const cb of listeners) {
    try {
      cb(muted);
    } catch {
      /* ignore */
    }
  }
}

export function toggleSoundMuted(): boolean {
  const next = !isSoundMuted();
  setSoundMuted(next);
  if (!next) {
    playCountdownBeep(false);
  }
  return next;
}

export function subscribeSoundMuted(cb: (muted: boolean) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (isSoundMuted()) return null;
  try {
    if (!audioCtx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    if (audioCtx.state === "suspended") {
      void audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/** Crisp F1 start light / countdown beep (880Hz normal, 1320Hz final lock/GO). */
export function playCountdownBeep(high = false): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(high ? 1320 : 880, now);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(high ? 0.16 : 0.11, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (high ? 0.22 : 0.12));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + (high ? 0.24 : 0.14));
  } catch {
    /* best effort */
  }
}

/** Synthesized twin-turbo V8/GT launch & acceleration sweep when lights go out. */
export function playLaunchRoar(): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;

    // Low sawtooth engine fundamental + harmonic
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc1.type = "sawtooth";
    osc2.type = "square";

    // Rev up from 95Hz -> 290Hz, gear shift dip -> 360Hz
    osc1.frequency.setValueAtTime(95, now);
    osc1.frequency.exponentialRampToValueAtTime(280, now + 0.55);
    osc1.frequency.setValueAtTime(215, now + 0.58);
    osc1.frequency.exponentialRampToValueAtTime(355, now + 1.25);

    osc2.frequency.setValueAtTime(190, now);
    osc2.frequency.exponentialRampToValueAtTime(560, now + 0.55);
    osc2.frequency.setValueAtTime(430, now + 0.58);
    osc2.frequency.exponentialRampToValueAtTime(710, now + 1.25);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(420, now);
    filter.frequency.exponentialRampToValueAtTime(1600, now + 0.7);
    filter.frequency.exponentialRampToValueAtTime(600, now + 1.35);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.14, now + 0.08);
    gain.gain.setValueAtTime(0.11, now + 0.75);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 1.42);
    osc2.stop(now + 1.42);
  } catch {
    /* best effort */
  }
}

/** Tactile confirmation click when placing a bet. */
export function playBetPlacedChime(): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const notes = [587.33, 880]; // D5 -> A5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + i * 0.065;
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(0.12, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.18);
    });
  } catch {
    /* best effort */
  }
}

/** Arpeggiated celebratory chime when the player's car wins. */
export function playWinChime(): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51]; // C5 E5 G5 C6 E6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + i * 0.085;
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(0.16, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.45);
    });
  } catch {
    /* best effort */
  }
}
