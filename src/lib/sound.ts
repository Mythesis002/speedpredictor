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

/** Crisp twin-exhaust anti-lag backfire pop on high-RPM upshifts. */
export function playShiftBackfire(): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;

    // 1. Snappy acoustic pop transient
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.07);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.075, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);

    // 2. Filtered exhaust noise crackle
    const sampleRate = ctx.sampleRate;
    const count = Math.floor(sampleRate * 0.065);
    const buf = ctx.createBuffer(1, count, sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < count; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (count * 0.28));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(950, now);
    filter.Q.setValueAtTime(1.8, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.045, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.07);
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

/**
 * Gentle sparkling shimmer with soft warm flutter when race finish confetti falls.
 * Features a staggered pentatonic chime cluster layered with a soft bandpass-filtered
 * airy paper flutter that smoothly decays over 1.2 seconds.
 */
export function playConfettiFallSound(): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const duration = 1.2;

    // 1. Sparkling shimmer cluster (high-register pentatonic overtone chimes)
    const sparkleNotes = [1046.5, 1318.51, 1567.98, 2093.0]; // C6, E6, G6, C7
    const delays = [0, 0.065, 0.13, 0.2];
    const gains = [0.045, 0.04, 0.035, 0.03];

    sparkleNotes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + delays[i];
      const end = now + duration;

      osc.type = i % 2 === 0 ? "triangle" : "sine";
      osc.frequency.setValueAtTime(freq, start);
      // Subtle downward micro-drift as confetti floats down
      osc.frequency.exponentialRampToValueAtTime(freq * 0.96, end);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(gains[i], start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(end);
    });

    // 2. Soft warm paper flutter breath (gentle bandpass-filtered noise sweep)
    const sampleRate = ctx.sampleRate;
    const bufferSize = Math.floor(sampleRate * duration);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.94 * b0 + white * 0.06;
      b1 = 0.92 * b1 + b0 * 0.08;
      output[i] = b1;
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.setValueAtTime(1.4, now);
    filter.frequency.setValueAtTime(2100, now);
    filter.frequency.exponentialRampToValueAtTime(1100, now + duration);

    const flutterGain = ctx.createGain();
    flutterGain.gain.setValueAtTime(0.0001, now);
    flutterGain.gain.exponentialRampToValueAtTime(0.032, now + 0.04);
    flutterGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    noiseSource.connect(filter);
    filter.connect(flutterGain);
    flutterGain.connect(ctx.destination);

    noiseSource.start(now);
    noiseSource.stop(now + duration);
  } catch {
    /* best effort */
  }
}
