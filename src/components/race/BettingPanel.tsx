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

const CHIPS = [100, 500, 1000, 5000, 10000];

export function BettingPanel({
  amount,
  balance,
  locked,
  onChange,
  selectedLabel,
  onConfirm,
  confirmed,
  phaseLabel,
}: Props) {
  const clamp = (n: number) => Math.max(100, Math.min(balance, Math.round(n)));
  return (
    <div className="glass rounded-3xl p-3 mx-3">
      {/* amount display */}
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="font-display text-[10px] tracking-[0.2em] text-white/50">
          BET AMOUNT
        </span>
        <span className="font-display text-[10px] tracking-[0.2em] text-[oklch(0.85_0.19_195)]">
          {phaseLabel}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          disabled={locked}
          onClick={() => onChange(clamp(amount - 100))}
          className="h-11 w-11 rounded-2xl glass grid place-items-center active:scale-95 disabled:opacity-40"
        >
          <Minus size={18} />
        </button>

        <div className="flex-1 h-11 rounded-2xl glass flex items-center justify-center relative overflow-hidden">
          <div className="animate-shimmer absolute inset-0 opacity-40" />
          <span className="font-display text-2xl tabular text-white">
            ₹{amount.toLocaleString("en-IN")}
          </span>
        </div>

        <button
          disabled={locked}
          onClick={() => onChange(clamp(amount + 100))}
          className="h-11 w-11 rounded-2xl glass grid place-items-center active:scale-95 disabled:opacity-40"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* chips */}
      <div className="mt-2 grid grid-cols-5 gap-1.5">
        {CHIPS.map((n) => (
          <button
            key={n}
            disabled={locked}
            onClick={() => onChange(clamp(n))}
            className="h-8 rounded-lg text-[11px] font-display tracking-wider bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95 disabled:opacity-40"
          >
            {n >= 1000 ? `${n / 1000}K` : n}
          </button>
        ))}
      </div>
      <div className="mt-1.5 grid grid-cols-3 gap-1.5">
        <button
          disabled={locked}
          onClick={() => onChange(clamp(amount / 2))}
          className="h-8 rounded-lg text-[11px] font-display tracking-wider bg-white/5 border border-white/10 active:scale-95 disabled:opacity-40"
        >
          HALF
        </button>
        <button
          disabled={locked}
          onClick={() => onChange(clamp(amount * 2))}
          className="h-8 rounded-lg text-[11px] font-display tracking-wider bg-white/5 border border-white/10 active:scale-95 disabled:opacity-40"
        >
          DOUBLE
        </button>
        <button
          disabled={locked}
          onClick={() => onChange(clamp(balance))}
          className="h-8 rounded-lg text-[11px] font-display tracking-wider bg-[oklch(0.85_0.17_90)]/10 border border-[oklch(0.85_0.17_90)]/40 text-[oklch(0.85_0.17_90)] active:scale-95 disabled:opacity-40"
        >
          MAX
        </button>
      </div>

      {/* Confirm */}
      <button
        disabled={locked || !selectedLabel || confirmed}
        onClick={onConfirm}
        className="mt-3 relative w-full h-12 rounded-2xl font-display tracking-[0.25em] text-sm overflow-hidden disabled:opacity-50 active:scale-[0.98] transition"
        style={{
          background: confirmed
            ? "linear-gradient(90deg, oklch(0.85 0.17 90 / 0.25), oklch(0.85 0.17 90 / 0.1))"
            : "linear-gradient(90deg, oklch(0.85 0.19 195), oklch(0.68 0.28 330))",
          color: confirmed ? "oklch(0.85 0.17 90)" : "#0a0a15",
          boxShadow: confirmed
            ? "inset 0 0 0 1px oklch(0.85 0.17 90 / 0.6), 0 0 24px oklch(0.85 0.17 90 / 0.2)"
            : "0 12px 30px -12px oklch(0.85 0.19 195 / 0.7)",
        }}
      >
        <span className="relative z-10">
          {confirmed
            ? `LOCKED · ${selectedLabel}`
            : selectedLabel
              ? locked
                ? "PREDICTIONS CLOSED"
                : `PREDICT ${selectedLabel.toUpperCase()}`
              : "SELECT A CAR"}
        </span>
        {!confirmed && !locked && selectedLabel && (
          <span className="absolute inset-0 animate-shimmer" />
        )}
      </button>
    </div>
  );
}
