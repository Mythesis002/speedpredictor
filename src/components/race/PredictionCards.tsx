import { Car, type CarSpec } from "./Car";

interface Props {
  cars: [CarSpec, CarSpec, CarSpec];
  selected: number | null;
  onSelect: (i: number) => void;
  locked: boolean;
  winner: number | null;
}

export function PredictionCards({ cars, selected, onSelect, locked, winner }: Props) {
  return (
    <div className="grid grid-cols-3 gap-2 px-3">
      {cars.map((car, i) => {
        const isSelected = selected === i;
        const isWinner = winner === i;
        const isLoser = winner !== null && winner !== i;
        return (
          <button
            key={car.id}
            disabled={locked}
            onClick={() => onSelect(i)}
            className={`group relative rounded-2xl p-2.5 glass overflow-hidden transition-all duration-300 active:scale-[0.97] ${
              isSelected ? "translate-y-[-2px]" : ""
            } ${isLoser ? "opacity-40" : ""} ${locked && !isSelected ? "opacity-60" : ""}`}
            style={{
              borderColor: isSelected ? car.color : undefined,
              boxShadow: isSelected
                ? `0 0 0 1.5px ${car.color}, 0 0 22px ${car.color}66, inset 0 0 16px ${car.color}22`
                : isWinner
                  ? `0 0 0 2px #ffd83a, 0 0 30px #ffd83a99`
                  : undefined,
            }}
          >
            {/* color glow */}
            <div
              className="absolute -top-6 left-1/2 -translate-x-1/2 h-14 w-14 rounded-full blur-2xl opacity-70 group-hover:opacity-100 transition-opacity"
              style={{ background: car.color }}
            />

            {/* multiplier chip */}
            <div className="absolute top-1.5 right-1.5 font-display text-[10px] tracking-widest px-1.5 py-0.5 rounded-md bg-black/40 border border-white/10">
              <span
                style={{
                  color:
                    car.kind === "hyper"
                      ? "#ffd66b"
                      : car.kind === "small"
                        ? "#8be9ff"
                        : "#fff",
                }}
              >
                {car.multiplier}×
              </span>
            </div>

            <div className="relative flex flex-col items-center pt-4 pb-1">
              <Car spec={car} size={38} idle glow={isSelected || isWinner} />
              <div className="mt-2 font-display text-[10px] uppercase tracking-widest text-white/80">
                {car.kind === "hyper"
                  ? "Hyper"
                  : car.kind === "small"
                    ? "Mini"
                    : car.colorName}
              </div>
            </div>

            {/* selected pulse ring */}
            {isSelected && (
              <div
                className="pointer-events-none absolute inset-0 rounded-2xl animate-pulse-glow"
                style={{
                  boxShadow: `inset 0 0 20px ${car.color}55`,
                }}
              />
            )}

            {/* shimmer when selectable */}
            {!locked && !isSelected && (
              <div className="pointer-events-none absolute inset-0 animate-shimmer" />
            )}
          </button>
        );
      })}
    </div>
  );
}
