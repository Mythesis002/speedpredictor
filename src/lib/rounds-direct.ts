import {
  LOCK_OFFSET_MS,
  ROUND_MS,
  outcomeFromReveal,
  roundIdAt,
  roundLockMs,
  roundStartMs,
} from "./round-engine";
import { perRoundSecret } from "./wallet.server";

const encoder = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function commitFor(roundId: number): Promise<string> {
  const secret = await perRoundSecret(roundId);
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return toHex(digest);
}

export async function getRoundClockDirect() {
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
}

export async function revealRoundDirect(roundId: number) {
  const now = Date.now();

  if (roundId > roundIdAt(now) || now < roundLockMs(roundId) + 150) {
    return { ok: false as const, reason: "early" as const };
  }
  if (roundIdAt(now) - roundId > 500) {
    return { ok: false as const, reason: "expired" as const };
  }

  const [reveal, commit] = await Promise.all([perRoundSecret(roundId), commitFor(roundId)]);
  const { order } = outcomeFromReveal(reveal, roundId);

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

  return { ok: true as const, roundId, reveal, commit, order, winner: order[0] };
}
