import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Highway } from "@/components/race/Highway";
import { PredictionCards } from "@/components/race/PredictionCards";
import { BettingPanel } from "@/components/race/BettingPanel";
import { Header } from "@/components/race/Header";
import {
  History,
  RecentRounds,
  LiveStats,
  type HistoryEntry,
} from "@/components/race/History";
import { WinModal } from "@/components/race/WinModal";
import { lineupForRound } from "@/lib/round-engine";
import { carLabel, formatINR } from "@/lib/car-label";
import { useRaceRound } from "@/lib/use-race-round";

import { BarChart3, Gift, Home, Settings, ShieldCheck, Trophy } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Speed Predict — Live Neon Car Racing Predictions" },
      {
        name: "description",
        content:
          "Watch three neon cars battle down a futuristic highway every round and predict the winning colour. Provably fair rounds, live odds, instant payouts.",
      },
      { property: "og:title", content: "Speed Predict — Live Neon Car Racing" },
      {
        property: "og:description",
        content:
          "Pick a colour, watch the live three-lane race and win up to 5×. Server-timed, provably fair racing predictions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SpeedPredict,
});

const WALLET_KEY = "sp.wallet.v1";
const START_BALANCE = 12450;

function SpeedPredict() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  if (!hydrated) {
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
  const [balance, setBalance] = useState(START_BALANCE);
  const [amount, setAmount] = useState(100);
  const [bet, setBet] = useState<Bet | null>(null);
  const betRef = useRef<Bet | null>(null);
  betRef.current = bet;

  const [win, setWin] = useState<{ amount: number; colorName: string; color: string } | null>(null);
  const [players, setPlayers] = useState(1245);
  const [totalBets, setTotalBets] = useState(89540);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  /* wallet persistence */
  useEffect(() => {
    const raw = localStorage.getItem(WALLET_KEY);
    if (raw) {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0) setBalance(n);
    }
  }, []);
  useEffect(() => {
    localStorage.setItem(WALLET_KEY, String(balance));
  }, [balance]);

  /* result banner (wins and losses both get feedback) */
  const [result, setResult] = useState<{ won: boolean; text: string; color: string } | null>(null);
  useEffect(() => {
    if (!result) return;
    const id = setTimeout(() => setResult(null), 5000);
    return () => clearTimeout(id);
  }, [result]);

  /* settlement — fired once per round by the engine when the race ends */
  const onSettle = useCallback((roundId: number, order: [number, number, number]) => {
    const cars = lineupForRound(roundId);
    const winnerCar = cars[order[0]];
    setHistory((h) => [{ id: roundId, car: winnerCar, ago: "now" }, ...h].slice(0, 50));

    const b = betRef.current;
    if (!b || b.roundId !== roundId) return;

    if (b.lane === order[0]) {
      const payout = Math.round(b.amount * cars[b.lane].multiplier);
      setBalance((v) => v + payout);
      setWin({
        amount: payout,
        colorName: carLabel(cars[b.lane]),
        color: cars[b.lane].color,
      });
      buzz([18, 40, 18, 40, 60]);
    } else {
      setResult({
        won: false,
        text: `${carLabel(winnerCar)} won · you lost ${formatINR(b.amount)}`,
        color: winnerCar.color,
      });
      buzz(30);
    }
  }, []);

  const { roundId, phase, countdown, locked, cars, progressRef, winner, fairness } =
    useRaceRound(onSettle);

  /* clear the ticket when a new round opens; seed history on first load */
  useEffect(() => {
    setBet((b) => (b && b.roundId !== roundId ? null : b));
  }, [roundId]);

  useEffect(() => {
    setHistory((h) =>
      h.length
        ? h
        : Array.from({ length: 24 }, (_, i) => {
            const id = roundId - 1 - i;
            const lineup = lineupForRound(id);
            return { id, car: lineup[(id * 7) % 3], ago: `${i + 1}m` };
          }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setPlayers((n) => Math.max(600, n + Math.round((Math.random() - 0.5) * 24)));
      setTotalBets((n) => Math.max(10000, n + Math.round((Math.random() - 0.4) * 900)));
    }, 1600);
    return () => clearInterval(id);
  }, []);

  const [selected, setSelected] = useState<number | null>(null);
  useEffect(() => setSelected(null), [roundId]);

  const confirmed = bet?.roundId === roundId;
  const hyperMode = cars.some((c) => c.kind === "hyper");
  const selectedLane = confirmed ? bet!.lane : selected;

  const selectedLabel = selectedLane === null ? null : carLabel(cars[selectedLane]);
  const selectedMultiplier = selectedLane === null ? null : cars[selectedLane].multiplier;

  /* keep the stake inside the wallet at all times */
  useEffect(() => {
    setAmount((a) => Math.max(100, Math.min(a, Math.max(100, balance))));
  }, [balance]);

  const placeBet = () => {
    if (selected === null || locked || confirmed) return;
    if (amount > balance || amount <= 0) return;
    setBalance((b) => b - amount);
    setBet({ roundId, lane: selected, amount });
    buzz(22);
  };

  const topUp = () => {
    setBalance((b) => b + 5000);
    buzz(14);
  };

  const raceLive = phase === "launch" || phase === "race";

  return (
    <div className="h-[100dvh] w-full overflow-y-auto overflow-x-hidden overscroll-none bg-[#04060c] text-white flex flex-col [scrollbar-width:none]">
      <div style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <Header balance={balance} roundId={roundId} onTopUp={topUp} />
      </div>

      <WinModal
        amount={win?.amount ?? null}
        colorName={win?.colorName}
        color={win?.color}
        onClose={() => setWin(null)}
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
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 z-30">
            <div
              className="px-3 py-1 rounded-full glass font-display text-[9px] tracking-[0.28em] animate-pulse-glow"
              style={{ color: "#ffd66b", borderColor: "#ffd66b55" }}
            >
              ⚡ HYPERCAR · 5× PAYOUT
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
          locked={locked}
          onChange={setAmount}
          selectedLabel={selectedLabel}
          confirmed={confirmed}
          phaseLabel={phase}
          multiplier={selectedMultiplier}
          onConfirm={placeBet}
        />

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
        <History entries={history} />
      </div>

      {/* Bottom nav */}
      <div
        className="sticky bottom-0 mt-auto z-40 bg-gradient-to-t from-[#04060c] via-[#04060c] to-transparent pt-3 px-2"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 8px)" }}
      >
        <div className="glass rounded-2xl grid grid-cols-5 py-1.5">
          {[
            { icon: Home, label: "Home", active: true },
            { icon: BarChart3, label: "Stats" },
            { icon: Trophy, label: "Leaders" },
            { icon: Gift, label: "Rewards" },
            { icon: Settings, label: "Settings" },
          ].map(({ icon: Icon, label, active }) => (
            <button
              key={label}
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

