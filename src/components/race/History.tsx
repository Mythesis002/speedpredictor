import type { CarSpec } from "./Car";

export interface HistoryEntry {
  id: number;
  car: CarSpec;
  ago: string;
}

/** Last-50 rounds dot chart, like a live game-show results strip. */
export function History({ entries }: { entries: HistoryEntry[] }) {
  return (
    <div className="glass rounded-2xl p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="font-display text-[10px] tracking-[0.2em] text-white/60">
          GAME HISTORY
        </span>
        <span className="text-[10px] text-white/40 font-display tracking-wide">
          Last 50 Rounds
        </span>
      </div>
      <div className="grid grid-cols-10 gap-1.5">
        {entries.slice(0, 30).map((e, i) => (
          <span
            key={`${e.id}-${i}`}
            title={`#${e.id} · ${e.car.colorName}`}
            className="aspect-square rounded-full"
            style={{
              background: e.car.color,
              opacity: e.car.kind === "small" ? 0.55 : 1,
              boxShadow: `0 0 8px ${e.car.color}88, inset 0 -2px 4px rgba(0,0,0,0.55)`,
              border:
                e.car.kind === "hyper"
                  ? "1px solid #ffd66b"
                  : "1px solid rgba(255,255,255,0.15)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

/** Floating left rail: recent round winners. */
export function RecentRounds({ entries }: { entries: HistoryEntry[] }) {
  return (
    <div className="glass rounded-xl p-1.5 w-[68px]">
      <div className="text-[8px] font-display tracking-[0.15em] text-white/55 px-1 pb-1">
        RECENT
      </div>
      <div className="space-y-1">
        {entries.slice(0, 6).map((e, i) => (
          <div
            key={`${e.id}-${i}`}
            className="flex items-center justify-between rounded-md bg-white/5 px-1.5 py-1"
          >
            <span className="text-[8px] text-white/45 tabular">#{String(e.id).slice(-3)}</span>
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{
                background: e.car.color,
                boxShadow: `0 0 7px ${e.car.color}`,
                border: "1px solid rgba(255,255,255,0.2)",
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Floating right rail: live stats. */
export function LiveStats({
  players,
  totalBets,
  biggestWin,
}: {
  players: number;
  totalBets: number;
  biggestWin: number;
}) {
  const rows = [
    { label: "Players", value: players.toLocaleString("en-IN") },
    { label: "Total Bets", value: `₹${totalBets.toLocaleString("en-IN")}` },
    { label: "Biggest Win", value: `₹${biggestWin.toLocaleString("en-IN")}` },
  ];
  return (
    <div className="glass rounded-xl p-1.5 w-[92px]">
      <div className="text-[8px] font-display tracking-[0.15em] text-white/55 px-1 pb-1">
        LIVE STATS
      </div>
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.label} className="rounded-md bg-white/5 px-1.5 py-1 leading-tight">
            <div className="text-[7.5px] text-white/45">{r.label}</div>
            <div className="text-[10px] font-display tabular text-white">{r.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
