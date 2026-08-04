/**
 * Deterministic, isomorphic race-round engine.
 *
 * The same pure functions run on the server (authority) and in the browser
 * (prediction / rendering), so a client never has to poll for animation state:
 * it syncs its clock once, then derives the entire round timeline locally.
 *
 * Fairness model (commit–reveal):
 *   perRoundSecret = HMAC(masterSecret, roundId)      // server only
 *   commit         = sha256(perRoundSecret)           // published before betting
 *   reveal         = perRoundSecret                   // published after bets lock
 * Anyone can verify sha256(reveal) === commit and re-derive the finish order
 * with `outcomeFromReveal`, which proves the result was fixed before any bet.
 */

import type { CarSpec, CarKind } from "@/components/race/Car";

export type RacePhase = "waiting" | "prep" | "lock" | "launch" | "race" | "finish";

/* ------------------------------------------------------------------ */
/* Timeline                                                            */
/* ------------------------------------------------------------------ */

/** Phase durations in ms. The sum is one full round. */
export const PHASE_MS: Record<RacePhase, number> = {
  waiting: 3000,
  prep: 3000,
  lock: 600,
  launch: 1400,
  race: 9600,
  finish: 4000,
};


export const PHASE_ORDER: RacePhase[] = [
  "waiting",
  "prep",
  "lock",
  "launch",
  "race",
  "finish",
];

export const ROUND_MS = PHASE_ORDER.reduce((s, p) => s + PHASE_MS[p], 0);

/** Betting closes when `lock` starts. */
export const LOCK_OFFSET_MS = PHASE_MS.waiting + PHASE_MS.prep;

/** Cosmetic base so round ids look like a long-running production service. */
const ROUND_ID_BASE = 328_000;
/** Epoch the schedule is anchored to (2026-01-01T00:00:00Z). */
const EPOCH_MS = 1_767_225_600_000;

export function roundIdAt(nowMs: number): number {
  return ROUND_ID_BASE + Math.floor((nowMs - EPOCH_MS) / ROUND_MS);
}

export function roundStartMs(roundId: number): number {
  return EPOCH_MS + (roundId - ROUND_ID_BASE) * ROUND_MS;
}

export function roundLockMs(roundId: number): number {
  return roundStartMs(roundId) + LOCK_OFFSET_MS;
}

export interface Timeline {
  roundId: number;
  phase: RacePhase;
  /** seconds elapsed inside the current phase */
  elapsed: number;
  /** duration of the current phase in seconds */
  duration: number;
  /** 0..1 progress through the current phase */
  t: number;
  /** seconds until betting locks (0 once locked) */
  countdown: number;
  /** 0..1 progress of the actual race (launch + race), 0 before, 1 after */
  raceT: number;
}

export function timelineAt(nowMs: number): Timeline {
  const roundId = roundIdAt(nowMs);
  let into = nowMs - roundStartMs(roundId);
  if (into < 0) into = 0;

  let acc = 0;
  let phase: RacePhase = "finish";
  let elapsed = 0;
  let duration = PHASE_MS.finish;
  for (const p of PHASE_ORDER) {
    const d = PHASE_MS[p];
    if (into < acc + d) {
      phase = p;
      elapsed = into - acc;
      duration = d;
      break;
    }
    acc += d;
  }

  const raceStart = LOCK_OFFSET_MS + PHASE_MS.lock;
  const raceSpan = PHASE_MS.launch + PHASE_MS.race;
  const raceT = Math.max(0, Math.min(1, (into - raceStart) / raceSpan));

  return {
    roundId,
    phase,
    elapsed: elapsed / 1000,
    duration: duration / 1000,
    t: duration ? elapsed / duration : 1,
    countdown: Math.max(0, (LOCK_OFFSET_MS - into) / 1000),
    raceT,
  };
}

export const isLocked = (phase: RacePhase) =>
  phase === "lock" || phase === "launch" || phase === "race" || phase === "finish";

/* ------------------------------------------------------------------ */
/* Deterministic RNG                                                   */
/* ------------------------------------------------------------------ */

export function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rngFrom(str: string): () => number {
  return mulberry32(xmur3(str)());
}

/* ------------------------------------------------------------------ */
/* Lineup (public — known before betting opens)                        */
/* ------------------------------------------------------------------ */

export const COLORS: { name: string; hex: string }[] = [
  { name: "Red", hex: "#ff3b4d" },
  { name: "Green", hex: "#3bff97" },
  { name: "Blue", hex: "#3b8bff" },
  { name: "Purple", hex: "#a24bff" },
  { name: "Orange", hex: "#ff8a2a" },
  { name: "Yellow", hex: "#ffd83a" },
  { name: "White", hex: "#f0f4ff" },
  { name: "Silver", hex: "#c9d1dc" },
];

/**
 * Odds model.
 *
 * Every car on the grid has a *different chance* of winning, and the payout is
 * derived from that chance rather than being an arbitrary number:
 *
 *   multiplier = RTP / winProbability
 *
 * This keeps the house edge constant and — crucially — guarantees every payout
 * is greater than the stake, so "winning" can never lose a player money.
 * Because the grid is public before betting opens, anyone can recompute both
 * the odds and the win probabilities for a round.
 */
export const RTP = 0.95;

export const KIND_WEIGHT: Record<CarKind, number> = {
  normal: 1,
  small: 1.4, // lighter car, wins more often, pays less
  hyper: 0.45, // rare winner, big payout
};

/** Win probability per lane for a grid, in lane order. */
export function winWeights(kinds: CarKind[]): number[] {
  const w = kinds.map((k) => KIND_WEIGHT[k]);
  const total = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / total);
}

const roundOdds = (p: number) => Math.round((RTP / p) * 100) / 100;

/** Publicly derivable grid for a round — identical on server and client. */
export function lineupForRound(roundId: number): [CarSpec, CarSpec, CarSpec] {
  const rnd = rngFrom(`grid:${roundId}`);
  const used = new Set<string>();
  let hyperUsed = false;
  const kinds: CarKind[] = [];
  const paint: { color: string; colorName: string }[] = [];

  for (let lane = 0; lane < 3; lane++) {
    const roll = rnd();
    const kind: CarKind = roll < 0.035 && !hyperUsed ? "hyper" : roll < 0.18 ? "small" : "normal";
    if (kind === "hyper") hyperUsed = true;
    kinds.push(kind);

    if (kind === "hyper") {
      paint.push({ color: "#0b0b10", colorName: "Black" });
      continue;
    }

    let c = COLORS[Math.floor(rnd() * COLORS.length)];
    let guard = 0;
    while (used.has(c.name) && guard++ < 24) {
      c = COLORS[Math.floor(rnd() * COLORS.length)];
    }
    used.add(c.name);
    paint.push({ color: c.hex, colorName: c.name });
  }

  const probs = winWeights(kinds);
  return kinds.map((kind, lane) => ({
    id: `r${roundId}-l${lane}`,
    color: paint[lane].color,
    colorName: paint[lane].colorName,
    kind,
    multiplier: roundOdds(probs[lane]),
  })) as [CarSpec, CarSpec, CarSpec];
}


/* ------------------------------------------------------------------ */
/* Outcome (secret until reveal)                                       */
/* ------------------------------------------------------------------ */

export interface Outcome {
  /** lane indexes ordered by finishing position, [P1, P2, P3] */
  order: [number, number, number];
  /** per-lane pace curve, progress 0..1 for race time 0..1 */
  curves: [Curve, Curve, Curve];
}

export type Curve = (t: number) => number;

/**
 * Build the full outcome from a revealed per-round secret.
 *
 * When `roundId` is supplied the finishing order is drawn against the public
 * per-lane win probabilities, so the published odds are the real odds.
 */
export function outcomeFromReveal(reveal: string, roundId?: number): Outcome {
  const rnd = rngFrom(`outcome:${reveal}`);
  const seeds = [0, 1, 2].map(() => Math.floor(rnd() * 0xffffffff));

  // deterministic finishing order, weighted by each lane's win probability
  const probs =
    roundId === undefined
      ? [1 / 3, 1 / 3, 1 / 3]
      : winWeights(lineupForRound(roundId).map((c) => c.kind));

  const pool = [0, 1, 2];
  const weights = [...probs];
  const order: number[] = [];
  while (pool.length) {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rnd() * total;
    let pick = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        pick = i;
        break;
      }
    }
    order.push(pool[pick]);
    pool.splice(pick, 1);
    weights.splice(pick, 1);
  }


  // final margins: P1 = 1.0, then tight, race-like gaps
  const margins: number[] = [0, 0, 0];
  const g1 = 0.012 + rnd() * 0.05;
  const g2 = g1 + 0.014 + rnd() * 0.06;
  margins[order[0]] = 1;
  margins[order[1]] = 1 - g1;
  margins[order[2]] = 1 - g2;

  const curves = [0, 1, 2].map((lane) => {
    const seed = seeds[lane];
    const margin = margins[lane];
    const bite = 1.2 + (seed % 100) / 110;
    const swing = 0.05 + ((seed >>> 3) % 40) / 520;
    const ph = ((seed >>> 7) % 100) / 100;
    const kick = ((seed >>> 11) % 50) / 700;
    return (t: number) => {
      const tc = Math.max(0, Math.min(1, t));
      const base = Math.pow(tc, 1 / bite);
      const surge = Math.sin((tc + ph) * Math.PI * 1.7) * swing * (1 - tc) * (1 - tc * 0.3);
      const late = Math.pow(tc, 5) * kick * (1 - tc);
      const ease = tc < 0.06 ? tc / 0.06 : 1;
      const v = (base + surge + late) * ease;
      // blend onto the exact margin as t -> 1 so the podium always matches `order`
      const w = Math.pow(tc, 3);
      return Math.max(0, v * (1 - w) + margin * w);
    };
  }) as [Curve, Curve, Curve];

  return { order: order as [number, number, number], curves };
}

/** Offline fallback so the experience never stalls if the API is unreachable. */
export function localReveal(roundId: number): string {
  return `offline:${roundId}`;
}
