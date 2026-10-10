import { Link } from "@tanstack/react-router";
import type { CarSpec } from "./Car";

export interface HistoryEntry {
  id: number;
  car: CarSpec;
  ago: string;
}

export interface BetHistoryEntry {
  id: string;
  roundId: number;
  /** the car the player picked */
  car: CarSpec;
  /** the car that actually won, once the round is settled */
  winnerCar: CarSpec | null;
  amount: number;
  payout: number;
  multiplier: number;
  status: "pending" | "won" | "lost";
}

const inr = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

/** The player's own bet history — what they picked, staked and took home. */
export function History({ entries }: { entries: BetHistoryEntry[] }) {
  const settled = entries.filter((e) => e.status !== "pending");
  const wins = settled.filter((e) => e.status === "won").length;
  const net = settled.reduce((sum, e) => sum + e.payout - e.amount, 0);

  return (
    <div className="glass rounded-2xl p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="font-display text-[10px] tracking-[0.2em] text-white/60">YOUR BETS</span>
        {settled.length > 0 && (
          <span className="text-[10px] font-display tracking-wide tabular text-white/45">
            {wins}/{settled.length} won ·{" "}
            <span className={net >= 0 ? "text-[#26ff9a]" : "text-[#ff5b7f]"}>
              {net >= 0 ? "+" : "−"}
              {inr(Math.abs(net))}
            </span>
          </span>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="py-5 text-center text-[11px] text-white/40">
          No bets yet — pick a car to start your history.
        </div>
      ) : (
        <div className="space-y-1">
          {entries.slice(0, 15).map((e) => (
            <div
              key={e.id}
              className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-2 py-1.5"
            >
              <span className="text-[9px] tabular text-white/35 w-9 shrink-0">
                #{String(e.roundId).slice(-4)}
              </span>
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{
                  background: e.car.color,
                  boxShadow: `0 0 7px ${e.car.color}`,
                  border: "1px solid rgba(255,255,255,0.2)",
                }}
              />
              <span className="text-[10.5px] text-white/70 truncate flex-1">
                {e.car.colorName}
                <span className="text-white/35"> · {e.multiplier.toFixed(2)}x</span>
              </span>
              <span className="text-[10.5px] tabular text-white/55 shrink-0">{inr(e.amount)}</span>
              <span
                className="text-[10.5px] font-display tabular shrink-0 w-[62px] text-right"
                style={{
                  color:
                    e.status === "won" ? "#26ff9a" : e.status === "lost" ? "#ff5b7f" : "#ffffff66",
                }}
              >
                {e.status === "pending"
                  ? "live"
                  : e.status === "won"
                    ? `+${inr(e.payout)}`
                    : `−${inr(e.amount)}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Floating left rail: recent round winners. Kept slim so it never hides the track. */
export function RecentRounds({ entries }: { entries: HistoryEntry[] }) {
  const uniqueEntries = entries.filter(
    (e, idx, arr) => arr.findIndex((item) => item.id === e.id) === idx,
  );
  return (
    <div className="glass rounded-xl p-1 w-[54px] pointer-events-none">
      <div className="text-[7px] font-display tracking-[0.15em] text-white/50 px-0.5 pb-1">
        RECENT
      </div>
      <div className="space-y-[3px]">
        {uniqueEntries.slice(0, 4).map((e) => (
          <div
            key={e.id}
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
    {
      label: "Staked",
      value:
        totalBets >= 100000
          ? `₹${(totalBets / 1000).toFixed(1)}K`
          : `₹${Math.round(totalBets).toLocaleString("en-IN")}`,
    },
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

/** Last finished races, exactly as stored on the server. Only the three team colours. */
const TEAM = [
  { name: "Red", hex: "#ff3b4d" },
  { name: "Purple", hex: "#a24bff" },
  { name: "Blue", hex: "#3b8bff" },
];

export function Results({ entries }: { entries: HistoryEntry[] }) {
  const uniqueEntries = entries.filter(
    (e, idx, arr) => arr.findIndex((item) => item.id === e.id) === idx,
  );
  const last = uniqueEntries.slice(0, 12);
  const pct = TEAM.map((t) => {
    const n = uniqueEntries.filter((e) => e.car.colorName === t.name).length;
    return { ...t, p: uniqueEntries.length ? Math.round((n / uniqueEntries.length) * 100) : 0 };
  });
  return (
    <div className="glass rounded-xl px-2.5 py-1.5">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="font-display text-[8.5px] tracking-[0.16em] text-white/50 shrink-0">
          LAST RESULTS
        </span>
        <div className="flex items-center gap-2 ml-auto">
          {pct.map((t) => (
            <span key={t.name} className="flex items-center gap-1 text-[8.5px] text-white/55 tabular">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.hex }} />
              {t.p}%
            </span>
          ))}
        </div>
      </div>
      {last.length === 0 ? (
        <div className="py-1 text-center text-[9.5px] text-white/35">
          Results appear here as soon as a race finishes.
        </div>
      ) : (
        <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] py-0.5">
          {last.map((e) => (
            <Link
              key={e.id}
              to="/verify/$roundId"
              params={{ roundId: String(e.id) }}
              className="rounded-md bg-white/[0.04] px-1.5 py-1 flex items-center gap-1 shrink-0 hover:bg-white/10 transition-colors"
              aria-label={`Round ${e.id}: ${e.car.colorName} won. Verify`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{
                  background: e.car.color,
                  boxShadow: `0 0 5px ${e.car.color}`,
                }}
              />
              <span className="text-[7.5px] tabular text-white/40 leading-none">
                #{String(e.id).slice(-3)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
