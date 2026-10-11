import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldCheck, X } from "lucide-react";
import QRCode from "qrcode";
import { checkDeposit, createDeposit } from "@/lib/wallet.functions";
import { formatINR } from "@/lib/car-label";

interface Props {
  open: boolean;
  onClose: () => void;
  onCredited: (balancePaise: number) => void;
}

const PRESETS = [50, 100, 500, 1000];

/**
 * QR-only deposit flow. Renders a pure, standalone QR matrix from `qrContent`
 * (or tightly crops the square QR region if only `image_url` is returned) so
 * Razorpay's tall retail standee poster, merchant name, and branding never appear.
 */
export function DepositModal({ open, onClose, onCredited }: Props) {
  const start = useServerFn(createDeposit);
  const poll = useServerFn(checkDeposit);

  const [amount, setAmount] = useState(100);
  const [qr, setQr] = useState<{
    id: string;
    url: string;
    cleanQrDataUrl: string | null;
    amountPaise: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkingNow, setCheckingNow] = useState(false);
  const [checkHint, setCheckHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paidInfo, setPaidInfo] = useState<{
    creditedPaise: number;
    newBalancePaise: number;
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
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

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
          setPaidInfo({
            creditedPaise: res.amountPaise || fallbackAmountPaise,
            newBalancePaise: newAvail,
          });
          onCredited(newAvail);
          if (timer.current) clearInterval(timer.current);
          return true;
        }
        if (isManual) {
          setCheckHint(
            "Still waiting for bank confirmation. Your balance will credit automatically the moment UPI settles.",
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
    [poll, onCredited],
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
        setError(res.error || "Could not generate a payment QR code. Please try again.");
        setBusy(false);
        return;
      }
      let cleanQrDataUrl: string | null = res.cleanQrDataUrl ?? null;
      if (!cleanQrDataUrl && res.qrContent) {
        try {
          cleanQrDataUrl = await QRCode.toDataURL(res.qrContent, {
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

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/80 px-5 animate-fade-in">
      <div className="w-full max-w-sm glass rounded-2xl p-4 relative overflow-hidden">
        <button
          onClick={onClose}
          aria-label="Close deposit dialog"
          className="absolute right-3 top-3 w-8 h-8 rounded-lg grid place-items-center bg-white/10"
        >
          <X size={15} />
        </button>

        <div className="font-display text-[13px] tracking-[0.18em] mb-3">ADD FUNDS</div>

        {!qr && (
          <>
            <div className="flex items-center h-12 rounded-xl bg-black/40 border border-white/10 px-3 gap-1 mb-2">
              <span className="text-white/45 font-display">₹</span>
              <input
                inputMode="numeric"
                value={amount}
                onChange={(e) =>
                  setAmount(Math.min(200000, Number(e.target.value.replace(/\D/g, "")) || 0))
                }
                className="flex-1 bg-transparent outline-none font-display tabular text-lg"
              />
            </div>
            <div className="grid grid-cols-4 gap-1.5 mb-3">
              {PRESETS.map((n) => (
                <button
                  key={n}
                  onClick={() => setAmount(n)}
                  className={`h-9 rounded-lg text-[11px] font-display border ${
                    amount === n
                      ? "bg-white/15 border-white/40"
                      : "bg-white/5 border-white/10 text-white/75"
                  }`}
                >
                  ₹{n}
                </button>
              ))}
            </div>
            {error && (
              <div className="rounded-xl bg-[#ff4d6d]/12 border border-[#ff4d6d]/35 px-3 py-2 text-[11px] text-[#ff8a9c] mb-2.5 leading-snug">
                {error}
              </div>
            )}
            <button
              disabled={amount < 10 || busy}
              onClick={generate}
              className="w-full h-12 rounded-xl font-display text-[13px] tracking-[0.14em] disabled:opacity-50 grid place-items-center"
              style={{ background: "linear-gradient(180deg,#ffd83a,#f0a415)", color: "#231a00" }}
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : "SHOW UPI QR CODE"}
            </button>
            <p className="mt-2 text-center text-[10px] text-white/35 font-display tracking-[0.12em]">
              INSTANT CREDIT · ZERO FEE · 100% PROTECTED
            </p>
          </>
        )}

        {qr && !paidInfo && (
          <div className="text-center">
            <div className="mx-auto w-56 h-56 rounded-2xl bg-white p-3 overflow-hidden grid place-items-center shadow-[0_0_30px_rgba(255,255,255,0.12)]">
              <img
                src={qr.cleanQrDataUrl || qr.url}
                alt="UPI payment QR code"
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain block select-none"
              />
            </div>
            <div className="mt-3 font-display text-lg tabular">
              {formatINR(qr.amountPaise / 100)}
            </div>
            <div className="mt-1 flex items-center justify-center gap-1.5 text-[10px] font-display tracking-[0.14em] text-[#ffc32b]">
              <Loader2 size={12} className="animate-spin" /> WAITING FOR UPI CONFIRMATION…
            </div>
            <button
              type="button"
              disabled={checkingNow}
              onClick={() => void verifyDepositStatus(qr.id, qr.amountPaise, true)}
              className="mt-3 w-full h-10 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 font-display text-[11px] tracking-[0.12em] text-white flex items-center justify-center gap-1.5 disabled:opacity-50 transition"
            >
              {checkingNow ? (
                <>
                  <Loader2 size={13} className="animate-spin" /> VERIFYING PAYMENT…
                </>
              ) : (
                "I HAVE PAID · CHECK STATUS NOW"
              )}
            </button>
            {checkHint && (
              <p className="mt-2 text-[10.5px] text-[#ffd83a] leading-snug">{checkHint}</p>
            )}
            <p className="mt-2 text-[10px] text-white/40 leading-relaxed">
              Scan with GPay, PhonePe, Paytm or any UPI app. Your wallet is credited the instant
              your bank confirms the transfer (even if you switch apps).
            </p>
          </div>
        )}

        {paidInfo && (
          <div className="text-center py-4">
            <ShieldCheck size={42} className="mx-auto text-[#26ff9a]" />
            <div className="mt-2.5 font-display text-[15px] tracking-[0.14em] text-[#26ff9a]">
              PAYMENT CREDITED
            </div>
            <div className="mt-3 rounded-xl bg-black/40 border border-[#26ff9a]/30 p-3 space-y-1.5 text-left">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-white/50">Amount Credited</span>
                <span className="font-display tabular text-[#26ff9a]">
                  +{formatINR(paidInfo.creditedPaise / 100)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] border-t border-white/10 pt-1.5">
                <span className="text-white/50">Available Balance</span>
                <span className="font-display tabular text-white">
                  {formatINR(paidInfo.newBalancePaise / 100)}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="mt-4 w-full h-11 rounded-xl font-display text-[12px] tracking-[0.14em] text-black"
              style={{ background: "#26ff9a" }}
            >
              DONE · BACK TO RACE
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
