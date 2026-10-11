import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  MAX_BET_PAISE,
  MAX_DEPOSIT_PAISE,
  MIN_BET_PAISE,
  MIN_DEPOSIT_PAISE,
  assertBettingOpen,
  closeRazorpayQr,
  createRazorpayQr,
  fetchQrPayments,
  isRoundSettleable,
  laneMultiplier,
  winnerLaneFor,
} from "./wallet.server";

export interface WalletState {
  balancePaise: number;
  heldPaise: number;
  availablePaise: number;
  phone: string;
  activeBet: { roundId: number; lane: number; amountPaise: number; multiplier: number } | null;
}

async function computeWalletBalances(supabaseAdmin: any, userId: string) {
  const [{ data: profile, error }, { data: pendingWithdrawals }] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("phone, balance_paise, is_banned")
      .eq("id", userId)
      .maybeSingle(),
    supabaseAdmin
      .from("withdrawals")
      .select("amount_paise")
      .eq("user_id", userId)
      .eq("status", "pending"),
  ]);
  if (error) throw new Error(error.message);
  if (!profile) throw new Error("Profile not found");

  const balancePaise = Math.max(0, Number(profile.balance_paise ?? 0));
  const heldPaise = (pendingWithdrawals ?? []).reduce(
    (sum: number, w: { amount_paise?: unknown }) => sum + Math.max(0, Number(w.amount_paise ?? 0)),
    0,
  );
  const availablePaise = Math.max(0, balancePaise - heldPaise);

  return {
    phone: String(profile.phone ?? ""),
    isBanned: Boolean(profile.is_banned),
    balancePaise,
    heldPaise,
    availablePaise,
  };
}

/** Current balance + held payout amount + the bet (if any) that is still riding on a live round. */
export const getWallet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WalletState> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { phone, balancePaise, heldPaise, availablePaise } = await computeWalletBalances(
      supabaseAdmin,
      userId,
    );

    const { data: bet } = await supabaseAdmin
      .from("bets")
      .select("round_id, lane, amount_paise, multiplier, status")
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("round_id", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      balancePaise,
      heldPaise,
      availablePaise,
      phone,
      activeBet: bet
        ? {
            roundId: Number(bet.round_id),
            lane: Number(bet.lane),
            amountPaise: Number(bet.amount_paise),
            multiplier: Number(bet.multiplier),
          }
        : null,
    };
  });

export const placeBet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { roundId: number; lane: number; amountPaise: number }) => {
    const { roundId, lane, amountPaise } = data ?? {};
    if (!Number.isInteger(roundId)) throw new Error("Invalid race round.");
    if (!Number.isInteger(lane) || lane < 0 || lane > 2) throw new Error("Select a valid car lane.");
    if (!Number.isInteger(amountPaise) || amountPaise < MIN_BET_PAISE)
      throw new Error("Minimum bet is ₹10.");
    if (amountPaise > MAX_BET_PAISE) throw new Error("Maximum bet per round is ₹1,00,000.");
    return { roundId, lane, amountPaise };
  })
  .handler(async ({ data, context }) => {
    assertBettingOpen(data.roundId);
    const multiplier = laneMultiplier(data.roundId, data.lane);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Prevent spending funds currently reserved for a pending 24h payout
    const { availablePaise } = await computeWalletBalances(supabaseAdmin, context.userId);
    if (data.amountPaise > availablePaise) {
      throw new Error(
        "Insufficient available balance (funds reserved for a pending payout cannot be staked).",
      );
    }

    const { data: rows, error } = await supabaseAdmin.rpc("place_bet", {
      p_user_id: context.userId,
      p_round_id: data.roundId,
      p_lane: data.lane,
      p_amount_paise: data.amountPaise,
      p_multiplier: multiplier,
    });
    if (error) {
      const msg = error.message.includes("duplicate key")
        ? "You already placed a bet on this round."
        : error.message.replace(/^.*ERROR:\s*/, "").replace(/^[A-Z_]+:\s*/, "");
      throw new Error(msg);
    }
    const row = Array.isArray(rows) ? rows[0] : rows;
    const { heldPaise } = await computeWalletBalances(supabaseAdmin, context.userId);
    const totalBalancePaise = Number(row?.out_balance_paise ?? 0);
    return {
      betId: row?.out_bet_id as string,
      balancePaise: totalBalancePaise,
      heldPaise,
      availablePaise: Math.max(0, totalBalancePaise - heldPaise),
      multiplier,
    };
  });

/** Settles the caller's bet for a finished round. Idempotent and server-decided. */
export const settleRound = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { roundId: number }) => {
    if (!Number.isInteger(data?.roundId)) throw new Error("Invalid round");
    return { roundId: data.roundId };
  })
  .handler(async ({ data, context }) => {
    if (!isRoundSettleable(data.roundId)) {
      throw new Error("Round is still running");
    }
    const winnerLane = await winnerLaneFor(data.roundId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("settle_bet", {
      p_user_id: context.userId,
      p_round_id: data.roundId,
      p_winner_lane: winnerLane,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(rows) ? rows[0] : rows;
    const { heldPaise } = await computeWalletBalances(supabaseAdmin, context.userId);
    const totalBalancePaise = Number(row?.out_balance_paise ?? 0);
    return {
      winnerLane,
      status: (row?.out_status as string) ?? "none",
      payoutPaise: Number(row?.out_payout_paise ?? 0),
      balancePaise: totalBalancePaise,
      heldPaise,
      availablePaise: Math.max(0, totalBalancePaise - heldPaise),
    };
  });

export interface CreateDepositResult {
  ok?: boolean;
  error?: string;
  depositId: string;
  qrImageUrl: string;
  qrContent: string | null;
  cleanQrDataUrl: string | null;
  amountPaise: number;
}

export const createDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { amountPaise: number }) => {
    const amountPaise = Number(data?.amountPaise ?? 0);
    return { amountPaise };
  })
  .handler(async ({ data, context }): Promise<CreateDepositResult> => {
    const emptyResult = (errorMsg: string): CreateDepositResult => ({
      ok: false,
      error: errorMsg,
      depositId: "",
      qrImageUrl: "",
      qrContent: null,
      cleanQrDataUrl: null,
      amountPaise: data.amountPaise,
    });

    if (!Number.isInteger(data.amountPaise) || data.amountPaise < MIN_DEPOSIT_PAISE) {
      return emptyResult("Minimum deposit is ₹10.");
    }
    if (data.amountPaise > MAX_DEPOSIT_PAISE) {
      return emptyResult("Maximum single deposit is ₹2,00,000.");
    }

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { isBanned } = await computeWalletBalances(supabaseAdmin, context.userId);
      if (isBanned) {
        return emptyResult("Deposits are unavailable while this account is suspended.");
      }

      const { data: dep, error } = await supabaseAdmin
        .from("deposits")
        .insert({ user_id: context.userId, amount_paise: data.amountPaise })
        .select("id")
        .single();
      if (error || !dep) {
        return emptyResult(error?.message || "Could not start your deposit. Please try again.");
      }

      const qr = await createRazorpayQr(data.amountPaise, dep.id, context.userId);
      const cleanImageUrl = qr.clean_qr_data_url || qr.image_url;
      await supabaseAdmin
        .from("deposits")
        .update({ qr_id: qr.id, qr_image_url: cleanImageUrl })
        .eq("id", dep.id);

      return {
        ok: true,
        depositId: dep.id,
        qrImageUrl: cleanImageUrl,
        qrContent: qr.image_content ?? null,
        cleanQrDataUrl: qr.clean_qr_data_url ?? null,
        amountPaise: data.amountPaise,
      };
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Payment service is temporarily unavailable. Please try again.";
      return emptyResult(message);
    }
  });

/** Polls Razorpay for the deposit and credits it exactly once. */
export const checkDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { depositId: string }) => {
    if (typeof data?.depositId !== "string" || data.depositId.length < 10)
      throw new Error("Invalid deposit");
    return { depositId: data.depositId };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: dep, error } = await supabaseAdmin
      .from("deposits")
      .select("id, user_id, amount_paise, qr_id, status")
      .eq("id", data.depositId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!dep || dep.user_id !== context.userId) throw new Error("Deposit not found");

    if (dep.status !== "paid" && dep.qr_id) {
      const payments = await fetchQrPayments(dep.qr_id);
      const expectedPaise = Number(dep.amount_paise);
      const captured = payments.find(
        (p) =>
          p.status === "captured" &&
          typeof p.id === "string" &&
          p.id.length > 0 &&
          Number(p.amount) >= expectedPaise,
      );
      if (captured) {
        await supabaseAdmin.rpc("credit_deposit", {
          p_deposit_id: dep.id,
          p_payment_id: captured.id,
          p_amount_paise: expectedPaise,
        });
        await closeRazorpayQr(dep.qr_id);
      }
    }

    const { data: fresh } = await supabaseAdmin
      .from("deposits")
      .select("status, amount_paise, paid_at")
      .eq("id", dep.id)
      .maybeSingle();
    const { balancePaise, heldPaise, availablePaise } = await computeWalletBalances(
      supabaseAdmin,
      context.userId,
    );

    return {
      status: fresh?.status ?? "pending",
      amountPaise: Number(fresh?.amount_paise ?? dep.amount_paise ?? 0),
      paidAt: (fresh?.paid_at as string | null) ?? null,
      balancePaise,
      heldPaise,
      availablePaise,
    };
  });

/** A player asks for a payout. Money is reserved immediately and debited after the 24-hour verification window. */
export const requestWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { amountPaise: number; upiId: string }) => {
    const amountPaise = data?.amountPaise;
    const upiId = (data?.upiId ?? "").trim().toLowerCase();
    if (!Number.isInteger(amountPaise) || amountPaise < 10000)
      throw new Error("Minimum payout is ₹100.");
    if (amountPaise > MAX_DEPOSIT_PAISE)
      throw new Error("Maximum single payout is ₹2,00,000.");
    if (!/^[\w.\-]{2,64}@[a-zA-Z]{2,32}$/.test(upiId))
      throw new Error("Enter a valid UPI ID (for example, name@upi).");
    return { amountPaise, upiId };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("request_withdrawal", {
      p_user_id: context.userId,
      p_amount_paise: data.amountPaise,
      p_upi_id: data.upiId,
    });
    if (error) throw new Error(error.message.replace(/^.*ERROR:\s*/, "").replace(/^[A-Z_]+:\s*/, ""));
    const { balancePaise, heldPaise, availablePaise } = await computeWalletBalances(
      supabaseAdmin,
      context.userId,
    );
    return { ok: true as const, balancePaise, heldPaise, availablePaise };
  });

/** The player's own payout requests, newest first. */
export const myWithdrawals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("withdrawals")
      .select("id, amount_paise, upi_id, status, admin_note, created_at, processed_at")
      .order("created_at", { ascending: false })
      .limit(20);
    return (data ?? []).map((w) => ({
      id: w.id as string,
      amountPaise: Number(w.amount_paise),
      upiId: w.upi_id as string,
      status: w.status as string,
      adminNote: (w.admin_note as string | null) ?? null,
      createdAt: w.created_at as string,
      processedAt: (w.processed_at as string | null) ?? null,
    }));
  });

/** The player's own bet history, newest first. */
export const myBets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("bets")
      .select("id, round_id, lane, amount_paise, multiplier, status, payout_paise, winner_lane, created_at")
      .order("round_id", { ascending: false })
      .limit(50);
    return (data ?? []).map((b) => ({
      id: b.id as string,
      roundId: Number(b.round_id),
      lane: Number(b.lane),
      amountPaise: Number(b.amount_paise),
      multiplier: Number(b.multiplier),
      status: b.status as string,
      payoutPaise: Number(b.payout_paise),
      winnerLane: b.winner_lane === null ? null : Number(b.winner_lane),
      createdAt: b.created_at as string,
    }));
  });

/** Safe, aggregate-only live numbers for the HUD (no personal data). */
export const liveStats = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.rpc("public_stats");
    const row = Array.isArray(data) ? data[0] : data;
    return {
      players: Number(row?.players ?? 0),
      stakedPaise: Number(row?.staked_paise ?? 0),
      betsToday: Number(row?.bets_today ?? 0),
    };
  } catch {
    return { players: 0, stakedPaise: 0, betsToday: 0 };
  }
});
