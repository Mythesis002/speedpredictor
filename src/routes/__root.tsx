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
      "@type": ["WebApplication", "VideoGame"],
      "@id": "https://apex2.live/#game",
      name: "Apex2",
      alternateName: ["Apex 2", "Apex2 Live", "Apex2 Online", "Apex Car Game", "Apex Racing"],
      url: "https://apex2.live",
      sameAs: [
        "https://apex2.live",
        "https://en.wikipedia.org/wiki/Online_game",
        "https://en.wikipedia.org/wiki/Racing_video_game",
      ],
      headline: "Apex2 — Live Neon Car Racing & Prediction Game",
      description:
        "Apex2: Live 3-car neon racing color prediction game. Predict Red, Purple or Blue in 21-second live rounds with provably fair SHA-256 verification and instant UPI settlements from ₹10.",
      applicationCategory: "GameApplication",
      operatingSystem: "All (Web, Android, iOS)",
      genre: ["Racing Game", "Color Prediction Game", "Multiplayer Game", "Skill & Prediction"],
      gamePlatform: ["Web Browser", "Mobile Web App", "PWA"],
      inLanguage: "en-IN",
      image: "https://apex2.live/apex-logo.svg",
      screenshot: "https://apex2.live/apex-logo.svg",
      knowsAbout: [
        "Color Prediction Games",
        "Car Racing Video Games",
        "Provably Fair SHA-256 Cryptography",
        "Unified Payments Interface (UPI)",
      ],
      audience: {
        "@type": "Audience",
        audienceType: "Adult Gamers 18+",
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
        category: "Minimum Stake ₹10",
      },
    },
    {
      "@type": "BreadcrumbList",
      "@id": "https://apex2.live/#breadcrumb",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Apex2 Home",
          item: "https://apex2.live/",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "How It Works & Game Rules",
          item: "https://apex2.live/how-it-works",
        },
        {
          "@type": "ListItem",
          position: 3,
          name: "Terms & Conditions Policy",
          item: "https://apex2.live/terms",
        },
      ],
    },
    {
      "@type": "FAQPage",
      "@id": "https://apex2.live/#faq",
      mainEntity: [
        {
          "@type": "Question",
          name: "What is Apex2 and how does the neon car game work?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Apex2 (https://apex2.live) is a live multiplayer neon car racing and prediction game. Every 21 seconds, three cars (Red, Purple, and Blue) race down a cyberpunk highway. Players predict which car will cross the finish line first with dynamic odds multipliers and instant UPI account balance updates.",
          },
        },
        {
          "@type": "Question",
          name: "How do players participate in Apex2 live races?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "To participate in Apex2: 1) Select your car color (Red 2×, Purple 3×, or Blue 6×) during the betting window. 2) Choose your stake starting from ₹10. 3) Confirm your choice and watch the live physics race. 4) If your chosen car wins, your payout is credited instantly.",
          },
        },
        {
          "@type": "Question",
          name: "Is Apex2 provably fair?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Apex2 uses cryptographic SHA-256 commitments published before betting opens for each round. Once betting locks, the seed is revealed. Anyone can verify past race results on the Verify page using standard SHA-256 hashing.",
          },
        },
        {
          "@type": "Question",
          name: "How do deposits and withdrawals work on Apex2?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Deposits use automatic UPI QR codes compatible with Google Pay, PhonePe, Paytm, and BHIM. Withdrawals are processed directly to your verified UPI ID with fast settlement and complete transaction history.",
          },
        },
      ],
    },
    {
      "@type": "Organization",
      "@id": "https://apex2.live/#organization",
      name: "Apex2",
      alternateName: "Apex 2",
      url: "https://apex2.live",
      logo: "https://apex2.live/apex-logo.svg",
      sameAs: ["https://apex2.live"],
      knowsAbout: [
        "Color Prediction Gaming",
        "High-Speed Multiplayer Racing",
        "Provably Fair Verification",
        "Instant UPI Payments",
      ],
    },
    {
      "@type": "WebSite",
      "@id": "https://apex2.live/#website",
      url: "https://apex2.live",
      name: "Apex2",
      alternateName: ["Apex 2", "Apex2 Live", "Apex2 Game"],
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
      { title: "Apex2 – Live Neon Car Racing & Prediction Game" },
      {
        name: "description",
        content:
          "Play Apex2: fast-paced 3-car neon racing and color predictions with provably fair rounds, instant UPI transactions from ₹10, and 21-second live races.",
      },
      {
        name: "keywords",
        content:
          "apex2, apex 2, apex2 game, neon car game, color prediction, provably fair racing, live car game, apex2.live",
      },
      { name: "author", content: "Apex2" },
      { name: "theme-color", content: "#04060c" },
      {
        name: "robots",
        content: "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1",
      },
      { property: "og:site_name", content: "Apex2" },
      {
        property: "og:title",
        content: "Apex2 – Live Neon Car Racing & Prediction Game",
      },
      {
        property: "og:description",
        content:
          "Play Apex2: fast-paced 3-car neon racing and color predictions with provably fair rounds, instant UPI transactions from ₹10, and 21-second live races.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://apex2.live/" },
      { property: "og:image", content: "https://apex2.live/apex-logo.svg" },
      { property: "og:image:alt", content: "Apex2 — Live Neon Car Racing & Prediction Game" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@apex2live" },
      { name: "twitter:creator", content: "@apex2live" },
      {
        name: "twitter:title",
        content: "Apex2 – Live Neon Car Racing & Prediction Game",
      },
      {
        name: "twitter:description",
        content:
          "Play Apex2: fast-paced 3-car neon racing and color predictions with provably fair rounds, instant UPI transactions from ₹10, and 21-second live races.",
      },
      { name: "twitter:image", content: "https://apex2.live/apex-logo.svg" },
    ],
    links: [
      { rel: "canonical", href: "https://apex2.live/" },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Inter:wght@400;500;600;700&display=swap",
      },
      {
        rel: "icon",
        href: "/assets/aistudio/favicon-512_0aab6f34.png",
        type: "image/png",
      },
      {
        rel: "shortcut icon",
        href: "/assets/aistudio/favicon-512_0aab6f34.png",
        type: "image/png",
      },
      {
        rel: "apple-touch-icon",
        href: "/assets/aistudio/favicon-512_0aab6f34.png",
      },
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
