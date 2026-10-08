import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface AdminOverview {
  players: { total: number; today: number; week: number; withBalance: number };
  money: {
    depositedPaise: number;
    depositsPendingPaise: number;
    depositsPendingCount: number;
    depositedTodayPaise: number;
    withdrawnPaise: number;
    withdrawPendingPaise: number;
    withdrawPendingCount: number;
    liabilityPaise: number;
    bonusPaise: number;
  };
  game: {
    stakedPaise: number;
    paidOutPaise: number;
    grossPaise: number;
    todayStakedPaise: number;
    todayPaidOutPaise: number;
    todayGrossPaise: number;
    betsTotal: number;
    betsToday: number;
    betsPending: number;
  };
}

export interface AdminWithdrawal {
  id: string;
  phone: string;
  amountPaise: number;
  upiId: string;
  status: string;
  adminNote: string | null;
  balancePaise: number;
  createdAt: string;
}

export interface AdminDeposit {
  id: string;
  phone: string;
  amountPaise: number;
  status: string;
  createdAt: string;
  paidAt: string | null;
}

export interface AdminPlayer {
  isBanned: boolean;
  bannedReason: string | null;
  id: string;
  phone: string;
  balancePaise: number;
  depositedPaise: number;
  stakedPaise: number;
  wonPaise: number;
  bets: number;
  joinedAt: string;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Every admin function verifies the caller's role through their own RLS session. */
async function assertAdmin(context: { supabase: Pick<SupabaseClient, "rpc">; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

function sum(rows: { [k: string]: unknown }[] | null, key: string): number {
  return (rows ?? []).reduce((t, r) => t + Number(r[key] ?? 0), 0);
}

const PAGE_SIZE = 1000;

interface PagedSelect {
  from(table: string): {
    select(columns: string): {
      order(
        column: string,
        opts: { ascending: boolean },
      ): {
        range(
          from: number,
          to: number,
        ): PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
      };
    };
  };
}

/**
 * Reads every row of a table, page by page. PostgREST silently caps an unpaged
 * read (1,000 rows by default), which would make admin totals quietly stop
 * growing once the game gets busy. Ordering by `id` keeps the pages stable.
 */
async function selectAll<T>(table: string, columns: string): Promise<T[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const client = supabaseAdmin as unknown as PagedSelect;
  const out: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from(table)
      .select(columns)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as T[];
    out.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Server functions                                                    */
/* ------------------------------------------------------------------ */

/** True when the signed-in account is an owner/admin. Used to reveal the portal link. */
export const amIAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<boolean> => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return Boolean(data);
  });

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const now = Date.now();
    // "today" is the Indian calendar day (IST = UTC+05:30), not UTC midnight
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const startOfToday = Math.floor((now + IST_OFFSET_MS) / DAY_MS) * DAY_MS - IST_OFFSET_MS;

    const [P, D, T, B, W] = await Promise.all([
      selectAll<{ id: string; balance_paise: number; created_at: string }>(
        "profiles",
        "id, balance_paise, created_at",
      ),
      selectAll<{
        amount_paise: number;
        status: string;
        created_at: string;
        paid_at: string | null;
      }>("deposits", "amount_paise, status, created_at, paid_at"),
      selectAll<{ kind: string; amount_paise: number; created_at: string }>(
        "transactions",
        "kind, amount_paise, created_at",
      ),
      selectAll<{
        amount_paise: number;
        payout_paise: number;
        status: string;
        created_at: string;
      }>("bets", "amount_paise, payout_paise, status, created_at"),
      selectAll<{ amount_paise: number; status: string }>("withdrawals", "amount_paise, status"),
    ]);

    const paidDeposits = D.filter((d) => d.status === "paid");
    const pendingDeposits = D.filter((d) => d.status !== "paid");
    const todayBets = B.filter((b) => new Date(b.created_at).getTime() >= startOfToday);

    const staked = sum(B, "amount_paise");
    const paidOut = sum(B, "payout_paise");
    const todayStaked = sum(todayBets, "amount_paise");
    const todayPaidOut = sum(todayBets, "payout_paise");

    const overview: AdminOverview = {
      players: {
        total: P.length,
        today: P.filter((p) => new Date(p.created_at).getTime() >= startOfToday).length,
        week: P.filter((p) => now - new Date(p.created_at).getTime() <= 7 * DAY_MS).length,
        withBalance: P.filter((p) => Number(p.balance_paise) > 0).length,
      },
      money: {
        depositedPaise: sum(paidDeposits, "amount_paise"),
        depositsPendingPaise: sum(pendingDeposits, "amount_paise"),
        depositsPendingCount: pendingDeposits.length,
        depositedTodayPaise: sum(
          paidDeposits.filter((d) => new Date(d.paid_at ?? d.created_at).getTime() >= startOfToday),
          "amount_paise",
        ),
        withdrawnPaise: sum(
          W.filter((w) => w.status === "paid"),
          "amount_paise",
        ),
        withdrawPendingPaise: sum(
          W.filter((w) => w.status === "pending"),
          "amount_paise",
        ),
        withdrawPendingCount: W.filter((w) => w.status === "pending").length,
        liabilityPaise: sum(P, "balance_paise"),
        bonusPaise: sum(
          T.filter((t) => t.kind === "signup_bonus"),
          "amount_paise",
        ),
      },
      game: {
        stakedPaise: staked,
        paidOutPaise: paidOut,
        grossPaise: staked - paidOut,
        todayStakedPaise: todayStaked,
        todayPaidOutPaise: todayPaidOut,
        todayGrossPaise: todayStaked - todayPaidOut,
        betsTotal: B.length,
        betsToday: todayBets.length,
        betsPending: B.filter((b) => b.status === "pending").length,
      },
    };

    return overview;
  });

export const listWithdrawals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminWithdrawal[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin
      .from("withdrawals")
      .select("id, user_id, amount_paise, upi_id, status, admin_note, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const ids = [...new Set((data ?? []).map((w) => w.user_id))];
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, phone, balance_paise")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

    return (data ?? []).map((w) => ({
      id: w.id,
      phone: byId.get(w.user_id)?.phone ?? "—",
      amountPaise: Number(w.amount_paise),
      upiId: w.upi_id,
      status: w.status,
      adminNote: w.admin_note,
      balancePaise: Number(byId.get(w.user_id)?.balance_paise ?? 0),
      createdAt: w.created_at,
    }));
  });

export const listDeposits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminDeposit[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin
      .from("deposits")
      .select("id, user_id, amount_paise, status, created_at, paid_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const ids = [...new Set((data ?? []).map((d) => d.user_id))];
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, phone")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const byId = new Map((profiles ?? []).map((p) => [p.id, p.phone]));

    return (data ?? []).map((d) => ({
      id: d.id,
      phone: byId.get(d.user_id) ?? "—",
      amountPaise: Number(d.amount_paise),
      status: d.status,
      createdAt: d.created_at,
      paidAt: d.paid_at,
    }));
  });

export const listPlayers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminPlayer[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: profiles }, deposits, bets] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, phone, balance_paise, created_at, is_banned, banned_reason")
        .order("created_at", { ascending: false })
        .limit(200),
      selectAll<{ user_id: string; amount_paise: number; status: string }>(
        "deposits",
        "user_id, amount_paise, status",
      ),
      selectAll<{ user_id: string; amount_paise: number; payout_paise: number }>(
        "bets",
        "user_id, amount_paise, payout_paise",
      ),
    ]);

    // group once instead of re-scanning every row for every player
    const paidByUser = new Map<string, typeof deposits>();
    for (const d of deposits) {
      if (d.status !== "paid") continue;
      paidByUser.set(d.user_id, [...(paidByUser.get(d.user_id) ?? []), d]);
    }
    const betsByUser = new Map<string, typeof bets>();
    for (const b of bets) {
      betsByUser.set(b.user_id, [...(betsByUser.get(b.user_id) ?? []), b]);
    }

    return (profiles ?? []).map((p) => {
      const myDeposits = paidByUser.get(p.id) ?? [];
      const myBets = betsByUser.get(p.id) ?? [];
      return {
        id: p.id,
        phone: p.phone,
        balancePaise: Number(p.balance_paise),
        depositedPaise: sum(myDeposits, "amount_paise"),
        stakedPaise: sum(myBets, "amount_paise"),
        wonPaise: sum(myBets, "payout_paise"),
        bets: myBets.length,
        joinedAt: p.created_at,
        isBanned: Boolean(p.is_banned),
        bannedReason: p.banned_reason ?? null,
      };
    });
  });

/** Approve (pays the player out and debits their wallet) or reject a payout request. */
export const actOnWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { withdrawalId: string; action: "approve" | "reject"; note?: string }) => {
    if (typeof data?.withdrawalId !== "string" || data.withdrawalId.length < 10)
      throw new Error("Invalid request");
    if (data.action !== "approve" && data.action !== "reject") throw new Error("Invalid action");
    return {
      withdrawalId: data.withdrawalId,
      action: data.action,
      note: typeof data.note === "string" ? data.note.slice(0, 300) : undefined,
    };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin.rpc("process_withdrawal", {
      p_withdrawal_id: data.withdrawalId,
      p_action: data.action,
      p_note: data.note,
    });
    if (error) throw new Error(error.message.replace(/^.*ERROR:\s*/, ""));
    const row = Array.isArray(rows) ? rows[0] : rows;
    return {
      status: (row?.out_status as string) ?? "pending",
      balancePaise: Number(row?.out_balance_paise ?? 0),
    };
  });

/** Payment wiring status — flips to live automatically once real keys are saved. */
export const getPaymentsStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const id = process.env["RAZORPAY_KEY_ID"] ?? "";
    return {
      configured: Boolean(id && process.env["RAZORPAY_KEY_SECRET"]),
      webhookReady: Boolean(process.env["RAZORPAY_WEBHOOK_SECRET"]),
      mode: id.startsWith("rzp_live") ? "live" : id ? "test" : "none",
      keyIdMasked: id ? `${id.slice(0, 12)}…` : null,
    };
  });

export interface AdminRound {
  roundId: number;
  winnerLane: number;
  createdAt: string;
}

/** Last 50 race outcomes exactly as stored in the database. */
export const listRounds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminRound[]> => {
    await assertAdmin(context);
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
  });

const reasonOk = (r: unknown) => typeof r === "string" && r.trim().length >= 3 && r.length <= 300;

/** Ban or unban a player. A reason is mandatory and every action is written to the audit log. */
export const setPlayerBan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { userId: string; banned: boolean; reason: string }) => {
    if (typeof d?.userId !== "string" || d.userId.length < 10) throw new Error("Invalid player");
    if (typeof d.banned !== "boolean") throw new Error("Invalid action");
    if (!reasonOk(d.reason)) throw new Error("A reason is required");
    return { userId: d.userId, banned: d.banned, reason: d.reason.trim() };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("admin_set_ban", {
      p_actor: context.userId,
      p_user: data.userId,
      p_banned: data.banned,
      p_reason: data.reason,
    });
    if (error) throw new Error(error.message.replace(/^.*ERROR:\s*/, ""));
    return { ok: true as const };
  });

/** Credit (+) or debit (−) a player's wallet with a reason; recorded in ledger + audit log. */
export const adjustPlayerBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { userId: string; amountPaise: number; reason: string }) => {
    if (typeof d?.userId !== "string" || d.userId.length < 10) throw new Error("Invalid player");
    if (
      !Number.isInteger(d.amountPaise) ||
      d.amountPaise === 0 ||
      Math.abs(d.amountPaise) > 10_000_000
    )
      throw new Error("Invalid amount");
    if (!reasonOk(d.reason)) throw new Error("A reason is required");
    return { userId: d.userId, amountPaise: d.amountPaise, reason: d.reason.trim() };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: bal, error } = await supabaseAdmin.rpc("admin_adjust_balance", {
      p_actor: context.userId,
      p_user: data.userId,
      p_amount_paise: data.amountPaise,
      p_reason: data.reason,
    });
    if (error) throw new Error(error.message.replace(/^.*ERROR:\s*/, ""));
    return { balancePaise: Number(bal ?? 0) };
  });
