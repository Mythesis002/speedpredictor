import { Car, type CarSpec } from "./Car";
import { carClassTag, carLabel, formatINR } from "@/lib/car-label";

interface Props {
  cars: [CarSpec, CarSpec, CarSpec];
  selected: number | null;
  onSelect: (i: number) => void;
  locked: boolean;
  winner: number | null;
  /** current stake, used to show the exact return on each card */
  amount: number;
  /** true once the stake has actually been committed for this round */
  confirmed: boolean;
}

export function PredictionCards({
  cars,
  selected,
  onSelect,
  locked,
  winner,
  amount,
  confirmed,
}: Props) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {cars.map((car, i) => {
        const isSelected = selected === i;
        const isWinner = winner === i;
        const isLoser = winner !== null && winner !== i;
        const tag = carClassTag(car);
        return (
          <button
            key={car.id}
            disabled={locked}
            aria-pressed={isSelected}
            aria-label={`${carLabel(car)} car, pays ${car.multiplier} times`}
            onClick={() => onSelect(i)}
            className={`relative rounded-2xl overflow-hidden border transition-all duration-300 active:scale-[0.97] ${
              isLoser ? "opacity-40" : ""
            } ${locked && !isSelected ? "opacity-70" : ""}`}
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
            {tag && !(isSelected && confirmed) && (
              <span className="absolute left-1 top-1 z-10 rounded-md bg-black/55 px-1.5 py-[1px] text-[7.5px] font-display tracking-[0.16em] text-white/70">
                {tag}
              </span>
            )}
            {isSelected && confirmed && (
              <span className="absolute left-1 top-1 z-10 rounded-md bg-[#26ff9a] px-1.5 py-[1px] text-[7.5px] font-display tracking-[0.12em] text-black">
                YOUR PICK
              </span>
            )}


            <div className="relative flex flex-col items-center px-1 pt-2.5 pb-2">
              <div className="scale-[0.92] -mt-1">
                <Car spec={car} size={78} glow={isSelected || isWinner} reflection={false} />
              </div>
              <div
                className="-mt-3 font-display text-[11px] tracking-[0.18em]"
                style={{ color: car.kind === "hyper" ? "#d9c98f" : car.color }}
              >
                {carLabel(car)}
              </div>
              <div
                className="mt-1 px-2 py-0.5 rounded-full text-[10px] font-display tabular"
                style={{
                  background:
                    car.kind === "hyper"
                      ? "linear-gradient(90deg,#8a6a12,#ffd66b)"
                      : car.kind === "small"
                        ? "rgba(255,255,255,0.1)"
                        : "linear-gradient(90deg,#7e1020,#ff3b4d)",
                  color: car.kind === "hyper" ? "#1a1405" : "#fff",
                  border: "1px solid rgba(255,255,255,0.15)",
                }}
              >
                {car.multiplier}x
              </div>
              <div className="mt-1 text-[8.5px] font-display tabular text-white/45">
                WIN {formatINR(amount * car.multiplier)}
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
