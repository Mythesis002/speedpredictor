import { useEffect, useMemo, useRef, useState } from "react";
import { Car, type CarSpec } from "./Car";
import { useHydrated } from "@/lib/use-hydrated";
import type { RacePhase } from "@/lib/race-engine";

function Particles() {
  const hydrated = useHydrated();
  const items = useMemo(
    () =>
      hydrated
        ? Array.from({ length: 12 }, (_, i) => ({
            left: (i * 8.3) % 100,
            bottom: Math.random() * 40,
            dur: 6 + Math.random() * 6,
            delay: Math.random() * 4,
          }))
        : [],
    [hydrated],
  );
  return (
    <div className="pointer-events-none absolute inset-0">
      {items.map((p, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${p.left}%`,
            bottom: `${p.bottom}%`,
            width: 2,
            height: 2,
            background: "oklch(0.85 0.19 195 / 0.7)",
            animation: `float-particle ${p.dur}s linear ${p.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}


interface Props {
  cars: [CarSpec, CarSpec, CarSpec];
  phase: RacePhase;
  progress: [number, number, number]; // 0..1
  lightsOn: 0 | 1 | 2 | 3 | 4 | 5; // 0..5 lights
  winnerLane: number | null;
  hyperMode: boolean;
}

const LANE_LEFTS = ["18%", "50%", "82%"];

export function Highway({
  cars,
  phase,
  progress,
  lightsOn,
  winnerLane,
  hyperMode,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(420);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect;
      setH(cr.height);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Track drawn as CSS trapezoid with perspective.
  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden"
      style={{
        perspective: 800,
      }}
    >
      {/* Grandstands background */}
      <div
        className="absolute left-0 right-0 top-0 h-[38%] pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, transparent 60%, oklch(0.14 0.05 275 / 0.7) 100%)",
        }}
      >
        {/* LED banner */}
        <div className="absolute left-1/2 top-[42%] -translate-x-1/2 w-[46%] max-w-56 h-6 rounded-md glass flex items-center justify-center overflow-hidden">
          <div className="animate-shimmer w-full text-center text-[10px] font-display tracking-widest text-[oklch(0.85_0.19_195)]">
            NEO PRIX · LIVE
          </div>
        </div>
        {/* spectator dots */}
        <div
          className="absolute left-0 right-0 bottom-2 h-4 opacity-70"
          style={{
            backgroundImage:
              "radial-gradient(circle, oklch(0.85 0.19 195 / 0.7) 0.6px, transparent 1.2px)",
            backgroundSize: "6px 6px",
          }}
        />
      </div>

      {/* Trapezoid road (perspective) */}
      <div
        className="absolute left-1/2 -translate-x-1/2 bottom-0"
        style={{
          width: "150%",
          height: "82%",
          transform: "translateX(-50%) rotateX(58deg)",
          transformOrigin: "50% 100%",
        }}
      >
        <div className="absolute inset-0 road-surface" />

        {/* lane dividers */}
        <div
          className={`absolute top-0 bottom-0 lane-dash ${phase === "waiting" || phase === "prep" || phase === "lock" ? "slow" : ""}`}
          style={{ left: "33.33%", width: 4 }}
        />
        <div
          className={`absolute top-0 bottom-0 lane-dash ${phase === "waiting" || phase === "prep" || phase === "lock" ? "slow" : ""}`}
          style={{ left: "66.66%", width: 4 }}
        />

        {/* road edges LED */}
        <div
          className="absolute top-0 bottom-0 left-[10%] w-[2px]"
          style={{
            background:
              "linear-gradient(180deg, transparent, oklch(0.85 0.19 195 / 0.9), transparent)",
            boxShadow: "0 0 12px oklch(0.85 0.19 195 / 0.6)",
          }}
        />
        <div
          className="absolute top-0 bottom-0 right-[10%] w-[2px]"
          style={{
            background:
              "linear-gradient(180deg, transparent, oklch(0.68 0.28 330 / 0.9), transparent)",
            boxShadow: "0 0 12px oklch(0.68 0.28 330 / 0.6)",
          }}
        />

        {/* start line */}
        <div
          className="absolute left-[10%] right-[10%] h-2"
          style={{
            bottom: "10%",
            backgroundImage:
              "repeating-linear-gradient(90deg,#fff 0 8px,#000 8px 16px)",
            opacity: 0.9,
          }}
        />

        {/* finish gate (distant) */}
        <div
          className="absolute left-[15%] right-[15%] h-3 rounded-sm"
          style={{
            top: "6%",
            backgroundImage:
              "repeating-linear-gradient(90deg,#fff 0 6px,#111 6px 12px)",
            filter: "drop-shadow(0 0 6px #fff8)",
          }}
        />
      </div>

      {/* Traffic lights */}
      <div className="absolute left-1/2 -translate-x-1/2 top-[6%] flex gap-1 z-10">
        {[0, 1, 2, 3, 4].map((i) => {
          const on = i < lightsOn && lightsOn <= 5;
          const cleared = phase === "launch" || phase === "race" || phase === "finish";
          return (
            <div
              key={i}
              className="w-3 h-3 rounded-full transition-all duration-300"
              style={{
                background: cleared
                  ? "oklch(0.28 0.14 145)"
                  : on
                    ? "oklch(0.7 0.24 25)"
                    : "oklch(0.2 0.02 265)",
                boxShadow: cleared
                  ? "0 0 12px oklch(0.7 0.22 145 / 0.9)"
                  : on
                    ? "0 0 12px oklch(0.72 0.25 25 / 0.9)"
                    : "inset 0 0 3px #000",
                border: "1px solid oklch(1 0 0 / 0.15)",
              }}
            />
          );
        })}
      </div>

      {/* Cars — positioned in 2D over perspective road */}
      {cars.map((car, i) => {
        // vertical position: bottom (start) 12% → top (finish) 40%
        const p = progress[i];
        const bottomPct = 12 + p * 50; // 12% -> 62% (of container from bottom)
        const scale = 1 - p * 0.55;
        const isWinner = winnerLane === i && phase === "finish";
        return (
          <div
            key={car.id}
            className="absolute z-20 transition-none"
            style={{
              left: LANE_LEFTS[i],
              bottom: `${bottomPct}%`,
              transform: `translate(-50%, 50%) scale(${scale})`,
            }}
          >
            <Car
              spec={car}
              size={72}
              idle={phase === "waiting" || phase === "prep" || phase === "lock"}
              racing={phase === "launch" || phase === "race"}
              glow={isWinner || (car.kind === "hyper" && hyperMode)}
            />
            {isWinner && (
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 font-display text-[10px] tracking-widest text-[oklch(0.85_0.17_90)] text-neon">
                WIN
              </div>
            )}
          </div>
        );
      })}

      {/* Motion blur overlay during race */}
      {(phase === "launch" || phase === "race") && (
        <div
          className="pointer-events-none absolute inset-0 z-10"
          style={{
            background:
              "linear-gradient(180deg, transparent 30%, oklch(0.85 0.19 195 / 0.06) 70%, transparent 100%)",
            mixBlendMode: "screen",
          }}
        />
      )}

      {/* Confetti on finish */}
      {phase === "finish" && (
        <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
          {Array.from({ length: 40 }).map((_, i) => {
            const hue = [195, 90, 330, 25, 145][i % 5];
            return (
              <span
                key={i}
                className="absolute block"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: "-5%",
                  width: 6,
                  height: 10,
                  background: `oklch(0.8 0.2 ${hue})`,
                  animation: `confetti-fall ${1.6 + Math.random() * 1.4}s ${Math.random() * 0.3}s linear forwards`,
                }}
              />
            );
          })}
        </div>
      )}

      {/* subtle floating particles (client only to avoid hydration mismatch) */}
      <Particles />


      {/* Suppress unused var warning */}
      <span className="hidden">{h}</span>
    </div>
  );
}
