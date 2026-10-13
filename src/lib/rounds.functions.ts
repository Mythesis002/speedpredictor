import { createServerFn } from "@tanstack/react-start";
import {
  LOCK_OFFSET_MS,
  ROUND_MS,
  outcomeFromReveal,
  roundIdAt,
  roundLockMs,
  roundStartMs,
} from "./round-engine";
import { perRoundSecret } from "./wallet.server";

/**
 * Server authority for the race schedule and results.
 *
 * The browser only needs two things from the server: an accurate clock and,
 * once betting has closed, the revealed per-round secret. Everything else
 * (grid, pace curves, rendering) is derived locally from those values, so the
 * animation never depends on network latency.
 */

const encoder = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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
 * Reveals a round's secret. Refuses while bets are still open (plus a 150 ms
 * post-lock isolation guard), which guarantees a 550 ms total dead-zone between
 * the last possible bet acceptance (`lockMs - 400ms`) and the first possible
 * secret reveal (`lockMs + 150ms`). No client can ever learn the result early.
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

    if (roundId > roundIdAt(now) || now < roundLockMs(roundId) + 150) {
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

/** The last 50 finished races, straight from the database. */
export const recentResults = createServerFn({ method: "GET" }).handler(
  async (): Promise<RoundResult[]> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data } = await supabaseAdmin
        .from("rounds")
        .select("round_id, winner_lane, created_at")
        .order("round_id", { ascending: false })
        .limit(50);
      return (data ?? []).map((r) => ({
        roundId: Number(r.round_id),
        winnerLane: Number(r.winner_lane),
        createdAt: r.created_at as string,
      }));
    } catch {
      return [];
    }
  },
);

