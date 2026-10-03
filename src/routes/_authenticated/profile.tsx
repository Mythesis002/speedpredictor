import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { getMyProfile, updateMyProfile } from "@/lib/profile.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Speed Predict" },
      { name: "description", content: "Your Speed Predict account, limits and responsible play settings." },
      { property: "og:title", content: "Profile — Speed Predict" },
      { property: "og:description", content: "Account and responsible play settings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

const inr = (p: number) => `₹${(p / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

function ProfilePage() {
  const fetchProfile = useServerFn(getMyProfile);
  const save = useServerFn(updateMyProfile);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["my-profile"], queryFn: () => fetchProfile() });
  const [name, setName] = useState<string | null>(null);
  const [limit, setLimit] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (data: Parameters<typeof save>[0]["data"], msg: string) => {
    setBusy(true);
    try {
      await save({ data });
      toast.success(msg);
      await qc.invalidateQueries({ queryKey: ["my-profile"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async (global: boolean) => {
    if (!confirm(global ? "Sign out on every device?" : "Sign out?")) return;
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut(global ? { scope: "global" } : undefined);
    void navigate({ to: "/auth", replace: true });
  };

  const p = q.data;
  const paused = p?.selfExcludedUntil && new Date(p.selfExcludedUntil) > new Date();

  return (
    <main className="min-h-[100dvh] bg-[#04060c] text-white px-4 py-6" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}>
      <div className="mx-auto max-w-md space-y-3">
        <Link to="/" className="inline-flex items-center gap-1 text-[12px] text-white/55 min-h-[44px]"><ArrowLeft size={14} /> Back to race</Link>
        <h1 className="font-display text-xl">Profile</h1>

        {q.isLoading && <div className="glass rounded-2xl p-6 grid place-items-center"><Loader2 className="animate-spin" /></div>}
        {q.isError && <div className="glass rounded-2xl p-4 text-sm">Could not load. <button className="underline" onClick={() => void q.refetch()}>Retry</button></div>}

        {p && (
          <>
            <section className="glass rounded-2xl p-4 space-y-1 text-[12px] text-white/70">
              <div className="flex justify-between"><span>Phone</span><span className="tabular">+91 {p.phone}</span></div>
              <div className="flex justify-between"><span>Balance</span><span className="tabular text-[#ffc32b]">{inr(p.balancePaise)}</span></div>
              <div className="flex justify-between"><span>Joined</span><span>{new Date(p.createdAt).toLocaleDateString()}</span></div>
              {p.isBanned && <div className="text-[#ff4d6d]">Account suspended — contact support.</div>}
            </section>

            <section className="glass rounded-2xl p-4 space-y-2">
              <label className="text-[10px] font-display tracking-[0.2em] text-white/50">DISPLAY NAME</label>
              <div className="flex gap-2">
                <input value={name ?? p.displayName ?? ""} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="Pick a name"
                  className="flex-1 h-11 rounded-xl bg-black/40 border border-white/10 px-3 outline-none text-sm" />
                <button disabled={busy || !name} onClick={() => void run({ displayName: name ?? "" }, "Name saved")}
                  className="h-11 px-4 rounded-xl bg-white/10 text-sm disabled:opacity-40">Save</button>
              </div>
            </section>

            <section className="glass rounded-2xl p-4 space-y-3">
              <div className="font-display text-[10px] tracking-[0.2em] text-white/50">RESPONSIBLE PLAY</div>
              <div className="space-y-1">
                <div className="text-[12px] text-white/70">Daily loss limit {p.dailyLossLimitPaise ? `(now ${inr(p.dailyLossLimitPaise)})` : "(off)"}</div>
                <div className="flex gap-2">
                  <input inputMode="numeric" value={limit ?? ""} onChange={(e) => setLimit(e.target.value.replace(/\D/g, ""))} placeholder="₹ amount"
                    className="flex-1 h-11 rounded-xl bg-black/40 border border-white/10 px-3 outline-none text-sm" />
                  <button disabled={busy || !limit} onClick={() => void run({ dailyLossLimitPaise: Number(limit) * 100 }, "Limit set")}
                    className="h-11 px-4 rounded-xl bg-white/10 text-sm disabled:opacity-40">Set</button>
                  {p.dailyLossLimitPaise && (
                    <button disabled={busy} onClick={() => void run({ dailyLossLimitPaise: null }, "Limit removed")}
                      className="h-11 px-3 rounded-xl bg-white/5 text-sm">Off</button>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[12px] text-white/70">
                  Take a break {paused && <span className="text-[#ffc32b]">— paused until {new Date(p.selfExcludedUntil!).toLocaleString()}</span>}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {([1, 7, 30] as const).map((d) => (
                    <button key={d} disabled={busy}
                      onClick={() => { if (confirm(`Block betting for ${d} day${d > 1 ? "s" : ""}? This cannot be undone early.`)) void run({ selfExcludeDays: d }, "Betting paused"); }}
                      className="h-11 rounded-xl bg-white/5 text-sm">{d === 1 ? "24 hours" : `${d} days`}</button>
                  ))}
                </div>
              </div>
              <p className="text-[10px] text-white/40">If gambling stops being fun, talk to someone you trust or a local support service.</p>
            </section>

            <section className="glass rounded-2xl p-4 space-y-2">
              <Link to="/how-it-works" className="block text-[12px] text-white/70 underline min-h-[24px]">How it works, Terms & Privacy</Link>
              <button onClick={() => void signOut(false)} className="w-full h-11 rounded-xl bg-white/10 text-sm">Sign out</button>
              <button onClick={() => void signOut(true)} className="w-full h-11 rounded-xl bg-white/5 text-sm text-white/70">Sign out of all devices</button>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
