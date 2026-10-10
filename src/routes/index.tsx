import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Highway } from "@/components/race/Highway";
import { PredictionCards } from "@/components/race/PredictionCards";
import { BettingPanel } from "@/components/race/BettingPanel";
import { Header } from "@/components/race/Header";
import {
  Results,
  RecentRounds,
  LiveStats,
  type HistoryEntry,
} from "@/components/race/History";
import { WinModal } from "@/components/race/WinModal";
import { DepositModal } from "@/components/race/DepositModal";
import { WithdrawModal } from "@/components/race/WithdrawModal";
import { BottomNav } from "@/components/race/BottomNav";
import { AuthModal } from "@/components/race/AuthModal";
import { lineupForRound } from "@/lib/round-engine";
import { carLabel, formatINR } from "@/lib/car-label";
import { useRaceRound } from "@/lib/use-race-round";
import { useAuthSession } from "@/lib/use-auth";
import { recentResults } from "@/lib/rounds.functions";
import {
  getWallet,
  liveStats,
  placeBet as placeBetFn,
  settleRound,
} from "@/lib/wallet.functions";
import {
  playBetPlacedChime,
  playCountdownBeep,
  playLaunchRoar,
  playWinChime,
} from "@/lib/sound";
import { ShieldCheck, Timer } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Apex — Live Neon Car Racing Predictions" },
      {
        name: "description",
        content:
          "Watch three neon cars battle down a futuristic highway every round and predict the winning colour. Provably fair rounds, live odds, instant payouts from ₹10.",
      },
      { property: "og:title", content: "Apex — Live Neon Car Racing" },
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

function timeAgo(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function SpeedPredict() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const { session, loading } = useAuthSession();

  if (!hydrated || loading) {
    return (
      <div className="h-[100dvh] w-full bg-[#04060c] grid place-items-center text-white/45">
        <div className="font-display text-[11px] tracking-[0.2em] animate-pulse">LOADING APEX</div>
      </div>
    );
  }
  return <Game isGuest={!session} />;
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

function Game({ isGuest }: { isGuest: boolean }) {
  const nav = useNavigate();
  const loadWallet = useServerFn(getWallet);
  const submitBet = useServerFn(placeBetFn);
  const settle = useServerFn(settleRound);

  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState(10);
  const [bet, setBet] = useState<Bet | null>(null);
  const betRef = useRef<Bet | null>(null);
  betRef.current = bet;
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authPrompt, setAuthPrompt] = useState<string>(
    "Sign in or create an account to claim your ₹28 welcome bonus and start predicting.",
  );
  const [betError, setBetError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);

  const [win, setWin] = useState<{ amount: number; colorName: string; color: string } | null>(null);
  const [players, setPlayers] = useState(0);
  const [totalBets, setTotalBets] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const requirePlayer = useCallback(
    (promptMessage: string): boolean => {
      if (!isGuest) return true;
      setAuthPrompt(promptMessage);
      setAuthModalOpen(true);
      buzz(14);
      return false;
    },
    [isGuest],
  );

  /* wallet comes from the server — never from the browser */
  const refreshWallet = useCallback(async () => {
    if (isGuest) {
      setBalance(0);
      setBet(null);
      return;
    }
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
  }, [loadWallet, isGuest]);

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
      setHistory((h) =>
        [{ id: roundId, car: winnerCar, ago: "now" }, ...h.filter((item) => item.id !== roundId)].slice(
          0,
          50,
        ),
      );

      const b = betRef.current;
      if (!b || b.roundId !== roundId || isGuest) return;

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
            playWinChime();
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
      })();
    },
    [settle, refreshWallet, isGuest],
  );

  const { roundId, phase, countdown, locked, cars, progressRef, winner, fairness } =
    useRaceRound(onSettle);

  /* Web Audio cues: F1 3-2-1 countdown beeps, lock tone, and engine launch roar */
  const lastBeepSecRef = useRef<number | null>(null);
  const lastPhaseSoundRef = useRef<string>(phase);

  useEffect(() => {
    if (phase === "waiting") {
      const sec = Math.ceil(countdown);
      if ((sec === 3 || sec === 2 || sec === 1) && lastBeepSecRef.current !== sec) {
        lastBeepSecRef.current = sec;
        playCountdownBeep(false);
      }
    } else {
      lastBeepSecRef.current = null;
    }
  }, [phase, countdown]);

  useEffect(() => {
    if (lastPhaseSoundRef.current !== phase) {
      if (phase === "lock") {
        playCountdownBeep(true);
      } else if (phase === "launch") {
        playLaunchRoar();
      }
      lastPhaseSoundRef.current = phase;
    }
  }, [phase]);

  /* real results, straight from the database — shared by every device */
  const loadResults = useServerFn(recentResults);
  const refreshResults = useCallback(async () => {
    try {
      const rows = await loadResults({});
      if (!rows.length) return;
      const seen = new Set<number>();
      const uniqueRows = rows.filter((r) => {
        if (seen.has(r.roundId)) return false;
        seen.add(r.roundId);
        return true;
      });
      setHistory(
        uniqueRows.map((r) => ({
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
  const activeBet = confirmed ? bet : null;
  const selectedLane = activeBet?.lane ?? selected;

  const selectedLabel = selectedLane === null ? null : carLabel(cars[selectedLane]);
  const selectedMultiplier = selectedLane === null ? null : cars[selectedLane].multiplier;

  /* keep the stake inside the wallet at all times */
  useEffect(() => {
    if (isGuest) return;
    setAmount((a) => Math.max(MIN_BET, Math.min(a, Math.max(MIN_BET, Math.floor(balance)))));
  }, [balance, isGuest]);

  const placeBet = async () => {
    if (!requirePlayer("Sign in to place your prediction and claim your ₹28 welcome bonus.")) {
      return;
    }
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
      playBetPlacedChime();
      buzz(22);
    } catch (err) {
      setBetError(err instanceof Error ? err.message : "Could not place the bet");
      void refreshWallet();
    }
    setPlacing(false);
  };

  const raceLive = phase === "launch" || phase === "race";
  const secLeft = Math.max(0, Math.ceil(countdown));
  const isUrgent = !locked && countdown <= 3.0;
  const isWarning = !locked && countdown > 3.0 && countdown <= 4.5;
  const timerColor = locked
    ? "#ff4d6d"
    : isUrgent
      ? "#ff3b5c"
      : isWarning
        ? "#ffc32b"
        : "#26ff9a";
  const ringRadius = 11;
  const ringCirc = 2 * Math.PI * ringRadius;
  const ringOffset = locked
    ? ringCirc
    : ringCirc * (1 - Math.min(1, Math.max(0, countdown / 6)));

  return (
    <div className="h-[100dvh] w-full overflow-y-auto overflow-x-hidden overscroll-none bg-[#04060c] text-white flex flex-col [scrollbar-width:none]">
      <div style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <Header
          balance={balance}
          roundId={roundId}
          isGuest={isGuest}
          onSignIn={() =>
            requirePlayer("Create your account to claim your ₹28 welcome bonus and play live.")
          }
          onTopUp={() => {
            if (requirePlayer("Sign in to top up your Apex wallet via UPI.")) {
              setDepositOpen(true);
            }
          }}
        />
      </div>

      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        promptText={authPrompt}
      />

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
          myLane={activeBet?.lane ?? null}
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
        {activeBet && (
          <div className="absolute bottom-1.5 left-1.5 z-30">
            <div
              className="rounded-full px-2 py-1 glass font-display text-[8.5px] tracking-[0.16em]"
              style={{
                color: cars[activeBet.lane].color,
                borderColor: `${cars[activeBet.lane].color}66`,
              }}
            >
              {formatINR(activeBet.amount)} ON {carLabel(cars[activeBet.lane])} ·{" "}
              {formatINR(activeBet.amount * cars[activeBet.lane].multiplier)}
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
      <div className="mt-2 mx-2 glass rounded-2xl p-3 space-y-2.5">
        {/* Betting Timer Urgency Indicator (Circular Ring + Step Countdown 6s... 5s... 4s... 3s... LOCKED) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 whitespace-nowrap">
            <div className="flex items-center gap-2">
              <div className="relative w-7 h-7 grid place-items-center shrink-0">
                <svg className="w-7 h-7 -rotate-90" viewBox="0 0 28 28">
                  <circle
                    cx="14"
                    cy="14"
                    r={ringRadius}
                    fill="none"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="2.6"
                  />
                  <circle
                    cx="14"
                    cy="14"
                    r={ringRadius}
                    fill="none"
                    stroke={timerColor}
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeDasharray={ringCirc}
                    strokeDashoffset={ringOffset}
                    style={{ transition: "stroke-dashoffset 90ms linear, stroke 200ms ease" }}
                  />
                </svg>
                <span
                  className={`font-display text-[9px] tabular ${isUrgent ? "animate-ping" : ""}`}
                  style={{ color: timerColor, animationDuration: "0.9s" }}
                >
                  {locked ? "×" : `${secLeft}s`}
                </span>
              </div>

              <div>
                <div className="text-[9px] text-white/45 font-display tracking-[0.14em]">
                  ROUND #{String(roundId).slice(-5)}
                </div>
                <div
                  className={`font-display text-[11px] tracking-[0.12em] tabular ${
                    isUrgent ? "animate-pulse" : ""
                  }`}
                  style={{ color: locked ? "rgba(255,255,255,0.65)" : timerColor }}
                >
                  {locked
                    ? "LOCKED · RACE IN PROGRESS"
                    : isUrgent
                      ? `HURRY · LOCKS IN ${countdown.toFixed(1)}s`
                      : `BETTING OPEN · ${countdown.toFixed(1)}s`}
                </div>
              </div>
            </div>

            <span
              className={`px-2 py-0.5 rounded-md text-[9.5px] font-display tracking-[0.15em] border ${
                locked
                  ? "bg-[#ff4d6d]/15 border-[#ff4d6d]/40 text-[#ff6b84]"
                  : isUrgent
                    ? "bg-[#ff3b5c]/20 border-[#ff3b5c]/60 text-[#ff6b84] animate-pulse"
                    : isWarning
                      ? "bg-[#ffc32b]/20 border-[#ffc32b]/50 text-[#ffd83a]"
                      : "bg-[#26ff9a]/15 border-[#26ff9a]/40 text-[#26ff9a]"
              }`}
            >
              {locked ? "LOCKED" : `${secLeft}s`}
            </span>
          </div>

          {/* 6-second segmented urgency bar + smooth fill */}
          <div className="relative h-2 rounded-full bg-white/8 overflow-hidden p-[1px]">
            <div
              className={`h-full rounded-full transition-[width] duration-75 ease-linear ${
                isUrgent ? "animate-pulse" : ""
              }`}
              style={{
                width: locked ? "100%" : `${Math.min(100, (countdown / 6) * 100)}%`,
                background: locked
                  ? "rgba(255,77,109,0.22)"
                  : isUrgent
                    ? "linear-gradient(90deg,#ff1e42,#ff6b3b)"
                    : isWarning
                      ? "linear-gradient(90deg,#ff9900,#ffd83a)"
                      : "linear-gradient(90deg,#26ff9a,#35e6ff)",
                boxShadow: isUrgent ? "0 0 12px #ff3b5c" : undefined,
              }}
            />
          </div>

          {/* Discrete countdown steps: 6s · 5s · 4s · 3s · 2s · 1s · LOCKED */}
          <div className="flex items-center justify-between px-0.5 text-[8.5px] font-display tracking-[0.12em] tabular">
            {[6, 5, 4, 3, 2, 1].map((s) => {
              const activeStep = !locked && secLeft === s;
              const passedStep = locked || secLeft < s;
              const urgentStep = s <= 3;
              return (
                <span
                  key={s}
                  className={`transition-colors ${
                    activeStep
                      ? urgentStep
                        ? "text-[#ff4d6d] font-bold scale-110"
                        : "text-[#ffc32b] font-bold scale-105"
                      : passedStep
                        ? "text-white/20"
                        : "text-white/45"
                  }`}
                >
                  {s}s
                </span>
              );
            })}
            <span
              className={`flex items-center gap-0.5 ${
                locked ? "text-[#ff4d6d] font-bold" : "text-white/30"
              }`}
            >
              <Timer size={9} />
              LOCKED
            </span>
          </div>
        </div>

        <PredictionCards
          cars={cars}
          selected={selectedLane}
          onSelect={(i) => {
            if (!requirePlayer("Sign in to pick your car and claim your ₹28 welcome bonus.")) {
              return;
            }
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
          balance={isGuest ? 28 : balance}
          locked={locked || placing}
          onChange={(n) => {
            if (!requirePlayer("Sign in to set your stake and bet on live races.")) return;
            setAmount(n);
          }}
          selectedLabel={selectedLabel}
          confirmed={confirmed}
          phaseLabel={phase}
          multiplier={selectedMultiplier}
          onConfirm={() => void placeBet()}
        />

        {/* provably-fair status */}
        <Link
          to="/verify/$roundId"
          params={{ roundId: String(Math.max(0, roundId - 1)) }}
          className="flex items-center gap-1 text-[8px] font-display tracking-[0.12em] text-white/35 py-0.5 leading-none"
        >
          <ShieldCheck
            size={10}
            className={fairness.verified ? "text-[#26ff9a]" : "text-white/30"}
          />
          <span className="truncate">
            {fairness.verified
              ? "PROVABLY FAIR · VERIFIED"
              : fairness.online
                ? `COMMIT ${fairness.commit?.slice(0, 10) ?? "…"}`
                : "LOCAL SIMULATION"}
          </span>
          <span className="ml-auto underline text-white/40">VERIFY</span>
        </Link>
      </div>

      <div className="mt-1.5 mx-2 pb-2">
        <Results entries={history} />
      </div>

      {/* Shared Bottom Navigation */}
      <BottomNav
        active="home"
        onCashOut={() => {
          if (requirePlayer("Sign in to view your wallet and cash out winnings via UPI.")) {
            setWithdrawOpen(true);
          }
        }}
      />
    </div>
  );
}
