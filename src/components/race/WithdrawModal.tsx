import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Check,
  CheckCircle2,
  Clock,
  Info,
  Lock,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
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
const PRESET_AMOUNTS = [100, 250, 500];

const rupees = (paise: number) =>
  `₹${(Math.max(0, paise) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

function formatEta24h(createdAtIso: string, nowMs: number): string {
  const createdMs = new Date(createdAtIso).getTime();
  if (!Number.isFinite(createdMs)) return "Within 24h";
  const targetMs = createdMs + PAYOUT_WINDOW_MS;
  const remainingMs = targetMs - nowMs;
  if (remainingMs <= 0) return "Ready for settlement";
  const totalMins = Math.ceil(remainingMs / 60_000);
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return `${hrs}h ${String(mins).padStart(2, "0")}m left`;
}

export function WithdrawModal({ open, onClose, balancePaise, heldPaise = 0, onRequested }: Props) {
  const requestFn = useServerFn(requestWithdrawal);
  const listFn = useServerFn(myWithdrawals);
  const qc = useQueryClient();

  const [amount, setAmount] = useState("100");
  const [upi, setUpi] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [showProtocolInfo, setShowProtocolInfo] = useState(false);

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

  const availablePaise = Math.max(0, balancePaise);
  const totalWalletPaise = availablePaise + computedHeldPaise;

  const submit = useMutation({
    mutationFn: () =>
      requestFn({
        data: { amountPaise: Math.round(Number(amount) * 100), upiId: upi.trim().toLowerCase() },
      }),
    onSuccess: (res) => {
      toast.success(
        "Payout successfully queued in 24-hour security escrow. Funds will transfer to your UPI upon audit completion.",
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
  const amountNumber = Number(amount) || 0;
  const amountPaise = Math.round(amountNumber * 100);
  const validUpi = /^[\w.-]{2,64}@[a-zA-Z]{2,32}$/.test(upi.trim());
  const exceedsBalance = amountPaise > availablePaise;
  const belowRequiredAmount = amountPaise < MIN_WITHDRAW_PAISE;

  const canSubmit =
    !belowMinimum &&
    Number.isInteger(amountPaise) &&
    !belowRequiredAmount &&
    !exceedsBalance &&
    validUpi;

  const handlePresetSelect = (preset: number) => {
    setAmount(String(preset));
  };

  const handleMaxSelect = () => {
    const maxRupees = Math.floor(availablePaise / 100);
    if (maxRupees > 0) {
      setAmount(String(maxRupees));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md px-0 sm:px-4 animate-fade-in">
      <div
        className="w-full sm:max-w-md rounded-t-[28px] sm:rounded-[28px] bg-[#07090e] border border-white/10 p-4 sm:p-5 max-h-[92dvh] overflow-y-auto text-white shadow-2xl [scrollbar-width:none] relative"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)",
          background:
            "radial-gradient(circle at 50% 0%, rgba(38,255,154,0.06) 0%, rgba(7,9,14,0.98) 75%)",
        }}
      >
        {/* Subtle mobile pull indicator */}
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-3 sm:hidden" />

        {/* Header: Identity, Trust Kicker & Close */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-[#26ff9a] shrink-0">
              <Wallet size={19} />
            </div>
            <div>
              <h2 className="font-display text-[15px] tracking-wide text-white font-medium">
                Withdraw to UPI
              </h2>
              <div className="flex items-center gap-2 text-[10px] text-white/45 mt-0.5">
                <span>Direct Bank Settlement</span>
                <span aria-hidden="true">·</span>
                <span className="text-[#26ff9a]/90 font-medium">0% Fee</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close cash out dialog"
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 active:scale-95 flex items-center justify-center text-white/50 hover:text-white transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* 1. PROGRESS & TRANSPARENCY: Financial Telemetry Deck */}
        <div className="mt-4 rounded-2xl bg-white/[0.02] border border-white/10 p-3.5 relative overflow-hidden">
          {/* Subtle ambient gradient mesh */}
          <div
            className="pointer-events-none absolute -right-10 -top-10 w-32 h-32 rounded-full blur-3xl opacity-20"
            style={{ background: belowMinimum ? "#ffc32b" : "#26ff9a" }}
          />

          <div className="flex items-baseline justify-between">
            <span className="text-[10px] font-display uppercase tracking-[0.16em] text-white/45">
              Available For Payout
            </span>
            <span className="text-[10px] text-white/40 tabular">Threshold: ₹100</span>
          </div>

          <div className="mt-1 flex items-baseline justify-between">
            <span className="font-display text-2xl sm:text-3xl tabular text-white font-semibold tracking-tight">
              {rupees(availablePaise)}
            </span>
            {!belowMinimum && (
              <span className="inline-flex items-center gap-1 text-[10.5px] font-display text-[#26ff9a] bg-[#26ff9a]/10 border border-[#26ff9a]/25 px-2 py-0.5 rounded-full">
                <Check size={11} /> Eligible to cash out
              </span>
            )}
          </div>

          {/* Progress towards ₹100 eligibility */}
          {belowMinimum ? (
            <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
              <div className="flex items-center justify-between text-[10px] font-display tabular tracking-wider text-white/60">
                <span className="text-[#ffe28a] flex items-center gap-1.5">
                  <Sparkles size={11} className="text-[#ffc32b]" />
                  {rupees(MIN_WITHDRAW_PAISE - availablePaise)} needed to unlock payout
                </span>
                <span>{progressPct}%</span>
              </div>
              <div className="h-2 rounded-full bg-black/60 border border-white/5 overflow-hidden p-[1px]">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${Math.max(4, progressPct)}%`,
                    background: "linear-gradient(90deg, #ffc32b, #26ff9a)",
                    boxShadow: "0 0 10px rgba(38,255,154,0.4)",
                  }}
                />
              </div>
              <p className="text-[10.5px] text-white/50 leading-relaxed">
                Win rounds on the track to grow your balance to the ₹100 milestone.
              </p>
            </div>
          ) : null}

          {/* Reserved Escrow & Total Breakdown */}
          {computedHeldPaise > 0 && (
            <div className="mt-3 pt-2.5 border-t border-white/5 space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between text-[#ffc32b]/90">
                <span className="flex items-center gap-1.5">
                  <Clock size={12} />
                  <span>In 24h Escrow Verification</span>
                </span>
                <span className="font-display tabular font-medium">
                  {rupees(computedHeldPaise)}
                </span>
              </div>
              <div className="flex items-center justify-between text-white/50 text-[10.5px]">
                <span>Total Portfolio (Wallet + Escrow)</span>
                <span className="font-display tabular text-white/70">
                  {rupees(totalWalletPaise)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 2. TRUST: 24-Hour Settlement Protocol Banner */}
        <div className="mt-3 rounded-xl bg-white/[0.02] border border-white/10 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5">
              <ShieldCheck size={16} className="text-[#26ff9a] shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-display font-medium text-white tracking-wide">
                    24-Hour Escrow Protection
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowProtocolInfo(!showProtocolInfo)}
                    className="text-[10px] text-white/40 hover:text-white flex items-center gap-0.5 transition cursor-pointer"
                  >
                    <Info size={11} />
                    <span>{showProtocolInfo ? "Hide" : "How it works"}</span>
                  </button>
                </div>
                <p className="text-[10.5px] text-white/60 leading-relaxed mt-0.5">
                  Requested amounts are held securely in escrow before debit. If any issue arises,
                  funds return 100% to your balance.
                </p>
              </div>
            </div>
          </div>

          {/* Expandable Protocol Steps */}
          {showProtocolInfo && (
            <div className="mt-3 pt-2.5 border-t border-white/5 grid grid-cols-3 gap-2 text-center animate-fade-in">
              <div className="p-2 rounded-lg bg-black/40 border border-white/5">
                <div className="text-[9px] font-display text-[#26ff9a] uppercase tracking-wider">
                  1. Request
                </div>
                <div className="text-[10px] text-white/60 mt-0.5 leading-tight">
                  Locked in zero-fee escrow
                </div>
              </div>
              <div className="p-2 rounded-lg bg-black/40 border border-white/5">
                <div className="text-[9px] font-display text-[#ffc32b] uppercase tracking-wider">
                  2. 24h Audit
                </div>
                <div className="text-[10px] text-white/60 mt-0.5 leading-tight">
                  Game fairness verification
                </div>
              </div>
              <div className="p-2 rounded-lg bg-black/40 border border-white/5">
                <div className="text-[9px] font-display text-[#26ff9a] uppercase tracking-wider">
                  3. Payout
                </div>
                <div className="text-[10px] text-white/60 mt-0.5 leading-tight">
                  Direct transfer to UPI
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 3. ACTION: Amount & UPI Destination Form */}
        <div className="mt-4 space-y-3.5">
          {/* Amount Input & Preset Chips */}
          <div>
            <div className="flex items-center justify-between text-[10px] font-display uppercase tracking-[0.14em] text-white/50">
              <label htmlFor="payout-amount">Withdrawal Amount</label>
              <span>Min ₹100</span>
            </div>

            <div className="mt-1.5 relative flex items-center">
              <span className="absolute left-3.5 text-white/40 font-display text-base select-none">
                ₹
              </span>
              <input
                id="payout-amount"
                inputMode="numeric"
                disabled={belowMinimum}
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="100"
                className="w-full rounded-xl bg-white/[0.04] border border-white/10 pl-8 pr-3 py-2.5 text-white font-display text-base tabular outline-none focus:border-[#26ff9a]/60 focus:bg-white/[0.07] transition disabled:opacity-40"
              />
            </div>

            {/* Quick Preset Selector Chips */}
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {PRESET_AMOUNTS.map((val) => {
                const isSelected = amount === String(val);
                const disabled = belowMinimum || val * 100 > availablePaise;
                return (
                  <button
                    key={val}
                    type="button"
                    disabled={disabled}
                    onClick={() => handlePresetSelect(val)}
                    className={`h-8 rounded-lg text-[11px] font-display tracking-wide border transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none cursor-pointer ${
                      isSelected
                        ? "bg-[#26ff9a]/15 border-[#26ff9a]/60 text-[#26ff9a]"
                        : "bg-white/[0.03] border-white/10 text-white/70 hover:text-white hover:bg-white/[0.06]"
                    }`}
                  >
                    ₹{val}
                  </button>
                );
              })}
              <button
                type="button"
                disabled={belowMinimum || availablePaise < MIN_WITHDRAW_PAISE}
                onClick={handleMaxSelect}
                className={`h-8 rounded-lg text-[11px] font-display tracking-wide border transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none cursor-pointer ${
                  amount === String(Math.floor(availablePaise / 100)) &&
                  availablePaise >= MIN_WITHDRAW_PAISE
                    ? "bg-[#ffd83a]/20 border-[#ffd83a]/70 text-[#ffd83a]"
                    : "bg-[#ffd83a]/5 border-[#ffd83a]/30 text-[#ffd83a]/80 hover:text-[#ffd83a] hover:bg-[#ffd83a]/10"
                }`}
              >
                MAX
              </button>
            </div>

            {/* Contextual Amount Validation Messages */}
            {exceedsBalance && !belowMinimum && (
              <div className="mt-1.5 flex items-center gap-1 text-[10.5px] text-[#ff6b6b]">
                <AlertCircle size={12} />
                <span>Exceeds available balance of {rupees(availablePaise)}</span>
              </div>
            )}
            {belowRequiredAmount && amount && !belowMinimum && !exceedsBalance && (
              <div className="mt-1.5 flex items-center gap-1 text-[10.5px] text-[#ffe28a]">
                <AlertCircle size={12} />
                <span>Minimum withdrawal amount is ₹100</span>
              </div>
            )}
          </div>

          {/* Receiving UPI ID Input with Instant Validation */}
          <div>
            <div className="flex items-center justify-between text-[10px] font-display uppercase tracking-[0.14em] text-white/50">
              <label htmlFor="upi-vpa">Receiving UPI ID (VPA)</label>
              {validUpi && (
                <span className="text-[#26ff9a] flex items-center gap-1 font-sans capitalize text-[10.5px]">
                  <CheckCircle2 size={11} /> Format verified
                </span>
              )}
            </div>

            <div className="mt-1.5 relative flex items-center">
              <input
                id="upi-vpa"
                disabled={belowMinimum}
                value={upi}
                onChange={(e) => setUpi(e.target.value.toLowerCase().trim())}
                placeholder="username@bank (e.g. 9876543210@paytm)"
                className="w-full rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2.5 text-white font-sans text-[13px] outline-none focus:border-[#26ff9a]/60 focus:bg-white/[0.07] transition disabled:opacity-40"
              />
            </div>
            <p className="mt-1 text-[10px] text-white/40">
              Ensure this UPI handle is active and linked to your bank account.
            </p>
          </div>

          {/* Definitive Action Button */}
          <div className="pt-1">
            <button
              disabled={submit.isPending || !canSubmit}
              onClick={() => submit.mutate()}
              className="w-full h-12 rounded-xl font-display text-[12.5px] tracking-[0.12em] font-medium transition-all active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer relative overflow-hidden"
              style={{
                background: belowMinimum
                  ? "rgba(255,255,255,0.08)"
                  : "linear-gradient(135deg, #26ff9a 0%, #17c975 100%)",
                color: belowMinimum ? "rgba(255,255,255,0.4)" : "#04140a",
                boxShadow: canSubmit ? "0 8px 24px -6px rgba(38,255,154,0.5)" : "none",
              }}
            >
              {submit.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  <span>Queuing in 24h Escrow…</span>
                </>
              ) : belowMinimum ? (
                <>
                  <Lock size={14} />
                  <span>{rupees(MIN_WITHDRAW_PAISE - availablePaise)} More Needed to Unlock</span>
                </>
              ) : !validUpi ? (
                <>
                  <span>Enter Valid UPI ID to Continue</span>
                  <ArrowRight size={14} />
                </>
              ) : exceedsBalance ? (
                <span>Amount Exceeds Balance</span>
              ) : belowRequiredAmount ? (
                <span>Minimum Amount is ₹100</span>
              ) : (
                <>
                  <Lock size={14} />
                  <span>Authorize {rupees(amountPaise)} Payout</span>
                </>
              )}
            </button>

            <div className="mt-2 text-center text-[10px] text-white/35">
              Encrypted 24-hour settlement gateway · 100% balance return guarantee
            </div>
          </div>
        </div>

        {/* 4. TRANSACTION TIMELINE & STATUS (Auditability) */}
        {(list.data ?? []).length > 0 && (
          <div className="mt-5 pt-4 border-t border-white/10">
            <div className="flex items-center justify-between text-[10px] font-display uppercase tracking-[0.16em] text-white/45 mb-2.5">
              <span>Settlement Timeline</span>
              <span>{(list.data ?? []).length} Total</span>
            </div>

            <div className="space-y-2">
              {(list.data ?? []).map((w) => {
                const isPending = w.status === "pending";
                const isPaid = w.status === "paid";
                return (
                  <div
                    key={w.id}
                    className="rounded-xl bg-white/[0.02] border border-white/5 p-3 hover:border-white/15 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-display tabular text-white font-medium text-[13px]">
                          {rupees(w.amountPaise)}
                        </span>
                        <span className="text-[10px] text-white/45 truncate max-w-[130px]">
                          via {w.upiId}
                        </span>
                      </div>

                      <span
                        className="text-[9.5px] font-display uppercase tracking-wider px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                        style={{
                          color: isPaid
                            ? "#26ff9a"
                            : w.status === "rejected"
                              ? "#ff6b6b"
                              : "#ffc32b",
                          background: isPaid
                            ? "rgba(38,255,154,0.1)"
                            : w.status === "rejected"
                              ? "rgba(255,107,107,0.1)"
                              : "rgba(255,195,43,0.1)",
                          border: `1px solid ${
                            isPaid
                              ? "rgba(38,255,154,0.25)"
                              : w.status === "rejected"
                                ? "rgba(255,107,107,0.25)"
                                : "rgba(255,195,43,0.25)"
                          }`,
                        }}
                      >
                        {isPending && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#ffc32b] animate-pulse" />
                        )}
                        {isPaid
                          ? "Settled to Bank"
                          : w.status === "rejected"
                            ? "Refunded to Wallet"
                            : "24h Escrow Lock"}
                      </span>
                    </div>

                    <div className="mt-1.5 flex items-center justify-between text-[10px] text-white/40">
                      <span>
                        Requested{" "}
                        {new Date(w.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>

                      {isPending ? (
                        <span className="text-[#ffc32b] font-display tabular font-medium">
                          {formatEta24h(w.createdAt, nowMs)}
                        </span>
                      ) : (
                        <span>
                          {new Date(w.processedAt || w.createdAt).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
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
