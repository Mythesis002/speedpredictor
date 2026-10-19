import { createFileRoute, Link, Link as RouterLink, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { phoneToEmail, useAuthSession } from "@/lib/use-auth";
import { Gift, Loader2, Lock, Phone } from "lucide-react";
import { GoogleSignInButton } from "@/components/race/GoogleSignInButton";
import {
  createNewUserEmailContent,
  getAccessToken,
  sendGmailMessage,
  queueNotification,
  ADMIN_NOTIFICATION_EMAIL,
} from "@/lib/gmail";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Apex Racing Predictions" },
      {
        name: "description",
        content:
          "Sign in or create your Apex account with a 10-digit mobile number or Google. New players receive a ₹28 welcome bonus and can bet from ₹10.",
      },
      { property: "og:title", content: "Sign in to Apex" },
      {
        property: "og:description",
        content: "Mobile number & Google sign-in, ₹28 welcome bonus, ₹10 minimum bet.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuthSession();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [adult, setAdult] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session) void navigate({ to: "/" });
  }, [session, navigate]);

  const digits = phone.replace(/\D/g, "");
  const valid = digits.length === 10 && password.length >= 6 && (mode === "login" || adult);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    const email = phoneToEmail(digits);

    try {
      if (mode === "signup") {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { phone: digits, age_confirmed: true },
            emailRedirectTo: window.location.origin,
          },
        });
        if (err) throw err;
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signInErr) throw signInErr;

        // Silently notify admin in the background (no user popup)
        const racerName = `+91 ${digits}`;
        const emailPayload = createNewUserEmailContent({
          name: racerName,
          phone: digits,
          email,
        });

        void getAccessToken().then((activeToken) => {
          if (activeToken) {
            void sendGmailMessage({
              to: ADMIN_NOTIFICATION_EMAIL,
              subject: emailPayload.subject,
              html: emailPayload.html,
              token: activeToken,
            }).catch(() => {
              queueNotification({
                type: "new_user",
                subject: emailPayload.subject,
                html: emailPayload.html,
                recipient: ADMIN_NOTIFICATION_EMAIL,
                meta: { phone: digits },
              });
            });
          } else {
            queueNotification({
              type: "new_user",
              subject: emailPayload.subject,
              html: emailPayload.html,
              recipient: ADMIN_NOTIFICATION_EMAIL,
              meta: { phone: digits },
            });
          }
        });
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Could not complete sign-in. Please try again.";
      setError(
        msg.includes("already registered")
          ? "This phone number is already registered. Switch to Sign In above."
          : msg.includes("Invalid login")
            ? "Incorrect phone number or password. Check your details and try again."
            : msg,
      );
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[100dvh] w-full bg-[#04060c] grid place-items-center text-white/45">
        <Loader2 size={20} className="animate-spin" aria-label="Loading Apex" />
      </div>
    );
  }

  return (
    <main className="min-h-[100dvh] w-full bg-[#04060c] text-white flex flex-col justify-center px-5 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center">
          <Link to="/" aria-label="Watch live races">
            <img
              src="/apex-logo.svg"
              alt="Apex logo"
              referrerPolicy="no-referrer"
              className="h-16 w-auto drop-shadow-[0_0_24px_rgba(255,195,43,0.45)]"
            />
          </Link>
        </div>

        <div className="glass rounded-2xl p-4">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-black/40 mb-4">
            {(["signup", "login"] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={`h-9 rounded-lg font-display text-[11px] tracking-[0.16em] transition ${
                  mode === m ? "bg-white/15 text-white" : "text-white/45"
                }`}
              >
                {m === "signup" ? "CREATE ACCOUNT" : "SIGN IN"}
              </button>
            ))}
          </div>

          {mode === "signup" && (
            <div className="mb-4 flex items-center gap-2 rounded-xl px-3 py-2 bg-[#26ff9a]/10 border border-[#26ff9a]/30">
              <Gift size={15} className="text-[#26ff9a] shrink-0" />
              <span className="text-[11px] text-[#26ff9a] font-display tracking-[0.1em]">
                ₹28 WELCOME BONUS ON SIGN UP
              </span>
            </div>
          )}

          <div className="mb-4 space-y-2.5">
            <GoogleSignInButton
              text={mode === "signup" ? "Sign up with Google" : "Sign in with Google"}
              onSuccess={() => {
                void navigate({ to: "/" });
              }}
            />
            <div className="flex items-center gap-2 py-1">
              <div className="h-px flex-1 bg-white/10"></div>
              <span className="text-[9px] font-display tracking-[0.18em] text-white/35">
                OR WITH MOBILE NUMBER
              </span>
              <div className="h-px flex-1 bg-white/10"></div>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-3">
            <label className="block">
              <span className="text-[10px] font-display tracking-[0.2em] text-white/45">
                PHONE NUMBER
              </span>
              <div className="mt-1 flex items-center h-12 rounded-xl bg-black/40 border border-white/10 px-3 gap-2">
                <Phone size={15} className="text-white/35" />
                <span className="text-white/45 font-display text-sm">+91</span>
                <input
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={10}
                  value={digits}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="10-digit mobile number"
                  className="flex-1 bg-transparent outline-none font-display tabular text-base placeholder:text-white/20"
                />
              </div>
            </label>

            <label className="block">
              <span className="text-[10px] font-display tracking-[0.2em] text-white/45">
                PASSWORD
              </span>
              <div className="mt-1 flex items-center h-12 rounded-xl bg-black/40 border border-white/10 px-3 gap-2">
                <Lock size={15} className="text-white/35" />
                <input
                  type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="flex-1 bg-transparent outline-none text-base placeholder:text-white/20"
                />
              </div>
            </label>

            {mode === "signup" && (
              <label className="flex items-start gap-2 text-[11px] text-white/65 min-h-[44px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={adult}
                  onChange={(e) => setAdult(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-[#ffc32b]"
                />
                <span>
                  I am 18 or older and agree to the{" "}
                  <RouterLink to="/terms" className="underline text-white/90 hover:text-white">
                    Terms & Conditions
                  </RouterLink>
                  .
                </span>
              </label>
            )}

            {error && (
              <p className="text-[11px] text-[#ff4d6d] font-display tracking-wide">{error}</p>
            )}

            <button
              type="submit"
              disabled={!valid || busy}
              className="w-full h-12 rounded-xl font-display text-[13px] tracking-[0.14em] disabled:opacity-50 active:scale-[0.98] transition grid place-items-center"
              style={{
                background: "linear-gradient(180deg,#ffd83a,#f0a415)",
                color: "#231a00",
                boxShadow: "0 12px 30px -14px rgba(255,190,40,0.9)",
              }}
            >
              {busy ? (
                <Loader2 size={16} className="animate-spin" />
              ) : mode === "signup" ? (
                "CREATE ACCOUNT & CLAIM ₹28"
              ) : (
                "SIGN IN"
              )}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-[10px] text-white/30 font-display tracking-[0.12em]">
          MINIMUM BET ₹10 · 18+ ONLY · PLAY RESPONSIBLY
        </p>
      </div>
    </main>
  );
}
