import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck, Zap, Trophy, HelpCircle, GraduationCap } from "lucide-react";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "Apex 2 (Apex2Bet) Rules, Fairness & Guide — Best Car Game & Color Prediction" },
      {
        name: "description",
        content:
          "Official guide to Apex 2 (Apex2Bet): How the live neon car racing color game works, 95% RTP odds, provably fair SHA-256 verification, and online earning guide for students.",
      },
      {
        name: "keywords",
        content:
          "apex2, apex 2, apex2bet, apex, car game, online money game, betting app, best betting game, color game, best online earning for student, provably fair car game, apex2.online, apex2.live",
      },
      { property: "og:site_name", content: "Apex 2 (Apex2Bet)" },
      { property: "og:title", content: "Apex 2 Rules, Fairness & Earning Guide — Apex2Bet" },
      {
        property: "og:description",
        content:
          "Understand how Apex 2 races work, dynamic color multipliers, provably fair SHA-256 commitments, instant UPI deposits, and safe gameplay.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "https://apex2bet.lovable.app/how-it-works" },
      { property: "og:image", content: "https://apex2bet.lovable.app/apex-logo.svg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Apex 2 Game Guide & Fairness — Apex2Bet" },
      {
        name: "twitter:description",
        content:
          "Rules, provably fair race audits, terms of use, and student earning guide for Apex 2 (Apex2Bet).",
      },
    ],
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
    title: "What is Apex 2 & How the Car Game Works",
    badge: "Game Rules",
    body: [
      "Apex 2 (Apex2Bet) is India's premier live 3-car neon racing color prediction game, running on apex2bet.lovable.app, apex2.online, and apex2.live.",
      "A new race begins every ~21 seconds. Players have a 6-second betting countdown before start lights turn green.",
      "Select your car color: Red, Purple, or Blue. Each car displays its real-time payout multiplier (e.g., 2.85×, 3.40×, or up to 6.00×). If your selected car crosses the finish line first, you instantly win your stake × multiplier.",
      "Minimum bet is only ₹10, making it an accessible online money game for entertainment and pocket money earnings.",
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
          <ArrowLeft size={14} /> Back to Apex 2 Race
        </Link>

        <header className="border-b border-white/10 pb-3">
          <div className="text-[10px] font-display tracking-[0.2em] text-[#a24bff] uppercase">
            Apex 2 · Official Guide
          </div>
          <h1 className="font-display text-xl font-bold mt-1 text-white">
            How Apex 2 Works — Rules, Fairness & Earning Guide
          </h1>
          <p className="text-[11px] text-white/60 mt-1 leading-relaxed">
            Everything you need to know about playing the Apex 2 (Apex2Bet) live car game, color
            prediction strategies, provably fair verification, and responsible online earning.
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
            Terms & Conditions Policy
          </Link>
          <div className="text-[9.5px] text-white/35 mt-1">
            Apex 2 (Apex2Bet) · Domains: apex2bet.lovable.app · apex2.online · apex2.live
          </div>
        </div>
      </div>
    </main>
  );
}
