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

        // If this is the committed bet on the track, its payout is strictly locked
        // to what was actually staked in this round (e.g. ₹10 -> WIN ₹29),
        // completely immune to whatever draft stake the user selects for the next round!
        const cardStake = isCommittedBet && activeBet ? activeBet.amount : amount;
        const payout = cardStake * car.multiplier;

        return (
          <button
            key={car.id}
            disabled={locked || confirmed}
            aria-pressed={isSelected}
            aria-label={`Select ${carLabel(car)} car, ${car.multiplier}× payout (${formatINR(payout)} return)`}
            onClick={() => onSelect(i)}
            className={`relative rounded-2xl overflow-hidden border transition-all duration-300 active:scale-[0.97] ${
              isLoser ? "opacity-40" : ""
            } ${locked && !isSelected ? "opacity-70" : ""} ${
              confirmed && !isSelected ? "opacity-45" : ""
            }`}
            style={{
              borderColor: isSelected ? car.color : `${car.color}55`,
              background: `linear-gradient(160deg, ${car.color}26, rgba(10,12,20,0.9) 65%)`,
              boxShadow: isSelected
                ? `0 0 0 1.5px ${car.color}, 0 0 26px ${car.color}66`
                : isWinner
                  ? `0 0 0 2px #ffd83a, 0 0 30px #ffd83a99`
                  : `inset 0 0 24px ${car.color}18`,
            }}
          >
            {isCommittedBet && activeBet && (
              <span className="absolute left-1 top-1 z-10 rounded-md bg-[#26ff9a] px-1.5 py-[1px] text-[7.5px] font-display tracking-[0.12em] text-black shadow-sm font-semibold">
                LOCKED · {formatINR(activeBet.amount)}
              </span>
            )}
            {isSelected && !confirmed && (
              <span className="absolute left-1 top-1 z-10 rounded-md bg-white/20 px-1.5 py-[1px] text-[7.5px] font-display tracking-[0.12em] text-white">
                SELECTED
              </span>
            )}

            <div className="relative flex flex-col items-center px-1 pt-2.5 pb-2">
              <div className="h-[58px] w-full flex items-center justify-center">
                <Car spec={car} size={84} glow={isSelected || isWinner} reflection={false} />
              </div>
              <div
                className="mt-0.5 font-display text-[11px] tracking-[0.18em] leading-none"
                style={{ color: car.kind === "hyper" ? "#ffd66b" : car.color }}
              >
                {carLabel(car)}
              </div>
              <div
                className="mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-display tabular leading-tight"
                style={{
                  background:
                    car.kind === "hyper"
                      ? "linear-gradient(90deg,#8a6a12,#ffd66b)"
                      : car.kind === "small"
                        ? "rgba(255,255,255,0.1)"
                        : `linear-gradient(90deg,${car.color}88,${car.color})`,
                  color: car.kind === "hyper" ? "#1a1405" : "#fff",
                  border: "1px solid rgba(255,255,255,0.18)",
                }}
              >
                {car.multiplier}×
              </div>
              <div className="mt-1 text-[10px] font-display tabular text-white/55">
                {isCommittedBet ? (
                  <span className="text-[#26ff9a] font-semibold">WIN {formatINR(payout)}</span>
                ) : confirmed ? (
                  <span className="text-white/35">RIVAL CAR</span>
                ) : (
                  <span>WIN {formatINR(payout)}</span>
                )}
              </div>
            </div>

            {isSelected && (
              <div
                className="pointer-events-none absolute inset-0 rounded-2xl animate-pulse-glow"
                style={{ boxShadow: `inset 0 0 22px ${car.color}66` }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
