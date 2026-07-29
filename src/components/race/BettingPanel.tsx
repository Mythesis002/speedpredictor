import { Minus, Plus } from "lucide-react";

interface Props {
  amount: number;
  balance: number;
  locked: boolean;
  onChange: (n: number) => void;
  selectedLabel: string | null;
  onConfirm: () => void;
  confirmed: boolean;
  phaseLabel: string;
}

const CHIPS = [100, 500, 1000, 5000];

export function BettingPanel({
  amount,
  balance,
  locked,
  onChange,
  selectedLabel,
  onConfirm,
  confirmed,
}: Props) {
  const clamp = (n: number) => Math.max(100, Math.min(balance, Math.round(n)));
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="font-display text-[10px] tracking-[0.22em] text-white/45">
          BET AMOUNT
        </span>
        <span className="text-[10px] tracking-[0.18em] text-white/40 font-display tabular">
          BAL ₹{balance.toLocaleString("en-IN")}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center h-11 rounded-xl bg-black/40 border border-white/10 overflow-hidden">
          <button
            disabled={locked}
            onClick={() => onChange(clamp(amount - 100))}
            className="h-11 w-10 grid place-items-center active:scale-95 disabled:opacity-40"
          >
            <Minus size={16} />
          </button>
          <span className="px-3 font-display text-base tabular text-white min-w-[86px] text-center bg-white/5 h-11 grid place-items-center">
            ₹{amount.toLocaleString("en-IN")}
          </span>
          <button
            disabled={locked}
            onClick={() => onChange(clamp(amount + 100))}
            className="h-11 w-10 grid place-items-center active:scale-95 disabled:opacity-40"
          >
            <Plus size={16} />
          </button>
        </div>

        <button
          disabled={locked || !selectedLabel || confirmed}
          onClick={onConfirm}
          className="flex-1 h-11 rounded-xl font-display text-[13px] tracking-[0.12em] disabled:opacity-50 active:scale-[0.98] transition relative overflow-hidden"
          style={{
            background: confirmed
              ? "linear-gradient(90deg, rgba(255,214,107,0.2), rgba(255,214,107,0.08))"
              : "linear-gradient(180deg,#ffd83a,#f0a415)",
            color: confirmed ? "#ffd66b" : "#231a00",
            boxShadow: confirmed
              ? "inset 0 0 0 1px rgba(255,214,107,0.5)"
              : "0 10px 26px -12px rgba(255,190,40,0.9)",
          }}
        >
          <span className="relative z-10">
            {confirmed
              ? `BET PLACED · ${selectedLabel}`
              : locked
                ? "BETS CLOSED"
                : selectedLabel
                  ? `PLACE BET · ${selectedLabel}`
                  : "SELECT A CAR"}
          </span>
          {!confirmed && !locked && selectedLabel && (
            <span className="absolute inset-0 animate-shimmer" />
          )}
        </button>
      </div>

      <div className="mt-2 grid grid-cols-5 gap-1.5">
        {CHIPS.map((n) => (
          <button
            key={n}
            disabled={locked}
            onClick={() => onChange(clamp(amount + n))}
            className="h-8 rounded-lg text-[11px] font-display tracking-wide bg-white/5 border border-white/10 active:scale-95 disabled:opacity-40"
          >
            +{n >= 1000 ? `${n / 1000}K` : n}
          </button>
        ))}
        <button
          disabled={locked}
          onClick={() => onChange(clamp(balance))}
          className="h-8 rounded-lg text-[11px] font-display tracking-wide bg-[#ffd83a]/10 border border-[#ffd83a]/40 text-[#ffd83a] active:scale-95 disabled:opacity-40"
        >
          MAX
        </button>
      </div>
    </div>
  );
}
