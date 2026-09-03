import { createServerFn } from "@tanstack/react-start";
import {
  LOCK_OFFSET_MS,
  ROUND_MS,
  outcomeFromReveal,
  roundIdAt,
  roundLockMs,
  roundStartMs,
} from "./round-engine";

/**
 * Server authority for the race schedule and results.
 *
 * The browser only needs two things from the server: an accurate clock and,
 * once betting has closed, the revealed per-round secret. Everything else
 * (grid, pace curves, rendering) is derived locally from those values, so the
 * animation never depends on network latency.
 */

const FALLBACK_MASTER_SEED = "speed-predict-dev-master-seed";

function masterSeed(): string {
  // read at call time: env is injected per-request on the edge runtime
  return process.env["RACE_MASTER_SEED"] || FALLBACK_MASTER_SEED;
}

const encoder = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** perRoundSecret = HMAC-SHA256(masterSeed, roundId) — never leaves the server before lock. */
async function perRoundSecret(roundId: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(masterSeed()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(`round:${roundId}`));
  return toHex(sig);
}

/** commit = SHA-256(perRoundSecret) — published before betting opens. */
async function commitFor(roundId: number): Promise<string> {
  const secret = await perRoundSecret(roundId);
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return toHex(digest);
}

export interface RoundClock {
  serverNow: number;
  roundId: number;
  roundStart: number;
  roundLength: number;
  lockAt: number;
  /** commitment for the round currently accepting bets */
  commit: string;
  /** commitment for the following round, so clients never see an unverified grid */
  nextCommit: string;
  /** revealed secret of the previous round (always safe to publish) */
  prevRoundId: number;
  prevReveal: string;
}

/** Clock + commitments. Cheap, cacheable, called on mount and on refocus. */
export const getRoundClock = createServerFn({ method: "GET" }).handler(
  async (): Promise<RoundClock> => {
    const serverNow = Date.now();
    const roundId = roundIdAt(serverNow);
    const [commit, nextCommit, prevReveal] = await Promise.all([
      commitFor(roundId),
      commitFor(roundId + 1),
      perRoundSecret(roundId - 1),
    ]);
    return {
      serverNow,
      roundId,
      roundStart: roundStartMs(roundId),
      roundLength: ROUND_MS,
      lockAt: roundStartMs(roundId) + LOCK_OFFSET_MS,
      commit,
      nextCommit,
      prevRoundId: roundId - 1,
      prevReveal,
    };
  },
);

export interface RoundReveal {
  roundId: number;
  reveal: string;
  commit: string;
  order: [number, number, number];
  winner: number;
}

export type RevealResult = ({ ok: true } & RoundReveal) | { ok: false; reason: "early" | "expired" };

/**
 * Reveals a round's secret. Refuses while bets are still open, which is what
 * makes the commitment meaningful — no client can learn the result early.
 * Refusals are returned as data (never thrown) so a client that asks a few ms
 * early doesn't surface an unhandled Response error.
 */
export const revealRound = createServerFn({ method: "GET" })
  .inputValidator((data: unknown): { roundId: number } => {
    const raw = (data as { roundId?: unknown } | undefined)?.roundId;
    const roundId = typeof raw === "string" ? Number(raw) : raw;
    if (typeof roundId !== "number" || !Number.isFinite(roundId) || !Number.isInteger(roundId)) {
      throw new Error("roundId must be an integer");
    }
    return { roundId };
  })
  .handler(async ({ data }): Promise<RevealResult> => {
    const { roundId } = data;
    const now = Date.now();

    if (roundId > roundIdAt(now) || now < roundLockMs(roundId)) {
      return { ok: false, reason: "early" };
    }
    // don't serve ancient history; keeps the endpoint bounded
    if (roundIdAt(now) - roundId > 500) {
      return { ok: false, reason: "expired" };
    }


    const [reveal, commit] = await Promise.all([perRoundSecret(roundId), commitFor(roundId)]);
    const { order } = outcomeFromReveal(reveal, roundId);
    return { ok: true, roundId, reveal, commit, order, winner: order[0] };
  });
