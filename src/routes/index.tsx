import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
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
import { accelCurve, makeRaceLineup, type RacePhase } from "@/lib/race-engine";
import type { CarSpec } from "@/components/race/Car";
import { BarChart3, Gift, Home, Settings, Trophy } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Speed Predict — Live Neon Car Racing Predictions" },
      {
        name: "description",
        content:
          "Watch three neon cars battle down a futuristic highway every round and predict the winning colour. Live odds, instant payouts, premium racing visuals.",
      },
      { property: "og:title", content: "Speed Predict — Live Neon Car Racing" },
      {
        property: "og:description",
        content:
          "Pick a colour, watch the live three-lane race and win up to 5×. A AAA-style racing prediction experience.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SpeedPredict,
});

const PHASE_DUR: Record<RacePhase, number> = {
  waiting: 8,
  prep: 0.01,
  lock: 0.01,
  launch: 0.5,
  race: 5,
  finish: 3,
};

function SpeedPredict() {
  const hydrated = useHydratedGuard();
  if (!hydrated) {
    return <div className="h-[100dvh] w-full bg-[#04060c]" />;
  }
  return <Game />;
}

function useHydratedGuard() {
  const [h, setH] = useState(false);
  useEffect(() => setH(true), []);
  return h;
}

function Game() {
  const [phase, setPhase] = useState<RacePhase>("waiting");
  const [phaseStart, setPhaseStart] = useState(() => performance.now());
  const [roundId, setRoundId] = useState(328451);
  const [cars, setCars] = useState<[CarSpec, CarSpec, CarSpec]>(() => makeRaceLineup());
  const curves = useRef<Array<(t: number) => number>>([
    accelCurve(1),
    accelCurve(2),
    accelCurve(3),
  ]);
  const finishOrder = useRef<[number, number, number]>([0, 1, 2]);
  const progressRef = useRef<[number, number, number]>([0, 0, 0]);
  const [now, setNow] = useState(performance.now());

  const [balance, setBalance] = useState(12450);
  const [amount, setAmount] = useState(100);
  const [selected, setSelected] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [players, setPlayers] = useState(1245);
  const [totalBets, setTotalBets] = useState(89540);
  const [history, setHistory] = useState<HistoryEntry[]>(() =>
    Array.from({ length: 30 }, (_, i) => ({
      id: 328450 - i,
      car: makeRaceLineup()[Math.floor(Math.random() * 3)],
      ago: `${i + 1}m`,
    })),
  );

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setNow(performance.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setPlayers((n) => Math.max(600, n + Math.round((Math.random() - 0.5) * 24)));
      setTotalBets((n) => Math.max(10000, n + Math.round((Math.random() - 0.4) * 900)));
    }, 1600);
    return () => clearInterval(id);
  }, []);

  const elapsed = (now - phaseStart) / 1000;
  const dur = PHASE_DUR[phase];
  const t = Math.min(1, elapsed / dur);

  useEffect(() => {
    if (phase === "race" || phase === "launch") {
      const localT = phase === "launch" ? t * 0.06 : 0.06 + t * 0.94;
      setProgress([
        curves.current[0](localT),
        curves.current[1](localT),
        curves.current[2](localT),
      ]);
    } else if (phase === "finish") {
      setProgress(
        [0, 1, 2].map((i) => (i === finishOrder.current[0] ? 1 : 0.94)) as [
          number,
          number,
          number,
        ],
      );
    } else {
      setProgress([0, 0, 0]);
    }
  }, [now, phase, t]);

  useEffect(() => {
    if (elapsed < dur) return;
    const nextMap: Record<RacePhase, RacePhase> = {
      waiting: "prep",
      prep: "lock",
      lock: "launch",
      launch: "race",
      race: "finish",
      finish: "waiting",
    };
    const next = nextMap[phase];

    if (phase === "race") {
      const finals = [0, 1, 2].map((i) => curves.current[i](1));
      const scored = finals.map((v) => v + Math.random() * 0.03 - 0.015);
      const order = [0, 1, 2].sort((a, b) => scored[b] - scored[a]);
      finishOrder.current = order as [number, number, number];

      if (confirmed && selected !== null && selected === order[0]) {
        setBalance((b) => b + Math.round(amount * cars[selected].multiplier));
      }
      setHistory((h) => [{ id: roundId, car: cars[order[0]], ago: "now" }, ...h].slice(0, 50));
    }

    if (phase === "finish") {
      setCars(makeRaceLineup());
      curves.current = [
        accelCurve(Math.floor(Math.random() * 100000)),
        accelCurve(Math.floor(Math.random() * 100000)),
        accelCurve(Math.floor(Math.random() * 100000)),
      ];
      setSelected(null);
      setConfirmed(false);
      setRoundId((r) => r + 1);
    }

    setPhase(next);
    setPhaseStart(performance.now());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, dur, phase]);

  const totalPrep = PHASE_DUR.waiting + PHASE_DUR.prep + PHASE_DUR.lock;
  const into =
    phase === "waiting"
      ? elapsed
      : phase === "prep"
        ? PHASE_DUR.waiting + elapsed
        : phase === "lock"
          ? PHASE_DUR.waiting + PHASE_DUR.prep + elapsed
          : totalPrep;
  const countdown = Math.max(0, totalPrep - into);

  const locked =
    phase === "lock" || phase === "launch" || phase === "race" || phase === "finish";
  const winner = phase === "finish" ? finishOrder.current[0] : null;
  const hyperMode = cars.some((c) => c.kind === "hyper");

  const selectedLabel =
    selected === null
      ? null
      : cars[selected].kind === "hyper"
        ? "BLACK"
        : cars[selected].kind === "small"
          ? "SMALL"
          : cars[selected].colorName.toUpperCase();

  const placeBet = () => {
    if (selected === null || locked || confirmed) return;
    if (amount > balance) return;
    setBalance((b) => b - amount);
    setConfirmed(true);
  };

  return (
    <div className="h-[100dvh] w-full overflow-y-auto overflow-x-hidden bg-[#04060c] text-white flex flex-col">
      <Header balance={balance} roundId={roundId} />

      {/* Race stage */}
      <div className="relative mx-2 rounded-2xl overflow-hidden border border-white/10 h-[46vh] min-h-[280px] shrink-0">
        <Highway
          cars={cars}
          phase={phase}
          progress={progress}
          winnerLane={winner}
          hyperMode={hyperMode}
          countdown={countdown}
        />
        <div className="absolute left-1.5 top-1.5 z-30">
          <RecentRounds entries={history} />
        </div>
        <div className="absolute right-1.5 top-1.5 z-30">
          <LiveStats players={players} totalBets={totalBets} biggestWin={45000} />
        </div>

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

      {/* Bet panel */}
      <div className="mt-2 mx-2 glass rounded-2xl p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-white/45 font-display tracking-[0.15em]">
            HOW TO PLAY?
          </span>
          <span className="font-display text-[12px] tracking-[0.15em] text-white">
            PLACE YOUR BET
          </span>
          <span
            className={`text-[10px] font-display tracking-[0.15em] ${locked ? "text-white/40" : "text-[#26ff9a]"}`}
          >
            {locked ? "CLOSED" : "OPEN"}
          </span>
        </div>

        <PredictionCards
          cars={cars}
          selected={selected}
          onSelect={(i) => {
            if (locked || confirmed) return;
            setSelected(i);
          }}
          locked={locked}
          winner={winner}
        />

        <BettingPanel
          amount={amount}
          balance={balance}
          locked={locked}
          onChange={setAmount}
          selectedLabel={selectedLabel}
          confirmed={confirmed}
          phaseLabel={phase}
          onConfirm={placeBet}
        />
      </div>

      <div className="mt-2 mx-2 pb-2">
        <History entries={history} />
      </div>

      {/* Bottom nav */}
      <div className="sticky bottom-0 mt-2 z-40 bg-gradient-to-t from-[#04060c] via-[#04060c] to-transparent pt-3 pb-2 px-2">
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
              className={`flex flex-col items-center gap-0.5 py-1 rounded-xl ${
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
