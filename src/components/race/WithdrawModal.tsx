import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, X } from "lucide-react";
import { myWithdrawals, requestWithdrawal } from "@/lib/wallet.functions";

interface Props {
  open: boolean;
  onClose: () => void;
  balancePaise: number;
}

const MIN_WITHDRAW_PAISE = 10_000; // ₹100

const rupees = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export function WithdrawModal({ open, onClose, balancePaise }: Props) {
  const requestFn = useServerFn(requestWithdrawal);
  const listFn = useServerFn(myWithdrawals);
  const qc = useQueryClient();
  const [amount, setAmount] = useState("100");
  const [upi, setUpi] = useState("");

  const list = useQuery({
    queryKey: ["my-withdrawals"],
    queryFn: () => listFn({}),
    enabled: open,
  });

  const submit = useMutation({
    mutationFn: () =>
      requestFn({
        data: { amountPaise: Math.round(Number(amount) * 100), upiId: upi.trim() },
      }),
    onSuccess: () => {
      toast.success("Payout request sent — you'll be paid after review");
      setAmount("100");
      setUpi("");
      void qc.invalidateQueries({ queryKey: ["my-withdrawals"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!open) return null;

  const belowMinimum = balancePaise < MIN_WITHDRAW_PAISE;
  const progressPct = Math.min(100, Math.round((balancePaise / MIN_WITHDRAW_PAISE) * 100));
  const amountPaise = Math.round(Number(amount) * 100);
  const validUpi = /^[\w.-]{2,64}@[a-zA-Z]{2,32}$/.test(upi.trim());
  const canSubmit =
    !belowMinimum &&
    Number.isInteger(amountPaise) &&
    amountPaise >= MIN_WITHDRAW_PAISE &&
    amountPaise <= balancePaise &&
    validUpi;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm px-0 sm:px-4">
      <div
        className="glass w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
      >
        <div className="flex items-center justify-between">
          <div className="font-display text-white text-[15px]">Cash out</div>
          <button onClick={onClose} aria-label="Close" className="text-white/50 p-1">
            <X size={18} />
          </button>
        </div>

        <div className="text-[11px] text-white/50 mt-1">
          Withdrawable balance <span className="text-white font-display tabular">{rupees(balancePaise)}</span> · minimum ₹100
        </div>

        {/* Encouraging helper banner when balance < ₹100 */}
        {belowMinimum && (
          <div className="mt-3 rounded-2xl p-3 bg-[#ffc32b]/10 border border-[#ffc32b]/35 space-y-2">
            <div className="flex items-start gap-2">
              <Sparkles size={15} className="text-[#ffc32b] shrink-0 mt-0.5" />
              <p className="text-[11.5px] text-[#ffe28a] leading-snug font-medium">
                Bonus unlocked! Win up to ₹100 to cash out instantly via UPI.
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-display tracking-wide text-white/60 tabular">
                <span>PROGRESS TO CASHOUT</span>
                <span>{rupees(balancePaise)} / ₹100</span>
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
          AMOUNT (₹)
        </label>
        <input
          inputMode="numeric"
          disabled={belowMinimum}
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
          className="w-full mt-1 rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-white tabular outline-none disabled:opacity-45"
        />

        <label className="block mt-3 text-[9px] font-display tracking-[0.16em] text-white/40">
          UPI ID
        </label>
        <input
          disabled={belowMinimum}
          value={upi}
          onChange={(e) => setUpi(e.target.value)}
          placeholder="name@upi"
          className="w-full mt-1 rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-white outline-none disabled:opacity-45"
        />

        <button
          disabled={submit.isPending || !canSubmit || belowMinimum}
          onClick={() => submit.mutate()}
          className="w-full mt-4 rounded-xl py-3 font-display text-[12px] tracking-[0.12em] text-black disabled:opacity-45 transition"
          style={{ background: "#26ff9a" }}
        >
          {submit.isPending
            ? "Sending…"
            : belowMinimum
              ? `Reach ₹100 to cash out (${rupees(MIN_WITHDRAW_PAISE - balancePaise)} to go)`
              : "Request payout"}
        </button>
        {!belowMinimum && !canSubmit && (amount || upi) && (
          <p className="mt-2 text-center text-[10px] text-white/40">
            Enter at least ₹100, within your balance, and a valid UPI ID.
          </p>
        )}

        {(list.data ?? []).length > 0 && (
          <div className="mt-4">
            <div className="text-[9px] font-display tracking-[0.16em] text-white/40 mb-1">
              YOUR REQUESTS
            </div>
            {(list.data ?? []).map((w) => (
              <div
                key={w.id}
                className="flex items-center justify-between py-1.5 border-t border-white/5 text-[12px]"
              >
                <span className="text-white/70 tabular">{rupees(w.amountPaise)}</span>
                <span
                  className="text-[10px]"
                  style={{
                    color:
                      w.status === "paid"
                        ? "#26ff9a"
                        : w.status === "rejected"
                          ? "#ff6b6b"
                          : "#ffc32b",
                  }}
                >
                  {w.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
