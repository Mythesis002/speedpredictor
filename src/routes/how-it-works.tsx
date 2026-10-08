import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How it works, Terms & Privacy — Apex" },
      {
        name: "description",
        content: "How Apex races work, the rules, fairness, terms of use and privacy.",
      },
      { property: "og:title", content: "How it works — Apex" },
      {
        property: "og:description",
        content: "Rules, provably fair results, terms and privacy for Apex.",
      },
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
      "A new race starts every ~21 seconds. Betting is open for 6 seconds before the start lights.",
      "Pick Red, Purple or Blue. Each car shows its payout. If your car finishes first you get stake × payout.",
      "Minimum bet ₹10, one bet per round. Results are decided on our server and can be verified on each round's Verify page.",
    ],
  },
  {
    title: "Fairness",
    body: [
      "Every round's result is locked with a published fingerprint before betting opens and revealed after betting closes.",
      "Payouts equal 0.95 ÷ the car's win chance, so the house edge is 5% on every car.",
    ],
  },
  {
    title: "Terms",
    body: [
      "You must be 18 or older and allowed to take part in skill/prediction games where you live.",
      "One account per person. Multiple accounts, automation or abuse leads to suspension and forfeiture of winnings.",
      "Deposits are made by UPI. Withdrawals (minimum ₹100) are reviewed and paid manually to your UPI ID.",
    ],
  },
  {
    title: "Privacy",
    body: [
      "We store your phone number, bets, deposits and withdrawals to run your account and meet legal duties.",
      "Your phone number is never shown to other players. We don't sell your data.",
    ],
  },
  {
    title: "Play responsibly",
    body: [
      "Only play with money you can afford to lose. Set a daily loss limit or pause your account any time from Profile.",
      "If gambling stops being fun, talk to someone you trust or contact a support service in your area.",
    ],
  },
];

function InfoPage() {
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
          <ArrowLeft size={14} /> Back
        </Link>
        <h1 className="font-display text-xl">How it works</h1>
        {sections.map((s) => (
          <section key={s.title} className="glass rounded-2xl p-4">
            <h2 className="font-display text-[11px] tracking-[0.2em] text-white/60 mb-2">
              {s.title.toUpperCase()}
            </h2>
            <ul className="space-y-1.5 text-[12px] text-white/75 list-disc pl-4">
              {s.body.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
