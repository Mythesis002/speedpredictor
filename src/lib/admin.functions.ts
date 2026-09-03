import { createServerFn } from "@tanstack/react-start";
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
async function assertAdmin(context: { supabase: any; userId: string }) {
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
    const startOfToday = new Date(new Date().toISOString().slice(0, 10)).getTime();

    const [profiles, deposits, transactions, bets, withdrawals] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, balance_paise, created_at"),
      supabaseAdmin.from("deposits").select("amount_paise, status, created_at, paid_at"),
      supabaseAdmin.from("transactions").select("kind, amount_paise, created_at"),
      supabaseAdmin.from("bets").select("amount_paise, payout_paise, status, created_at"),
      supabaseAdmin.from("withdrawals").select("amount_paise, status"),
    ]);

    const P = profiles.data ?? [];
    const D = deposits.data ?? [];
    const B = bets.data ?? [];
    const W = withdrawals.data ?? [];
    const T = transactions.data ?? [];

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

    const [{ data: profiles }, { data: deposits }, { data: bets }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, phone, balance_paise, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseAdmin.from("deposits").select("user_id, amount_paise, status"),
      supabaseAdmin.from("bets").select("user_id, amount_paise, payout_paise"),
    ]);

    return (profiles ?? []).map((p) => {
      const myDeposits = (deposits ?? []).filter((d) => d.user_id === p.id && d.status === "paid");
      const myBets = (bets ?? []).filter((b) => b.user_id === p.id);
      return {
        id: p.id,
        phone: p.phone,
        balancePaise: Number(p.balance_paise),
        depositedPaise: sum(myDeposits, "amount_paise"),
        stakedPaise: sum(myBets, "amount_paise"),
        wonPaise: sum(myBets, "payout_paise"),
        bets: myBets.length,
        joinedAt: p.created_at,
      };
    });
  });

/** Approve (pays the player out and debits their wallet) or reject a payout request. */
export const actOnWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { withdrawalId: string; action: "approve" | "reject"; note?: string }) => {
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
