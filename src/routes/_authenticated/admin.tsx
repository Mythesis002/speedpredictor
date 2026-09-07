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
  getAdminOverview,
  getPaymentsStatus,
  listDeposits,
  listPlayers,
  listRounds,
  listWithdrawals,
} from "@/lib/admin.functions";
import { lineupForRound } from "@/lib/round-engine";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
  head: () => ({
    meta: [
      { title: "Owner Console · Speed Predict" },
      {
        name: "description",
        content:
          "Live owner console for Speed Predict: deposits, payouts, player growth and daily gaming revenue in one screen.",
      },
      { property: "og:title", content: "Owner Console · Speed Predict" },
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

type Tab = "payouts" | "deposits" | "players";

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
  const overviewFn = useServerFn(getAdminOverview);
  const withdrawalsFn = useServerFn(listWithdrawals);
  const depositsFn = useServerFn(listDeposits);
  const playersFn = useServerFn(listPlayers);
  const actFn = useServerFn(actOnWithdrawal);
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("payouts");

  const overview = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => overviewFn({}),
    refetchInterval: 20_000,
  });
  const withdrawals = useQuery({
    queryKey: ["admin", "withdrawals"],
    queryFn: () => withdrawalsFn({}),
    refetchInterval: 20_000,
  });
  const deposits = useQuery({
    queryKey: ["admin", "deposits"],
    queryFn: () => depositsFn({}),
    enabled: tab === "deposits",
  });
  const players = useQuery({
    queryKey: ["admin", "players"],
    queryFn: () => playersFn({}),
    enabled: tab === "players",
  });

  const act = useMutation({
    mutationFn: (v: { withdrawalId: string; action: "approve" | "reject" }) => actFn({ data: v }),
    onSuccess: (res) => {
      toast.success(res.status === "paid" ? "Payout approved & debited" : "Request rejected");
      void qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const forbidden =
    overview.error && /forbidden/i.test((overview.error as Error).message ?? "");

  if (forbidden) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="font-display text-xl text-white">Owner access only</h1>
        <p className="text-sm text-white/50">This console is restricted to the account owner.</p>
        <Link to="/" className="glass rounded-xl px-4 py-2 text-sm text-white">
          Back to the game
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
        <Link to="/" className="glass rounded-xl p-2 text-white/70">
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
          label="TODAY'S EARNING"
          value={o ? rupees(o.game.todayGrossPaise) : "—"}
          sub={o ? `All-time ${rupees(o.game.grossPaise)}` : undefined}
          tone={o && o.game.todayGrossPaise < 0 ? "warn" : "good"}
        />
        <Stat
          icon={Clock}
          label="UNPAID DEPOSITS"
          value={o ? String(o.money.depositsPendingCount) : "—"}
          sub={o ? `${rupees(o.money.depositsPendingPaise)} not paid yet` : undefined}
          tone="warn"
        />
        <Stat
          icon={Banknote}
          label="WANTS TO WITHDRAW"
          value={o ? String(o.money.withdrawPendingCount) : "—"}
          sub={o ? `${rupees(o.money.withdrawPendingPaise)} requested` : undefined}
          tone="warn"
        />
        <Stat
          icon={Users}
          label="PLAYERS JOINED"
          value={o ? String(o.players.total) : "—"}
          sub={o ? `${o.players.today} today · ${o.players.week} this week` : undefined}
        />
        <Stat
          icon={Wallet}
          label="WALLET LIABILITY"
          value={o ? rupees(o.money.liabilityPaise) : "—"}
          sub={o ? `Bonus given ${rupees(o.money.bonusPaise)}` : undefined}
        />
        <Stat
          icon={Coins}
          label="TOTAL STAKED"
          value={o ? rupees(o.game.stakedPaise) : "—"}
          sub={o ? `${o.game.betsTotal} bets · ${o.game.betsToday} today` : undefined}
        />
        <Stat
          icon={Banknote}
          label="PAID OUT TO PLAYERS"
          value={o ? rupees(o.game.paidOutPaise) : "—"}
          sub={o ? `Withdrawn ${rupees(o.money.withdrawnPaise)}` : undefined}
        />
      </section>

      {/* Tabs */}
      <div className="mt-3 mx-2 glass rounded-2xl grid grid-cols-3 p-1">
        {(
          [
            ["payouts", `Payouts${pending.length ? ` (${pending.length})` : ""}`],
            ["deposits", "Deposits"],
            ["players", "Players"],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`py-2 rounded-xl text-[11px] font-display tracking-wide ${
              tab === id ? "text-white" : "text-white/45"
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
            {pending.map((w) => (
              <div key={w.id} className="glass rounded-2xl p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-display text-white text-[13px]">+91 {w.phone}</div>
                    <div className="text-[10px] text-white/45 truncate">{w.upiId}</div>
                    <div className="text-[10px] text-white/35">{when(w.createdAt)}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-display tabular text-[17px] text-[#ffc32b]">
                      {rupees(w.amountPaise)}
                    </div>
                    <div className="text-[10px] text-white/40">
                      Wallet {rupees(w.balancePaise)}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button
                    disabled={act.isPending}
                    onClick={() => act.mutate({ withdrawalId: w.id, action: "approve" })}
                    className="rounded-xl py-2 text-[12px] font-display text-black disabled:opacity-50"
                    style={{ background: "#26ff9a" }}
                  >
                    Mark paid
                  </button>
                  <button
                    disabled={act.isPending}
                    onClick={() => act.mutate({ withdrawalId: w.id, action: "reject" })}
                    className="rounded-xl py-2 text-[12px] font-display text-white/80 border border-white/15 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}

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
                    className="text-[10px]"
                    style={{ color: d.status === "paid" ? "#26ff9a" : "#ffc32b" }}
                  >
                    {d.status === "paid" ? "paid" : "not paid yet"}
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
                  <div className="tabular text-[13px] text-[#ffc32b]">
                    {rupees(p.balancePaise)}
                  </div>
                </div>
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
      </div>
    </div>
  );
}
