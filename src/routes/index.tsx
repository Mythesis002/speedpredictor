import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Highway } from "@/components/race/Highway";
import { PredictionCards } from "@/components/race/PredictionCards";
import { BettingPanel } from "@/components/race/BettingPanel";
import { Header } from "@/components/race/Header";
import { Results, RecentRounds, LiveStats, type HistoryEntry } from "@/components/race/History";
import { WinModal } from "@/components/race/WinModal";
import { DepositModal } from "@/components/race/DepositModal";
import { WithdrawModal } from "@/components/race/WithdrawModal";
import { BottomNav } from "@/components/race/BottomNav";
import { AuthModal } from "@/components/race/AuthModal";
import { InternetErrorModal, InternetRestoredToast } from "@/components/race/InternetErrorModal";
import { lineupForRound } from "@/lib/round-engine";
import { carLabel, formatINR } from "@/lib/car-label";
import { useRaceRound } from "@/lib/use-race-round";
import { useAuthSession } from "@/lib/use-auth";
import { useNetworkMonitor } from "@/lib/use-network-monitor";
import { recentResults } from "@/lib/rounds.functions";
import { getWallet, liveStats, placeBet as placeBetFn, settleRound } from "@/lib/wallet.functions";
import {
  playBetPlacedChime,
  playConfettiFallSound,
  playCountdownBeep,
  playLaunchRoar,
  playWinChime,
} from "@/lib/sound";
import { SpecialOfferModal } from "@/components/race/SpecialOfferModal";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
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
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Apex2 – Live Neon Car Racing & Prediction Game" },
      {
        name: "twitter:description",
        content:
          "Play Apex2: fast-paced 3-car neon racing and color predictions with provably fair rounds, instant UPI transactions from ₹10, and 21-second live races.",
      },
      { name: "twitter:image", content: "https://apex2.live/apex-logo.svg" },
    ],
    links: [{ rel: "canonical", href: "https://apex2.live/" }],
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

  const network = useNetworkMonitor();
  const isPaused = network.isPaused;

  const [balance, setBalance] = useState(0);
  const [heldBalance, setHeldBalance] = useState(0);
  const [amount, setAmount] = useState(10);
  const [bet, setBet] = useState<Bet | null>(null);
  const betRef = useRef<Bet | null>(null);
  betRef.current = bet;
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositInitialAmount, setDepositInitialAmount] = useState(50);
  const [specialOfferOpen, setSpecialOfferOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authPrompt, setAuthPrompt] = useState<string>(
    "Sign in or create an account to claim your ₹28 welcome bonus and place bets.",
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
      setHeldBalance(0);
      setBet(null);
      return;
    }
    try {
      const w = await loadWallet({});
      setBalance((w.availablePaise ?? w.balancePaise) / 100);
      setHeldBalance((w.heldPaise ?? 0) / 100);
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
        [
          { id: roundId, car: winnerCar, ago: "now" },
          ...h.filter((item) => item.id !== roundId),
        ].slice(0, 50),
      );

      const b = betRef.current;
      if (!b || b.roundId !== roundId || isGuest) return;

      void (async () => {
        try {
          const res = await settle({ data: { roundId } });
          setBalance((res.availablePaise ?? res.balancePaise) / 100);
          setHeldBalance((res.heldPaise ?? 0) / 100);
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
              text: `${carLabel(cars[res.winnerLane])} won · Stake ${formatINR(b.amount)} not returned`,
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

  const { roundId, phase, countdown, locked, cars, progressRef, winner, fairness } = useRaceRound(
    onSettle,
    { paused: isPaused },
  );

  /* Web Audio cues: F1 3-2-1 countdown beeps, lock tone, and engine launch roar */
  const lastBeepSecRef = useRef<number | null>(null);
  const lastPhaseSoundRef = useRef<string>(phase);

  useEffect(() => {
    if (isPaused) {
      lastBeepSecRef.current = null;
      return;
    }
    if (phase === "waiting") {
      const sec = Math.ceil(countdown);
      if ((sec === 3 || sec === 2 || sec === 1) && lastBeepSecRef.current !== sec) {
        lastBeepSecRef.current = sec;
        playCountdownBeep(false);
      }
    } else {
      lastBeepSecRef.current = null;
    }
  }, [phase, countdown, isPaused]);

  useEffect(() => {
    if (isPaused) return;
    if (lastPhaseSoundRef.current !== phase) {
      if (phase === "lock") {
        playCountdownBeep(true);
      } else if (phase === "launch") {
        playLaunchRoar();
      } else if (phase === "finish") {
        playConfettiFallSound();
      }
      lastPhaseSoundRef.current = phase;
    }
  }, [phase, isPaused]);

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
          if (!s) return;
          setPlayers(Number(s.players ?? 0) || 0);
          setTotalBets(Math.round((Number(s.stakedPaise ?? 0) || 0) / 100));
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
    if (!requirePlayer("Sign in to place your bet and claim your ₹28 welcome bonus.")) {
      return;
    }
    if (isPaused) {
      setBetError("Internet connection interrupted. Reconnect to win more.");
      buzz(40);
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
      setBalance((res.availablePaise ?? res.balancePaise) / 100);
      setHeldBalance((res.heldPaise ?? 0) / 100);
      setBet({ roundId, lane, amount: staked });
      playBetPlacedChime();
      buzz(22);
    } catch (err) {
      setBetError(
        err instanceof Error ? err.message : "Could not place your bet. Please try again.",
      );
      void refreshWallet();
    }
    setPlacing(false);
  };

  const raceLive = phase === "launch" || phase === "race";
  const secLeft = Math.max(0, Math.ceil(countdown));
  const isUrgent = !locked && countdown <= 3.0;
  const isWarning = !locked && countdown > 3.0 && countdown <= 4.5;
  const timerColor = locked ? "#ff4d6d" : isUrgent ? "#ff3b5c" : isWarning ? "#ffc32b" : "#26ff9a";
  const ringRadius = 11;
  const ringCirc = 2 * Math.PI * ringRadius;
  const ringOffset = locked ? ringCirc : ringCirc * (1 - Math.min(1, Math.max(0, countdown / 6)));

  return (
    <div className="h-[100dvh] w-full overflow-y-auto overflow-x-hidden overscroll-none bg-[#04060c] text-white flex flex-col [scrollbar-width:none]">
      <div style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <Header
          balance={balance}
          heldBalance={heldBalance}
          roundId={roundId}
          isGuest={isGuest}
          networkStatus={network.status}
          onSignIn={() =>
            requirePlayer("Create an account to claim your ₹28 welcome bonus and play live.")
          }
          onTopUp={() => {
            if (requirePlayer("Sign in to add funds to your Apex wallet via UPI.")) {
              setDepositOpen(true);
            }
          }}
          onOpenCashOut={() => setWithdrawOpen(true)}
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
        onBetNextRound={() => {
          setWin(null);
          if (winner !== null) {
            setSelected(winner);
          }
        }}
      />

      <DepositModal
        open={depositOpen}
        initialAmount={depositInitialAmount}
        onClose={() => setDepositOpen(false)}
        onCredited={(paise) => {
          setBalance(paise / 100);
          void refreshWallet();
        }}
      />

      <SpecialOfferModal
        open={specialOfferOpen}
        onClose={() => setSpecialOfferOpen(false)}
        onClaim={(amt) => {
          setSpecialOfferOpen(false);
          setDepositInitialAmount(amt);
          setDepositOpen(true);
        }}
      />

      <WithdrawModal
        open={withdrawOpen}
        onClose={() => {
          setWithdrawOpen(false);
          void refreshWallet();
        }}
        balancePaise={Math.round(balance * 100)}
        heldPaise={Math.round(heldBalance * 100)}
        onRequested={(availPaise, heldPaiseVal) => {
          setBalance(availPaise / 100);
          setHeldBalance(heldPaiseVal / 100);
        }}
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
          paused={isPaused}
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
              {formatINR(activeBet.amount)} ON {carLabel(cars[activeBet.lane])} · PAYS{" "}
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
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
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
                  style={{ color: isPaused ? "#ff6b84" : timerColor, animationDuration: "0.9s" }}
                >
                  {isPaused ? "!" : locked ? "×" : `${secLeft}s`}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-[9px] text-white/45 font-display tracking-[0.14em] truncate">
                  ROUND #{String(roundId).slice(-5)}
                </div>
                {isPaused ? (
                  <div className="font-display text-[10.5px] tracking-[0.1em] text-[#ff8a9c] animate-pulse truncate">
                    INTERNET ERROR · RECONNECT TO WIN MORE
                  </div>
                ) : (
                  <div
                    className={`font-display text-[10.5px] tracking-[0.1em] tabular truncate ${
                      isUrgent ? "animate-pulse" : ""
                    }`}
                    style={{ color: locked ? "rgba(255,255,255,0.65)" : timerColor }}
                  >
                    {locked
                      ? "BETS LOCKED · RACING"
                      : isUrgent
                        ? `CLOSING · ${countdown.toFixed(1)}s LEFT`
                        : `BETTING OPEN · ${countdown.toFixed(1)}s`}
                  </div>
                )}
              </div>
            </div>

            {isPaused ? (
              <span className="shrink-0 whitespace-nowrap px-2 py-0.5 rounded-md text-[9.5px] font-display tracking-[0.15em] border bg-[#ff3b5c]/20 border-[#ff3b5c]/60 text-[#ff6b84] animate-pulse">
                PAUSED
              </span>
            ) : (
              <span
                className={`shrink-0 whitespace-nowrap px-2 py-0.5 rounded-md text-[9.5px] font-display tracking-[0.15em] border ${
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
            )}
          </div>
        </div>

        <PredictionCards
          cars={cars}
          selected={selectedLane}
          onSelect={(i) => {
            if (isPaused) {
              setBetError("Internet connection interrupted. Reconnect to win more.");
              buzz(40);
              return;
            }
            if (!requirePlayer("Sign in to select a car and claim your ₹28 welcome bonus.")) {
              return;
            }
            if (locked || confirmed) return;
            setSelected(i);
            buzz(10);
            if (!isGuest && balance < MIN_BET) {
              setSpecialOfferOpen(true);
            }
          }}
          locked={locked || isPaused}
          winner={winner}
          amount={amount}
          confirmed={confirmed}
          activeBet={activeBet}
        />

        <BettingPanel
          amount={amount}
          balance={isGuest ? 28 : balance}
          locked={locked || placing || isPaused}
          onChange={(n) => {
            if (isPaused) return;
            if (!requirePlayer("Sign in to set your stake and bet on live races.")) return;
            setAmount(n);
          }}
          selectedLabel={selectedLabel}
          confirmed={confirmed}
          phaseLabel={isPaused ? "paused" : phase}
          multiplier={selectedMultiplier}
          activeBetAmount={activeBet?.amount ?? null}
          onConfirm={() => void placeBet()}
          onOpenDeposit={(amt = 50) => {
            if (requirePlayer("Sign in to add funds to your Apex wallet via UPI.")) {
              setDepositInitialAmount(amt);
              setDepositOpen(true);
            }
          }}
          onShowOffer={() => {
            if (requirePlayer("Sign in to claim your exclusive ₹20 bonus offer.")) {
              setSpecialOfferOpen(true);
            }
          }}
        />
      </div>

      <div className="mt-2 mx-2 pb-24">
        <Results entries={history} />
      </div>

      {/* Shared Bottom Navigation */}
      <BottomNav
        active="home"
        onCashOut={() => {
          if (requirePlayer("Sign in to view your wallet and withdraw winnings via UPI.")) {
            setWithdrawOpen(true);
          }
        }}
      />

      {/* Network outage & high latency modal */}
      <InternetErrorModal
        status={network.status}
        latencyMs={network.latencyMs}
        effectiveType={network.effectiveType}
        retrying={network.retrying}
        onRetry={network.checkNow}
      />

      {/* Network recovery confirmation toast */}
      {network.justRestored && <InternetRestoredToast latencyMs={network.latencyMs} />}
    </div>
  );
}
