import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2,
  X,
  Sparkles,
  QrCode,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import QRCode from "qrcode";
import { checkDeposit, createDeposit } from "@/lib/wallet.functions";
import { formatINR } from "@/lib/car-label";
import {
  createAddFundsEmailContent,
  getAccessToken,
  sendGmailMessage,
  queueNotification,
  ADMIN_NOTIFICATION_EMAIL,
} from "@/lib/gmail";

interface Props {
  open: boolean;
  onClose: () => void;
  onCredited: (balancePaise: number) => void;
  initialAmount?: number;
}

const PRESETS = [30, 50, 100, 200];

function getCleanUpiQuery(uri: string): string {
  if (!uri) return "";
  const qIdx = uri.indexOf("?");
  let query = qIdx >= 0 ? uri.slice(qIdx + 1) : uri;
  if (!query.includes("cu=")) {
    query += "&cu=INR";
  }
  return query;
}

/**
 * Generates direct app deep links using custom schemes and Android explicit package intents.
 * This guarantees that clicking an app button opens that specific app directly
 * and prevents WhatsApp Pay from hijacking the generic upi:// link.
 */
function getAppHref(
  app: "phonepe" | "gpay" | "paytm" | "cred" | "bhim" | "generic",
  rawUri: string | null,
): string {
  if (!rawUri) return "#";
  const query = getCleanUpiQuery(rawUri);
  const isAndroid = typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);

  if (app === "phonepe") {
    return isAndroid
      ? `intent://pay?${query}#Intent;scheme=upi;package=com.phonepe.app;end`
      : `phonepe://pay?${query}`;
  }

  if (app === "gpay") {
    return isAndroid
      ? `intent://upi/pay?${query}#Intent;scheme=upi;package=com.google.android.apps.nbu.paisa.user;end`
      : `tez://upi/pay?${query}`;
  }

  if (app === "paytm") {
    return isAndroid
      ? `intent://pay?${query}#Intent;scheme=upi;package=net.one97.paytm;end`
      : `paytmmp://pay?${query}`;
  }

  if (app === "cred") {
    return isAndroid
      ? `intent://pay?${query}#Intent;scheme=upi;package=com.dreamplug.androidapp;end`
      : `cred://pay?${query}`;
  }

  if (app === "bhim") {
    return isAndroid
      ? `intent://pay?${query}#Intent;scheme=upi;package=in.org.npci.upiapp;end`
      : `bhim://pay?${query}`;
  }

  return rawUri;
}

export function DepositModal({ open, onClose, onCredited, initialAmount = 50 }: Props) {
  const start = useServerFn(createDeposit);
  const poll = useServerFn(checkDeposit);

  const [amount, setAmount] = useState(initialAmount);
  const [showQrCode, setShowQrCode] = useState(false);
  const [selectedApp, setSelectedApp] = useState<"phonepe" | "gpay" | "paytm" | "cred">("phonepe");
  const [qr, setQr] = useState<{
    id: string;
    url: string;
    cleanQrDataUrl: string | null;
    upiUri: string | null;
    amountPaise: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkingNow, setCheckingNow] = useState(false);
  const [checkHint, setCheckHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paidInfo, setPaidInfo] = useState<{
    creditedPaise: number;
    newBalancePaise: number;
    depositId?: string;
  } | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const reset = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setQr(null);
    setPaidInfo(null);
    setCheckHint(null);
    setError(null);
    setBusy(false);
    setCheckingNow(false);
    setShowQrCode(false);
  }, []);

  useEffect(() => {
    if (open) {
      setAmount(initialAmount);
    } else {
      reset();
    }
  }, [open, initialAmount, reset]);

  const notifyAdmin = useCallback((credited: number, depId: string, newAvail: number) => {
    const depositEmail = createAddFundsEmailContent({
      amountPaise: credited,
      depositId: depId,
      balancePaise: newAvail,
    });

    void getAccessToken().then((token) => {
      if (token) {
        void sendGmailMessage({
          to: ADMIN_NOTIFICATION_EMAIL,
          subject: depositEmail.subject,
          html: depositEmail.html,
          token,
        }).catch(() => {
          queueNotification({
            type: "add_funds",
            subject: depositEmail.subject,
            html: depositEmail.html,
            recipient: ADMIN_NOTIFICATION_EMAIL,
            meta: { depositId: depId, amountPaise: credited, balancePaise: newAvail },
          });
        });
      } else {
        queueNotification({
          type: "add_funds",
          subject: depositEmail.subject,
          html: depositEmail.html,
          recipient: ADMIN_NOTIFICATION_EMAIL,
          meta: { depositId: depId, amountPaise: credited, balancePaise: newAvail },
        });
      }
    });
  }, []);

  const verifyDepositStatus = useCallback(
    async (depositId: string, fallbackAmountPaise: number, isManual = false) => {
      if (isManual) {
        setCheckingNow(true);
        setCheckHint(null);
      }
      try {
        const res = await poll({ data: { depositId } });
        if (res.status === "paid") {
          const newAvail = res.availablePaise ?? res.balancePaise;
          const credited = res.amountPaise || fallbackAmountPaise;
          setPaidInfo({
            creditedPaise: credited,
            newBalancePaise: newAvail,
            depositId,
          });
          onCredited(newAvail);
          if (timer.current) clearInterval(timer.current);
          notifyAdmin(credited, depositId, newAvail);
          return true;
        }
        if (isManual) {
          setCheckHint(
            "Waiting for bank confirmation. Your balance will credit automatically the moment UPI settles.",
          );
        }
      } catch {
        if (isManual) {
          setCheckHint("Checking with payment server… Keep this window open for a few seconds.");
        }
      } finally {
        if (isManual) setCheckingNow(false);
      }
      return false;
    },
    [poll, onCredited, notifyAdmin],
  );

  useEffect(() => {
    if (!qr || paidInfo) return;
    timer.current = setInterval(() => {
      void verifyDepositStatus(qr.id, qr.amountPaise, false);
    }, 3500);

    const onFocusOrVisible = () => {
      if (document.visibilityState === "visible") {
        void verifyDepositStatus(qr.id, qr.amountPaise, false);
      }
    };
    window.addEventListener("focus", onFocusOrVisible);
    document.addEventListener("visibilitychange", onFocusOrVisible);

    return () => {
      if (timer.current) clearInterval(timer.current);
      window.removeEventListener("focus", onFocusOrVisible);
      document.removeEventListener("visibilitychange", onFocusOrVisible);
    };
  }, [qr, paidInfo, verifyDepositStatus]);

  if (!open) return null;

  const generate = async () => {
    setBusy(true);
    setError(null);
    setCheckHint(null);
    try {
      const res = await start({ data: { amountPaise: Math.round(amount * 100) } });
      if (res.ok === false || res.error || !res.depositId) {
        setError(res.error || "Could not generate a payment request. Please try again.");
        setBusy(false);
        return;
      }
      const upiUri = res.upiUri || res.qrContent || null;
      let cleanQrDataUrl: string | null = res.cleanQrDataUrl ?? null;
      if (!cleanQrDataUrl && upiUri) {
        try {
          cleanQrDataUrl = await QRCode.toDataURL(upiUri, {
            width: 520,
            margin: 1,
            errorCorrectionLevel: "M",
            color: {
              dark: "#000000",
              light: "#ffffff",
            },
          });
        } catch {
          cleanQrDataUrl = null;
        }
      }
      setQr({
        id: res.depositId,
        url: res.qrImageUrl,
        cleanQrDataUrl,
        upiUri,
        amountPaise: res.amountPaise,
      });
    } catch (err) {
      setError(
        err instanceof Error && !err.message.includes("500")
          ? err.message
          : "Unable to connect to the payment service. Check your connection and try again.",
      );
    }
    setBusy(false);
  };

  const handleDirectRedirect = (app: "phonepe" | "gpay" | "paytm" | "cred") => {
    if (!qr?.upiUri) return;
    const href = getAppHref(app, qr.upiUri);
    window.location.href = href;
  };

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/85 backdrop-blur-sm px-4 animate-fade-in">
      <div className="w-full max-w-sm glass rounded-3xl p-4.5 relative border border-white/15 shadow-[0_0_40px_rgba(0,0,0,0.8)]">
        <button
          onClick={onClose}
          aria-label="Close deposit dialog"
          className="absolute right-3.5 top-3.5 w-8 h-8 rounded-full grid place-items-center bg-white/10 text-white/60 hover:text-white transition"
        >
          <X size={15} />
        </button>

        <div className="flex items-center gap-2 mb-3">
          <div className="font-display text-[13px] tracking-[0.18em] text-white">
            ADD FUNDS TO WALLET
          </div>
        </div>

        {!qr && (
          <>
            <div className="flex items-center h-12 rounded-xl bg-black/50 border border-white/15 px-3.5 gap-2 mb-2.5">
              <span className="text-[#ffd83a] font-display text-lg">₹</span>
              <input
                inputMode="numeric"
                value={amount}
                onChange={(e) =>
                  setAmount(Math.min(200000, Number(e.target.value.replace(/\D/g, "")) || 0))
                }
                className="flex-1 bg-transparent outline-none font-display tabular text-xl text-white font-bold"
              />
              <span className="text-white/40 text-[10px] font-display tracking-widest">INR</span>
            </div>

            <div className="grid grid-cols-4 gap-1.5 mb-3.5">
              {PRESETS.map((p) => {
                const selected = amount === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setAmount(p)}
                    className="relative h-9 rounded-xl font-display text-[12px] tabular font-bold transition-all cursor-pointer border"
                    style={{
                      background: selected ? "rgba(255,216,58,0.2)" : "rgba(255,255,255,0.05)",
                      borderColor: selected ? "#ffd83a" : "rgba(255,255,255,0.1)",
                      color: selected ? "#ffd83a" : "rgba(255,255,255,0.8)",
                    }}
                  >
                    <span>₹{p}</span>
                  </button>
                );
              })}
            </div>

            {error && (
              <div className="mb-3 px-3 py-2 rounded-xl bg-[#ff3b5c]/15 border border-[#ff3b5c]/35 text-[#ff8a9c] text-[11px] leading-tight">
                {error}
              </div>
            )}

            <button
              type="button"
              disabled={busy || amount < 10}
              onClick={() => void generate()}
              className="relative overflow-hidden w-full h-12 rounded-xl font-display text-[13px] tracking-[0.12em] flex items-center justify-center gap-2 cursor-pointer transition active:scale-[0.98] shadow-lg disabled:opacity-50"
              style={{
                background: busy
                  ? "rgba(255,216,58,0.3)"
                  : "linear-gradient(180deg,#ffd83a,#f0a415)",
                color: busy ? "#ffd83a" : "#231a00",
                fontWeight: 800,
              }}
            >
              {busy ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>STARTING PAYMENT…</span>
                </>
              ) : (
                <span>PAY {formatINR(amount)} VIA UPI APP →</span>
              )}
              {!busy && <span className="absolute inset-0 animate-shimmer" />}
            </button>
          </>
        )}

        {qr && !paidInfo && (
          <div className="text-center pt-1 animate-fade-in">
            <div className="font-display text-2xl tabular font-extrabold text-white">
              {formatINR(qr.amountPaise / 100)}
            </div>

            {qr.amountPaise === 5000 && (
              <div className="inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full bg-[#26ff9a]/20 border border-[#26ff9a]/40 text-[#26ff9a] text-[10px] font-display font-semibold">
                <Sparkles size={11} /> +₹20 Bonus (Total ₹70)
              </div>
            )}

            {/* DIRECT 1-TAP PAYMENT APP REDIRECT BUTTONS (No WhatsApp Hijacking) */}
            {qr.upiUri && (
              <div className="mt-3.5 space-y-2.5">
                {/* Quick App Selector Pills */}
                <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-black/40 border border-white/10">
                  <button
                    type="button"
                    onClick={() => setSelectedApp("phonepe")}
                    className={`py-1.5 px-1 rounded-lg text-[10px] font-display font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                      selectedApp === "phonepe"
                        ? "bg-[#5f259f] text-white shadow"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    <span>PhonePe</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedApp("gpay")}
                    className={`py-1.5 px-1 rounded-lg text-[10px] font-display font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                      selectedApp === "gpay"
                        ? "bg-white text-[#4285F4] shadow"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    <span>GPay</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedApp("paytm")}
                    className={`py-1.5 px-1 rounded-lg text-[10px] font-display font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                      selectedApp === "paytm"
                        ? "bg-[#00baf2] text-[#002e6e] shadow"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    <span>Paytm</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedApp("cred")}
                    className={`py-1.5 px-1 rounded-lg text-[10px] font-display font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                      selectedApp === "cred"
                        ? "bg-white text-black shadow"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    <span>CRED</span>
                  </button>
                </div>

                {/* PRIMARY ACTION: Direct 1-Tap Redirect to the Selected App */}
                <a
                  href={getAppHref(selectedApp, qr.upiUri)}
                  onClick={() => handleDirectRedirect(selectedApp)}
                  target="_self"
                  className="w-full h-13 rounded-xl font-display text-[13px] tracking-[0.08em] flex items-center justify-between px-4 cursor-pointer active:scale-[0.98] transition-all text-[#07130a] font-black shadow-[0_0_30px_rgba(38,255,154,0.4)]"
                  style={{
                    background: "linear-gradient(180deg, #26ff9a, #1bc574)",
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-full bg-black/10 flex items-center justify-center text-[12px] font-black">
                      {selectedApp === "phonepe" && "Pe"}
                      {selectedApp === "gpay" && "G"}
                      {selectedApp === "paytm" && "₹"}
                      {selectedApp === "cred" && "C"}
                    </span>
                    <div className="text-left">
                      <div className="text-[12.5px] leading-tight font-extrabold text-[#07130a]">
                        PAY VIA{" "}
                        {selectedApp === "phonepe"
                          ? "PHONEPE"
                          : selectedApp === "gpay"
                            ? "GOOGLE PAY"
                            : selectedApp === "paytm"
                              ? "PAYTM"
                              : "CRED"}
                      </div>
                      <div className="text-[9.5px] font-sans font-medium text-black/75">
                        Direct 1-tap redirect to app
                      </div>
                    </div>
                  </div>
                  <ExternalLink size={16} className="text-[#07130a] shrink-0" />
                </a>

                {/* Direct 1-tap shortcut tiles for all other apps */}
                <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                  <a
                    href={getAppHref("phonepe", qr.upiUri)}
                    onClick={() => handleDirectRedirect("phonepe")}
                    target="_self"
                    className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-[#5f259f]/25 hover:bg-[#5f259f]/35 border border-[#5f259f]/50 active:scale-95 transition cursor-pointer text-white text-[11px] font-display font-semibold"
                  >
                    <span className="w-4 h-4 rounded-full bg-[#5f259f] text-white flex items-center justify-center text-[8.5px] font-black">
                      Pe
                    </span>
                    <span>PhonePe</span>
                  </a>

                  <a
                    href={getAppHref("gpay", qr.upiUri)}
                    onClick={() => handleDirectRedirect("gpay")}
                    target="_self"
                    className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 active:scale-95 transition cursor-pointer text-white text-[11px] font-display font-semibold"
                  >
                    <span className="w-4 h-4 rounded-full bg-white text-[#4285F4] flex items-center justify-center text-[8.5px] font-black">
                      G
                    </span>
                    <span>Google Pay</span>
                  </a>

                  <a
                    href={getAppHref("paytm", qr.upiUri)}
                    onClick={() => handleDirectRedirect("paytm")}
                    target="_self"
                    className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-[#002e6e]/40 hover:bg-[#002e6e]/60 border border-[#00baf2]/50 active:scale-95 transition cursor-pointer text-white text-[11px] font-display font-semibold"
                  >
                    <span className="w-4 h-4 rounded-full bg-[#00baf2] text-[#002e6e] flex items-center justify-center text-[8.5px] font-black">
                      ₹
                    </span>
                    <span>Paytm</span>
                  </a>
                </div>

                <div className="flex items-center justify-center gap-1.5 text-[10px] font-display tracking-[0.12em] text-[#ffc32b] pt-1">
                  <Loader2 size={12} className="animate-spin" /> WAITING FOR PAYMENT…
                </div>
              </div>
            )}

            {/* Collapsible QR view */}
            <div className="mt-3 border-t border-white/10 pt-2">
              <button
                type="button"
                onClick={() => setShowQrCode(!showQrCode)}
                className="w-full py-1 text-center text-[10.5px] font-display tracking-wider text-white/60 hover:text-white flex items-center justify-center gap-1.5 cursor-pointer transition"
              >
                <QrCode size={13} />
                <span>{showQrCode ? "Hide QR Code" : "Or Scan QR Code"}</span>
                {showQrCode ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>

              {showQrCode && (
                <div className="mt-2 p-3 rounded-2xl bg-white flex flex-col items-center justify-center shadow-lg animate-scale-in">
                  <img
                    src={qr.cleanQrDataUrl || qr.url}
                    alt="UPI payment QR code"
                    referrerPolicy="no-referrer"
                    className="w-full max-w-[180px] h-auto object-contain block select-none rounded-lg"
                  />
                  <p className="mt-1 text-[9px] text-black/60 font-sans">Scan with any UPI app</p>
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={checkingNow}
              onClick={() => void verifyDepositStatus(qr.id, qr.amountPaise, true)}
              className="mt-3 w-full h-10 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 font-display text-[11px] tracking-[0.12em] text-white flex items-center justify-center gap-1.5 disabled:opacity-50 transition cursor-pointer"
            >
              {checkingNow ? (
                <>
                  <Loader2 size={13} className="animate-spin" /> CHECKING…
                </>
              ) : (
                "I HAVE PAID · CHECK STATUS"
              )}
            </button>
            {checkHint && (
              <p className="mt-2 text-[10.5px] text-[#ffd83a] leading-snug">{checkHint}</p>
            )}
            {error && <p className="mt-2 text-[10.5px] text-[#ff8a9c] leading-snug">{error}</p>}
          </div>
        )}

        {paidInfo && (
          <div className="text-center py-3 animate-scale-in">
            <div className="w-12 h-12 rounded-full mx-auto bg-[#26ff9a]/20 border border-[#26ff9a]/50 flex items-center justify-center text-[#26ff9a] mb-2 shadow-[0_0_20px_rgba(38,255,154,0.35)]">
              <CheckCircle2 size={28} />
            </div>
            <div className="font-display text-[15px] tracking-[0.14em] text-[#26ff9a] font-bold">
              PAYMENT RECEIVED!
            </div>

            <div className="mt-3 rounded-xl bg-black/50 border border-[#26ff9a]/30 p-2.5 space-y-1.5 text-left">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-white/50">Credited</span>
                <span className="font-display tabular text-[#26ff9a] font-bold">
                  +{formatINR(paidInfo.creditedPaise / 100)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] border-t border-white/10 pt-1.5">
                <span className="text-white/50">New Balance</span>
                <span className="font-display tabular text-white font-bold">
                  {formatINR(paidInfo.newBalancePaise / 100)}
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="mt-3.5 w-full h-11 rounded-xl font-display text-[12px] tracking-[0.14em] text-black font-extrabold cursor-pointer shadow-lg active:scale-[0.98] transition"
              style={{ background: "#26ff9a" }}
            >
              START RACING NOW →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
