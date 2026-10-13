import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  BadgeIndianRupee,
  Banknote,
  Clock,
  Coins,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import {
  actOnWithdrawal,
  amIAdmin,
  getAdminOverview,
  getPaymentsStatus,
  listDeposits,
  listPlayers,
  setPlayerBan,
  adjustPlayerBalance,
  listRounds,
  listWithdrawals,
} from "@/lib/admin.functions";
import { lineupForRound } from "@/lib/round-engine";
import { AdminGmailPanel } from "@/components/race/AdminGmailPanel";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
  head: () => ({
    meta: [
      { title: "Owner Console · Apex" },
      {
        name: "description",
        content:
          "Live owner console for Apex: deposits, payouts, player growth and daily gaming revenue in one screen.",
      },
      {
        property: "og:description",
        content: "Deposits, payout requests, player growth and daily revenue at a glance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const rupees = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

type Tab = "payouts" | "deposits" | "players" | "races" | "gmail";

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  tone = "default",
}: {
  icon: typeof Users;
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "good" | "warn";
}) {
  const color =
    tone === "good" ? "#26ff9a" : tone === "warn" ? "#ffc32b" : "rgba(255,255,255,0.92)";
  return (
    <div className="glass rounded-2xl p-3">
      <div className="flex items-center gap-1.5 text-[9px] font-display tracking-[0.16em] text-white/45">
        <Icon size={12} />
        <span className="truncate">{label}</span>
      </div>
      <div className="font-display text-[19px] tabular mt-1 leading-none" style={{ color }}>
        {value}
      </div>
      {sub ? <div className="text-[10px] text-white/40 mt-1 truncate">{sub}</div> : null}
    </div>
  );
}

function AdminPage() {
  const checkAdminFn = useServerFn(amIAdmin);
  const overviewFn = useServerFn(getAdminOverview);
  const withdrawalsFn = useServerFn(listWithdrawals);
  const depositsFn = useServerFn(listDeposits);
  const playersFn = useServerFn(listPlayers);
  const actFn = useServerFn(actOnWithdrawal);
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("payouts");

  const adminCheck = useQuery({
    queryKey: ["am-i-admin"],
    queryFn: () => checkAdminFn({}),
  });
  const isOwner = adminCheck.data === true;

  const overview = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => overviewFn({}),
    enabled: isOwner,
    refetchInterval: 20_000,
  });
  const withdrawals = useQuery({
    queryKey: ["admin", "withdrawals"],
    queryFn: () => withdrawalsFn({}),
    enabled: isOwner,
    refetchInterval: 20_000,
  });
  const deposits = useQuery({
    queryKey: ["admin", "deposits"],
    queryFn: () => depositsFn({}),
    enabled: isOwner && tab === "deposits",
  });
  const players = useQuery({
    queryKey: ["admin", "players"],
    queryFn: () => playersFn({}),
    enabled: isOwner && tab === "players",
  });
  const roundsFn = useServerFn(listRounds);
  const rounds = useQuery({
    queryKey: ["admin", "rounds"],
    queryFn: () => roundsFn({}),
    enabled: isOwner && tab === "races",
    refetchInterval: 15_000,
  });
  const payFn = useServerFn(getPaymentsStatus);
  const payments = useQuery({
    queryKey: ["admin", "payments"],
    queryFn: () => payFn({}),
    enabled: isOwner,
  });

  const act = useMutation({
    mutationFn: (v: { withdrawalId: string; action: "approve" | "reject" }) => actFn({ data: v }),
    onSuccess: (res) => {
      toast.success(res.status === "paid" ? "Payout approved & debited" : "Request rejected");
      void qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (adminCheck.isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[#04060c] text-white/45">
        <div className="font-display text-[11px] tracking-[0.2em] animate-pulse">
          VERIFYING ACCESS
        </div>
      </div>
    );
  }

  const forbidden =
    adminCheck.data === false ||
    adminCheck.isError ||
    (overview.error && /forbidden/i.test((overview.error as Error).message ?? ""));

  if (forbidden) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="font-display text-xl text-white">Not Found</h1>
        <p className="text-sm text-white/50">The page you requested does not exist.</p>
        <Link to="/" className="glass rounded-xl px-4 py-2 text-sm text-white">
          Back to race
        </Link>
      </div>
    );
  }

  const o = overview.data;
  const pending = (withdrawals.data ?? []).filter((w) => w.status === "pending");
  const history = (withdrawals.data ?? []).filter((w) => w.status !== "pending");

  return (
    <div
      className="min-h-dvh flex flex-col"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
    >
      <header className="flex items-center gap-2 px-3 py-3">
        <Link to="/" aria-label="Back to race" className="glass rounded-xl p-2 text-white/70">
          <ArrowLeft size={16} />
        </Link>
        <div className="leading-none">
          <div className="font-display text-[15px] italic text-white">OWNER</div>
          <div
            className="font-display text-[15px] italic"
            style={{ color: "#ffc32b", textShadow: "0 0 14px #ffc32b66" }}
          >
            CONSOLE
          </div>
        </div>
        <div className="ml-auto text-[9px] font-display tracking-[0.16em] text-white/40">
          LIVE · AUTO-REFRESH
        </div>
      </header>

      {/* Money */}
      <section className="px-2 grid grid-cols-2 gap-2">
        <Stat
          icon={BadgeIndianRupee}
          label="TOTAL DEPOSITED"
          value={o ? rupees(o.money.depositedPaise) : "—"}
          sub={o ? `${rupees(o.money.depositedTodayPaise)} today` : undefined}
          tone="good"
        />
        <Stat
          icon={TrendingUp}
          label="TODAY'S NET REVENUE"
          value={o ? rupees(o.game.todayGrossPaise) : "—"}
          sub={o ? `All-time ${rupees(o.game.grossPaise)}` : undefined}
          tone={o && o.game.todayGrossPaise < 0 ? "warn" : "good"}
        />
        <Stat
          icon={Clock}
          label="PENDING DEPOSITS"
          value={o ? String(o.money.depositsPendingCount) : "—"}
          sub={o ? `${rupees(o.money.depositsPendingPaise)} awaiting payment` : undefined}
          tone="warn"
        />
        <Stat
          icon={Banknote}
          label="PENDING PAYOUTS"
          value={o ? String(o.money.withdrawPendingCount) : "—"}
          sub={o ? `${rupees(o.money.withdrawPendingPaise)} requested` : undefined}
          tone="warn"
        />
        <Stat
          icon={Users}
          label="REGISTERED PLAYERS"
          value={o ? String(o.players.total) : "—"}
          sub={o ? `${o.players.today} today · ${o.players.week} this week` : undefined}
        />
        <Stat
          icon={Wallet}
          label="PLAYER BALANCES"
          value={o ? rupees(o.money.liabilityPaise) : "—"}
          sub={o ? `Bonuses credited ${rupees(o.money.bonusPaise)}` : undefined}
        />
        <Stat
          icon={Coins}
          label="TOTAL STAKED"
          value={o ? rupees(o.game.stakedPaise) : "—"}
          sub={o ? `${o.game.betsTotal} bets · ${o.game.betsToday} today` : undefined}
        />
        <Stat
          icon={Banknote}
          label="TOTAL WINNINGS PAID"
          value={o ? rupees(o.game.paidOutPaise) : "—"}
          sub={o ? `Withdrawn ${rupees(o.money.withdrawnPaise)}` : undefined}
        />
      </section>

      {/* Payment & Webhook Environment Verification */}
      <div className="mt-2 mx-2 glass rounded-2xl p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{
                background:
                  payments.data?.configured && payments.data?.webhookReady ? "#26ff9a" : "#ffc32b",
                boxShadow: `0 0 8px ${
                  payments.data?.configured && payments.data?.webhookReady ? "#26ff9a" : "#ffc32b"
                }`,
              }}
            />
            <span className="font-display text-[10px] tracking-[0.16em] text-white/80">
              RAZORPAY ENVIRONMENT VERIFICATION
            </span>
          </div>
          <span className="text-[9.5px] font-display tracking-wider uppercase text-[#ffc32b]">
            {payments.data?.mode === "live"
              ? "LIVE MODE"
              : payments.data?.mode === "test"
                ? "TEST MODE"
                : "KEYS MISSING"}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5 text-[10px]">
          <div className="rounded-xl bg-black/35 px-2.5 py-1.5 border border-white/5">
            <div className="text-white/40">KEY ID</div>
            <div
              className="font-display tabular truncate mt-0.5"
              style={{ color: payments.data?.hasKeyId ? "#26ff9a" : "#ff6b6b" }}
            >
              {payments.data?.keyIdMasked ?? "Missing"}
            </div>
          </div>
          <div className="rounded-xl bg-black/35 px-2.5 py-1.5 border border-white/5">
            <div className="text-white/40">KEY SECRET</div>
            <div
              className="font-display mt-0.5"
              style={{ color: payments.data?.hasKeySecret ? "#26ff9a" : "#ff6b6b" }}
            >
              {payments.data?.hasKeySecret ? "Configured" : "Missing"}
            </div>
          </div>
          <div className="rounded-xl bg-black/35 px-2.5 py-1.5 border border-white/5">
            <div className="text-white/40">WEBHOOK SECRET</div>
            <div
              className="font-display mt-0.5"
              style={{ color: payments.data?.webhookReady ? "#26ff9a" : "#ff6b6b" }}
            >
              {payments.data?.webhookReady ? "Verified" : "Missing"}
            </div>
          </div>
        </div>

        <div className="text-[10.5px] text-white/55 leading-snug flex items-center justify-between gap-2">
          <span>
            Webhook listener:{" "}
            <code className="text-white/80 font-mono">
              {payments.data?.webhookEndpoint ?? "/api/public/razorpay-webhook"}
            </code>{" "}
            (event: <code className="text-white/80 font-mono">qr_code.credited</code>)
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-3 mx-2 glass rounded-2xl grid grid-cols-5 p-1 gap-0.5">
        {(
          [
            ["payouts", `Payouts${pending.length ? ` (${pending.length})` : ""}`],
            ["deposits", "Deposits"],
            ["players", "Players"],
            ["races", "Races"],
            ["gmail", "Gmail"],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`py-2 rounded-xl text-[10.5px] font-display tracking-wide transition truncate px-1 ${
              tab === id ? "text-white font-semibold" : "text-white/45"
            }`}
            style={tab === id ? { background: "rgba(162,75,255,0.18)" } : undefined}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-2 mx-2 flex flex-col gap-2 pb-6">
        {tab === "payouts" && (
          <>
            {pending.length === 0 && (
              <div className="glass rounded-2xl p-4 text-center text-sm text-white/45">
                No pending payout requests.
              </div>
            )}
            {pending.map((w) => {
              const createdMs = new Date(w.createdAt).getTime();
              const dueMs = createdMs + 24 * 60 * 60 * 1000;
              const remMs = dueMs - Date.now();
              const readyFor24h = remMs <= 0;
              const hrs = Math.max(0, Math.floor(remMs / 3_600_000));
              const mins = Math.max(0, Math.floor((remMs % 3_600_000) / 60_000));
              return (
                <div key={w.id} className="glass rounded-2xl p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-display text-white text-[13px]">+91 {w.phone}</div>
                      <div className="text-[10px] text-white/45 truncate">UPI: {w.upiId}</div>
                      <div className="text-[10px] text-white/35">Requested {when(w.createdAt)}</div>
                      <div
                        className="mt-1 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[9.5px] font-display tracking-wide"
                        style={{
                          color: readyFor24h ? "#26ff9a" : "#ffc32b",
                          background: readyFor24h
                            ? "rgba(38,255,154,0.12)"
                            : "rgba(255,195,43,0.12)",
                        }}
                      >
                        {readyFor24h
                          ? "24H VERIFICATION COMPLETE · READY TO DEBIT"
                          : `24H ESCROW WINDOW · ${hrs}h ${String(mins).padStart(2, "0")}m LEFT`}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-display tabular text-[17px] text-[#ffc32b]">
                        {rupees(w.amountPaise)}
                      </div>
                      <div className="text-[10px] text-white/40">
                        Pre-debit wallet {rupees(w.balancePaise)}
                      </div>
                      <div className="text-[9.5px] text-white/50">
                        After debit {rupees(Math.max(0, w.balancePaise - w.amountPaise))}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2.5">
                    <button
                      disabled={act.isPending}
                      onClick={() => act.mutate({ withdrawalId: w.id, action: "approve" })}
                      className="rounded-xl py-2 text-[11.5px] font-display text-black disabled:opacity-50"
                      style={{ background: "#26ff9a" }}
                    >
                      Approve & Debit Wallet
                    </button>
                    <button
                      disabled={act.isPending}
                      onClick={() => act.mutate({ withdrawalId: w.id, action: "reject" })}
                      className="rounded-xl py-2 text-[11.5px] font-display text-white/80 border border-white/15 disabled:opacity-50"
                    >
                      Decline & Unlock Funds
                    </button>
                  </div>
                </div>
              );
            })}

            {history.length > 0 && (
              <div className="glass rounded-2xl p-3">
                <div className="text-[9px] font-display tracking-[0.16em] text-white/40 mb-2">
                  PAYOUT HISTORY
                </div>
                {history.map((w) => (
                  <div
                    key={w.id}
                    className="flex items-center justify-between py-1.5 border-t border-white/5 first:border-0"
                  >
                    <div className="min-w-0">
                      <div className="text-[12px] text-white/80">+91 {w.phone}</div>
                      <div className="text-[10px] text-white/35">{when(w.createdAt)}</div>
                    </div>
                    <div className="text-right">
                      <div className="tabular text-[12px] text-white/80">
                        {rupees(w.amountPaise)}
                      </div>
                      <div
                        className="text-[10px]"
                        style={{ color: w.status === "paid" ? "#26ff9a" : "#ff6b6b" }}
                      >
                        {w.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "deposits" && (
          <div className="glass rounded-2xl p-3">
            {(deposits.data ?? []).length === 0 && (
              <div className="text-center text-sm text-white/45 py-4">No deposits yet.</div>
            )}
            {(deposits.data ?? []).map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between py-2 border-t border-white/5 first:border-0"
              >
                <div className="min-w-0">
                  <div className="text-[12px] text-white/85">+91 {d.phone}</div>
                  <div className="text-[10px] text-white/35">{when(d.createdAt)}</div>
                </div>
                <div className="text-right">
                  <div className="tabular text-[13px] text-white">{rupees(d.amountPaise)}</div>
                  <div
                    className="text-[10px] font-display uppercase tracking-wide"
                    style={{ color: d.status === "paid" ? "#26ff9a" : "#ffc32b" }}
                  >
                    {d.status === "paid" ? "paid" : "pending"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "players" && (
          <div className="glass rounded-2xl p-3">
            {(players.data ?? []).map((p) => (
              <div key={p.id} className="py-2 border-t border-white/5 first:border-0">
                <div className="flex items-center justify-between">
                  <div className="text-[12px] text-white/85">+91 {p.phone}</div>
                  <div className="tabular text-[13px] text-[#ffc32b]">{rupees(p.balancePaise)}</div>
                </div>
                {p.isBanned && (
                  <div className="text-[10px] text-[#ff4d6d]">Suspended: {p.bannedReason}</div>
                )}
                <PlayerActions id={p.id} banned={p.isBanned} />
                <div className="text-[10px] text-white/40 mt-0.5">
                  Joined {when(p.joinedAt)} · Deposited {rupees(p.depositedPaise)} · Staked{" "}
                  {rupees(p.stakedPaise)} · Won {rupees(p.wonPaise)} · {p.bets} bets
                </div>
              </div>
            ))}
            {(players.data ?? []).length === 0 && (
              <div className="text-center text-sm text-white/45 py-4">No players yet.</div>
            )}
          </div>
        )}

        {tab === "races" && (
          <div className="glass rounded-2xl p-3">
            <div className="text-[9px] font-display tracking-[0.16em] text-white/40 mb-2">
              LAST 50 RACE RESULTS
            </div>
            {(rounds.data ?? []).length === 0 && (
              <div className="text-center text-sm text-white/45 py-4">
                No finished races recorded yet.
              </div>
            )}
            {(rounds.data ?? []).map((r) => {
              const car = lineupForRound(r.roundId)[r.winnerLane];
              return (
                <div
                  key={r.roundId}
                  className="flex items-center gap-2 py-1.5 border-t border-white/5 first:border-0"
                >
                  <span className="text-[10px] tabular text-white/35 w-14 shrink-0">
                    #{r.roundId}
                  </span>
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{
                      background: car?.color,
                      boxShadow: `0 0 8px ${car?.color}`,
                      border: "1px solid rgba(255,255,255,0.2)",
                    }}
                  />
                  <span className="text-[12px] text-white/80 flex-1 truncate">
                    {car?.colorName ?? `Lane ${r.winnerLane + 1}`}
                  </span>
                  <span className="text-[10px] text-white/35 shrink-0">{when(r.createdAt)}</span>
                </div>
              );
            })}
          </div>
        )}

        {tab === "gmail" && <AdminGmailPanel />}
      </div>
    </div>
  );
}

function PlayerActions({ id, banned }: { id: string; banned: boolean }) {
  const ban = useServerFn(setPlayerBan);
  const adjust = useServerFn(adjustPlayerBalance);
  const qc = useQueryClient();
  const done = (m: string) => {
    toast.success(m);
    void qc.invalidateQueries({ queryKey: ["admin"] });
  };
  const fail = (e: unknown) =>
    toast.error(e instanceof Error ? e.message : "Action could not be completed");
  return (
    <div className="flex gap-2 mt-1">
      <button
        className="h-8 px-3 rounded-lg bg-white/5 text-[10px]"
        onClick={() => {
          const reason = prompt(
            banned
              ? "Enter reason for restoring this account (3–300 characters):"
              : "Enter reason for suspending this account (3–300 characters):",
          );
          if (!reason) return;
          ban({ data: { userId: id, banned: !banned, reason } }).then(
            () => done(banned ? "Account restored" : "Account suspended"),
            fail,
          );
        }}
      >
        {banned ? "Restore account" : "Suspend"}
      </button>
      <button
        className="h-8 px-3 rounded-lg bg-white/5 text-[10px]"
        onClick={() => {
          const amt = Number(
            prompt("Enter balance adjustment in ₹ (use a negative value to debit, e.g. -50):"),
          );
          if (!Number.isFinite(amt) || amt === 0) return;
          const reason = prompt("Enter audit reason for this adjustment (3–300 characters):");
          if (!reason) return;
          adjust({ data: { userId: id, amountPaise: Math.round(amt * 100), reason } }).then(
            () => done("Wallet balance adjusted"),
            fail,
          );
        }}
      >
        Adjust balance
      </button>
    </div>
  );
}
