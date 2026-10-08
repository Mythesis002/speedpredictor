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
      {
        name: "description",
        content: "Check in your own browser that this race result was fixed before betting opened.",
      },
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
  return Array.from(new Uint8Array(d))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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
    <main
      className="min-h-[100dvh] bg-[#04060c] text-white px-4 py-6"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}
    >
      <div className="mx-auto max-w-md space-y-3">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-[12px] text-white/55 min-h-[44px]"
        >
          <ArrowLeft size={14} /> Back to race
        </Link>
        <h1 className="font-display text-xl">Verify Round #{roundId}</h1>

        {q.isLoading && (
          <div className="glass rounded-2xl p-6 grid place-items-center">
            <Loader2 className="animate-spin" />
          </div>
        )}
        {q.isError && (
          <div className="glass rounded-2xl p-4 text-sm">
            Could not load this round.{" "}
            <button className="underline" onClick={() => void q.refetch()}>
              Retry
            </button>
          </div>
        )}
        {d && !d.ok && (
          <div className="glass rounded-2xl p-4 text-sm text-white/70">
            {d.reason === "early"
              ? "This round is still taking bets. Its secret is revealed the moment betting closes."
              : "This round is too old to verify here."}
          </div>
        )}

        {d?.ok && lineup && (
          <>
            <div
              className="rounded-2xl p-4 flex items-center gap-3 border"
              style={{
                borderColor: passed ? "#26ff9a66" : "#ff4d6d66",
                background: passed ? "#26ff9a14" : "#ff4d6d14",
              }}
            >
              {passed ? (
                <CheckCircle2 className="text-[#26ff9a]" />
              ) : (
                <XCircle className="text-[#ff4d6d]" />
              )}
              <div>
                <div className="font-display text-sm">{passed ? "Verified ✓" : "Mismatch ✗"}</div>
                <div className="text-[11px] text-white/60">
                  Winner:{" "}
                  <b style={{ color: lineup[d.winner].color }}>{lineup[d.winner].colorName}</b> ·
                  checked in your browser
                </div>
              </div>
            </div>

            <div className="glass rounded-2xl p-4 space-y-2 text-[11px] break-all">
              <Row k="Commitment (published before betting)" v={d.commit} />
              <Row k="Revealed secret" v={d.reveal} />
              <Row k="SHA-256 of secret (computed here)" v={d.hash} ok={d.hashOk} />
              <Row
                k="Finish order (lanes)"
                v={d.order.map((l) => lineup[l].colorName).join(" → ")}
                ok={d.winnerOk}
              />
            </div>

            <div className="glass rounded-2xl p-4">
              <div className="font-display text-[10px] tracking-[0.2em] text-white/55 mb-2">
                ODDS & HOUSE EDGE
              </div>
              {lineup.map((c, i) => (
                <div key={c.id} className="flex justify-between text-[12px] py-1">
                  <span style={{ color: c.color }}>{c.colorName}</span>
                  <span className="tabular text-white/70">
                    {(probs[i] * 100).toFixed(1)}% chance · pays {c.multiplier}x
                  </span>
                </div>
              ))}
              <div className="text-[10px] text-white/45 mt-2">
                Payout = {RTP} ÷ win chance. House edge: {Math.round((1 - RTP) * 100)}%.
              </div>
            </div>
          </>
        )}

        <div className="glass rounded-2xl p-4 text-[11px] text-white/60 space-y-1.5">
          <div className="font-display text-[10px] tracking-[0.2em] text-white/55">
            HOW IT WORKS
          </div>
          <p>
            1. Before betting opens we publish a fingerprint (SHA-256) of a secret for the round.
          </p>
          <p>
            2. When betting closes we reveal the secret. Your browser hashes it — it must match the
            fingerprint.
          </p>
          <p>
            3. The finish order is computed from that secret, weighted by each car's published win
            chance. Since the secret was locked in first, nobody could change the result after
            seeing bets.
          </p>
        </div>
      </div>
    </main>
  );
}

function Row({ k, v, ok }: { k: string; v: string; ok?: boolean }) {
  return (
    <div>
      <div className="text-white/45 flex items-center gap-1">
        {k}{" "}
        {ok !== undefined &&
          (ok ? (
            <CheckCircle2 size={11} className="text-[#26ff9a]" />
          ) : (
            <XCircle size={11} className="text-[#ff4d6d]" />
          ))}
      </div>
      <div className="font-mono text-white/85">{v}</div>
    </div>
  );
}
