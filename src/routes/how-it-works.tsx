import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck, Zap, Trophy, HelpCircle, GraduationCap } from "lucide-react";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How Apex2 Works – Game Rules, Odds & Fairness Guide" },
      {
        name: "description",
        content:
          "Official guide to Apex2: Learn how live 3-car neon racing predictions work, dynamic odds multipliers, provably fair SHA-256 verification, and player safety.",
      },
      {
        name: "keywords",
        content:
          "apex2, how apex2 works, apex 2 game rules, neon car game, color prediction rules, provably fair sha-256, apex2.live",
      },
      { property: "og:site_name", content: "Apex2" },
      { property: "og:title", content: "How Apex2 Works – Game Rules & Fairness Guide" },
      {
        property: "og:description",
        content:
          "Understand how Apex2 races work, dynamic color multipliers, provably fair SHA-256 commitments, instant UPI deposits, and safe gameplay.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "https://apex2.live/how-it-works" },
      { property: "og:image", content: "https://apex2.live/apex-logo.svg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "How Apex2 Works – Game Rules & Fairness Guide" },
      {
        name: "twitter:description",
        content: "Rules, provably fair race audits, terms of use, and player guide for Apex2.",
      },
      { name: "twitter:image", content: "https://apex2.live/apex-logo.svg" },
    ],
    links: [{ rel: "canonical", href: "https://apex2.live/how-it-works" }],
  }),
  component: InfoPage,
});

const sections: {
  title: string;
  icon?: typeof Zap;
  badge?: string;
  body: string[];
}[] = [
  {
    title: "What is Apex2 & How the Car Game Works",
    badge: "Game Rules",
    body: [
      "Apex2 is a live 3-car neon racing color prediction game hosted at apex2.live.",
      "A new race begins every ~21 seconds. Players have a 6-second betting countdown before start lights turn green.",
      "Select your car color: Red, Purple, or Blue. Each car displays its real-time payout multiplier (e.g., 2.00×, 3.00×, or up to 6.00×). If your selected car crosses the finish line first, you instantly win your stake × multiplier.",
      "Minimum bet is only ₹10, making it an accessible game for casual entertainment.",
    ],
  },
  {
    title: "Best Online Earning Game for Students & Casual Players",
    badge: "Student Earning",
    body: [
      "Micro-Stake Friendly: Start with just ₹10. Students can test their predictions without risking significant capital.",
      "Transparent 95% Return to Player (RTP): multi-lane mathematical model ensures honest, reliable odds without hidden house deductions.",
      "Instant UPI Payments: Zero deposit fees with instant QR code scanning via Google Pay, PhonePe, Paytm, CRED, or BHIM.",
      "Fast Withdrawals: Direct bank account payouts via verified UPI ID starting at ₹100 minimum.",
    ],
  },
  {
    title: "Provably Fair SHA-256 Racing Engine",
    badge: "100% Cryptographic Audit",
    body: [
      "Before betting opens for each round, the server generates a cryptographic SHA-256 commitment of the round's outcome secret.",
      "Once betting locks, the seed secret is revealed. You can visit the Verify page for any round to re-calculate the SHA-256 hash in your own browser.",
      "Neither the player nor the platform can manipulate or foresee the outcome once the round hash is published.",
    ],
  },
  {
    title: "Terms of Use & Legal Compliance",
    badge: "Terms",
    body: [
      "You must be 18 years of age or older to participate in real-money prediction games.",
      "Strict one account per person policy. Multi-accounting, bot scripts, or exploit attempts result in immediate account suspension.",
      "All transactions are recorded in your immutable profile ledger with full timestamp and reference ID tracking.",
    ],
  },
  {
    title: "Privacy & Account Security",
    badge: "Privacy",
    body: [
      "We store your phone number and transaction history exclusively to secure your balance and fulfill KYC/regulatory standards.",
      "Your phone number is never shared, made public, or sold to third-party telemarketers.",
    ],
  },
  {
    title: "Responsible Play & Self-Exclusion",
    badge: "Player Safety",
    body: [
      "Only bet discretionary money that you can afford to lose.",
      "Set your daily loss limit anytime inside your Profile settings to automatically prevent further bets once reached.",
      "You can voluntarily pause betting on your account for 24 hours, 7 days, or 30 days at any time.",
    ],
  },
];

function InfoPage() {
  return (
    <main
      className="min-h-[100dvh] bg-[#04060c] text-white px-4 py-6"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}
    >
      <div className="mx-auto max-w-md space-y-3.5">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-[12px] text-white/55 hover:text-white min-h-[44px] transition-colors"
        >
          <ArrowLeft size={14} /> Back to Apex2 Race
        </Link>

        <header className="border-b border-white/10 pb-3">
          <div className="text-[10px] font-display tracking-[0.2em] text-[#a24bff] uppercase">
            Apex2 · Official Guide
          </div>
          <h1 className="font-display text-xl font-bold mt-1 text-white">
            How Apex2 Works — Rules, Odds &amp; Fairness Guide
          </h1>
          <p className="text-[11px] text-white/60 mt-1 leading-relaxed">
            Everything you need to know about playing the Apex2 live neon car racing game, color
            prediction mechanics, provably fair SHA-256 verification, and responsible play.
          </p>
        </header>

        {sections.map((s) => (
          <section key={s.title} className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display text-[11px] tracking-[0.15em] text-white/70 uppercase">
                {s.title}
              </h2>
              {s.badge && (
                <span className="text-[8px] font-display uppercase tracking-wider text-[#26ff9a] bg-[#26ff9a]/10 px-1.5 py-0.5 rounded-full border border-[#26ff9a]/20">
                  {s.badge}
                </span>
              )}
            </div>
            <ul className="space-y-1.5 text-[12px] text-white/75 list-disc pl-4 leading-relaxed">
              {s.body.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </section>
        ))}

        <div className="pt-2 text-center text-[10.5px] text-white/50 space-x-2">
          <span>Read our full</span>
          <Link to="/terms" className="text-white/80 hover:text-white underline font-medium">
            Terms &amp; Conditions Policy
          </Link>
          <div className="text-[9.5px] text-white/35 mt-1">
            Apex2 · Official Platform: https://apex2.live
          </div>
        </div>
      </div>
    </main>
  );
}
