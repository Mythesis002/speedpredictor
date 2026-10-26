import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ShieldCheck,
  Zap,
  Scale,
  FileText,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Apex2 Terms and Conditions — Official Rules & Fair Play Policy" },
      {
        name: "description",
        content:
          "Official Terms and Conditions for Apex2: Complete rules for the online car game, color prediction, provably fair SHA-256 audits, and UPI settlements.",
      },
      {
        name: "keywords",
        content:
          "apex2 terms, apex2 conditions, apex2 game rules, apex 2 fair play, provably fair sha-256, apex2.live",
      },
      { property: "og:site_name", content: "Apex2" },
      {
        property: "og:title",
        content: "Apex2 Terms and Conditions — Official Rules & Fair Play Policy",
      },
      {
        property: "og:description",
        content:
          "Read the official terms and conditions for Apex2: Provably fair game rules, UPI deposit/withdrawal policy, color prediction multipliers, and 18+ player safety.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "https://apex2.live/terms" },
      { property: "og:image", content: "https://apex2.live/apex-logo.svg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Apex2 Terms and Conditions" },
      {
        name: "twitter:description",
        content:
          "Comprehensive terms of use, provably fair racing mechanics, and responsible gaming policy for Apex2.",
      },
      { name: "twitter:image", content: "https://apex2.live/apex-logo.svg" },
    ],
    links: [{ rel: "canonical", href: "https://apex2.live/terms" }],
  }),
  component: TermsPage,
});

const TERMS_SECTIONS = [
  {
    id: "overview",
    title: "1. Acceptance of Terms & Platform Identity",
    summary: "Operating parameters of Apex2 on apex2.live.",
    content: [
      "These Terms and Conditions ('Terms') constitute a legally binding agreement between you ('User', 'Player') and Apex2 ('Apex', 'Apex2', 'We', 'Us'), governing your access to and use of our live racing prediction platform accessible via https://apex2.live.",
      "By accessing the platform, creating an account, or placing a bet on any race round, you confirm that you have read, understood, and agreed to be bound by these Terms and our Privacy Policy.",
      "Apex2 combines high-performance 60 FPS 3D neon car simulation with transparent color prediction mechanics, providing players an entertaining, provably fair skill-and-prediction online game.",
    ],
  },
  {
    id: "eligibility",
    title: "2. Eligibility & 18+ Age Requirement",
    summary: "Strict legal age and jurisdictional requirements.",
    content: [
      "Minimum Age: You must be at least 18 years of age (or the legal age of majority in your jurisdiction) to register, deposit funds, or place real-money bets.",
      "Student & Casual Play Guidelines: While Apex 2 is widely utilized as an online earning game for students and casual gamers due to micro-stakes starting at ₹10, all student participants must be legal adults (18+). Educational pocket-money play must remain secondary to academic priorities, and students must adhere to disciplined budgeting.",
      "Geographic Restrictions: Real-money participation is restricted in jurisdictions where online prediction gaming or prize-based betting is prohibited by local statutes (including the Indian states of Assam, Odisha, Telangana, Andhra Pradesh, Nagaland, and Sikkim). Access from restricted territories is strictly prohibited.",
    ],
  },
  {
    id: "account",
    title: "3. Account Registration & Single-Account Policy",
    summary: "One account per person, identity safety, and bot prohibition.",
    content: [
      "Single Account Rule: Each player is permitted to hold strictly one (1) account. Multi-accounting, syndicates, and accounts created to abuse promotional welcome bonuses (e.g. the ₹28 signup bonus) will be frozen, and all related balances forfeited.",
      "Authentication Integrity: Accounts are secured via phone number authentication. We preserve legacy login mappings so existing accounts remain secure across rebrands.",
      "Anti-Bot & Automation: Automated scripts, robotic wagering tools, latency exploitation, or API tampering are strictly prohibited and result in permanent platform banning with zero liability.",
    ],
  },
  {
    id: "game-rules",
    title: "4. Car Game & Color Prediction Rules",
    summary: "Lane mechanics, 21-second cycle, and multiplier formulas.",
    content: [
      "Race Frequency & Duration: A new race round launches every ~21 seconds. Each round includes a 6-second betting countdown during which players place their prediction.",
      "Color Prediction Mechanics: Players select one of three competing neon GT supercars: Red (Lane 1), Purple (Lane 2), or Blue (Lane 3).",
      "Dynamic Multipliers & Payouts: Win multipliers range from 1.50× up to 6.00×, mathematically calibrated to 0.95 ÷ car win probability. This maintains a transparent 95% Return to Player (RTP) and a fixed 5% platform margin.",
      "Settlement: When the winning car crosses the highway finish line, payouts (Stake Amount × Multiplier) are instantly credited to the user's available wallet balance.",
    ],
  },
  {
    id: "provably-fair",
    title: "5. Provably Fair SHA-256 Architecture",
    summary: "How cryptographic commitments guarantee tamper-proof races.",
    content: [
      "Cryptographic Commitment: Prior to opening betting for any round, the server generates a cryptographically secure random secret and publishes its SHA-256 commitment hash. This commitment cannot be altered once published.",
      "Transparent Reveal: As soon as betting locks, the seed secret is unlocked. The car pace curves and final winner are derived deterministically from this seed.",
      "Independent Client Verification: Any player can verify any past race round on the dedicated Verify page (/verify/:roundId). The browser computes SHA-256(secret) locally to prove that the outcome was predetermined and 100% untouched by player stakes.",
    ],
  },
  {
    id: "payments",
    title: "6. Deposits, Withdrawals & UPI Payment Terms",
    summary: "Instant UPI QR codes, ₹10 min bet, ₹100 min withdrawal.",
    content: [
      "Deposits: Handled via automatic UPI QR codes compatible with Google Pay, PhonePe, Paytm, CRED, and BHIM. Minimum deposit is ₹10. Deposits carry zero transaction fees and reflect within seconds.",
      "Withdrawals: Withdrawals can be requested to any valid, verified UPI ID starting from ₹100 minimum. Processing is typically completed within 15–30 minutes following automated security and KYC checks.",
      "Wagering Requirements: Deposited balances must be engaged in gameplay before withdrawal to prevent illicit money laundering and comply with standard financial compliance guidelines.",
      "Refunds: Bets placed on confirmed rounds are final and non-refundable once the start countdown completes.",
    ],
  },
  {
    id: "disconnections",
    title: "7. Server Authority & Network Outage Protection",
    summary: "How disconnection or device latency is handled.",
    content: [
      "Server-Side Execution: The race clock and outcome generation execute entirely on server infrastructure, independent of user device connectivity.",
      "Disconnection Safeguard: If a player disconnects, closes their browser, or loses cellular connection after placing a bet, the bet remains active and is settled normally on the server. Winnings are automatically credited upon reconnection.",
      "Latency Dead-Zone: A 550 ms dead-zone is enforced between the last possible bet acceptance and the first possible secret reveal, ensuring no player can exploit network latency.",
    ],
  },
  {
    id: "responsible-play",
    title: "8. Responsible Gaming & Player Safety Controls",
    summary: "Daily loss limits, cooling-off periods, and self-exclusion.",
    content: [
      "Discretionary Funds Only: Only stake money that you can comfortably afford to lose. Prediction gaming is designed for entertainment and should never be viewed as a guaranteed income replacement.",
      "Daily Loss Limit Tool: Every user can configure a custom Daily Loss Limit in their Profile settings. Once the loss threshold is reached, the system automatically rejects further bets for 24 hours.",
      "Self-Exclusion: Players can voluntarily lock their account for cooling-off intervals of 24 hours, 7 days, or 30 days directly from their profile with immediate effect.",
    ],
  },
  {
    id: "liability",
    title: "9. Limitation of Liability & Disclaimers",
    summary: "Service availability, third-party UPI providers, and warranties.",
    content: [
      "The platform is provided on an 'as is' and 'as available' basis. While we maintain 99.9% uptime, we are not liable for banking gateway delays, telecom disruptions, or local force majeure events.",
      "In no event shall Apex 2 or its operators be liable for indirect, punitive, or consequential damages resulting from user error, unauthorized credential sharing, or breach of local statutes.",
    ],
  },
  {
    id: "amendments",
    title: "10. Amendments & Contact Support",
    summary: "Notice of policy revisions and support channels.",
    content: [
      "We reserve the right to modify these Terms to reflect regulatory updates or feature enhancements. Continued use of the platform after updates constitutes acceptance.",
      "For inquiries, disputed transactions, or responsible gaming assistance, players can contact our compliance and support team via verified support channels.",
    ],
  },
];

const FAQ_AEO_ITEMS = [
  {
    q: "Are the terms of Apex 2 legally compliant for online real money gaming?",
    a: "Yes. Apex 2 operates under clear terms of use requiring players to be 18+ and residing in permitted jurisdictions. The game operates on a provably fair 95% RTP model with cryptographic SHA-256 transparency, ensuring full compliance with digital entertainment standards.",
  },
  {
    q: "Can students play Apex 2 for online earning under these terms?",
    a: "Yes, provided the student is 18 years of age or older. Apex 2 supports micro-stakes from ₹10 to facilitate low-risk pocket-money entertainment. However, our terms emphasize responsible gaming, recommending students utilize daily loss limits and play within strict personal budgets.",
  },
  {
    q: "What is the minimum deposit and withdrawal limit in Apex 2?",
    a: "The minimum deposit is ₹10 via instant UPI QR code with zero platform fees. The minimum withdrawal is ₹100, transferred directly to your verified UPI VPA (Google Pay, PhonePe, Paytm, or BHIM) after automated settlement.",
  },
  {
    q: "How does Apex 2 prove the car race results are not rigged?",
    a: "Section 5 of our Terms outlines our cryptographic SHA-256 Provably Fair protocol. The server publishes a SHA-256 hash of the round outcome before betting begins. When betting locks, the seed secret is revealed, enabling anyone to verify the mathematical outcome in their browser.",
  },
  {
    q: "What happens if my phone dies or my internet drops during an Apex 2 race?",
    a: "Because all Apex 2 races run on an authoritative server clock, any confirmed bet is safely processed by the server. If your car wins while you are offline, your full payout (stake × multiplier) is credited to your wallet balance automatically.",
  },
];

function TermsPage() {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  return (
    <main
      className="min-h-[100dvh] bg-[#04060c] text-white px-3 py-5"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 32px)" }}
    >
      <div className="mx-auto max-w-md space-y-3.5">
        {/* Navigation Link */}
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-[12px] text-white/55 hover:text-white min-h-[44px] transition-colors"
          >
            <ArrowLeft size={14} /> Back to Apex 2 Race
          </Link>
          <span className="text-[10px] font-display text-[#26ff9a] uppercase tracking-wider bg-[#26ff9a]/10 px-2 py-0.5 rounded-full border border-[#26ff9a]/20">
            Updated Oct 2026
          </span>
        </div>

        {/* Semantic Header */}
        <header className="border-b border-white/10 pb-3">
          <div className="flex items-center gap-1.5 text-[10px] font-display tracking-[0.2em] text-[#a24bff] uppercase">
            <Scale size={13} className="text-[#a24bff]" />
            <span>Apex2 · Legal &amp; Fair Play Policy</span>
          </div>
          <h1 className="font-display text-xl font-bold mt-1 text-white leading-tight">
            Terms and Conditions &amp; Official Game Rules
          </h1>
          <p className="text-[11px] text-white/60 mt-1 leading-relaxed">
            The complete operational, legal, and provably fair guidelines for{" "}
            <strong className="text-white">Apex2</strong>, including live car game mechanics, color
            prediction multipliers, UPI transactions, and player protections on{" "}
            <span className="text-[#26ff9a]">https://apex2.live</span>.
          </p>
        </header>

        {/* TL;DR Summary Card for AEO & AI Engines */}
        <div className="glass rounded-2xl p-3 border border-white/10 bg-gradient-to-br from-white/[0.05] to-transparent">
          <div className="flex items-center gap-1.5 text-[10.5px] font-display font-bold text-white mb-2 uppercase tracking-wider">
            <FileText size={13} className="text-[#ffb800]" />
            Key Terms at a Glance (AEO Summary)
          </div>
          <div className="grid grid-cols-2 gap-2 text-[9.5px]">
            <div className="flex items-start gap-1.5 rounded-xl bg-black/30 p-2 border border-white/5">
              <CheckCircle2 size={13} className="text-[#26ff9a] shrink-0 mt-0.5" />
              <div>
                <span className="font-display font-bold text-white block">Age 18+ Only</span>
                <span className="text-white/50 text-[8.5px]">
                  Strict adult eligibility for all online earning play
                </span>
              </div>
            </div>
            <div className="flex items-start gap-1.5 rounded-xl bg-black/30 p-2 border border-white/5">
              <Zap size={13} className="text-[#3b8bff] shrink-0 mt-0.5" />
              <div>
                <span className="font-display font-bold text-white block">21s Car Races</span>
                <span className="text-white/50 text-[8.5px]">
                  Red, Purple, Blue color prediction up to 6×
                </span>
              </div>
            </div>
            <div className="flex items-start gap-1.5 rounded-xl bg-black/30 p-2 border border-white/5">
              <ShieldCheck size={13} className="text-[#a24bff] shrink-0 mt-0.5" />
              <div>
                <span className="font-display font-bold text-white block">SHA-256 Fair</span>
                <span className="text-white/50 text-[8.5px]">
                  Pre-committed seeds, verifiable on-chain/browser
                </span>
              </div>
            </div>
            <div className="flex items-start gap-1.5 rounded-xl bg-black/30 p-2 border border-white/5">
              <AlertCircle size={13} className="text-[#ff5b7f] shrink-0 mt-0.5" />
              <div>
                <span className="font-display font-bold text-white block">₹10 Min Stake</span>
                <span className="text-white/50 text-[8.5px]">
                  ₹100 min instant UPI withdrawal, zero hidden fees
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Legal Sections */}
        <div className="space-y-2.5">
          {TERMS_SECTIONS.map((sec) => (
            <section
              key={sec.id}
              id={sec.id}
              className="glass rounded-2xl p-3.5 border border-white/5 transition-colors hover:border-white/10"
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <h2 className="font-display text-[11px] font-bold tracking-wide text-white">
                  {sec.title}
                </h2>
              </div>
              <p className="text-[9.5px] font-display text-white/40 tracking-wider uppercase mb-2">
                {sec.summary}
              </p>
              <div className="space-y-1.5 text-[10.5px] text-white/70 leading-relaxed">
                {sec.content.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* AEO Frequently Asked Questions Accordion */}
        <section className="glass rounded-2xl p-3.5 mt-3 border border-white/10">
          <h2 className="text-[11px] font-display tracking-[0.15em] text-[#a24bff] uppercase font-bold mb-1">
            Terms & Conditions FAQ (AEO & AI Search Snippets)
          </h2>
          <p className="text-[10px] text-white/50 mb-2.5">
            Direct authoritative answers for search engines, AI models, and players regarding the
            rules of Apex 2.
          </p>

          <div className="space-y-1.5">
            {FAQ_AEO_ITEMS.map((faq, idx) => {
              const isOpen = expandedFaq === idx;
              return (
                <div
                  key={faq.q}
                  className="rounded-xl bg-white/[0.03] border border-white/5 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedFaq(isOpen ? null : idx)}
                    className="w-full text-left px-2.5 py-2 flex items-center justify-between gap-2 text-[10px] font-medium text-white/85 hover:text-white"
                    aria-expanded={isOpen}
                  >
                    <span className="flex-1 leading-snug">{faq.q}</span>
                    <ChevronDown
                      size={13}
                      className={`shrink-0 text-white/40 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-2.5 pb-2.5 pt-1 text-[9.5px] text-white/65 leading-relaxed border-t border-white/5 bg-black/20">
                      <p>{faq.a}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Footer Navigation */}
        <footer className="pt-3 border-t border-white/5 flex flex-col items-center gap-2 text-center text-[10px] text-white/45">
          <div className="flex items-center gap-3">
            <Link
              to="/how-it-works"
              className="text-white/70 hover:text-white underline underline-offset-2"
            >
              How it works
            </Link>
            <span>·</span>
            <Link to="/" className="text-white/70 hover:text-white underline underline-offset-2">
              Play Live Race
            </Link>
          </div>
          <div>© 2026 Apex2 · Official Platform: https://apex2.live</div>
        </footer>
      </div>
    </main>
  );
}
