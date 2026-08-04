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

/** Floating left rail: recent round winners. Kept slim so it never hides the track. */
export function RecentRounds({ entries }: { entries: HistoryEntry[] }) {
  return (
    <div className="glass rounded-xl p-1 w-[54px] pointer-events-none">
      <div className="text-[7px] font-display tracking-[0.15em] text-white/50 px-0.5 pb-1">
        RECENT
      </div>
      <div className="space-y-[3px]">
        {entries.slice(0, 4).map((e, i) => (
          <div
            key={`${e.id}-${i}`}
            className="flex items-center justify-between rounded bg-white/5 px-1 py-[2px]"
          >
            <span className="text-[7.5px] text-white/40 tabular">{String(e.id).slice(-3)}</span>
            <span
              className="w-2 h-2 rounded-full"
              style={{
                background: e.car.color,
                boxShadow: `0 0 6px ${e.car.color}`,
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
}: {
  players: number;
  totalBets: number;
  biggestWin?: number;
}) {
  const rows = [
    { label: "Players", value: players.toLocaleString("en-IN") },
    { label: "Bets", value: `₹${Math.round(totalBets / 1000)}K` },
  ];
  return (
    <div className="glass rounded-xl p-1 w-[68px] pointer-events-none">
      <div className="text-[7px] font-display tracking-[0.15em] text-white/50 px-0.5 pb-1">
        LIVE
      </div>
      <div className="space-y-[3px]">
        {rows.map((r) => (
          <div key={r.label} className="rounded bg-white/5 px-1 py-[2px] leading-tight">
            <div className="text-[7px] text-white/40">{r.label}</div>
            <div className="text-[9.5px] font-display tabular text-white">{r.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

