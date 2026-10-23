import { Car, type CarSpec } from "./Car";
import { carLabel, formatINR } from "@/lib/car-label";

interface Props {
  cars: [CarSpec, CarSpec, CarSpec];
  selected: number | null;
  onSelect: (i: number) => void;
  locked: boolean;
  winner: number | null;
  /** current draft stake, used to show the exact return on each card before betting */
  amount: number;
  /** true once the stake has actually been committed for this round */
  confirmed: boolean;
  /** committed bet for the current round, if already placed */
  activeBet?: { lane: number; amount: number } | null;
}
export function PredictionCards({
  cars,
  selected,
  onSelect,
  locked,
  winner,
  amount,
  confirmed,
  activeBet,
}: Props) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {cars.map((car, i) => {
        const isSelected = selected === i;
        const isWinner = winner === i;
        const isLoser = winner !== null && winner !== i;
        const isCommittedBet = confirmed && activeBet?.lane === i;

        // Committed bet locks to what was actually staked, draft stake shows preview
        const cardStake = isCommittedBet && activeBet ? activeBet.amount : amount;
        const payout = cardStake * car.multiplier;

        return (
          <button
            key={car.id}
            type="button"
            disabled={locked || confirmed}
            aria-pressed={isSelected}
            aria-label={`Select ${carLabel(car)}, multiplier ${car.multiplier}×, returns ${formatINR(payout)}`}
            onClick={() => onSelect(i)}
            className={`group relative rounded-2xl overflow-hidden border transition-all duration-200 flex flex-col justify-between active:scale-[0.97] select-none text-left cursor-pointer ${
              isLoser ? "opacity-35 grayscale-[25%]" : ""
            } ${locked && !isSelected ? "opacity-60" : ""} ${
              confirmed && !isSelected ? "opacity-40" : ""
            }`}
            style={{
              borderColor: isSelected ? car.color : isWinner ? "#ffd83a" : `${car.color}45`,
              background: isSelected
                ? `linear-gradient(175deg, ${car.color}33 0%, rgba(13,16,28,0.95) 55%, rgba(6,8,16,0.98) 100%)`
                : isWinner
                  ? `linear-gradient(175deg, rgba(255,216,58,0.25) 0%, rgba(13,16,28,0.95) 55%, rgba(6,8,16,0.98) 100%)`
                  : `linear-gradient(175deg, ${car.color}15 0%, rgba(11,13,24,0.92) 55%, rgba(5,6,13,0.96) 100%)`,
              boxShadow: isSelected
                ? `0 0 0 1.5px ${car.color}, 0 8px 24px -4px ${car.color}77`
                : isWinner
                  ? `0 0 0 2px #ffd83a, 0 8px 28px -4px #ffd83a88`
                  : `inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 12px rgba(0,0,0,0.35)`,
            }}
          >
            {/* Top Bar: Multiplier badge on left, Status badge on right */}
            <div className="w-full px-2 pt-2 pb-1 flex items-center justify-between gap-1 z-10">
              <span
                className={`px-1.5 py-0.5 rounded-md text-[9px] font-display font-black tracking-wider leading-none shadow-sm ${
                  car.kind === "hyper"
                    ? "bg-gradient-to-r from-[#ffd83a] to-[#f0a415] text-[#1a1200] border border-[#ffe57f]/60"
                    : "bg-white/10 text-white/95 border border-white/15"
                }`}
              >
                {car.kind === "hyper" ? `⚡ ${car.multiplier}×` : `${car.multiplier}×`}
              </span>

              {/* Status Span: Cleanly aligned with no clipping */}
              {isCommittedBet && activeBet ? (
                <span className="px-1.5 py-0.5 rounded-md bg-[#26ff9a] text-black font-display font-black text-[8px] tracking-[0.12em] shadow-sm flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
                  BET {formatINR(activeBet.amount)}
                </span>
              ) : isSelected && !confirmed ? (
                <span className="px-1.5 py-0.5 rounded-md bg-white/25 text-white font-display font-bold text-[8px] tracking-[0.12em] border border-white/40 shadow-sm">
                  SELECTED
                </span>
              ) : isWinner ? (
                <span className="px-1.5 py-0.5 rounded-md bg-[#ffd83a] text-black font-display font-black text-[8px] tracking-[0.12em]">
                  WINNER
                </span>
              ) : (
                <span className="text-[8px] font-display font-semibold tracking-[0.14em] text-white/40 uppercase">
                  LANE {i + 1}
                </span>
              )}
            </div>

            {/* Center Area: Centered Car Graphic + Name */}
            <div className="relative flex flex-col items-center justify-center px-1 py-1 w-full">
              <div className="h-[54px] w-full flex items-center justify-center pointer-events-none">
                <Car spec={car} size={82} glow={isSelected || isWinner} reflection={false} />
              </div>
              <div
                className="mt-0.5 font-display font-bold text-[10.5px] tracking-[0.18em] leading-none uppercase text-center truncate max-w-full px-1"
                style={{ color: car.kind === "hyper" ? "#ffd66b" : car.color }}
              >
                {carLabel(car)}
              </div>
            </div>

            {/* Bottom Footer Section: Structured High-Contrast Payout Pill */}
            <div className="w-full px-1.5 pb-1.5 pt-0.5 z-10">
              <div
                className={`w-full py-1 px-1.5 rounded-xl flex items-center justify-center gap-1 transition-all ${
                  isCommittedBet
                    ? "bg-[#26ff9a]/20 border border-[#26ff9a]/55 text-[#26ff9a]"
                    : isSelected
                      ? "bg-white/15 border border-white/30 text-white"
                      : confirmed
                        ? "bg-black/30 border border-white/5 text-white/30"
                        : "bg-black/45 border border-white/10 text-white/85"
                }`}
              >
                <span className="text-[8.5px] font-display uppercase tracking-[0.12em] text-white/55">
                  WIN
                </span>
                <span
                  className={`text-[12px] font-display font-black tabular tracking-tight leading-none ${
                    isCommittedBet
                      ? "text-[#26ff9a]"
                      : isSelected
                        ? "text-[#ffd83a]"
                        : confirmed
                          ? "text-white/30"
                          : "text-white"
                  }`}
                >
                  {confirmed && !isCommittedBet ? "—" : formatINR(payout)}
                </span>
              </div>
            </div>

            {/* Ambient Pulse Border on Selection */}
            {isSelected && (
              <div
                className="pointer-events-none absolute inset-0 rounded-2xl animate-pulse-glow"
                style={{ boxShadow: `inset 0 0 20px ${car.color}55` }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
