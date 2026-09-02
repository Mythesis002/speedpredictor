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
  paymentsConfigured,
  winnerLaneFor,
} from "./wallet.server";

export interface WalletState {
  balancePaise: number;
  phone: string;
  activeBet: { roundId: number; lane: number; amountPaise: number; multiplier: number } | null;
}

/** Current balance + the bet (if any) that is still riding on a live round. */
export const getWallet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WalletState> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("phone, balance_paise")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!profile) throw new Error("Profile not found");

    const { data: bet } = await supabaseAdmin
      .from("bets")
      .select("round_id, lane, amount_paise, multiplier, status")
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("round_id", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      balancePaise: Number(profile.balance_paise),
      phone: profile.phone,
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
  .inputValidator((data: { roundId: number; lane: number; amountPaise: number }) => {
    const { roundId, lane, amountPaise } = data ?? {};
    if (!Number.isInteger(roundId)) throw new Error("Invalid round");
    if (!Number.isInteger(lane) || lane < 0 || lane > 2) throw new Error("Invalid lane");
    if (!Number.isInteger(amountPaise) || amountPaise < MIN_BET_PAISE)
      throw new Error("Minimum bet is ₹10");
    if (amountPaise > MAX_BET_PAISE) throw new Error("Stake is above the table limit");
    return { roundId, lane, amountPaise };
  })
  .handler(async ({ data, context }) => {
    assertBettingOpen(data.roundId);
    const multiplier = laneMultiplier(data.roundId, data.lane);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("place_bet", {
      p_user_id: context.userId,
      p_round_id: data.roundId,
      p_lane: data.lane,
      p_amount_paise: data.amountPaise,
      p_multiplier: multiplier,
    });
    if (error) {
      const msg = error.message.includes("duplicate key")
        ? "You already have a bet on this round"
        : error.message.replace(/^.*ERROR:\s*/, "");
      throw new Error(msg);
    }
    const row = Array.isArray(rows) ? rows[0] : rows;
    return {
      betId: row?.out_bet_id as string,
      balancePaise: Number(row?.out_balance_paise ?? 0),
      multiplier,
    };
  });

/** Settles the caller's bet for a finished round. Idempotent and server-decided. */
export const settleRound = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { roundId: number }) => {
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
    return {
      winnerLane,
      status: (row?.out_status as string) ?? "none",
      payoutPaise: Number(row?.out_payout_paise ?? 0),
      balancePaise: Number(row?.out_balance_paise ?? 0),
    };
  });

export const createDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { amountPaise: number }) => {
    const amountPaise = data?.amountPaise;
    if (!Number.isInteger(amountPaise) || amountPaise < MIN_DEPOSIT_PAISE)
      throw new Error("Minimum deposit is ₹10");
    if (amountPaise > MAX_DEPOSIT_PAISE) throw new Error("Amount is above the deposit limit");
    return { amountPaise };
  })
  .handler(async ({ data, context }) => {
    if (!paymentsConfigured()) throw new Error("Payments are not configured yet");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: dep, error } = await supabaseAdmin
      .from("deposits")
      .insert({ user_id: context.userId, amount_paise: data.amountPaise })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const qr = await createRazorpayQr(data.amountPaise, dep.id, context.userId);
    await supabaseAdmin
      .from("deposits")
      .update({ qr_id: qr.id, qr_image_url: qr.image_url })
      .eq("id", dep.id);

    return { depositId: dep.id, qrImageUrl: qr.image_url, amountPaise: data.amountPaise };
  });

/** Polls Razorpay for the deposit and credits it exactly once. */
export const checkDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { depositId: string }) => {
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
      const captured = payments.find(
        (p) => p.status === "captured" && p.amount >= Number(dep.amount_paise),
      );
      if (captured) {
        await supabaseAdmin.rpc("credit_deposit", {
          p_deposit_id: dep.id,
          p_payment_id: captured.id,
          p_amount_paise: Number(dep.amount_paise),
        });
        await closeRazorpayQr(dep.qr_id);
      }
    }

    const { data: fresh } = await supabaseAdmin
      .from("deposits")
      .select("status")
      .eq("id", dep.id)
      .maybeSingle();
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("balance_paise")
      .eq("id", context.userId)
      .maybeSingle();

    return {
      status: fresh?.status ?? "pending",
      balancePaise: Number(profile?.balance_paise ?? 0),
    };
  });

/** A player asks for a payout. Money leaves the wallet only when an admin approves. */
export const requestWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { amountPaise: number; upiId: string }) => {
    const amountPaise = data?.amountPaise;
    const upiId = (data?.upiId ?? "").trim();
    if (!Number.isInteger(amountPaise) || amountPaise < 10000)
      throw new Error("Minimum withdrawal is ₹100");
    if (amountPaise > MAX_DEPOSIT_PAISE) throw new Error("Amount is above the payout limit");
    if (!/^[\w.\-]{2,64}@[a-zA-Z]{2,32}$/.test(upiId)) throw new Error("Enter a valid UPI ID");
    return { amountPaise, upiId };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("balance_paise")
      .eq("id", context.userId)
      .maybeSingle();
    if (!profile) throw new Error("Profile not found");

    const { data: pending } = await supabaseAdmin
      .from("withdrawals")
      .select("amount_paise")
      .eq("user_id", context.userId)
      .eq("status", "pending");
    const held = (pending ?? []).reduce((t, w) => t + Number(w.amount_paise), 0);

    if (Number(profile.balance_paise) - held < data.amountPaise) {
      throw new Error("Not enough withdrawable balance");
    }

    const { error } = await supabaseAdmin.from("withdrawals").insert({
      user_id: context.userId,
      amount_paise: data.amountPaise,
      upi_id: data.upiId,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** The player's own payout requests, newest first. */
export const myWithdrawals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("withdrawals")
      .select("id, amount_paise, upi_id, status, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    return (data ?? []).map((w) => ({
      id: w.id,
      amountPaise: Number(w.amount_paise),
      upiId: w.upi_id,
      status: w.status,
      createdAt: w.created_at,
    }));
  });
