import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Shield, Volume2, VolumeX } from "lucide-react";
import { getMyProfile, updateMyProfile } from "@/lib/profile.functions";
import { amIAdmin } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/race/BottomNav";
import { WithdrawModal } from "@/components/race/WithdrawModal";
import { isSoundMuted, subscribeSoundMuted, toggleSoundMuted } from "@/lib/sound";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Apex" },
      { name: "description", content: "Your Apex account, limits and responsible play settings." },
      { property: "og:title", content: "Profile — Apex" },
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
  const checkAdmin = useServerFn(amIAdmin);
  const save = useServerFn(updateMyProfile);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["my-profile"], queryFn: () => fetchProfile() });
  const adminQ = useQuery({ queryKey: ["am-i-admin"], queryFn: () => checkAdmin({}) });
  const [name, setName] = useState<string | null>(null);
  const [limit, setLimit] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    setMuted(isSoundMuted());
    return subscribeSoundMuted(setMuted);
  }, []);

  const run = async (data: Parameters<typeof save>[0]["data"], msg: string) => {
    setBusy(true);
    try {
      await save({ data });
      toast.success(msg);
      await qc.invalidateQueries({ queryKey: ["my-profile"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save your changes. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async (global: boolean) => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut(global ? { scope: "global" } : undefined);
    void navigate({ to: "/", replace: true });
  };

  const p = q.data;
  const paused = p?.selfExcludedUntil && new Date(p.selfExcludedUntil) > new Date();

  return (
    <main className="h-[100dvh] w-full overflow-y-auto overflow-x-hidden bg-[#04060c] text-white flex flex-col [scrollbar-width:none]">
      <div className="mx-auto w-full max-w-md px-4 pt-5 pb-6 space-y-3 flex-1">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-[12px] text-white/55 min-h-[44px]"
          >
            <ArrowLeft size={14} /> Back to race
          </Link>
          {adminQ.data && (
            <Link
              to="/admin"
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 bg-[#ffc32b]/15 border border-[#ffc32b]/40 text-[11px] font-display tracking-[0.12em] text-[#ffd83a]"
            >
              <Shield size={13} /> OWNER CONSOLE
            </Link>
          )}
        </div>
        <h1 className="font-display text-xl">Profile</h1>

        {q.isLoading && (
          <div className="glass rounded-2xl p-6 grid place-items-center">
            <Loader2 className="animate-spin" aria-label="Loading profile" />
          </div>
        )}
        {q.isError && (
          <div className="glass rounded-2xl p-4 text-sm">
            We couldn't load your profile settings.{" "}
            <button className="underline" onClick={() => void q.refetch()}>
              Try again
            </button>
          </div>
        )}

        {p && (
          <>
            <section className="glass rounded-2xl p-4 space-y-1.5 text-[12px] text-white/70">
              <div className="flex justify-between">
                <span>Phone number</span>
                <span className="tabular">+91 {p.phone}</span>
              </div>
              <div className="flex justify-between">
                <span>Available balance</span>
                <span className="tabular text-[#26ff9a] font-display">
                  {inr(p.availablePaise ?? p.balancePaise)}
                </span>
              </div>
              {(p.heldPaise ?? 0) > 0 && (
                <>
                  <div className="flex justify-between">
                    <span className="text-[#ffc32b]">Reserved in 24h payout escrow</span>
                    <span className="tabular text-[#ffc32b] font-display">{inr(p.heldPaise)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total wallet (pre-debit)</span>
                    <span className="tabular text-white font-display">{inr(p.balancePaise)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between">
                <span>Member since</span>
                <span>{new Date(p.createdAt).toLocaleDateString()}</span>
              </div>
              {p.isBanned && (
                <div className="text-[#ff4d6d]">
                  Your account is currently suspended. Please contact support for assistance.
                </div>
              )}
            </section>

            <section className="glass rounded-2xl p-4 space-y-2">
              <label className="text-[10px] font-display tracking-[0.2em] text-white/50">
                DISPLAY NAME
              </label>
              <div className="flex gap-2">
                <input
                  value={name ?? p.displayName ?? ""}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={20}
                  placeholder="Enter display name"
                  className="flex-1 h-11 rounded-xl bg-black/40 border border-white/10 px-3 outline-none text-sm"
                />
                <button
                  disabled={busy || !name}
                  onClick={() => void run({ displayName: name ?? "" }, "Display name saved")}
                  className="h-11 px-4 rounded-xl bg-white/10 text-sm disabled:opacity-40"
                >
                  Save
                </button>
              </div>
            </section>

            {/* Sound effects preference */}
            <section className="glass rounded-2xl p-4 flex items-center justify-between">
              <div>
                <div className="font-display text-[10px] tracking-[0.2em] text-white/50">
                  RACE SOUND EFFECTS
                </div>
                <div className="text-[12px] text-white/70 mt-0.5">
                  Countdown beeps, engine roar & win chimes
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMuted(toggleSoundMuted())}
                className="h-10 px-3.5 rounded-xl bg-white/10 flex items-center gap-2 text-xs font-display tracking-wide"
              >
                {muted ? (
                  <>
                    <VolumeX size={15} className="text-white/45" /> MUTED
                  </>
                ) : (
                  <>
                    <Volume2 size={15} className="text-[#26ff9a]" /> ON
                  </>
                )}
              </button>
            </section>

            <section className="glass rounded-2xl p-4 space-y-3">
              <div className="font-display text-[10px] tracking-[0.2em] text-white/50">
                RESPONSIBLE PLAY
              </div>
              <div className="space-y-1">
                <div className="text-[12px] text-white/70">
                  Daily loss limit{" "}
                  {p.dailyLossLimitPaise ? `(active: ${inr(p.dailyLossLimitPaise)})` : "(not set)"}
                </div>
                <div className="flex gap-2">
                  <input
                    inputMode="numeric"
                    value={limit ?? ""}
                    onChange={(e) => setLimit(e.target.value.replace(/\D/g, ""))}
                    placeholder="Daily limit in ₹ (min ₹10)"
                    className="flex-1 h-11 rounded-xl bg-black/40 border border-white/10 px-3 outline-none text-sm"
                  />
                  <button
                    disabled={busy || !limit}
                    onClick={() =>
                      void run(
                        { dailyLossLimitPaise: Number(limit) * 100 },
                        "Daily loss limit updated",
                      )
                    }
                    className="h-11 px-3.5 rounded-xl bg-white/10 text-sm disabled:opacity-40 whitespace-nowrap"
                  >
                    Save limit
                  </button>
                  {p.dailyLossLimitPaise && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run({ dailyLossLimitPaise: null }, "Daily loss limit removed")
                      }
                      className="h-11 px-3 rounded-xl bg-white/5 text-sm"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[12px] text-white/70">
                  Pause betting{" "}
                  {paused && p.selfExcludedUntil && (
                    <span className="text-[#ffc32b]">
                      · paused until {new Date(p.selfExcludedUntil).toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {([1, 7, 30] as const).map((d) => (
                    <button
                      key={d}
                      disabled={busy}
                      onClick={() => {
                        void run(
                          { selfExcludeDays: d },
                          `Betting paused for ${d === 1 ? "24 hours" : `${d} days`}`,
                        );
                      }}
                      className="h-11 rounded-xl bg-white/5 text-sm"
                    >
                      {d === 1 ? "24 hours" : `${d} days`}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[10px] text-white/40">
                Only bet what you can afford to lose. If playing stops being enjoyable, pause your account and reach out to a local support service.
              </p>
            </section>

            <section className="glass rounded-2xl p-4 space-y-2">
              <Link
                to="/how-it-works"
                className="block text-[12px] text-white/70 underline min-h-[24px]"
              >
                How it works, Terms & Privacy
              </Link>
              <button
                onClick={() => void signOut(false)}
                className="w-full h-11 rounded-xl bg-white/10 text-sm"
              >
                Sign out
              </button>
              <button
                onClick={() => void signOut(true)}
                className="w-full h-11 rounded-xl bg-white/5 text-sm text-white/70"
              >
                Sign out of all devices
              </button>
            </section>
          </>
        )}
      </div>

      <WithdrawModal
        open={withdrawOpen}
        onClose={() => {
          setWithdrawOpen(false);
          void q.refetch();
        }}
        balancePaise={p?.availablePaise ?? p?.balancePaise ?? 0}
        heldPaise={p?.heldPaise ?? 0}
        onRequested={() => void q.refetch()}
      />

      <BottomNav active="profile" onCashOut={() => setWithdrawOpen(true)} />
    </main>
  );
}
