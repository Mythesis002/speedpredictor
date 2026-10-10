import { useState } from "react";
import { Link as RouterLink } from "@tanstack/react-router";
import { Gift, Loader2, Lock, Phone, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { phoneToEmail } from "@/lib/use-auth";

interface Props {
  open: boolean;
  onClose: () => void;
  promptText?: string;
}

export function AuthModal({ open, onClose, promptText }: Props) {
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [adult, setAdult] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

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
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      }
      setBusy(false);
      onClose();
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

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm px-0 sm:px-4 animate-fade-in">
      <div
        className="w-full sm:max-w-sm glass rounded-t-3xl sm:rounded-3xl p-4 relative"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close sign in modal"
          className="absolute right-3 top-3 w-8 h-8 rounded-lg grid place-items-center bg-white/10 text-white/70 hover:text-white"
        >
          <X size={15} />
        </button>

        <div className="mb-3 flex flex-col items-center">
          <img
            src="/apex-logo.svg"
            alt="Apex logo"
            referrerPolicy="no-referrer"
            className="h-11 w-auto drop-shadow-[0_0_18px_rgba(255,195,43,0.45)]"
          />
          {promptText && (
            <p className="mt-1.5 text-[11px] text-white/70 text-center">{promptText}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-black/40 mb-3">
          {(["signup", "login"] as const).map((m) => (
            <button
              key={m}
              type="button"
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
          <div className="mb-3 flex items-center gap-2 rounded-xl px-3 py-2 bg-[#26ff9a]/10 border border-[#26ff9a]/30">
            <Gift size={15} className="text-[#26ff9a] shrink-0" />
            <span className="text-[11px] text-[#26ff9a] font-display tracking-[0.1em]">
              ₹28 WELCOME BONUS ON SIGN UP
            </span>
          </div>
        )}

        <form onSubmit={submit} className="space-y-2.5">
          <label className="block">
            <span className="text-[10px] font-display tracking-[0.2em] text-white/45">
              PHONE NUMBER
            </span>
            <div className="mt-1 flex items-center h-11 rounded-xl bg-black/40 border border-white/10 px-3 gap-2">
              <Phone size={15} className="text-white/35" />
              <span className="text-white/45 font-display text-sm">+91</span>
              <input
                inputMode="numeric"
                autoComplete="tel"
                maxLength={10}
                value={digits}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="9876543210"
                className="flex-1 bg-transparent outline-none font-display tabular text-base placeholder:text-white/20 text-white"
              />
            </div>
          </label>

          <label className="block">
            <span className="text-[10px] font-display tracking-[0.2em] text-white/45">
              PASSWORD
            </span>
            <div className="mt-1 flex items-center h-11 rounded-xl bg-black/40 border border-white/10 px-3 gap-2">
              <Lock size={15} className="text-white/35" />
              <input
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="flex-1 bg-transparent outline-none text-base placeholder:text-white/20 text-white"
              />
            </div>
          </label>

          {mode === "signup" && (
            <label className="flex items-start gap-2 text-[11px] text-white/65 min-h-[36px] cursor-pointer pt-0.5">
              <input
                type="checkbox"
                checked={adult}
                onChange={(e) => setAdult(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-[#ffc32b]"
              />
              <span>
                I am 18 or older and agree to the{" "}
                <RouterLink to="/how-it-works" onClick={onClose} className="underline">
                  Terms & Privacy
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
            className="w-full h-11 rounded-xl font-display text-[12px] tracking-[0.14em] disabled:opacity-50 active:scale-[0.98] transition grid place-items-center"
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
    </div>
  );
}
