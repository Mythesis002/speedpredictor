/**
 * Server-only wallet, betting and payment helpers.
 *
 * Every rupee movement happens here (or in the SQL routines this calls).
 * The browser is never trusted with a balance, a stake, an odds multiplier or
 * a race result — it only ever *renders* what the server already committed.
 */

import {
  LOCK_OFFSET_MS,
  lineupForRound,
  outcomeFromReveal,
  roundIdAt,
  roundLockMs,
  roundStartMs,
} from "./round-engine";

export const MIN_BET_PAISE = 1000; // ₹10
export const MAX_BET_PAISE = 10_000_000; // ₹1,00,000 safety ceiling
export const MIN_DEPOSIT_PAISE = 1000; // ₹10
export const MAX_DEPOSIT_PAISE = 20_000_000; // ₹2,00,000

const FALLBACK_MASTER_SEED = "speed-predict-dev-master-seed";
const encoder = new TextEncoder();

function masterSeed(): string {
  return process.env["RACE_MASTER_SEED"] || FALLBACK_MASTER_SEED;
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Identical derivation to rounds.functions.ts — the single source of race truth. */
export async function perRoundSecret(roundId: number): Promise<string> {
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

export async function winnerLaneFor(roundId: number): Promise<number> {
  const reveal = await perRoundSecret(roundId);
  return outcomeFromReveal(reveal, roundId).order[0];
}

/**
 * Server-side betting window check.
 *
 * A bet is only valid for the round that is live *right now*, and only before
 * that round locks. A 250 ms guard band absorbs request latency so a bet can
 * never land on a race whose outcome is already derivable.
 */
export function assertBettingOpen(roundId: number): void {
  const now = Date.now();
  const current = roundIdAt(now);
  if (roundId !== current) {
    throw new Error("Round is no longer accepting bets");
  }
  if (now < roundStartMs(roundId)) {
    throw new Error("Round has not started");
  }
  if (now >= roundLockMs(roundId) - 250) {
    throw new Error("Betting is closed for this round");
  }
  void LOCK_OFFSET_MS;
}

/** Odds are read from the public grid on the server — never sent by the client. */
export function laneMultiplier(roundId: number, lane: number): number {
  const cars = lineupForRound(roundId);
  const car = cars[lane];
  if (!car) throw new Error("Invalid lane");
  return car.multiplier;
}

export function isRoundSettleable(roundId: number): boolean {
  const now = Date.now();
  return roundId < roundIdAt(now) || now >= roundLockMs(roundId);
}

export function normalisePhone(raw: string): string {
  return raw.replace(/\D/g, "").slice(-10);
}

/* ------------------------------------------------------------------ */
/* Razorpay (QR-only deposits)                                         */
/* ------------------------------------------------------------------ */

function razorpayAuth(): string {
  const id = process.env["RAZORPAY_KEY_ID"];
  const secret = process.env["RAZORPAY_KEY_SECRET"];
  if (!id || !secret) throw new Error("Payments are not configured yet");
  return `Basic ${btoa(`${id}:${secret}`)}`;
}

export function paymentsConfigured(): boolean {
  return Boolean(process.env["RAZORPAY_KEY_ID"] && process.env["RAZORPAY_KEY_SECRET"]);
}

export interface RazorpayQr {
  id: string;
  image_url: string;
  close_by?: number;
}

/** Creates a single-use, fixed-amount UPI QR code for one deposit. */
export async function createRazorpayQr(
  amountPaise: number,
  depositId: string,
  userId: string,
): Promise<RazorpayQr> {
  const res = await fetch("https://api.razorpay.com/v1/payments/qr_codes", {
    method: "POST",
    headers: { Authorization: razorpayAuth(), "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "upi_qr",
      name: "Speed Predict wallet top-up",
      usage: "single_use",
      fixed_amount: true,
      payment_amount: amountPaise,
      description: `Deposit ${depositId}`,
      close_by: Math.floor(Date.now() / 1000) + 20 * 60,
      notes: { deposit_id: depositId, user_id: userId },
    }),
  });
  const body = (await res.json()) as RazorpayQr & { error?: { description?: string } };
  if (!res.ok) {
    throw new Error(body?.error?.description || "Could not create the payment QR");
  }
  return body;
}

export interface RazorpayQrPayment {
  id: string;
  amount: number;
  status: string;
}

/** Authoritative payment lookup — used for polling and as a webhook backstop. */
export async function fetchQrPayments(qrId: string): Promise<RazorpayQrPayment[]> {
  const res = await fetch(`https://api.razorpay.com/v1/payments/qr_codes/${qrId}/payments`, {
    headers: { Authorization: razorpayAuth() },
  });
  if (!res.ok) return [];
  const body = (await res.json()) as { items?: RazorpayQrPayment[] };
  return body.items ?? [];
}

export async function closeRazorpayQr(qrId: string): Promise<void> {
  try {
    await fetch(`https://api.razorpay.com/v1/payments/qr_codes/${qrId}/close`, {
      method: "POST",
      headers: { Authorization: razorpayAuth() },
    });
  } catch {
    /* best effort — Razorpay also auto-expires via close_by */
  }
}

/** Constant-time HMAC-SHA256 verification of a Razorpay webhook body. */
export async function verifyRazorpaySignature(
  rawBody: string,
  signature: string | null,
): Promise<boolean> {
  const secret = process.env["RAZORPAY_WEBHOOK_SECRET"];
  if (!secret || !signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody)));
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}
