import { Car, type CarSpec } from "./Car";
import { useHydrated } from "@/lib/use-hydrated";
import { useMemo } from "react";
import type { RacePhase } from "@/lib/race-engine";

interface Props {
  cars: [CarSpec, CarSpec, CarSpec];
  phase: RacePhase;
  progress: [number, number, number]; // 0..1
  winnerLane: number | null;
  hyperMode: boolean;
  countdown: number;
}

const LANE_X = [22, 50, 78]; // % of stage width at the bottom

export function Highway({ cars, phase, progress, winnerLane, hyperMode, countdown }: Props) {
  const hydrated = useHydrated();
  const racing = phase === "launch" || phase === "race";

  const sparks = useMemo(
    () =>
      hydrated
        ? Array.from({ length: 14 }, (_, i) => ({
            left: (i * 7.3 + 4) % 96,
            dur: 2.4 + ((i * 37) % 30) / 10,
            delay: ((i * 53) % 40) / 10,
            size: 1 + ((i * 17) % 3),
          }))
        : [],
    [hydrated],
  );

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#04060c]">
      {/* ---------- Night city vanishing point ---------- */}
      <div
        className="absolute inset-x-0 top-0 h-[46%]"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 100%, oklch(0.32 0.14 300 / 0.55), transparent 70%), linear-gradient(180deg,#05060d 0%, #0a0a18 60%, #100d22 100%)",
        }}
      />
      {/* skyline blocks */}
      <div className="absolute inset-x-0 top-[10%] h-[30%] opacity-70">
        {Array.from({ length: 18 }).map((_, i) => {
          const l = (i * 5.6) % 100;
          const bh = 20 + ((i * 29) % 60);
          return (
            <div
              key={i}
              className="absolute bottom-0 rounded-t-sm"
              style={{
                left: `${l}%`,
                width: `${3 + (i % 3)}%`,
                height: `${bh}%`,
                background: "linear-gradient(180deg,#131a2e,#080b16)",
                boxShadow: `0 0 12px ${i % 3 === 0 ? "#3ad8ff33" : "#ff3ac833"}`,
              }}
            >
              <div
                className="absolute inset-0 opacity-60"
                style={{
                  backgroundImage:
                    "radial-gradient(circle, #7fe9ff 0.5px, transparent 1px)",
                  backgroundSize: "6px 8px",
                }}
              />
            </div>
          );
        })}
      </div>

      {/* grandstand glow band */}
      <div
        className="absolute inset-x-0 top-[36%] h-[10%]"
        style={{
          background:
            "linear-gradient(180deg, transparent, oklch(0.5 0.2 320 / 0.25), transparent)",
        }}
      />

      {/* finish gantry */}
      <div className="absolute left-1/2 -translate-x-1/2 top-[40%] w-[34%] h-2 rounded-sm bg-[#0d1220] border border-white/10 flex items-center justify-around">
        <span className="w-1.5 h-1.5 rounded-full bg-[#26ff9a] shadow-[0_0_8px_#26ff9a]" />
        <span className="w-1.5 h-1.5 rounded-full bg-[#26ff9a] shadow-[0_0_8px_#26ff9a]" />
        <span className="w-1.5 h-1.5 rounded-full bg-[#26ff9a] shadow-[0_0_8px_#26ff9a]" />
      </div>

      {/* ---------- Road (perspective) ---------- */}
      <div className="absolute inset-x-0 bottom-0 top-[42%] overflow-hidden">
        {/* tarmac trapezoid */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg,#0b0f1a 0%, #12141f 40%, #171a26 100%)",
            clipPath: "polygon(42% 0%, 58% 0%, 128% 100%, -28% 100%)",
          }}
        />
        {/* wet sheen */}
        <div
          className="absolute inset-0 mix-blend-screen opacity-40"
          style={{
            background:
              "radial-gradient(80% 60% at 50% 0%, oklch(0.6 0.2 300 / 0.35), transparent 70%)",
            clipPath: "polygon(42% 0%, 58% 0%, 128% 100%, -28% 100%)",
          }}
        />

        {/* neon edge rails */}
        <div
          className="absolute inset-0"
          style={{
            clipPath: "polygon(41.4% 0%, 42.6% 0%, -25% 100%, -32% 100%)",
            background: "linear-gradient(180deg, transparent, #b14bff)",
            filter: "blur(0.4px) drop-shadow(0 0 10px #b14bffaa)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            clipPath: "polygon(57.4% 0%, 58.6% 0%, 132% 100%, 125% 100%)",
            background: "linear-gradient(180deg, transparent, #35e6ff)",
            filter: "blur(0.4px) drop-shadow(0 0 10px #35e6ffaa)",
          }}
        />

        {/* lane dashes (perspective, continuously scrolling) */}
        {[0, 1].map((k) => (
          <div key={k} className="absolute inset-0 overflow-hidden">
            {Array.from({ length: 9 }).map((_, i) => (
              <span
                key={i}
                className="absolute left-1/2 block rounded-full bg-white/85"
                style={{
                  top: 0,
                  width: 6,
                  height: 22,
                  transformOrigin: "50% 0%",
                  animation: `dash-run ${racing ? 0.75 : 2.6}s linear ${(i * (racing ? 0.75 : 2.6)) / 9}s infinite`,
                  ["--dash-x" as string]: k === 0 ? "-1" : "1",
                }}
              />
            ))}
          </div>
        ))}

        {/* tarmac grain */}
        <div
          className="absolute inset-0 opacity-[0.12] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle, #ffffff 0.4px, transparent 0.9px)",
            backgroundSize: "4px 4px",
          }}
        />
      </div>

      {/* speed streaks while racing */}
      {racing &&
        sparks.map((s, i) => (
          <span
            key={i}
            className="absolute rounded-full pointer-events-none"
            style={{
              left: `${s.left}%`,
              bottom: 0,
              width: s.size,
              height: 40,
              background:
                "linear-gradient(180deg, transparent, oklch(0.9 0.15 195 / 0.7), transparent)",
              animation: `streak ${0.6 + (i % 4) / 10}s linear ${(i % 5) / 10}s infinite`,
            }}
          />
        ))}

      {/* ---------- Cars ---------- */}
      {cars.map((car, i) => {
        const p = progress[i];
        const scale = 1 - p * 0.78;
        const bottom = 4 + p * 46; // % from bottom of the stage
        const x = 50 + (LANE_X[i] - 50) * (1 - p * 0.5);
        const isWinner = winnerLane === i && phase === "finish";
        return (
          <div
            key={car.id}
            className="absolute z-20"
            style={{
              left: `${x}%`,
              bottom: `${bottom}%`,
              transform: `translate(-50%, 0) scale(${scale})`,
              transformOrigin: "50% 100%",
              opacity: p > 0.95 ? 0.85 : 1,
            }}
          >
            <div className={racing ? "animate-shake" : "animate-idle"}>
              <Car
                spec={car}
                size={118}
                racing={racing}
                glow={isWinner || (car.kind === "hyper" && hyperMode)}
              />
            </div>
            {isWinner && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 font-display text-[10px] tracking-[0.3em] text-[#ffd66b] text-neon">
                WINNER
              </div>
            )}
          </div>
        );
      })}

      {/* ---------- Countdown pill ---------- */}
      {(phase === "waiting" || phase === "prep" || phase === "lock") && (
        <div className="absolute left-1/2 -translate-x-1/2 top-2 z-30">
          <div className="glass rounded-2xl px-5 py-2 text-center min-w-[140px]">
            <div className="text-[9px] tracking-[0.25em] text-white/55 font-display">
              GAME STARTS IN
            </div>
            <div className="font-display text-2xl tabular text-[#ffc32b] leading-tight">
              {countdown.toFixed(2)}
            </div>
          </div>
        </div>
      )}
      {racing && (
        <div className="absolute left-1/2 -translate-x-1/2 top-2 z-30">
          <div className="glass rounded-2xl px-5 py-2 font-display text-sm tracking-[0.35em] text-[#35e6ff] text-neon animate-pulse-glow">
            RACING
          </div>
        </div>
      )}

      {/* finish flash */}
      {phase === "finish" && (
        <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
          {Array.from({ length: 30 }).map((_, i) => {
            const hue = [195, 90, 330, 25, 145][i % 5];
            return (
              <span
                key={i}
                className="absolute block"
                style={{
                  left: `${(i * 3.7) % 100}%`,
                  top: "-5%",
                  width: 5,
                  height: 9,
                  background: `oklch(0.8 0.2 ${hue})`,
                  animation: `confetti-fall ${1.6 + ((i * 13) % 14) / 10}s ${((i * 7) % 4) / 10}s linear forwards`,
                }}
              />
            );
          })}
        </div>
      )}

      {/* vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 60%, transparent 40%, #000 100%)",
          opacity: 0.75,
        }}
      />
    </div>
  );
}
