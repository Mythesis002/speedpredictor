import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { phoneToEmail, useAuthSession } from "@/lib/use-auth";
import { Gift, Loader2, Lock, Phone } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Speed Predict Racing Predictions" },
      {
        name: "description",
        content:
          "Create your Speed Predict account with a phone number and password. New players get a ₹28 welcome bonus and can start predicting from ₹10.",
      },
      { property: "og:title", content: "Sign in to Speed Predict" },
      {
        property: "og:description",
        content: "Phone-number sign up, ₹28 welcome bonus, ₹10 minimum prediction.",
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session) void navigate({ to: "/" });
  }, [session, navigate]);

  const digits = phone.replace(/\D/g, "");
  const valid = digits.length === 10 && password.length >= 6;

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
          options: { data: { phone: digits }, emailRedirectTo: window.location.origin },
        });
        if (err) throw err;
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signInErr) throw signInErr;
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(
        msg.includes("already registered")
          ? "This number is already registered — sign in instead."
          : msg.includes("Invalid login")
            ? "Wrong number or password."
            : msg,
      );
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="h-[100dvh] w-full bg-[#04060c]" />;
  }

  return (
    <main className="min-h-[100dvh] w-full bg-[#04060c] text-white flex flex-col justify-center px-5 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="text-center mb-7">
          <div className="font-display text-3xl italic leading-none">SPEED</div>
          <div
            className="font-display text-3xl italic leading-none"
            style={{ color: "#ffc32b", textShadow: "0 0 20px #ffc32b55" }}
          >
            PREDICT
          </div>
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
                  placeholder="9876543210"
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
          MINIMUM PREDICTION ₹10 · 18+ ONLY · PLAY RESPONSIBLY
        </p>
      </div>
    </main>
  );
}
