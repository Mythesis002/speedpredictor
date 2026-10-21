import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { Toaster } from "@/components/ui/sonner";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you requested doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Back to race
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Unable to load this page
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We couldn't load this view right now. Try again or return to the live race.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Back to race
          </a>
        </div>
      </div>
    </div>
  );
}

const APEX_SCHEMA_JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": ["WebApplication", "VideoGame", "Brand"],
      "@id": "https://apex2bet.lovable.app/#game",
      name: "Apex 2",
      alternateName: [
        "Apex2",
        "Apex2Bet",
        "Apex",
        "Apex 2 Online",
        "Apex 2 Live",
        "Apex Car Game",
        "Apex Betting App",
        "Paisa Kamane Wala Car Game",
      ],
      url: "https://apex2bet.lovable.app",
      sameAs: [
        "https://apex2.online",
        "https://apex2.live",
        "https://apex2bet.lovable.app",
        "https://en.wikipedia.org/wiki/Online_game",
        "https://en.wikipedia.org/wiki/Racing_video_game",
        "https://en.wikipedia.org/wiki/Unified_Payments_Interface",
      ],
      headline:
        "Apex 2 (Apex2Bet) — India's #1 Car Game & Online Money Game | Color Prediction Betting App",
      description:
        "Apex 2 (Apex2Bet): India's premier live 3-car neon racing color prediction game. Predict Red, Purple or Blue in 21-second live rounds to win up to 6× real money payouts. Instant UPI deposits and withdrawals from ₹10. Best online earning game for students in 2026–2030.",
      applicationCategory: "GameApplication",
      operatingSystem: "All (Web, Android, iOS)",
      genre: [
        "Racing Game",
        "Color Prediction Game",
        "Online Money Game",
        "Betting App",
        "Skill & Prediction",
      ],
      gamePlatform: ["Web Browser", "Mobile Web App", "PWA"],
      inLanguage: "en-IN",
      image: "https://apex2bet.lovable.app/apex-logo.svg",
      screenshot: "https://apex2bet.lovable.app/apex-logo.svg",
      knowsAbout: [
        "Color Prediction Games",
        "Car Racing Video Games",
        "Provably Fair SHA-256 Cryptography",
        "Unified Payments Interface (UPI)",
        "Real Money Gaming (RMG)",
      ],
      audience: {
        "@type": "Audience",
        audienceType: "Adult Gamers & College Students 18–30",
        geographicArea: {
          "@type": "Country",
          name: "India",
        },
      },
      offers: {
        "@type": "Offer",
        price: "10",
        priceCurrency: "INR",
        availability: "https://schema.org/InStock",
        category: "Minimum Bet ₹10",
      },
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "4.9",
        bestRating: "5",
        ratingCount: "18450",
      },
    },
    {
      "@type": "BreadcrumbList",
      "@id": "https://apex2bet.lovable.app/#breadcrumb",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Apex 2 Home",
          item: "https://apex2bet.lovable.app/",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "How It Works & Game Rules",
          item: "https://apex2bet.lovable.app/how-it-works",
        },
        {
          "@type": "ListItem",
          position: 3,
          name: "Terms & Conditions Policy",
          item: "https://apex2bet.lovable.app/terms",
        },
      ],
    },
    {
      "@type": "FAQPage",
      "@id": "https://apex2bet.lovable.app/#faq",
      mainEntity: [
        {
          "@type": "Question",
          name: "What is Apex 2 (Apex2Bet) and how does the car game work?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Apex 2 (also branded as Apex2Bet and accessible via apex2bet.lovable.app, apex2.online, and apex2.live) is a live online neon car racing and color prediction betting game. Players pick between three competing neon cars—Red, Purple, and Blue—racing on a cyberpunk highway every ~21 seconds with multiplier payouts up to 6× and instant UPI withdrawals from ₹10.",
          },
        },
        {
          "@type": "Question",
          name: "Why is Apex 2 rated the best online earning game for students in 2026?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Apex 2 is favored as the best online earning game for students and casual players due to its low ₹10 entry barrier, 95% Return-to-Player (RTP), instant zero-fee UPI QR deposits (via GPay, PhonePe, Paytm), fast ₹100 withdrawals directly to bank accounts, provably fair SHA-256 transparency, and disciplined daily loss limit protections.",
          },
        },
        {
          "@type": "Question",
          name: "How to play and win the Apex 2 color prediction car game?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "To play Apex 2: 1) Select your car color (Red, Purple, or Blue) during the 6-second betting window. 2) Enter your stake starting from ₹10 using quick chips. 3) Confirm your bet and watch the live 3-lane neon highway race. 4) If your car crosses the finish line first, your payout (stake × multiplier) is credited instantly to your wallet.",
          },
        },
        {
          "@type": "Question",
          name: "How does Apex 2 compare to legacy apps like Fast Parity or Daman?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Unlike opaque apps like Fast Parity or Daman that use hidden server-side RNG without verification, Apex 2 features real-time 3D physics-based neon racing simulation, cryptographic SHA-256 pre-committed seeds verifiable in your own browser, ultra-fast 21-second rounds, zero ads, and instant UPI payouts.",
          },
        },
        {
          "@type": "Question",
          name: "Is Apex 2 provably fair?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Apex 2 utilizes cryptographic SHA-256 commitments published before betting opens for every round. Once betting locks, the server reveals the secret. Players can verify any past race on the dedicated Verify page using client-side SHA-256 hashing to guarantee 100% tamper-proof outcomes.",
          },
        },
        {
          "@type": "Question",
          name: "How do deposits and withdrawals work on Apex 2?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Deposits are instant using automatic UPI QR codes compatible with Google Pay, PhonePe, Paytm, and BHIM. Withdrawals start from ₹100 and are transferred directly to your verified UPI ID with fast processing and full transaction history.",
          },
        },
      ],
    },
    {
      "@type": "Organization",
      "@id": "https://apex2bet.lovable.app/#organization",
      name: "Apex 2",
      alternateName: "Apex2Bet",
      url: "https://apex2bet.lovable.app",
      logo: "https://apex2bet.lovable.app/apex-logo.svg",
      sameAs: ["https://apex2.online", "https://apex2.live"],
      knowsAbout: [
        "Color Prediction Gaming",
        "High-Speed Multiplayer Racing",
        "Provably Fair Verification",
        "Instant UPI Payments",
      ],
    },
    {
      "@type": "WebSite",
      "@id": "https://apex2bet.lovable.app/#website",
      url: "https://apex2bet.lovable.app",
      name: "Apex 2",
      alternateName: ["Apex2Bet", "Apex 2 Game", "Apex 2 Car Game"],
    },
  ],
};

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",
      },
      { title: "Apex 2 (Apex2Bet) — Best Car Game & Color Prediction Online Money Game" },
      {
        name: "description",
        content:
          "Apex 2 (Apex2Bet): Play India's top live 3-car neon racing color game. Predict Red, Purple or Blue in 21s live rounds. Win up to 6× real money with instant UPI payouts from ₹10. Best online earning game for students.",
      },
      {
        name: "keywords",
        content:
          "apex2, apex 2, apex2bet, apex, car game, online money game, betting app, best betting game, color game, best online earning for student, real money car game, colour prediction, colour prediction game, instant upi withdrawal game, live racing predictions, apex2.online, apex2.live",
      },
      { name: "author", content: "Apex 2" },
      { name: "theme-color", content: "#04060c" },
      {
        name: "robots",
        content: "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1",
      },
      { property: "og:site_name", content: "Apex 2 (Apex2Bet)" },
      {
        property: "og:title",
        content: "Apex 2 — #1 Car Game & Online Money Game | Color Prediction Betting App",
      },
      {
        property: "og:description",
        content:
          "Play Apex 2 (Apex2Bet): Predict the winning neon car color in 21s live races and win real money up to 6×. Instant UPI deposits and fast withdrawals from ₹10. Best online earning for students.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://apex2bet.lovable.app" },
      { property: "og:image", content: "https://apex2bet.lovable.app/apex-logo.svg" },
      { property: "og:image:alt", content: "Apex 2 — Real Money Neon Car Game & Color Prediction" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@apex2bet" },
      { name: "twitter:creator", content: "@apex2bet" },
      {
        name: "twitter:title",
        content: "Apex 2 — Best Car Game & Color Prediction Betting App",
      },
      {
        name: "twitter:description",
        content:
          "Apex 2: Live 3-car neon racing color prediction game. Win real money with 95% RTP, instant UPI payouts from ₹10. Best online earning game for students.",
      },
      { name: "twitter:image", content: "https://apex2bet.lovable.app/apex-logo.svg" },
    ],
    links: [
      { rel: "canonical", href: "https://apex2bet.lovable.app" },
      { rel: "alternate", href: "https://apex2.online" },
      { rel: "alternate", href: "https://apex2.live" },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Inter:wght@400;500;600;700&display=swap",
      },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/apex-logo.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "apple-touch-icon", href: "/favicon.svg" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              #lovable-badge,
              #lovable-badge-cta,
              #lovable-badge-close,
              aside#lovable-badge,
              aside[id*="lovable" i],
              div[id*="lovable-badge" i],
              [id*="lovable-badge" i],
              [class*="lovable-badge" i],
              [aria-label*="Edit with Lovable" i],
              [aria-label*="Lovable" i],
              a[href*="lovable.dev" i][target="_blank"],
              iframe[src*="lovable.dev" i] {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                pointer-events: none !important;
                position: fixed !important;
                top: -99999px !important;
                left: -99999px !important;
                width: 0 !important;
                height: 0 !important;
                max-width: 0 !important;
                max-height: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
                border: 0 !important;
                outline: 0 !important;
                overflow: hidden !important;
                z-index: -999999 !important;
                clip-path: inset(100%) !important;
                transform: scale(0) !important;
              }
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                function purgeLovable() {
                  try {
                    var selectors = [
                      '#lovable-badge',
                      '#lovable-badge-cta',
                      '#lovable-badge-close',
                      'aside#lovable-badge',
                      'aside[id*="lovable" i]',
                      '[id*="lovable-badge" i]',
                      '[class*="lovable-badge" i]',
                      '[aria-label*="Edit with Lovable" i]',
                      '[aria-label*="Lovable" i]',
                      'a[href*="lovable.dev"][target="_blank"]'
                    ];
                    var nodes = document.querySelectorAll(selectors.join(','));
                    for (var i = 0; i < nodes.length; i++) {
                      nodes[i].remove();
                    }
                  } catch (e) {}
                }
                if (typeof window !== 'undefined' && typeof document !== 'undefined') {
                  purgeLovable();
                  if (typeof MutationObserver !== 'undefined') {
                    var obs = new MutationObserver(function() {
                      purgeLovable();
                    });
                    if (document.documentElement) {
                      obs.observe(document.documentElement, { childList: true, subtree: true });
                    }
                  }
                  setInterval(purgeLovable, 1000);
                }
              })();
            `,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(APEX_SCHEMA_JSON_LD),
          }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    const purge = () => {
      const els = document.querySelectorAll(
        '#lovable-badge, #lovable-badge-cta, #lovable-badge-close, aside[id*="lovable" i], [id*="lovable-badge" i], [class*="lovable-badge" i], [aria-label*="Edit with Lovable" i], [aria-label*="Lovable" i], a[href*="lovable.dev"][target="_blank"]',
      );
      els.forEach((el) => el.remove());
    };
    purge();
    const interval = setInterval(purge, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="app-shell">
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
      </div>
      <Toaster position="top-center" theme="dark" richColors />
    </QueryClientProvider>
  );
}
