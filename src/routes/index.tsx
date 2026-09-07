import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Highway } from "@/components/race/Highway";
import { PredictionCards } from "@/components/race/PredictionCards";
import { BettingPanel } from "@/components/race/BettingPanel";
import { Header } from "@/components/race/Header";
import {
  History,
  Results,
  RecentRounds,
  LiveStats,
  type HistoryEntry,
  type BetHistoryEntry,
} from "@/components/race/History";
import { WinModal } from "@/components/race/WinModal";
import { DepositModal } from "@/components/race/DepositModal";
import { WithdrawModal } from "@/components/race/WithdrawModal";
import { lineupForRound } from "@/lib/round-engine";
import { carLabel, formatINR } from "@/lib/car-label";
import { useRaceRound } from "@/lib/use-race-round";
import { useAuthSession } from "@/lib/use-auth";
import { recentResults } from "@/lib/rounds.functions";
import {
  getWallet,
  liveStats,
  myBets,
  placeBet as placeBetFn,
  settleRound,
} from "@/lib/wallet.functions";
import { amIAdmin } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";

import {
  BarChart3,
  Banknote,
  Gift,
  Home,
  LogOut,
  Settings,
  ShieldCheck,
  ShieldHalf,
  Trophy,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Speed Predict — Live Neon Car Racing Predictions" },
      {
        name: "description",
        content:
          "Watch three neon cars battle down a futuristic highway every round and predict the winning colour. Provably fair rounds, live odds, instant payouts from ₹10.",
      },
      { property: "og:title", content: "Speed Predict — Live Neon Car Racing" },
      {
        property: "og:description",
        content:
          "Pick a colour, watch the live three-lane race and win up to 6×. Server-timed, provably fair racing predictions with UPI deposits.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SpeedPredict,
});

const MIN_BET = 10;

function SpeedPredict() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const { session, loading } = useAuthSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (hydrated && !loading && !session) void navigate({ to: "/auth" });
  }, [hydrated, loading, session, navigate]);

  if (!hydrated || loading || !session) {
    return <div className="h-[100dvh] w-full bg-[#04060c]" />;
  }
  return <Game />;
}

interface Bet {
  roundId: number;
  lane: number;
  amount: number;
}

function buzz(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* haptics are best-effort */
    }
  }
}

function Game() {
  const loadWallet = useServerFn(getWallet);
  const submitBet = useServerFn(placeBetFn);
  const settle = useServerFn(settleRound);
  const checkAdmin = useServerFn(amIAdmin);

  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState(10);
  const [bet, setBet] = useState<Bet | null>(null);
  const betRef = useRef<Bet | null>(null);
  betRef.current = bet;
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [betError, setBetError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);

  const [win, setWin] = useState<{ amount: number; colorName: string; color: string } | null>(null);
  const [players, setPlayers] = useState(1245);
  const [totalBets, setTotalBets] = useState(89540);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [betHistory, setBetHistory] = useState<BetHistoryEntry[]>([]);

  /* the player's own bet history, straight from the server ledger */
  const loadBets = useServerFn(myBets);
  const refreshBets = useCallback(async () => {
    try {
      const rows = await loadBets({});
      setBetHistory(
        rows.map((b) => {
          const lineup = lineupForRound(b.roundId);
          return {
            id: b.id,
            roundId: b.roundId,
            car: lineup[b.lane],
            winnerCar: b.winnerLane === null ? null : lineup[b.winnerLane],
            amount: b.amountPaise / 100,
            payout: b.payoutPaise / 100,
            multiplier: b.multiplier,
            status: (b.status === "won" || b.status === "lost"
              ? b.status
              : "pending") as BetHistoryEntry["status"],
          };
        }),
      );
    } catch {
      /* transient */
    }
  }, [loadBets]);

  useEffect(() => {
    void refreshBets();
  }, [refreshBets]);

  useEffect(() => {
    void checkAdmin({})
      .then(setIsAdmin)
      .catch(() => setIsAdmin(false));
  }, [checkAdmin]);


  /* wallet comes from the server — never from the browser */
  const refreshWallet = useCallback(async () => {
    try {
      const w = await loadWallet({});
      setBalance(w.balancePaise / 100);
      setBet(
        w.activeBet
          ? {
              roundId: w.activeBet.roundId,
              lane: w.activeBet.lane,
              amount: w.activeBet.amountPaise / 100,
            }
          : null,
      );
    } catch {
      /* transient — the next refresh will pick it up */
    }
  }, [loadWallet]);

  useEffect(() => {
    void refreshWallet();
  }, [refreshWallet]);

  useEffect(() => {
    if (!betError) return;
    const id = setTimeout(() => setBetError(null), 4000);
    return () => clearTimeout(id);
  }, [betError]);

  /* result banner (wins and losses both get feedback) */
  const [result, setResult] = useState<{ won: boolean; text: string; color: string } | null>(null);
  useEffect(() => {
    if (!result) return;
    const id = setTimeout(() => setResult(null), 5000);
    return () => clearTimeout(id);
  }, [result]);

  /* settlement — the server decides the winner and the payout */
  const onSettle = useCallback(
    (roundId: number, order: [number, number, number]) => {
      const cars = lineupForRound(roundId);
      const winnerCar = cars[order[0]];
      setHistory((h) => [{ id: roundId, car: winnerCar, ago: "now" }, ...h].slice(0, 50));

      const b = betRef.current;
      if (!b || b.roundId !== roundId) return;

      void (async () => {
        try {
          const res = await settle({ data: { roundId } });
          setBalance(res.balancePaise / 100);
          setBet(null);
          if (res.status === "won") {
            setWin({
              amount: res.payoutPaise / 100,
              colorName: carLabel(cars[b.lane]),
              color: cars[b.lane].color,
            });
            buzz([18, 40, 18, 40, 60]);
          } else if (res.status === "lost") {
            setResult({
              won: false,
              text: `${carLabel(cars[res.winnerLane])} won · you lost ${formatINR(b.amount)}`,
              color: cars[res.winnerLane].color,
            });
            buzz(30);
          }
        } catch {
          void refreshWallet();
        }
        void refreshBets();
      })();
    },
    [settle, refreshWallet, refreshBets],
  );


  const { roundId, phase, countdown, locked, cars, progressRef, winner, fairness } =
    useRaceRound(onSettle);

  /* real results, straight from the database — shared by every device */
  const loadResults = useServerFn(recentResults);
  const refreshResults = useCallback(async () => {
    try {
      const rows = await loadResults({});
      if (!rows.length) return;
      setHistory(
        rows.map((r) => ({
          id: r.roundId,
          car: lineupForRound(r.roundId)[r.winnerLane],
          ago: timeAgo(r.createdAt),
        })),
      );
    } catch {
      /* transient */
    }
  }, [loadResults]);

  useEffect(() => {
    void refreshResults();
  }, [refreshResults, roundId]);

  /* real live numbers */
  const loadStats = useServerFn(liveStats);
  useEffect(() => {
    const pull = () => {
      void loadStats({})
        .then((s) => {
          setPlayers(s.players);
          setTotalBets(Math.round(s.stakedPaise / 100));
        })
        .catch(() => {});
    };
    pull();
    const id = setInterval(pull, 20_000);
    return () => clearInterval(id);
  }, [loadStats]);


  const [selected, setSelected] = useState<number | null>(null);
  useEffect(() => setSelected(null), [roundId]);

  const confirmed = bet?.roundId === roundId;
  const hyperMode = cars.some((c) => c.kind === "hyper");
  const selectedLane = confirmed ? bet!.lane : selected;

  const selectedLabel = selectedLane === null ? null : carLabel(cars[selectedLane]);
  const selectedMultiplier = selectedLane === null ? null : cars[selectedLane].multiplier;

  /* keep the stake inside the wallet at all times */
  useEffect(() => {
    setAmount((a) => Math.max(MIN_BET, Math.min(a, Math.max(MIN_BET, Math.floor(balance)))));
  }, [balance]);

  const placeBet = async () => {
    if (selected === null || locked || confirmed || placing) return;
    if (amount < MIN_BET || amount > balance) return;
    setPlacing(true);
    const staked = amount;
    const lane = selected;
    try {
      const res = await submitBet({
        data: { roundId, lane, amountPaise: Math.round(staked * 100) },
      });
      setBalance(res.balancePaise / 100);
      setBet({ roundId, lane, amount: staked });
      void refreshBets();
      buzz(22);

    } catch (err) {
      setBetError(err instanceof Error ? err.message : "Could not place the bet");
      void refreshWallet();
    }
    setPlacing(false);
  };

  const raceLive = phase === "launch" || phase === "race";

  return (
    <div className="h-[100dvh] w-full overflow-y-auto overflow-x-hidden overscroll-none bg-[#04060c] text-white flex flex-col [scrollbar-width:none]">
      <div style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <Header balance={balance} roundId={roundId} onTopUp={() => setDepositOpen(true)} />
      </div>

      <WinModal
        amount={win?.amount ?? null}
        colorName={win?.colorName}
        color={win?.color}
        onClose={() => setWin(null)}
      />

      <DepositModal
        open={depositOpen}
        onClose={() => setDepositOpen(false)}
        onCredited={(paise) => setBalance(paise / 100)}
      />

      <WithdrawModal
        open={withdrawOpen}
        onClose={() => {
          setWithdrawOpen(false);
          void refreshWallet();
        }}
        balancePaise={Math.round(balance * 100)}
      />

      {/* Race stage */}
      <div className="relative mx-2 rounded-2xl overflow-hidden border border-white/10 h-[42vh] min-h-[260px] max-h-[420px] shrink-0">
        <Highway
          cars={cars}
          phase={phase}
          progressRef={progressRef}
          winnerLane={winner}
          hyperMode={hyperMode}
          countdown={countdown}
          myLane={confirmed ? bet!.lane : null}
        />
        <div
          className={`absolute left-1.5 top-1.5 z-30 transition-opacity duration-500 ${raceLive ? "opacity-25" : "opacity-100"}`}
        >
          <RecentRounds entries={history} />
        </div>
        <div
          className={`absolute right-1.5 top-1.5 z-30 transition-opacity duration-500 ${raceLive ? "opacity-25" : "opacity-100"}`}
        >
          <LiveStats players={players} totalBets={totalBets} />
        </div>

        {/* active ticket chip — always visible while the race runs */}
        {confirmed && (
          <div className="absolute bottom-1.5 left-1.5 z-30">
            <div
              className="rounded-full px-2 py-1 glass font-display text-[8.5px] tracking-[0.16em]"
              style={{ color: cars[bet!.lane].color, borderColor: `${cars[bet!.lane].color}66` }}
            >
              {formatINR(bet!.amount)} ON {carLabel(cars[bet!.lane])} ·{" "}
              {formatINR(bet!.amount * cars[bet!.lane].multiplier)}
            </div>
          </div>
        )}

        {hyperMode && phase !== "finish" && (
          <div className="absolute bottom-1.5 right-2 z-30">
            <div
              className="whitespace-nowrap rounded-full glass px-2.5 py-1 font-display text-[8px] tracking-[0.2em] animate-pulse-glow"
              style={{ color: "#ffd66b", borderColor: "#ffd66b55" }}
            >
              ⚡ HYPER {cars.find((c) => c.kind === "hyper")?.multiplier ?? 5}×
            </div>

          </div>
        )}
      </div>

      {/* Result banner */}
      {result && (
        <div className="mx-2 mt-2 animate-fade-in">
          <div
            className="rounded-xl px-3 py-2 text-center font-display text-[10px] tracking-[0.18em]"
            style={{
              background: "rgba(255,255,255,0.05)",
              boxShadow: `inset 0 0 0 1px ${result.color}44`,
              color: "rgba(255,255,255,0.75)",
            }}
          >
            {result.text.toUpperCase()}
          </div>
        </div>
      )}

      {betError && (
        <div className="mx-2 mt-2 animate-fade-in">
          <div className="rounded-xl px-3 py-2 text-center font-display text-[10px] tracking-[0.16em] bg-[#ff4d6d]/10 text-[#ff8a9c]">
            {betError.toUpperCase()}
          </div>
        </div>
      )}

      {/* Bet panel */}
      <div className="mt-2 mx-2 glass rounded-2xl p-3 space-y-3">
        <div className="flex items-center justify-between gap-2 whitespace-nowrap">
          <span className="text-[10px] text-white/45 font-display tracking-[0.12em] shrink-0">
            #{String(roundId).slice(-5)}
          </span>
          <span className="font-display text-[11px] tracking-[0.12em] text-white truncate">
            {locked ? "RACE IN PROGRESS" : `CLOSES IN ${countdown.toFixed(1)}s`}
          </span>

          <span
            className={`text-[10px] font-display tracking-[0.15em] ${locked ? "text-white/40" : "text-[#26ff9a]"}`}
          >
            {locked ? "CLOSED" : "OPEN"}
          </span>
        </div>

        {/* betting-window progress bar — the anticipation driver */}
        <div className="h-1 rounded-full bg-white/8 overflow-hidden">
          <div
            className="h-full rounded-full transition-[width] duration-100 ease-linear"
            style={{
              width: locked ? "0%" : `${Math.min(100, (countdown / 6) * 100)}%`,
              background: countdown < 2 ? "#ff4d6d" : "linear-gradient(90deg,#26ff9a,#35e6ff)",
            }}
          />
        </div>

        <PredictionCards
          cars={cars}
          selected={selectedLane}
          onSelect={(i) => {
            if (locked || confirmed) return;
            setSelected(i);
            buzz(10);
          }}
          locked={locked}
          winner={winner}
          amount={amount}
          confirmed={confirmed}
        />

        <BettingPanel
          amount={amount}
          balance={balance}
          locked={locked || placing}
          onChange={setAmount}
          selectedLabel={selectedLabel}
          confirmed={confirmed}
          phaseLabel={phase}
          multiplier={selectedMultiplier}
          onConfirm={() => void placeBet()}
        />

        {isAdmin && (
          <a
            href="/admin"
            className="glass rounded-xl px-3 py-2 flex items-center gap-2 text-[11px] font-display tracking-wide text-white"
          >
            <ShieldHalf size={14} style={{ color: "#ffc32b" }} />
            Owner console
          </a>
        )}

        {/* provably-fair status */}
        <div className="flex items-center gap-1.5 text-[9px] font-display tracking-[0.14em] text-white/40">
          <ShieldCheck
            size={12}
            className={fairness.verified ? "text-[#26ff9a]" : "text-white/35"}
          />
          <span className="truncate">
            {fairness.verified
              ? "PROVABLY FAIR · RESULT VERIFIED"
              : fairness.online
                ? `COMMIT ${fairness.commit?.slice(0, 12) ?? "…"}`
                : "OFFLINE MODE · LOCAL SIMULATION"}
          </span>
        </div>
      </div>

      <div className="mt-2 mx-2 pb-4">
        <History entries={betHistory} />
      </div>

      {/* Bottom nav */}
      <div
        className="sticky bottom-0 mt-auto z-40 bg-gradient-to-t from-[#04060c] via-[#04060c] to-transparent pt-3 px-2"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 8px)" }}
      >
        <div className="glass rounded-2xl grid grid-cols-5 py-1.5">
          {([
            { icon: Home, label: "Home", active: true },
            { icon: BarChart3, label: "Stats" },
            { icon: Trophy, label: "Leaders" },
            { icon: Banknote, label: "Cash out", action: () => setWithdrawOpen(true) },
            { icon: LogOut, label: "Sign out", action: () => void supabase.auth.signOut() },
          ] as { icon: typeof Home; label: string; active?: boolean; action?: () => void }[])
            .map(({ icon: Icon, label, active, action }) => (
              <button
                key={label}
                onClick={action}
                className={`flex flex-col items-center gap-0.5 py-1.5 rounded-xl min-h-[44px] ${
                  active ? "text-[#a24bff]" : "text-white/45"
                }`}
                style={active ? { background: "rgba(162,75,255,0.12)" } : undefined}
              >
                <Icon size={16} />
                <span className="text-[9px] font-display tracking-wide">{label}</span>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
