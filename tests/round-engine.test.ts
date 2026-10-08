/**
 * Focused checks for the deterministic race and odds engine.
 *
 * Run with:  npm test
 * (Node's built-in test runner — no extra dependency needed.)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LOCK_OFFSET_MS,
  PHASE_MS,
  PHASE_ORDER,
  ROUND_MS,
  RTP,
  COLORS,
  lineupForRound,
  outcomeFromReveal,
  roundIdAt,
  roundLockMs,
  roundStartMs,
  timelineAt,
  winWeights,
  type CarKind,
} from "../src/lib/round-engine.ts";

const SAMPLE_ROUNDS = Array.from({ length: 400 }, (_, i) => 330_000 + i * 7);

test("phase durations add up to one round and the lock sits before the race", () => {
  const total = PHASE_ORDER.reduce((s, p) => s + PHASE_MS[p], 0);
  assert.equal(ROUND_MS, total);
  assert.equal(LOCK_OFFSET_MS, PHASE_MS.waiting + PHASE_MS.prep);
  assert.ok(LOCK_OFFSET_MS < ROUND_MS);
});

test("round ids and start times are exact inverses", () => {
  for (const id of SAMPLE_ROUNDS) {
    const start = roundStartMs(id);
    assert.equal(roundIdAt(start), id, "first ms of a round belongs to that round");
    assert.equal(roundIdAt(start + ROUND_MS - 1), id, "last ms still belongs to it");
    assert.equal(roundIdAt(start + ROUND_MS), id + 1, "next ms starts the next round");
    assert.equal(roundLockMs(id), start + LOCK_OFFSET_MS);
  }
});

test("timeline walks through every phase in order", () => {
  const id = 340_000;
  const start = roundStartMs(id);
  const expectations: [number, string][] = [
    [0, "waiting"],
    [PHASE_MS.waiting, "prep"],
    [LOCK_OFFSET_MS, "lock"],
    [LOCK_OFFSET_MS + PHASE_MS.lock, "launch"],
    [LOCK_OFFSET_MS + PHASE_MS.lock + PHASE_MS.launch, "race"],
    [ROUND_MS - PHASE_MS.finish, "finish"],
  ];
  for (const [offset, phase] of expectations) {
    assert.equal(timelineAt(start + offset).phase, phase, `phase at +${offset}ms`);
  }
});

test("betting countdown reaches zero exactly at lock and stays there", () => {
  const start = roundStartMs(340_000);
  assert.ok(timelineAt(start).countdown > 0);
  assert.equal(timelineAt(start + LOCK_OFFSET_MS).countdown, 0);
  assert.equal(timelineAt(start + ROUND_MS - 1).countdown, 0);
});

test("race progress is 0 before the launch and 1 once the race is over", () => {
  const start = roundStartMs(340_000);
  assert.equal(timelineAt(start).raceT, 0);
  assert.equal(timelineAt(start + LOCK_OFFSET_MS).raceT, 0);
  assert.equal(timelineAt(start + ROUND_MS - 1).raceT, 1);
});

test("the lineup is deterministic for a round", () => {
  for (const id of SAMPLE_ROUNDS.slice(0, 50)) {
    assert.deepEqual(lineupForRound(id), lineupForRound(id));
  }
});

test("every grid has three lanes, three different colours and at most one hyper car", () => {
  for (const id of SAMPLE_ROUNDS) {
    const grid = lineupForRound(id);
    assert.equal(grid.length, 3);
    const names = new Set(grid.map((c) => c.colorName));
    assert.equal(names.size, 3, `round ${id} repeated a colour`);
    for (const c of grid) {
      assert.ok(COLORS.some((x) => x.name === c.colorName));
    }
    assert.ok(grid.filter((c) => c.kind === "hyper").length <= 1, `round ${id} has two hyper cars`);
  }
});

test("payouts are above the stake and match RTP divided by win chance", () => {
  for (const id of SAMPLE_ROUNDS) {
    const grid = lineupForRound(id);
    const probs = winWeights(grid.map((c) => c.kind));
    grid.forEach((car, lane) => {
      assert.ok(car.multiplier > 1, `multiplier must exceed 1 (round ${id}, lane ${lane})`);
      // rounded to 2dp, so allow a hair of tolerance
      const expected = RTP / probs[lane];
      assert.ok(Math.abs(car.multiplier - expected) <= 0.005 + 1e-9, `round ${id} lane ${lane}`);
      // expected return per lane equals the house RTP (within rounding)
      assert.ok(Math.abs(probs[lane] * car.multiplier - RTP) < 0.02);
    });
  }
});

test("win probabilities sum to one", () => {
  const kinds: CarKind[][] = [
    ["normal", "normal", "normal"],
    ["hyper", "small", "normal"],
    ["small", "small", "small"],
  ];
  for (const k of kinds) {
    const sum = winWeights(k).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-12);
  }
});

test("outcome order is a permutation of the three lanes", () => {
  for (let i = 0; i < 200; i++) {
    const { order } = outcomeFromReveal(`reveal-${i}`, 340_000);
    assert.deepEqual([...order].sort(), [0, 1, 2]);
  }
});

test("outcome is deterministic for the same reveal", () => {
  const a = outcomeFromReveal("abc123", 340_001);
  const b = outcomeFromReveal("abc123", 340_001);
  assert.deepEqual(a.order, b.order);
  for (let lane = 0; lane < 3; lane++) {
    for (const t of [0, 0.25, 0.5, 0.9, 1]) {
      assert.equal(a.curves[lane](t), b.curves[lane](t));
    }
  }
});

test("pace curves end exactly on the published finish margins (P1 = 1.0, P2/P3 behind)", () => {
  const { order, curves } = outcomeFromReveal("finish-check", 340_002);
  const finals = curves.map((c) => c(1));
  assert.equal(finals[order[0]], 1);
  assert.ok(finals[order[1]] < 1 && finals[order[1]] > finals[order[2]]);
  assert.ok(finals[order[2]] > 0.8, "gaps stay tight, like a real race");
});

test("the empirical winner frequency converges on the published win chance", () => {
  // Pick a grid where the odds are clearly unequal, then simulate many reveals.
  const roundId = SAMPLE_ROUNDS.find((id) => {
    const kinds = lineupForRound(id).map((c) => c.kind);
    return kinds.includes("hyper") && kinds.includes("small");
  });
  assert.ok(roundId !== undefined, "need a sample round with mixed kinds");
  const probs = winWeights(lineupForRound(roundId).map((c) => c.kind));

  const trials = 20_000;
  const wins = [0, 0, 0];
  for (let i = 0; i < trials; i++) {
    wins[outcomeFromReveal(`sim-${roundId}-${i}`, roundId).order[0]]++;
  }
  probs.forEach((p, lane) => {
    const observed = wins[lane] / trials;
    assert.ok(Math.abs(observed - p) < 0.02, `lane ${lane}: observed ${observed}, expected ${p}`);
  });
});
