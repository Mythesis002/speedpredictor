import { Car, type CarSpec } from "./Car";
import { useHydrated } from "@/lib/use-hydrated";
import { memo, useEffect, useMemo, useRef } from "react";
import type { RacePhase } from "@/lib/race-engine";

interface Props {
  cars: [CarSpec, CarSpec, CarSpec];
  phase: RacePhase;
  /** live progress 0..1 per lane, mutated each frame outside React for 60fps */
  progressRef: { current: [number, number, number] };
  winnerLane: number | null;
  hyperMode: boolean;
  countdown: number;
}

const LANE_X = [22, 50, 78]; // % of stage width at the bottom

/* --------------------------- ambient traffic --------------------------- */

const TRAFFIC_COLORS = ["#5d6b86", "#8ea3c4", "#c94b5d", "#3fa9a0", "#c9a24b", "#7a4bc9"];

const TrafficCar = memo(function TrafficCar({ color }: { color: string }) {
  return (
    <svg width="96" height="60" viewBox="0 0 96 60" style={{ display: "block" }}>
      <ellipse cx="48" cy="52" rx="34" ry="5" fill="#000" opacity="0.5" />
      <path d="M14 30 q8-18 34-18 t34 18 l5 14 q2 9 -6 11 h-66 q-8-2 -6-11 z" fill={color} />
      <path d="M26 24 q22-11 44 0 l3 11 q-25-7 -50 0 z" fill="#14202f" opacity="0.9" />
      <rect x="20" y="38" width="56" height="5" rx="2.5" fill="#ff2b3b" opacity="0.9" />
      <rect x="16" y="36" width="64" height="9" rx="4.5" fill="#ff2b3b" opacity="0.25" />
      <path d="M12 34 q-4 8 0 14 h8 q-3-8 -1-14 z" fill="#0a0b0f" />
      <path d="M84 34 q4 8 0 14 h-8 q3-8 1-14 z" fill="#0a0b0f" />
    </svg>
  );
});

const Traffic = memo(function Traffic({ fast }: { fast: boolean }) {
  const items = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => {
        const lane = i % 3;
        const spread = [-1, 0, 1][lane];
        return {
          key: i,
          tx: `${spread * (34 + ((i * 13) % 12))}vw`,
          dur: 5.2 + ((i * 37) % 45) / 10,
          delay: -((i * 17) % 60) / 10,
          color: TRAFFIC_COLORS[i % TRAFFIC_COLORS.length],
          scale: 0.7 + ((i * 7) % 5) / 10,
        };
      }),
    [],
  );

  return (
    <div className="traffic-layer pointer-events-none absolute inset-x-0 bottom-0 top-0 z-10">
      {items.map((it) => {
        const dur = `${it.dur / (fast ? 2.1 : 1)}s`;
        return (
          <div
            key={it.key}
            className="traffic-x absolute left-1/2 bottom-[6%]"
            style={
              {
                "--tx": it.tx,
                animationDuration: dur,
                animationDelay: `${it.delay}s`,
              } as React.CSSProperties
            }
          >
            <div
              className="traffic-y"
              style={{
                animationDuration: dur,
                animationDelay: `${it.delay}s`,
                filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.6))",
              }}
            >
              <div style={{ transform: `scale(${it.scale})`, opacity: 0.85 }}>
                <TrafficCar color={it.color} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
});

/* ------------------------------- highway ------------------------------- */

export function Highway({
  cars,
  phase,
  progressRef,
  winnerLane,
  hyperMode,
  countdown,
}: Props) {
  const hydrated = useHydrated();
  const racing = phase === "launch" || phase === "race";

  const stageRef = useRef<HTMLDivElement | null>(null);
  const laneRefs = useRef<Array<HTMLDivElement | null>>([null, null, null]);
  const smooth = useRef<[number, number, number]>([0, 0, 0]);

  /* 60fps hero-car motion, written straight to the DOM (no React re-render) */
  useEffect(() => {
    if (!hydrated) return;
    let raf = 0;
    const loop = () => {
      const w = stageRef.current?.clientWidth ?? 360;
      const p = progressRef.current;
      const leader = Math.max(p[0], p[1], p[2]);
      for (let i = 0; i < 3; i++) {
        const target = Math.min(1, Math.max(0, (leader - p[i]) * 3.4));
        // critically-damped-ish smoothing keeps depth changes buttery
        smooth.current[i] += (target - smooth.current[i]) * 0.12;
        const d = smooth.current[i];
        const scale = 1 - d * 0.44;
        const y = -d * 96;
        const x = ((LANE_X[i] - 50) * (1 - d * 0.5) * w) / 100;
        const el = laneRefs.current[i];
        if (el) {
          el.style.transform = `translate3d(calc(-50% + ${x.toFixed(2)}px), ${y.toFixed(2)}px, 0) scale(${scale.toFixed(3)})`;
          el.style.zIndex = String(30 - Math.round(d * 10));
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [hydrated, progressRef]);

  const sparks = useMemo(
    () =>
      hydrated
        ? Array.from({ length: 12 }, (_, i) => ({
            left: (i * 8.3 + 4) % 96,
            delay: ((i * 53) % 40) / 10,
            size: 1 + ((i * 17) % 3),
          }))
        : [],
    [hydrated],
  );

  return (
    <div ref={stageRef} className="relative w-full h-full overflow-hidden bg-[#04060c]">
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
                  backgroundImage: "radial-gradient(circle, #7fe9ff 0.5px, transparent 1px)",
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
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(180deg,#0b0f1a 0%, #12141f 40%, #171a26 100%)",
            clipPath: "polygon(42% 0%, 58% 0%, 128% 100%, -28% 100%)",
          }}
        />
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

        {/* lane dashes — always flowing, faster while racing */}
        {[0, 1].map((k) => (
          <div key={k} className="absolute inset-0 overflow-hidden">
            {Array.from({ length: 9 }).map((_, i) => {
              const dur = racing ? 0.7 : 1.9;
              return (
                <span
                  key={i}
                  className="absolute left-1/2 block rounded-full bg-white/85 gpu"
                  style={{
                    top: 0,
                    width: 6,
                    height: 22,
                    transformOrigin: "50% 0%",
                    animation: `dash-run ${dur}s linear ${(i * dur) / 9}s infinite`,
                    ["--dash-x" as string]: k === 0 ? "-1" : "1",
                  }}
                />
              );
            })}
          </div>
        ))}

        <div
          className="absolute inset-0 opacity-[0.12] pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, #ffffff 0.4px, transparent 0.9px)",
            backgroundSize: "4px 4px",
          }}
        />
      </div>

      {/* ---------- Ambient traffic (always moving) ---------- */}
      {hydrated && <Traffic fast={racing} />}

      {/* speed streaks while racing */}
      {racing &&
        sparks.map((s, i) => (
          <span
            key={i}
            className="absolute rounded-full pointer-events-none gpu"
            style={{
              left: `${s.left}%`,
              bottom: 0,
              width: s.size,
              height: 40,
              background:
                "linear-gradient(180deg, transparent, oklch(0.9 0.15 195 / 0.7), transparent)",
              animation: `streak ${0.6 + (i % 4) / 10}s linear ${s.delay / 4}s infinite`,
            }}
          />
        ))}

      {/* ---------- Hero cars ---------- */}
      {cars.map((car, i) => {
        const isWinner = winnerLane === i && phase === "finish";
        return (
          <div
            key={car.id}
            ref={(el) => {
              laneRefs.current[i] = el;
            }}
            className="absolute z-20 gpu"
            style={{
              left: "50%",
              bottom: "6%",
              transformOrigin: "50% 100%",
            }}
          >
            <div className="animate-shake" style={{ animationPlayState: racing ? "running" : "paused" }}>
              <Car
                spec={car}
                size={118}
                racing
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
              NEXT RACE IN
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
          {Array.from({ length: 24 }).map((_, i) => {
            const hue = [195, 90, 330, 25, 145][i % 5];
            return (
              <span
                key={i}
                className="absolute block gpu"
                style={{
                  left: `${(i * 4.3) % 100}%`,
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
          background: "radial-gradient(120% 80% at 50% 60%, transparent 40%, #000 100%)",
          opacity: 0.75,
        }}
      />
    </div>
  );
}
