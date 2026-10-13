import { Minus, Plus } from "lucide-react";
import { formatINR } from "@/lib/car-label";

interface Props {
  amount: number;
  balance: number;
  locked: boolean;
  onChange: (n: number) => void;
  selectedLabel: string | null;
  onConfirm: () => void;
  confirmed: boolean;
  phaseLabel: string;
  /** payout multiplier of the currently selected car, if any */
  multiplier: number | null;
  /** locked stake amount for the current round, if already placed */
  activeBetAmount?: number | null;
}

const MIN_BET = 10;
const CHIPS = [10, 50, 100, 500];
const STEP = 10;

export function BettingPanel({
  amount,
  balance,
  locked,
  onChange,
  selectedLabel,
  onConfirm,
  confirmed,
  multiplier,
  activeBetAmount,
}: Props) {
  const cap = Math.max(MIN_BET, balance);
  const clamp = (n: number) => Math.max(MIN_BET, Math.min(cap, Math.round(n)));
  const insufficient = amount > balance;
  const disabled = locked || !selectedLabel || confirmed || insufficient;

  return (
    <div>
      {confirmed && activeBetAmount != null && (
        <div className="mb-1.5 flex items-center justify-between px-1 text-[9.5px] font-display tracking-[0.14em] uppercase">
          <span className="text-[#26ff9a] font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#26ff9a] animate-pulse" />
            Active Bet: {formatINR(activeBetAmount)} Locked
          </span>
          <span className="text-white/45">Next Bet Prep: {formatINR(amount)}</span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="flex items-center h-11 rounded-xl bg-black/40 border border-white/10 overflow-hidden">
          <button
            type="button"
            aria-label="Decrease bet amount"
            onClick={() => onChange(clamp(amount - STEP))}
            className="h-11 w-10 grid place-items-center active:scale-95 text-white/80 hover:text-white cursor-pointer transition-colors"
          >
            <Minus size={16} />
          </button>
          <span className="px-3 font-display text-base tabular text-white min-w-[86px] text-center bg-white/5 h-11 grid place-items-center select-none">
            {formatINR(amount)}
          </span>
          <button
            type="button"
            aria-label="Increase bet amount"
            onClick={() => onChange(clamp(amount + STEP))}
            className="h-11 w-10 grid place-items-center active:scale-95 text-white/80 hover:text-white cursor-pointer transition-colors"
          >
            <Plus size={16} />
          </button>
        </div>

        <button
          disabled={disabled}
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
          <span className="relative z-10 block truncate px-1">
            {confirmed
              ? activeBetAmount != null
                ? `BET PLACED · ${formatINR(activeBetAmount)}`
                : "BET PLACED"
              : locked
                ? "BETS LOCKED"
                : insufficient
                  ? "LOW BALANCE"
                  : selectedLabel
                    ? `BET ${formatINR(amount)}`
                    : "SELECT A CAR"}
          </span>

          {!disabled && <span className="absolute inset-0 animate-shimmer" />}
        </button>
      </div>

      <div className="mt-2 grid grid-cols-5 gap-1.5">
        {CHIPS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(clamp(n))}
            className={`h-8 rounded-lg text-[11px] font-display tracking-wide border active:scale-95 cursor-pointer transition-colors ${
              amount === n
                ? "bg-white/15 border-white/40 text-white"
                : "bg-white/5 border-white/10 text-white/80 hover:text-white"
            }`}
          >
            {n >= 1000 ? `${n / 1000}K` : n}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange(clamp(balance))}
          className="h-8 rounded-lg text-[11px] font-display tracking-wide bg-[#ffd83a]/10 border border-[#ffd83a]/40 text-[#ffd83a] active:scale-95 hover:bg-[#ffd83a]/20 cursor-pointer transition-colors"
        >
          MAX
        </button>
      </div>
    </div>
  );
}
