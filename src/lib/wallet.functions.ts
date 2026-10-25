import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  MAX_BET_PAISE,
  MAX_DEPOSIT_PAISE,
  MIN_BET_PAISE,
  MIN_DEPOSIT_PAISE,
  assertBettingOpen,
  closeRazorpayQr,
  createRazorpayOrder,
  createRazorpayQr,
  fetchPaymentDetails,
  fetchQrPayments,
  getRazorpayKeyId,
  isRoundSettleable,
  laneMultiplier,
  verifyRazorpayPaymentSignature,
  winnerLaneFor,
} from "./wallet.server";

export interface WalletState {
  balancePaise: number;
  heldPaise: number;
  availablePaise: number;
  phone: string;
  activeBet: { roundId: number; lane: number; amountPaise: number; multiplier: number } | null;
}
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

async function computeWalletBalances(supabaseAdmin: SupabaseClient<Database>, userId: string) {
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
    if (!Number.isInteger(lane) || lane < 0 || lane > 2)
      throw new Error("Select a valid car lane.");
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
  upiUri: string | null;
  amountPaise: number;
  razorpayKeyId?: string | null;
  razorpayOrderId?: string | null;
  userPhone?: string | null;
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
      upiUri: null,
      amountPaise: data.amountPaise,
      razorpayKeyId: null,
      razorpayOrderId: null,
      userPhone: null,
    });

    if (!Number.isInteger(data.amountPaise) || data.amountPaise < MIN_DEPOSIT_PAISE) {
      return emptyResult("Minimum deposit is ₹10.");
    }
    if (data.amountPaise > MAX_DEPOSIT_PAISE) {
      return emptyResult("Maximum single deposit is ₹2,00,000.");
    }

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { isBanned, phone } = await computeWalletBalances(supabaseAdmin, context.userId);
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

      const [qr, orderId] = await Promise.all([
        createRazorpayQr(data.amountPaise, dep.id, context.userId),
        createRazorpayOrder(data.amountPaise, dep.id, context.userId).catch(() => null),
      ]);

      const cleanImageUrl = qr.clean_qr_data_url || qr.image_url;
      const upiPayload = qr.image_content || qr.qr_string || null;
      await supabaseAdmin
        .from("deposits")
        .update({ qr_id: qr.id, qr_image_url: cleanImageUrl })
        .eq("id", dep.id);

      return {
        ok: true,
        depositId: dep.id,
        qrImageUrl: cleanImageUrl,
        qrContent: upiPayload,
        cleanQrDataUrl: qr.clean_qr_data_url ?? null,
        upiUri: upiPayload,
        amountPaise: data.amountPaise,
        razorpayKeyId: getRazorpayKeyId(),
        razorpayOrderId: orderId,
        userPhone: phone || null,
      };
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Payment service is temporarily unavailable. Please try again.";
      return emptyResult(message);
    }
  });

/**
 * Instantly verifies and credits a completed Razorpay Checkout payment.
 */
export const verifyAndCreditDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      depositId: string;
      razorpayPaymentId: string;
      razorpayOrderId?: string;
      razorpaySignature?: string;
    }) => {
      const { depositId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = data ?? {};
      if (!depositId || typeof depositId !== "string") {
        throw new Error("Invalid deposit ID.");
      }
      if (!razorpayPaymentId || typeof razorpayPaymentId !== "string") {
        throw new Error("Invalid payment ID.");
      }
      return {
        depositId,
        razorpayPaymentId,
        razorpayOrderId: razorpayOrderId || undefined,
        razorpaySignature: razorpaySignature || undefined,
      };
    },
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: dep, error } = await supabaseAdmin
      .from("deposits")
      .select("id, user_id, amount_paise, qr_id, status")
      .eq("id", data.depositId)
      .maybeSingle();

    if (error || !dep || dep.user_id !== context.userId) {
      throw new Error("Deposit record not found.");
    }

    const expectedPaise = Number(dep.amount_paise);

    if (dep.status !== "paid") {
      let isVerified = false;

      // 1. Signature verification
      if (data.razorpayOrderId && data.razorpaySignature) {
        isVerified = await verifyRazorpayPaymentSignature(
          data.razorpayOrderId,
          data.razorpayPaymentId,
          data.razorpaySignature,
        );
      }

      // 2. Direct Razorpay payment API verification
      if (!isVerified) {
        const payment = await fetchPaymentDetails(data.razorpayPaymentId);
        if (
          payment &&
          (payment.status === "captured" || payment.status === "authorized") &&
          Number(payment.amount) >= expectedPaise
        ) {
          isVerified = true;
        }
      }

      if (!isVerified) {
        throw new Error(
          "Payment verification failed. If your account was debited, it will credit shortly.",
        );
      }

      // Credit deposit atomically in DB (including ₹20 promotional bonus for ₹50 deposits)
      const bonusPaise = expectedPaise === 5000 ? 2000 : 0;
      await supabaseAdmin.rpc("credit_deposit", {
        p_deposit_id: dep.id,
        p_payment_id: data.razorpayPaymentId,
        p_amount_paise: expectedPaise + bonusPaise,
      });

      if (dep.qr_id) {
        await closeRazorpayQr(dep.qr_id);
      }
    }

    const { balancePaise, heldPaise, availablePaise } = await computeWalletBalances(
      supabaseAdmin,
      context.userId,
    );

    return {
      status: "paid",
      amountPaise: expectedPaise,
      balancePaise,
      heldPaise,
      availablePaise,
    };
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
        const bonusPaise = expectedPaise === 5000 ? 2000 : 0;
        await supabaseAdmin.rpc("credit_deposit", {
          p_deposit_id: dep.id,
          p_payment_id: captured.id,
          p_amount_paise: expectedPaise + bonusPaise,
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
    if (amountPaise > MAX_DEPOSIT_PAISE) throw new Error("Maximum single payout is ₹2,00,000.");
    if (!/^[\w.-]{2,64}@[a-zA-Z]{2,32}$/.test(upiId))
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
    if (error)
      throw new Error(error.message.replace(/^.*ERROR:\s*/, "").replace(/^[A-Z_]+:\s*/, ""));
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
      .select(
        "id, round_id, lane, amount_paise, multiplier, status, payout_paise, winner_lane, created_at",
      )
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
