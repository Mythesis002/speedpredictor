import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How it works, Terms & Privacy — Apex" },
      { name: "description", content: "How Apex races work, the rules, fairness, terms of use and privacy." },
      { property: "og:title", content: "How it works — Apex" },
      { property: "og:description", content: "Rules, provably fair results, terms and privacy for Apex." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InfoPage,
});

const sections: { title: string; body: string[] }[] = [
  {
    title: "How it works",
    body: [
      "A new race starts every ~21 seconds. Betting stays open for 6 seconds before the start lights arm.",
      "Select Red, Purple, or Blue. Each car displays its payout multiplier (for example, 2.85×). If your car finishes first, you win your stake × multiplier.",
      "Minimum bet is ₹10, with one bet allowed per round. Race outcomes are determined on our server and can be verified on any finished round's Verify page.",
    ],
  },
  {
    title: "Provably fair results",
    body: [
      "Before betting opens, we publish a cryptographic SHA-256 commitment of the round's secret. The secret is revealed as soon as betting locks.",
      "Payout multipliers equal 0.95 ÷ the car's win probability, maintaining a transparent 5% house edge across all lanes.",
    ],
  },
  {
    title: "Terms of use",
    body: [
      "You must be 18 or older and legally permitted to participate in real-money prediction games in your jurisdiction.",
      "Limit one account per player. Multiple accounts, automated play, or abuse will result in account suspension and forfeiture of promotional balances.",
      "Deposits are processed instantly via UPI QR. Withdrawal requests (₹100 minimum) are reviewed and transferred directly to your verified UPI ID.",
    ],
  },
  {
    title: "Privacy",
    body: [
      "We record your phone number, bets, deposits, and withdrawals solely to operate your account, verify transactions, and meet regulatory obligations.",
      "Your phone number is never displayed to other players, and we never sell your personal information.",
    ],
  },
  {
    title: "Responsible play",
    body: [
      "Only bet what you can afford to lose. You can set a daily loss limit or pause betting for 24 hours, 7 days, or 30 days at any time from your Profile.",
      "If playing stops being enjoyable, pause your account and reach out to a trusted person or a local support service.",
    ],
  },
];

function InfoPage() {
  return (
    <main className="min-h-[100dvh] bg-[#04060c] text-white px-4 py-6" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}>
      <div className="mx-auto max-w-md space-y-3">
        <Link to="/" className="inline-flex items-center gap-1 text-[12px] text-white/55 min-h-[44px]">
          <ArrowLeft size={14} /> Back to race
        </Link>
        <h1 className="font-display text-xl">How it works</h1>
        {sections.map((s) => (
          <section key={s.title} className="glass rounded-2xl p-4">
            <h2 className="font-display text-[11px] tracking-[0.2em] text-white/60 mb-2">{s.title.toUpperCase()}</h2>
            <ul className="space-y-1.5 text-[12px] text-white/75 list-disc pl-4">
              {s.body.map((b) => <li key={b}>{b}</li>)}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
