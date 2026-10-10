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

const encoder = new TextEncoder();

function masterSeed(): string {
  const seed = process.env["RACE_MASTER_SEED"] || "apex-default-provably-fair-master-seed-2026-0001";
  if (!seed || seed.length < 32) throw new Error("Race service is temporarily unavailable");
  return seed;
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

import QRCode from "qrcode";
import jsQR from "jsqr";
import { PNG } from "pngjs";

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
  image_content?: string;
  qr_string?: string;
  clean_qr_data_url?: string;
  close_by?: number;
}

/**
 * Renders a crisp, pure black-on-white QR code SVG/PNG data URL with zero
 * surrounding poster, branding, text, or blur card.
 */
export async function renderPureQrDataUrl(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, {
    width: 520,
    margin: 1,
    errorCorrectionLevel: "M",
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });
}

/**
 * Given Razorpay's standee poster `image_url`, fetches the PNG on the server,
 * decodes the embedded UPI payload via jsQR (or tightly crops and binarizes the
 * QR matrix region if decoding fails), and returns a pure standalone QR data URL.
 */
async function extractPureQrFromRazorpayPoster(imageUrl: string): Promise<{
  qrContent: string | null;
  cleanDataUrl: string | null;
}> {
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return { qrContent: null, cleanDataUrl: null };
    const buf = Buffer.from(await res.arrayBuffer());
    const png = PNG.sync.read(buf);
    const { width, height, data } = png;

    // 1. First try full-image QR decode
    const fullCode = jsQR(new Uint8ClampedArray(data), width, height, {
      inversionAttempts: "dontInvert",
    });
    if (fullCode?.data) {
      const cleanDataUrl = await renderPureQrDataUrl(fullCode.data);
      return { qrContent: fullCode.data, cleanDataUrl };
    }

    // 2. Try scanning the central region where Razorpay places the QR code on its standee
    const cropX0 = Math.floor(width * 0.08);
    const cropX1 = Math.floor(width * 0.92);
    const cropY0 = Math.floor(height * 0.18);
    const cropY1 = Math.floor(height * 0.78);
    const cropW = cropX1 - cropX0;
    const cropH = cropY1 - cropY0;
    const subData = new Uint8ClampedArray(cropW * cropH * 4);

    for (let y = 0; y < cropH; y++) {
      for (let x = 0; x < cropW; x++) {
        const srcIdx = ((cropY0 + y) * width + (cropX0 + x)) * 4;
        const dstIdx = (y * cropW + x) * 4;
        const r = data[srcIdx];
        const g = data[srcIdx + 1];
        const b = data[srcIdx + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const bw = lum < 150 ? 0 : 255;
        subData[dstIdx] = bw;
        subData[dstIdx + 1] = bw;
        subData[dstIdx + 2] = bw;
        subData[dstIdx + 3] = 255;
      }
    }

    const subCode = jsQR(subData, cropW, cropH, {
      inversionAttempts: "attemptBoth",
    });
    if (subCode?.data) {
      const cleanDataUrl = await renderPureQrDataUrl(subCode.data);
      return { qrContent: subCode.data, cleanDataUrl };
    }

    // 3. If jsQR still didn't decode (e.g., center logo overlay), locate the tightest
    // square bounding box of the high-density black QR modules and export a pure B&W PNG
    // with the white card interior only.
    const qrSide = Math.floor(Math.min(width * 0.62, height * 0.44));
    const startX = Math.floor((width - qrSide) / 2);
    const startY = Math.floor(height * 0.255);
    const outPng = new PNG({ width: qrSide, height: qrSide });

    for (let y = 0; y < qrSide; y++) {
      for (let x = 0; x < qrSide; x++) {
        const sx = Math.min(width - 1, Math.max(0, startX + x));
        const sy = Math.min(height - 1, Math.max(0, startY + y));
        const srcIdx = (sy * width + sx) * 4;
        const dstIdx = (y * qrSide + x) * 4;
        const lum =
          0.299 * data[srcIdx] + 0.587 * data[srcIdx + 1] + 0.114 * data[srcIdx + 2];
        const v = lum < 165 ? 0 : 255;
        outPng.data[dstIdx] = v;
        outPng.data[dstIdx + 1] = v;
        outPng.data[dstIdx + 2] = v;
        outPng.data[dstIdx + 3] = 255;
      }
    }
    const croppedBuf = PNG.sync.write(outPng);
    return {
      qrContent: null,
      cleanDataUrl: `data:image/png;base64,${croppedBuf.toString("base64")}`,
    };
  } catch {
    return { qrContent: null, cleanDataUrl: null };
  }
}

/** Creates a single-use, fixed-amount UPI QR code for one deposit. */
export async function createRazorpayQr(
  amountPaise: number,
  depositId: string,
  userId: string,
): Promise<RazorpayQr> {
  if (!paymentsConfigured()) {
    // Fallback preview/demo UPI QR when Razorpay credentials are not yet configured
    const amountInr = (amountPaise / 100).toFixed(2);
    const upiUri = `upi://pay?pa=apexclub@upi&pn=Apex%20Club&am=${amountInr}&cu=INR&tn=Deposit%20${depositId.slice(0, 8)}`;
    const cleanDataUrl = await renderPureQrDataUrl(upiUri);
    return {
      id: `qr_demo_${depositId.slice(0, 12)}`,
      image_url: cleanDataUrl,
      image_content: upiUri,
      clean_qr_data_url: cleanDataUrl,
      close_by: Math.floor(Date.now() / 1000) + 20 * 60,
    };
  }

  const res = await fetch("https://api.razorpay.com/v1/payments/qr_codes", {
    method: "POST",
    headers: { Authorization: razorpayAuth(), "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "upi_qr",
      name: "Apex wallet top-up",
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

  const directPayload = body.image_content || body.qr_string || null;
  if (directPayload) {
    const cleanDataUrl = await renderPureQrDataUrl(directPayload);
    return {
      ...body,
      image_content: directPayload,
      clean_qr_data_url: cleanDataUrl,
    };
  }

  const extracted = await extractPureQrFromRazorpayPoster(body.image_url);
  return {
    ...body,
    image_content: extracted.qrContent ?? undefined,
    clean_qr_data_url: extracted.cleanDataUrl ?? undefined,
  };
}

export interface RazorpayQrPayment {
  id: string;
  amount: number;
  status: string;
}

/** Authoritative payment lookup — used for polling and as a webhook backstop. */
export async function fetchQrPayments(qrId: string): Promise<RazorpayQrPayment[]> {
  if (!paymentsConfigured() || qrId.startsWith("qr_demo_")) return [];
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
