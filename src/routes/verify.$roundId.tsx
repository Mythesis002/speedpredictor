import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { revealRound } from "@/lib/rounds.functions";
import { lineupForRound, outcomeFromReveal, winWeights, RTP } from "@/lib/round-engine";

export const Route = createFileRoute("/verify/$roundId")({
  head: ({ params }) => ({
    meta: [
      { title: `Verify Round #${params.roundId} — Apex` },
      { name: "description", content: "Check in your own browser that this race result was fixed before betting opened." },
      { property: "og:title", content: `Verify Round #${params.roundId} — Apex` },
      { property: "og:description", content: "Provably fair race verification for Apex." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VerifyPage,
});

async function sha256Hex(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function VerifyPage() {
  const { roundId } = Route.useParams();
  const id = Number(roundId);
  const reveal = useServerFn(revealRound);

  const q = useQuery({
    queryKey: ["verify", id],
    enabled: Number.isInteger(id),
    queryFn: async () => {
      const r = await reveal({ data: { roundId: id } });
      if (!r.ok) return { ok: false as const, reason: r.reason };
      const hash = await sha256Hex(r.reveal);
      const order = outcomeFromReveal(r.reveal, id).order;
      return {
        ...r,
        hash,
        hashOk: hash === r.commit,
        winnerOk: order[0] === r.winner,
      };
    },
  });

  const lineup = Number.isInteger(id) ? lineupForRound(id) : null;
  const probs = lineup ? winWeights(lineup.map((c) => c.kind)) : [];
  const d = q.data;
  const passed = d?.ok && d.hashOk && d.winnerOk;

  return (
    <main className="min-h-[100dvh] bg-[#04060c] text-white px-4 py-6" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}>
      <div className="mx-auto max-w-md space-y-3">
        <Link to="/" className="inline-flex items-center gap-1 text-[12px] text-white/55 min-h-[44px]">
          <ArrowLeft size={14} /> Back to race
        </Link>
        <h1 className="font-display text-xl">Verify Round #{roundId}</h1>

        {q.isLoading && (
          <div className="glass rounded-2xl p-6 grid place-items-center">
            <Loader2 className="animate-spin" aria-label="Verifying round" />
          </div>
        )}
        {q.isError && (
          <div className="glass rounded-2xl p-4 text-sm">
            We couldn't load verification data for this round.{" "}
            <button className="underline" onClick={() => void q.refetch()}>
              Try again
            </button>
          </div>
        )}
        {d && !d.ok && (
          <div className="glass rounded-2xl p-4 text-sm text-white/70">
            {d.reason === "early"
              ? "Betting is still open for this round. The server secret is revealed as soon as betting locks."
              : "Verification records are only retained for the most recent 500 rounds."}
          </div>
        )}

        {d?.ok && lineup && (
          <>
            <div
              className="rounded-2xl p-4 flex items-center gap-3 border"
              style={{ borderColor: passed ? "#26ff9a66" : "#ff4d6d66", background: passed ? "#26ff9a14" : "#ff4d6d14" }}
            >
              {passed ? <CheckCircle2 className="text-[#26ff9a]" /> : <XCircle className="text-[#ff4d6d]" />}
              <div>
                <div className="font-display text-sm">{passed ? "Outcome verified ✓" : "Verification mismatch ✗"}</div>
                <div className="text-[11px] text-white/60">
                  Winner: <b style={{ color: lineup[d.winner].color }}>{lineup[d.winner].colorName}</b> · Verified locally in your browser
                </div>
              </div>
            </div>

            <div className="glass rounded-2xl p-4 space-y-2 text-[11px] break-all">
              <Row k="Pre-race SHA-256 commitment" v={d.commit} />
              <Row k="Revealed round secret" v={d.reveal} />
              <Row k="Browser SHA-256 check" v={d.hash} ok={d.hashOk} />
              <Row k="Finishing order" v={d.order.map((l) => lineup[l].colorName).join(" → ")} ok={d.winnerOk} />
            </div>

            <div className="glass rounded-2xl p-4">
              <div className="font-display text-[10px] tracking-[0.2em] text-white/55 mb-2">ODDS & HOUSE EDGE</div>
              {lineup.map((c, i) => (
                <div key={c.id} className="flex justify-between text-[12px] py-1">
                  <span style={{ color: c.color }}>{c.colorName}</span>
                  <span className="tabular text-white/70">{(probs[i] * 100).toFixed(1)}% win chance · {c.multiplier}× payout</span>
                </div>
              ))}
              <div className="text-[10px] text-white/45 mt-2">Payout multiplier = {RTP} ÷ win probability ({Math.round((1 - RTP) * 100)}% house edge).</div>
            </div>
          </>
        )}

        <div className="glass rounded-2xl p-4 text-[11px] text-white/60 space-y-1.5">
          <div className="font-display text-[10px] tracking-[0.2em] text-white/55">HOW VERIFICATION WORKS</div>
          <p>1. Before betting opens, we publish the SHA-256 commitment hash of the round's secret.</p>
          <p>2. As soon as betting locks, we reveal the secret so your browser can hash it and confirm it matches the commitment.</p>
          <p>3. The finishing order is deterministically derived from that secret and each car's published win probability, ensuring no result can be altered after bets are placed.</p>
        </div>
      </div>
    </main>
  );
}

function Row({ k, v, ok }: { k: string; v: string; ok?: boolean }) {
  return (
    <div>
      <div className="text-white/45 flex items-center gap-1">
        {k} {ok !== undefined && (ok ? <CheckCircle2 size={11} className="text-[#26ff9a]" /> : <XCircle size={11} className="text-[#ff4d6d]" />)}
      </div>
      <div className="font-mono text-white/85">{v}</div>
    </div>
  );
}
