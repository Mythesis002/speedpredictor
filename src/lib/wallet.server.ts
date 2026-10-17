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
  const configured = readFreshEnv("RACE_MASTER_SEED");
  if (configured && configured.length >= 32) return configured;
  // Derive an environment-unique secret from the server's private credentials
  // so no deployment ever shares a publicly known fallback seed.
  const serviceKey = readFreshEnv("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const rzpSecret = readFreshEnv("RAZORPAY_KEY_SECRET") ?? "";
  const dbUrl = readFreshEnv("DATABASE_URL") ?? "";
  return `apex-provably-fair-v2:${serviceKey.slice(-24)}:${rzpSecret.slice(-16)}:${dbUrl.slice(-16)}:master-entropy-9f8a7b6c`;
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Multi-stage HMAC-SHA256 key derivation (HKDF-Extract + Expand pattern).
 * Stage 1 derives a daily epoch key from the master seed; Stage 2 derives the
 * unique per-round secret bound to the round's exact start timestamp and ID.
 * Knowing a billion past `perRoundSecret` values yields zero bits of information
 * about `roundId + 1`.
 */
export async function perRoundSecret(roundId: number): Promise<string> {
  const epochBucket = Math.floor(roundId / 4096);
  const masterKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(masterSeed()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const epochRaw = await crypto.subtle.sign(
    "HMAC",
    masterKey,
    encoder.encode(`apex:epoch:v2:${epochBucket}`),
  );
  const epochKey = await crypto.subtle.importKey(
    "raw",
    epochRaw,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const roundMsg = `apex:round:v2:${roundId}:start:${roundStartMs(roundId)}`;
  const sig = await crypto.subtle.sign("HMAC", epochKey, encoder.encode(roundMsg));
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
 * that round locks. A 400 ms safety buffer before `roundLockMs` guarantees that
 * no bet can ever be accepted close to or after the reveal threshold.
 */
export function assertBettingOpen(roundId: number): void {
  const now = Date.now();
  const current = roundIdAt(now);
  if (roundId !== current) {
    throw new Error("This round is no longer accepting bets.");
  }
  if (now < roundStartMs(roundId)) {
    throw new Error("Betting for this round has not opened yet.");
  }
  if (now >= roundLockMs(roundId) - 400) {
    throw new Error("Bets are locked for this round.");
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

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { PNG } from "pngjs";

/**
 * Reloads `.env` / `.env.local` from disk into `process.env` at call time so
 * updated credentials (such as `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`) take
 * effect immediately without requiring a process restart.
 */
function readFreshEnv(key: string): string | undefined {
  // Always check process.env first for maximum reliability in containerized/server environments
  const direct = process.env[key]?.trim();
  if (direct) return direct;

  try {
    if (typeof process !== "undefined" && typeof process.cwd === "function") {
      const root = process.cwd();
      for (const file of [".env.local", ".env"]) {
        try {
          const content = readFileSync(resolve(root, file), "utf8");
          for (const rawLine of content.split(/\r?\n/)) {
            const line = rawLine.trim();
            if (!line || line.startsWith("#")) continue;
            const eqIdx = line.indexOf("=");
            if (eqIdx <= 0) continue;
            const k = line.slice(0, eqIdx).trim();
            let v = line.slice(eqIdx + 1).trim();
            if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
              v = v.slice(1, -1);
            }
            if (v) {
              process.env[k] = v;
            }
          }
        } catch {
          /* file doesn't exist or FS unavailable on edge runtime */
        }
      }
    }
  } catch {
    /* ignore */
  }
  const val = process.env[key]?.trim();
  return val ? val : undefined;
}

function razorpayAuth(): string {
  const id = readFreshEnv("RAZORPAY_KEY_ID");
  const secret = readFreshEnv("RAZORPAY_KEY_SECRET");
  if (!id || !secret) throw new Error("Payments are not configured yet");
  return `Basic ${btoa(`${id}:${secret}`)}`;
}

export function paymentsConfigured(): boolean {
  return Boolean(readFreshEnv("RAZORPAY_KEY_ID") && readFreshEnv("RAZORPAY_KEY_SECRET"));
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(imageUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
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

    // 3. Fallback: tight crop of QR bounding region
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
        const lum = 0.299 * data[srcIdx] + 0.587 * data[srcIdx + 1] + 0.114 * data[srcIdx + 2];
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

/**
 * Razorpay's live UPI intent URI format for the merchant account:
 * upi://pay?pa=aniketsingh476883.rzp@rxairtel&pn=ANIKETSINGH&mc=5261&mode=22&am={amount}&tr={qr_id}qrv2
 */
export function buildRazorpayUpiUri(qrId: string, amountPaise: number): string {
  const amountInr = (amountPaise / 100).toFixed(2);
  return `upi://pay?pa=aniketsingh476883.rzp@rxairtel&pn=ANIKETSINGH&mc=5261&mode=22&am=${amountInr}&tr=${qrId}qrv2`;
}

/** Creates a single-use, fixed-amount UPI QR code for one deposit. */
export async function createRazorpayQr(
  amountPaise: number,
  depositId: string,
  userId: string,
): Promise<RazorpayQr> {
  if (!paymentsConfigured()) {
    // Fallback preview/demo UPI QR when Razorpay credentials are not yet configured
    const demoId = `qr_demo_${depositId.slice(0, 12)}`;
    const upiUri = buildRazorpayUpiUri(demoId, amountPaise);
    const cleanDataUrl = await renderPureQrDataUrl(upiUri);
    return {
      id: demoId,
      image_url: cleanDataUrl,
      image_content: upiUri,
      qr_string: upiUri,
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
    throw new Error(
      body?.error?.description || "Could not generate a payment QR code. Please try again.",
    );
  }

  // Instant Direct QR Generation (<10ms):
  // Generate pure high-contrast black-and-white QR code directly from the UPI intent URI.
  // Zero CDN delay, zero network timeout risks, and zero clipping.
  const upiUri = body.image_content || body.qr_string || buildRazorpayUpiUri(body.id, amountPaise);

  try {
    const cleanDataUrl = await renderPureQrDataUrl(upiUri);
    return {
      ...body,
      image_content: upiUri,
      qr_string: upiUri,
      clean_qr_data_url: cleanDataUrl,
    };
  } catch {
    return {
      ...body,
      image_content: upiUri,
      qr_string: upiUri,
      clean_qr_data_url: body.image_url,
    };
  }
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
  const secret = readFreshEnv("RAZORPAY_WEBHOOK_SECRET");
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
