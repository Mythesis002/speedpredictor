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

function masterSeed(): string {
  // read at call time: env is injected per-request on the edge runtime
  const seed = process.env["RACE_MASTER_SEED"];
  if (!seed || seed.length < 32) throw new Error("Race service is temporarily unavailable");
  return seed;
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
  .validator((data: unknown): { roundId: number } => {
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
    // persist the finished race so results history is real and shared by
    // every device (best effort — never block the reveal on a DB hiccup)
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("rounds").upsert(
        {
          round_id: roundId,
          winner_lane: order[0],
          finish_order: order,
          commit_hash: commit,
          reveal,
        },
        { onConflict: "round_id" },
      );
    } catch {
      /* results are derivable from the reveal anyway */
    }

    return { ok: true, roundId, reveal, commit, order, winner: order[0] };
  });

export interface RoundResult {
  roundId: number;
  winnerLane: number;
  createdAt: string;
}

/**
 * The last 50 finished races, shared by every player.
 *
 * A new account must not land on an empty teaching surface while the database
 * is warming up (or before this device has caused a result to be persisted).
 * Missing rows are therefore backfilled from the same server-authoritative
 * round engine. Persisted rows always win, so this never invents a different
 * result for a round we already have on record.
 */
export const recentResults = createServerFn({ method: "GET" }).handler(
  async (): Promise<RoundResult[]> => {
    const now = Date.now();
    const currentRound = roundIdAt(now);
    const persisted = new Map<number, RoundResult>();

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data } = await supabaseAdmin
        .from("rounds")
        .select("round_id, winner_lane, created_at")
        .order("round_id", { ascending: false })
        .limit(50);

      for (const row of data ?? []) {
        const roundId = Number(row.round_id);
        const winnerLane = Number(row.winner_lane);
        if (Number.isInteger(roundId) && Number.isInteger(winnerLane)) {
          persisted.set(roundId, {
            roundId,
            winnerLane,
            createdAt: String(row.created_at),
          });
        }
      }
    } catch {
      // The deterministic fallback below keeps onboarding useful if storage is unavailable.
    }

    const results: RoundResult[] = [];
    for (let roundId = currentRound - 1; results.length < 50 && roundId > 0; roundId -= 1) {
      const stored = persisted.get(roundId);
      if (stored) {
        results.push(stored);
        continue;
      }

      const reveal = await perRoundSecret(roundId);
      const { order } = outcomeFromReveal(reveal, roundId);
      results.push({
        roundId,
        winnerLane: order[0],
        createdAt: new Date(roundStartMs(roundId) + ROUND_MS).toISOString(),
      });
    }

    return results;
  },
);

