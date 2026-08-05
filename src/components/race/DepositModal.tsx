import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldCheck, X } from "lucide-react";
import { checkDeposit, createDeposit } from "@/lib/wallet.functions";
import { formatINR } from "@/lib/car-label";

interface Props {
  open: boolean;
  onClose: () => void;
  onCredited: (balancePaise: number) => void;
}

const PRESETS = [50, 100, 500, 1000];

/**
 * QR-only deposit flow. The client never handles a payment token — it just
 * shows the Razorpay UPI QR and polls the server until the money is credited.
 */
export function DepositModal({ open, onClose, onCredited }: Props) {
  const start = useServerFn(createDeposit);
  const poll = useServerFn(checkDeposit);

  const [amount, setAmount] = useState(100);
  const [qr, setQr] = useState<{ id: string; url: string; amountPaise: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const reset = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setQr(null);
    setPaid(false);
    setError(null);
    setBusy(false);
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  useEffect(() => {
    if (!qr || paid) return;
    timer.current = setInterval(async () => {
      try {
        const res = await poll({ data: { depositId: qr.id } });
        if (res.status === "paid") {
          setPaid(true);
          onCredited(res.balancePaise);
          if (timer.current) clearInterval(timer.current);
        }
      } catch {
        /* keep polling — transient network errors are expected */
      }
    }, 4000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [qr, paid, poll, onCredited]);

  if (!open) return null;

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await start({ data: { amountPaise: Math.round(amount * 100) } });
      setQr({ id: res.depositId, url: res.qrImageUrl, amountPaise: res.amountPaise });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the payment");
    }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/80 px-5 animate-fade-in">
      <div className="w-full max-w-sm glass rounded-2xl p-4 relative">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 w-8 h-8 rounded-lg grid place-items-center bg-white/10"
        >
          <X size={15} />
        </button>

        <div className="font-display text-[13px] tracking-[0.18em] mb-3">ADD MONEY</div>

        {!qr && (
          <>
            <div className="flex items-center h-12 rounded-xl bg-black/40 border border-white/10 px-3 gap-1 mb-2">
              <span className="text-white/45 font-display">₹</span>
              <input
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(Math.min(200000, Number(e.target.value.replace(/\D/g, "")) || 0))}
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
            {error && <p className="text-[11px] text-[#ff4d6d] mb-2">{error}</p>}
            <button
              disabled={amount < 10 || busy}
              onClick={generate}
              className="w-full h-12 rounded-xl font-display text-[13px] tracking-[0.14em] disabled:opacity-50 grid place-items-center"
              style={{ background: "linear-gradient(180deg,#ffd83a,#f0a415)", color: "#231a00" }}
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : "SHOW UPI QR CODE"}
            </button>
            <p className="mt-2 text-center text-[10px] text-white/35 font-display tracking-[0.12em]">
              MINIMUM ₹10 · SCAN & PAY WITH ANY UPI APP
            </p>
          </>
        )}

        {qr && !paid && (
          <div className="text-center">
            <div className="mx-auto w-52 h-52 rounded-xl bg-white p-2 grid place-items-center">
              <img src={qr.url} alt="UPI payment QR code" className="w-full h-full object-contain" />
            </div>
            <div className="mt-3 font-display text-lg tabular">{formatINR(qr.amountPaise / 100)}</div>
            <div className="mt-1 flex items-center justify-center gap-1.5 text-[10px] font-display tracking-[0.14em] text-white/45">
              <Loader2 size={12} className="animate-spin" /> WAITING FOR PAYMENT…
            </div>
            <p className="mt-2 text-[10px] text-white/35 leading-relaxed">
              Scan with GPay, PhonePe, Paytm or any UPI app. Your balance updates automatically the
              moment the payment is confirmed.
            </p>
          </div>
        )}

        {paid && (
          <div className="text-center py-6">
            <ShieldCheck size={40} className="mx-auto text-[#26ff9a]" />
            <div className="mt-3 font-display text-[15px] tracking-[0.14em] text-[#26ff9a]">
              PAYMENT RECEIVED
            </div>
            <button
              onClick={onClose}
              className="mt-4 w-full h-11 rounded-xl font-display text-[12px] tracking-[0.14em] bg-white/10"
            >
              BACK TO THE RACE
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
