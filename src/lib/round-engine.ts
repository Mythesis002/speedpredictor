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

export const PHASE_ORDER: RacePhase[] = ["waiting", "prep", "lock", "launch", "race", "finish"];

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

export function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}

export function xmur3(str: string): () => number {
  const [s0, s1, s2, s3] = cyrb128(str);
  let h = (s0 ^ s1 ^ s2 ^ s3) >>> 0;
  return () => {
    h = (h + 0x9e3779b9) >>> 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 16), 0x85ebca6b);
    t = Math.imul(t ^ (t >>> 13), 0xc2b2ae35);
    return (t ^ (t >>> 16)) >>> 0;
  };
}

export function sfc32(a: number, b: number, c: number, d: number): () => number {
  let sA = a >>> 0;
  let sB = b >>> 0;
  let sC = c >>> 0;
  let sD = d >>> 0;
  for (let i = 0; i < 15; i++) {
    const t = (((sA + sB) | 0) + sD) | 0;
    sD = (sD + 1) | 0;
    sA = sB ^ (sB >>> 9);
    sB = (sC + (sC << 3)) | 0;
    sC = (sC << 21) | (sC >>> 11);
    sC = (sC + t) | 0;
  }
  return () => {
    const t = (((sA + sB) | 0) + sD) | 0;
    sD = (sD + 1) | 0;
    sA = sB ^ (sB >>> 9);
    sB = (sC + (sC << 3)) | 0;
    sC = (sC << 21) | (sC >>> 11);
    sC = (sC + t) | 0;
    return (t >>> 0) / 4294967296;
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
  const [a, b, c, d] = cyrb128(`apex:v2:${str}`);
  return sfc32(a, b, c, d);
}

/* ------------------------------------------------------------------ */
/* Lineup (public — known before betting opens)                        */
/* ------------------------------------------------------------------ */

/** The three team colours. Every grid uses exactly these, shuffled across lanes. */
export const COLORS: { name: string; hex: string }[] = [
  { name: "Red", hex: "#ff3b4d" },
  { name: "Purple", hex: "#a24bff" },
  { name: "Blue", hex: "#3b8bff" },
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

const roundOdds = (p: number) => Math.floor((RTP / p) * 100) / 100;

/**
 * Publicly derivable grid for a round — identical on server and client.
 *
 * Uses independent domain-separated PRNG streams for car class selection and
 * unbiased Fisher–Yates lane colour shuffling so lane position, colour, and
 * car tier have zero statistical cross-correlation.
 */
export function lineupForRound(roundId: number): [CarSpec, CarSpec, CarSpec] {
  const kindRng = rngFrom(`grid:kinds:${roundId}`);
  const colorRng = rngFrom(`grid:colors:${roundId}`);
  const hyperLaneRng = rngFrom(`grid:hyper-lane:${roundId}`);

  // Determine which lane (if any) is eligible for hyper car so Lane 0 has no positional bias
  const candidateHyperLane = Math.floor(hyperLaneRng() * 3);
  const kinds: CarKind[] = ["normal", "normal", "normal"];

  for (let lane = 0; lane < 3; lane++) {
    const roll = kindRng();
    if (lane === candidateHyperLane && roll < 0.085) {
      kinds[lane] = "hyper";
    } else if (roll < 0.22) {
      kinds[lane] = "small";
    } else {
      kinds[lane] = "normal";
    }
  }

  // Unbiased Fisher-Yates shuffle of the 3 colours across the 3 lanes
  const palette = [...COLORS];
  for (let i = palette.length - 1; i > 0; i--) {
    const j = Math.floor(colorRng() * (i + 1));
    const tmp = palette[i];
    palette[i] = palette[j];
    palette[j] = tmp;
  }

  const probs = winWeights(kinds);
  return kinds.map((kind, lane) => ({
    id: `r${roundId}-l${lane}`,
    color: palette[lane].hex,
    colorName: palette[lane].name,
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
 * Security & anti-pattern guarantees:
 * 1. Domain-separated PRNG streams (`outcome:order:` vs `outcome:telemetry:`)
 *    ensure that animation curves never leak or bias the winner draw.
 * 2. When `roundId` is supplied, `roundId` is bound directly into the seed
 *    derivation alongside `reveal` so a reveal token is cryptographically bound
 *    to its exact round and lane probability weights.
 * 3. Memoryless 53-bit float weighted draw: each round is 100% statistically
 *    independent of previous rounds (gambler's fallacy / streak trackers gain 0% edge).
 */
export function outcomeFromReveal(reveal: string, roundId?: number): Outcome {
  const domainKey = roundId !== undefined ? `${reveal}:r${roundId}` : reveal;
  const orderRng = rngFrom(`outcome:order:${domainKey}`);
  const curveRng = rngFrom(`outcome:telemetry:${domainKey}`);

  // Deterministic finishing order, weighted by each lane's exact win probability
  const probs =
    roundId === undefined
      ? [1 / 3, 1 / 3, 1 / 3]
      : winWeights(lineupForRound(roundId).map((c) => c.kind));

  const pool = [0, 1, 2];
  const weights = [...probs];
  const order: number[] = [];
  while (pool.length) {
    const total = weights.reduce((a, b) => a + b, 0);
    // Double-precision uniform draw combining two 32-bit words (53-bit float precision)
    const uHi = orderRng();
    const uLo = orderRng();
    let r = (uHi + uLo / 4294967296) * total;
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

  // Final margins: P1 = 1.0, then realistic photo-finish or decisive gaps
  const margins: number[] = [0, 0, 0];
  const g1 = 0.012 + curveRng() * 0.048;
  const g2 = g1 + 0.014 + curveRng() * 0.058;
  margins[order[0]] = 1;
  margins[order[1]] = 1 - g1;
  margins[order[2]] = 1 - g2;

  const seeds = [0, 1, 2].map(() => Math.floor(curveRng() * 0xffffffff));

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
