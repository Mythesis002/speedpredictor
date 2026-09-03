import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { X } from "lucide-react";
import { myWithdrawals, requestWithdrawal } from "@/lib/wallet.functions";

interface Props {
  open: boolean;
  onClose: () => void;
  balancePaise: number;
}

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
      setUpi("");
      void qc.invalidateQueries({ queryKey: ["my-withdrawals"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        className="glass w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
      >
        <div className="flex items-center justify-between">
          <div className="font-display text-white text-[15px]">Cash out</div>
          <button onClick={onClose} className="text-white/50 p-1">
            <X size={18} />
          </button>
        </div>

        <div className="text-[11px] text-white/45 mt-1">
          Withdrawable balance {rupees(balancePaise)} · minimum ₹100
        </div>

        <label className="block mt-3 text-[9px] font-display tracking-[0.16em] text-white/40">
          AMOUNT (₹)
        </label>
        <input
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
          className="w-full mt-1 rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-white tabular outline-none"
        />

        <label className="block mt-3 text-[9px] font-display tracking-[0.16em] text-white/40">
          UPI ID
        </label>
        <input
          value={upi}
          onChange={(e) => setUpi(e.target.value)}
          placeholder="name@upi"
          className="w-full mt-1 rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-white outline-none"
        />

        <button
          disabled={submit.isPending}
          onClick={() => submit.mutate()}
          className="w-full mt-4 rounded-xl py-3 font-display text-black disabled:opacity-50"
          style={{ background: "#26ff9a" }}
        >
          {submit.isPending ? "Sending…" : "Request payout"}
        </button>

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
