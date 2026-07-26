import type { CarSpec } from "./Car";

export interface HistoryEntry {
  id: number;
  car: CarSpec;
  ago: string;
}

export function History({ entries }: { entries: HistoryEntry[] }) {
  return (
    <div className="px-3">
      <div className="flex items-center justify-between mb-1.5 px-1">
        <span className="font-display text-[10px] tracking-[0.25em] text-white/50">
          LAST WINNERS
        </span>
        <span className="font-display text-[10px] tracking-[0.2em] text-white/30">
          {entries.length} RACES
        </span>
      </div>
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
        {entries.map((e) => (
          <div
            key={e.id}
            className="shrink-0 w-11 h-14 rounded-xl relative overflow-hidden glass flex flex-col items-center justify-center gap-0.5"
            style={{
              borderColor: e.car.color + "55",
              boxShadow: `inset 0 0 10px ${e.car.color}22`,
            }}
          >
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{
                background: e.car.color,
                boxShadow: `0 0 8px ${e.car.color}`,
              }}
            />
            <span
              className="font-display text-[10px] tabular"
              style={{
                color:
                  e.car.kind === "hyper"
                    ? "#ffd66b"
                    : e.car.kind === "small"
                      ? "#8be9ff"
                      : "#fff",
              }}
            >
              {e.car.multiplier}×
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
