import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Background } from "@/components/race/Background";
import { Highway } from "@/components/race/Highway";
import { PredictionCards } from "@/components/race/PredictionCards";
import { BettingPanel } from "@/components/race/BettingPanel";
import { Header } from "@/components/race/Header";
import { History, type HistoryEntry } from "@/components/race/History";
import {
  accelCurve,
  makeRaceLineup,
  type RacePhase,
} from "@/lib/race-engine";
import type { CarSpec } from "@/components/race/Car";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Neo Prix — Live Race Prediction" },
      {
        name: "description",
        content:
          "A premium three-lane futuristic racing prediction experience. Watch live races, feel the anticipation, predict the winning colour.",
      },
      { property: "og:title", content: "Neo Prix — Live Race Prediction" },
      {
        property: "og:description",
        content:
          "Watch a live futuristic three-lane highway and predict the winning colour. Anticipation, speed, luxury.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NeoPrix,
});

// Phase durations (seconds)
const PHASE_DUR: Record<RacePhase, number> = {
  waiting: 3,
  prep: 4,
  lock: 1.5,
  launch: 0.8,
  race: 4.5,
  finish: 3.5,
};

function NeoPrix() {
  const hydrated = useHydratedGuard();
  if (!hydrated) {
    return (
      <div className="relative h-[100dvh] w-full overflow-hidden text-white">
        <Background />
      </div>
    );
  }
  return <NeoPrixGame />;
}

function useHydratedGuard() {
  const [h, setH] = useState(false);
  useEffect(() => setH(true), []);
  return h;
}

function NeoPrixGame() {
  const [phase, setPhase] = useState<RacePhase>("waiting");
  const [phaseStart, setPhaseStart] = useState(() => performance.now());
  const [roundId, setRoundId] = useState(1042);
  const [cars, setCars] = useState<[CarSpec, CarSpec, CarSpec]>(() =>
    makeRaceLineup(),
  );
  const curves = useRef<Array<(t: number) => number>>([
    accelCurve(1),
    accelCurve(2),
    accelCurve(3),
  ]);
  const finishOrder = useRef<[number, number, number]>([0, 1, 2]);
  const [progress, setProgress] = useState<[number, number, number]>([0, 0, 0]);
  const [now, setNow] = useState(performance.now());

  const [balance, setBalance] = useState(25000);
  const [amount, setAmount] = useState(500);
  const [selected, setSelected] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [online, setOnline] = useState(12483);
  const [history, setHistory] = useState<HistoryEntry[]>(() =>
    Array.from({ length: 12 }, (_, i) => ({
      id: 1041 - i,
      car: makeRaceLineup()[Math.floor(Math.random() * 3)],
      ago: `${i + 1}m`,
    })),
  );

  // rAF loop
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setNow(performance.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Online users subtle drift
  useEffect(() => {
    const id = setInterval(() => {
      setOnline((n) => Math.max(8000, n + Math.round((Math.random() - 0.5) * 60)));
    }, 1800);
    return () => clearInterval(id);
  }, []);

  const elapsed = (now - phaseStart) / 1000;
  const dur = PHASE_DUR[phase];
  const t = Math.min(1, elapsed / dur);

  // Compute progress from phase
  useEffect(() => {
    if (phase === "race" || phase === "launch") {
      const localT = phase === "launch" ? t * 0.08 : 0.08 + t * 0.92;
      const p = [
        curves.current[0](localT),
        curves.current[1](localT),
        curves.current[2](localT),
      ] as [number, number, number];
      setProgress(p);
    } else if (phase === "finish") {
      setProgress([1, 1, 1].map((_, i) => (i === finishOrder.current[0] ? 1 : 0.9)) as [
        number,
        number,
        number,
      ]);
    } else {
      setProgress([0, 0, 0]);
    }
  }, [now, phase, t]);

  // Phase advancement
  useEffect(() => {
    if (elapsed < dur) return;
    // transition
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
      // Determine winner from curves at t=1
      const finals = [0, 1, 2].map((i) => curves.current[i](1)) as number[];
      // Introduce tiny jitter for drama
      const scored = finals.map((v, i) => v + Math.random() * 0.03 - 0.015);
      const order = [0, 1, 2].sort((a, b) => scored[b] - scored[a]);
      finishOrder.current = order as [number, number, number];

      // settle bet
      if (confirmed && selected !== null) {
        if (selected === order[0]) {
          setBalance((b) => b + Math.round(amount * cars[selected].multiplier));
        }
      }

      // History
      setHistory((h) =>
        [
          {
            id: roundId,
            car: cars[order[0]],
            ago: "now",
          },
          ...h,
        ].slice(0, 50),
      );
    }

    if (phase === "finish") {
      // reset for next round
      const lineup = makeRaceLineup();
      setCars(lineup);
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

  // Countdown value & lights
  const totalPrepWindow =
    PHASE_DUR.waiting + PHASE_DUR.prep + PHASE_DUR.lock;
  const timeIntoStart =
    phase === "waiting"
      ? elapsed
      : phase === "prep"
        ? PHASE_DUR.waiting + elapsed
        : phase === "lock"
          ? PHASE_DUR.waiting + PHASE_DUR.prep + elapsed
          : totalPrepWindow;
  const countdown = Math.max(0, totalPrepWindow - timeIntoStart);

  // lights fill during prep (0 → 5)
  const prepT =
    phase === "prep"
      ? Math.min(1, elapsed / PHASE_DUR.prep)
      : phase === "lock"
        ? 1
        : phase === "launch" || phase === "race" || phase === "finish"
          ? 1
          : 0;
  const lightsOn = (Math.floor(prepT * 5) as 0 | 1 | 2 | 3 | 4 | 5);

  const locked =
    phase === "lock" ||
    phase === "launch" ||
    phase === "race" ||
    phase === "finish";
  const winner = phase === "finish" ? finishOrder.current[0] : null;
  const hyperMode = cars.some((c) => c.kind === "hyper");

  const phaseLabel: Record<RacePhase, string> = {
    waiting: "PREDICTIONS OPEN",
    prep: "LIGHTS OUT SOON",
    lock: "PREDICTIONS CLOSED",
    launch: "LAUNCH",
    race: "RACING",
    finish: "RESULTS",
  };

  const selectedLabel =
    selected === null
      ? null
      : cars[selected].kind === "hyper"
        ? "Black Hyper"
        : cars[selected].kind === "small"
          ? `Mini ${cars[selected].colorName}`
          : cars[selected].colorName;

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden text-white">
      <Background intense={hyperMode || phase === "finish"} />

      {/* Hero highway zone */}
      <div className="absolute inset-0">
        <Highway
          cars={cars}
          phase={phase}
          progress={progress}
          lightsOn={lightsOn}
          winnerLane={winner}
          hyperMode={hyperMode}
        />
      </div>

      <Header
        balance={balance}
        roundId={roundId}
        countdown={countdown}
        online={online}
      />

      {/* Hyper alert */}
      {hyperMode && phase !== "finish" && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40">
          <div
            className="px-3 py-1 rounded-full glass font-display text-[10px] tracking-[0.3em] animate-pulse-glow"
            style={{
              color: "#ffd66b",
              boxShadow: "0 0 24px #ffd66b55",
              borderColor: "#ffd66b55",
            }}
          >
            ⚡ HYPERCAR IN RACE · 5× PAYOUT
          </div>
        </div>
      )}

      {/* Bottom stack */}
      <div className="absolute bottom-0 left-0 right-0 z-30 pb-3 pt-2 space-y-2.5">
        <History entries={history} />
        <PredictionCards
          cars={cars}
          selected={selected}
          onSelect={(i) => {
            if (locked) return;
            setSelected(i);
            setConfirmed(false);
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
          phaseLabel={phaseLabel[phase]}
          onConfirm={() => {
            if (selected === null || locked) return;
            if (amount > balance) return;
            setBalance((b) => b - amount);
            setConfirmed(true);
          }}
        />
      </div>
    </div>
  );
}
