import { createServerFn } from "@tanstack/react-start";
import { getRoundClockDirect, revealRoundDirect, type commitFor } from "./rounds-direct";

export interface RoundClock {
  serverNow: number;
  roundId: number;
  roundStart: number;
  roundLength: number;
  lockAt: number;
  commit: string;
  nextCommit: string;
  prevRoundId: number;
  prevReveal: string;
}

export const getRoundClock = createServerFn({ method: "GET" }).handler(
  async (): Promise<RoundClock> => {
    return await getRoundClockDirect();
  },
);

export interface RoundReveal {
  roundId: number;
  reveal: string;
  commit: string;
  order: [number, number, number];
  winner: number;
}

export type RevealResult =
  ({ ok: true } & RoundReveal) | { ok: false; reason: "early" | "expired" };

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
    return await revealRoundDirect(data.roundId);
  });

export interface RoundResult {
  roundId: number;
  winnerLane: number;
  createdAt: string;
}

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
