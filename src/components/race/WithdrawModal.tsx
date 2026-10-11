import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Clock, ShieldCheck, Sparkles, X } from "lucide-react";
import { myWithdrawals, requestWithdrawal } from "@/lib/wallet.functions";

interface Props {
  open: boolean;
  onClose: () => void;
  balancePaise: number;
  heldPaise?: number;
  onRequested?: (availablePaise: number, heldPaise: number, totalBalancePaise: number) => void;
}

const MIN_WITHDRAW_PAISE = 10_000; // ₹100
const PAYOUT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

const rupees = (paise: number) =>
  `₹${(Math.max(0, paise) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

function formatEta24h(createdAtIso: string, nowMs: number): string {
  const createdMs = new Date(createdAtIso).getTime();
  if (!Number.isFinite(createdMs)) return "Within 24h";
  const targetMs = createdMs + PAYOUT_WINDOW_MS;
  const remainingMs = targetMs - nowMs;
  if (remainingMs <= 0) return "Ready for final settlement";
  const totalMins = Math.ceil(remainingMs / 60_000);
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return `${hrs}h ${String(mins).padStart(2, "0")}m remaining`;
}

export function WithdrawModal({
  open,
  onClose,
  balancePaise,
  heldPaise = 0,
  onRequested,
}: Props) {
  const requestFn = useServerFn(requestWithdrawal);
  const listFn = useServerFn(myWithdrawals);
  const qc = useQueryClient();
  const [amount, setAmount] = useState("100");
  const [upi, setUpi] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());

  const list = useQuery({
    queryKey: ["my-withdrawals"],
    queryFn: () => listFn({}),
    enabled: open,
    refetchInterval: open ? 15_000 : false,
  });

  useEffect(() => {
    if (!open) return;
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [open]);

  const computedHeldPaise =
    (list.data ?? [])
      .filter((w) => w.status === "pending")
      .reduce((sum, w) => sum + Number(w.amountPaise || 0), 0) || heldPaise;

  // balancePaise passed from parent is availablePaise; total wallet includes held escrow
  const availablePaise = Math.max(0, balancePaise);
  const totalWalletPaise = availablePaise + computedHeldPaise;

  const submit = useMutation({
    mutationFn: () =>
      requestFn({
        data: { amountPaise: Math.round(Number(amount) * 100), upiId: upi.trim().toLowerCase() },
      }),
    onSuccess: (res) => {
      toast.success(
        "Payout locked in 24-hour security escrow. Funds will be transferred to your UPI ID and debited within 24 hours.",
      );
      setAmount("100");
      setUpi("");
      if (onRequested && res) {
        onRequested(res.availablePaise, res.heldPaise, res.balancePaise);
      }
      void qc.invalidateQueries({ queryKey: ["my-withdrawals"] });
      void qc.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!open) return null;

  const belowMinimum = availablePaise < MIN_WITHDRAW_PAISE;
  const progressPct = Math.min(100, Math.round((availablePaise / MIN_WITHDRAW_PAISE) * 100));
  const amountPaise = Math.round(Number(amount) * 100);
  const validUpi = /^[\w.-]{2,64}@[a-zA-Z]{2,32}$/.test(upi.trim());
  const canSubmit =
    !belowMinimum &&
    Number.isInteger(amountPaise) &&
    amountPaise >= MIN_WITHDRAW_PAISE &&
    amountPaise <= availablePaise &&
    validUpi;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm px-0 sm:px-4">
      <div
        className="glass w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-4 max-h-[90dvh] overflow-y-auto"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
      >
        <div className="flex items-center justify-between">
          <div className="font-display text-white text-[15px]">Cash out to UPI</div>
          <button onClick={onClose} aria-label="Close cash out dialog" className="text-white/50 p-1">
            <X size={18} />
          </button>
        </div>

        {/* Transparent Wallet Breakdown so user never feels any money is missing */}
        <div className="mt-2.5 rounded-2xl bg-black/40 border border-white/10 p-3 space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-white/55">Available to play / cash out</span>
            <span className="font-display tabular text-white">{rupees(availablePaise)}</span>
          </div>
          {computedHeldPaise > 0 && (
            <>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#ffc32b]/90 flex items-center gap-1">
                  <Clock size={11} /> Reserved in 24h payout escrow
                </span>
                <span className="font-display tabular text-[#ffc32b]">
                  {rupees(computedHeldPaise)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] border-t border-white/10 pt-1.5">
                <span className="text-white/45">Total wallet balance (pre-debit)</span>
                <span className="font-display tabular text-white/85">
                  {rupees(totalWalletPaise)}
                </span>
              </div>
            </>
          )}
        </div>

        {/* 24-Hour Security Settlement Notice */}
        <div className="mt-2.5 rounded-xl bg-[#26ff9a]/8 border border-[#26ff9a]/25 px-3 py-2 flex items-start gap-2">
          <ShieldCheck size={14} className="text-[#26ff9a] shrink-0 mt-0.5" />
          <p className="text-[10.5px] text-white/70 leading-relaxed">
            <span className="text-[#26ff9a] font-display">24-HOUR PROTECTED DEBIT:</span> When you
            request a payout, your amount is safely reserved in escrow and{" "}
            <span className="text-white">only debited after 24 hours</span> once the UPI transfer is
            settled. If a request is declined, 100% is unlocked back to your playable balance.
          </p>
        </div>

        {/* Progress helper banner when available balance < ₹100 */}
        {belowMinimum && (
          <div className="mt-3 rounded-2xl p-3 bg-[#ffc32b]/10 border border-[#ffc32b]/35 space-y-2">
            <div className="flex items-start gap-2">
              <Sparkles size={15} className="text-[#ffc32b] shrink-0 mt-0.5" />
              <p className="text-[11.5px] text-[#ffe28a] leading-snug font-medium">
                Reach ₹100 in available balance to request a UPI payout.
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-display tracking-wide text-white/60 tabular">
                <span>PROGRESS TO ₹100 MINIMUM</span>
                <span>{rupees(availablePaise)} / ₹100</span>
              </div>
              <div className="h-1.5 rounded-full bg-black/40 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${progressPct}%`,
                    background: "linear-gradient(90deg, #ffc32b, #26ff9a)",
                  }}
                />
              </div>
            </div>
          </div>
        )}

        <label className="block mt-3 text-[9px] font-display tracking-[0.16em] text-white/40">
          AMOUNT (₹) · MIN ₹100
        </label>
        <input
          inputMode="numeric"
          disabled={belowMinimum}
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
          className="w-full mt-1 rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-white tabular outline-none disabled:opacity-45"
        />

        <label className="block mt-3 text-[9px] font-display tracking-[0.16em] text-white/40">
          RECEIVING UPI ID
        </label>
        <input
          disabled={belowMinimum}
          value={upi}
          onChange={(e) => setUpi(e.target.value)}
          placeholder="yourname@upi"
          className="w-full mt-1 rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-white outline-none disabled:opacity-45"
        />

        <button
          disabled={submit.isPending || !canSubmit || belowMinimum}
          onClick={() => submit.mutate()}
          className="w-full mt-4 rounded-xl py-3 font-display text-[12px] tracking-[0.12em] text-black disabled:opacity-45 transition"
          style={{ background: "#26ff9a" }}
        >
          {submit.isPending
            ? "Locking payout in escrow…"
            : belowMinimum
              ? `${rupees(MIN_WITHDRAW_PAISE - availablePaise)} more needed to cash out`
              : `Lock ${rupees(Number.isFinite(amountPaise) ? amountPaise : 0)} for 24h UPI payout`}
        </button>
        {!belowMinimum && !canSubmit && (amount || upi) && (
          <p className="mt-2 text-center text-[10px] text-white/40">
            Enter an amount between ₹100 and {rupees(availablePaise)}, plus a valid UPI ID (e.g.
            name@upi).
          </p>
        )}

        {(list.data ?? []).length > 0 && (
          <div className="mt-4">
            <div className="text-[9px] font-display tracking-[0.16em] text-white/40 mb-1.5">
              PAYOUT SCHEDULE & STATUS
            </div>
            <div className="space-y-1.5">
              {(list.data ?? []).map((w) => {
                const isPending = w.status === "pending";
                const isPaid = w.status === "paid";
                return (
                  <div
                    key={w.id}
                    className="rounded-xl bg-white/[0.03] border border-white/10 px-3 py-2 text-[11.5px]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display tabular text-white">
                        {rupees(w.amountPaise)}
                      </span>
                      <span
                        className="text-[9.5px] font-display uppercase tracking-wider px-2 py-0.5 rounded-md"
                        style={{
                          color: isPaid ? "#26ff9a" : w.status === "rejected" ? "#ff6b6b" : "#ffc32b",
                          background: isPaid
                            ? "rgba(38,255,154,0.12)"
                            : w.status === "rejected"
                              ? "rgba(255,107,107,0.12)"
                              : "rgba(255,195,43,0.12)",
                        }}
                      >
                        {isPaid
                          ? "DEBITED & PAID"
                          : w.status === "rejected"
                            ? "REFUNDED TO WALLET"
                            : "RESERVED · 24H ESCROW"}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-white/45">
                      <span className="truncate max-w-[155px]">UPI: {w.upiId}</span>
                      {isPending ? (
                        <span className="text-[#ffc32b] font-display tabular">
                          {formatEta24h(w.createdAt, nowMs)}
                        </span>
                      ) : (
                        <span>
                          {new Date(w.processedAt || w.createdAt).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
