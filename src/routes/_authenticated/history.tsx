import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { myBets } from "@/lib/wallet.functions";
import { lineupForRound } from "@/lib/round-engine";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "My bets — Apex" },
      { name: "description", content: "Your Apex bet history, win rate and profit." },
      { property: "og:title", content: "My bets — Apex" },
      { property: "og:description", content: "Bet history and results." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HistoryPage,
});

const inr = (p: number) => `₹${(p / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
type Filter = "all" | "won" | "lost" | "pending";

function HistoryPage() {
  const fetchBets = useServerFn(myBets);
  const q = useQuery({ queryKey: ["my-bets-page"], queryFn: () => fetchBets() });
  const [filter, setFilter] = useState<Filter>("all");
  const bets = q.data ?? [];

  const summary = useMemo(() => {
    const settled = bets.filter((b) => b.status !== "pending");
    const won = settled.filter((b) => b.status === "won");
    const net = settled.reduce((t, b) => t + b.payoutPaise - b.amountPaise, 0);
    const best = won.reduce((m, b) => Math.max(m, b.payoutPaise - b.amountPaise), 0);
    return { total: bets.length, rate: settled.length ? Math.round((won.length / settled.length) * 100) : 0, net, best };
  }, [bets]);

  const shown = bets.filter((b) => filter === "all" || b.status === filter);

  const exportCsv = () => {
    const rows = [["round", "car", "stake_inr", "odds", "status", "payout_inr", "placed_at"]];
    for (const b of bets) {
      rows.push([String(b.roundId), lineupForRound(b.roundId)[b.lane].colorName, (b.amountPaise / 100).toFixed(2), String(b.multiplier), b.status, (b.payoutPaise / 100).toFixed(2), b.createdAt]);
    }
    const url = URL.createObjectURL(new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "apex-bets.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-[100dvh] bg-[#04060c] text-white px-4 py-6" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}>
      <div className="mx-auto max-w-md space-y-3">
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-1 text-[12px] text-white/55 min-h-[44px]"><ArrowLeft size={14} /> Back to race</Link>
          {bets.length > 0 && <button onClick={exportCsv} className="inline-flex items-center gap-1 text-[12px] text-white/60 min-h-[44px]"><Download size={13} /> CSV</button>}
        </div>
        <h1 className="font-display text-xl">My bets</h1>

        <div className="grid grid-cols-4 gap-2">
          {[["Bets", String(summary.total)], ["Win rate", `${summary.rate}%`], ["Net", `${summary.net >= 0 ? "+" : "−"}${inr(Math.abs(summary.net))}`], ["Best win", inr(summary.best)]].map(([k, v]) => (
            <div key={k} className="glass rounded-xl p-2">
              <div className="text-[9px] text-white/45">{k}</div>
              <div className="text-[12px] font-display tabular">{v}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-1.5">
          {(["all", "won", "lost", "pending"] as Filter[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`h-9 px-3 rounded-full text-[11px] capitalize ${filter === f ? "bg-white/15 text-white" : "bg-white/5 text-white/50"}`}>{f}</button>
          ))}
        </div>

        {q.isLoading && <div className="glass rounded-2xl p-6 grid place-items-center"><Loader2 className="animate-spin" /></div>}
        {q.isError && <div className="glass rounded-2xl p-4 text-sm">Could not load. <button className="underline" onClick={() => void q.refetch()}>Retry</button></div>}
        {!q.isLoading && shown.length === 0 && (
          <div className="glass rounded-2xl p-6 text-center text-sm text-white/55">
            No bets yet. <Link to="/" className="underline">Play now</Link>
          </div>
        )}

        <div className="space-y-1.5">
          {shown.map((b) => {
            const lineup = lineupForRound(b.roundId);
            const car = lineup[b.lane];
            const pl = b.status === "won" ? b.payoutPaise - b.amountPaise : b.status === "lost" ? -b.amountPaise : 0;
            return (
              <Link key={b.id} to="/verify/$roundId" params={{ roundId: String(b.roundId) }} className="glass rounded-xl p-3 flex items-center gap-3">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: car.color, boxShadow: `0 0 8px ${car.color}` }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px]">Round #{b.roundId} · {car.colorName} · {b.multiplier}x</div>
                  <div className="text-[10px] text-white/40" title={new Date(b.createdAt).toLocaleString()}>
                    Stake {inr(b.amountPaise)} · {new Date(b.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-[10px] uppercase ${b.status === "won" ? "text-[#26ff9a]" : b.status === "lost" ? "text-[#ff4d6d]" : "text-white/50"}`}>{b.status}</div>
                  <div className={`text-[12px] tabular ${pl > 0 ? "text-[#26ff9a]" : pl < 0 ? "text-[#ff4d6d]" : "text-white/50"}`}>
                    {pl === 0 ? "—" : `${pl > 0 ? "+" : "−"}${inr(Math.abs(pl))}`}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
