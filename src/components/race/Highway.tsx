import { Car, type CarSpec } from "./Car";
import { useHydrated } from "@/lib/use-hydrated";
import { useEffect, useMemo, useRef } from "react";
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

const LANE_X = [23, 50, 77]; // % of stage width at the camera plane

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
  const bodyRefs = useRef<Array<HTMLDivElement | null>>([null, null, null]);
  const posRefs = useRef<Array<HTMLDivElement | null>>([null, null, null]);
  const smooth = useRef<[number, number, number]>([0, 0, 0]);
  const lastP = useRef<[number, number, number]>([0, 0, 0]);
  const shownPos = useRef<[number, number, number]>([0, 0, 0]);

  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  /* 60fps hero-car motion, written straight to the DOM (no React re-render) */
  useEffect(() => {
    if (!hydrated) return;
    let raf = 0;
    let prev = performance.now();

    const loop = (ts: number) => {
      const dt = Math.min(0.05, (ts - prev) / 1000) || 0.016;
      prev = ts;

      const stage = stageRef.current;
      const w = stage?.clientWidth ?? 360;
      const hgt = stage?.clientHeight ?? 300;
      const ph = phaseRef.current;
      const p = progressRef.current;
      const trailer = Math.min(p[0], p[1], p[2]);

      // running order (0 = P1)
      const order = [0, 1, 2].sort((a, b) => p[b] - p[a]);

      for (let i = 0; i < 3; i++) {
        // speed of this car right now (used for throttle / squat)
        const speed = Math.max(0, (p[i] - lastP.current[i]) / dt);
        lastP.current[i] = p[i];

        // camera sits behind the pack: the leader is further up the road
        // (smaller, higher), the last car is closest to the lens.
        const gap = Math.max(0, p[i] - trailer);
        const target = Math.min(1, Math.sqrt(gap) * 3.4);
        smooth.current[i] += (target - smooth.current[i]) * Math.min(1, dt * 7);
        const d = smooth.current[i];


        const scale = (1 - d * 0.46) * (ph === "waiting" || ph === "prep" ? 1 : 1);
        const y = -d * hgt * 0.34;
        const x = ((LANE_X[i] - 50) * (1 - d * 0.55) * w) / 100;

        const el = laneRefs.current[i];
        if (el) {
          el.style.transform = `translate3d(calc(-50% + ${x.toFixed(2)}px), ${y.toFixed(2)}px, 0) scale(${scale.toFixed(3)})`;
          el.style.zIndex = String(30 - Math.round(d * 12));
          el.style.opacity = (1 - d * 0.18).toFixed(3);
        }

        // launch squat / finish dive — subtle body pitch sells accel + braking
        const bodyEl = bodyRefs.current[i];
        if (bodyEl) {
          const throttle = Math.min(1, speed * 2.6);
          const pitch =
            ph === "launch" ? 3.5 : ph === "finish" ? -2.5 : -throttle * 1.2;
          const shake = racing ? (Math.random() - 0.5) * 1.1 * throttle : 0;
          bodyEl.style.transform = `translate3d(${shake.toFixed(2)}px, ${(pitch * 0.4).toFixed(2)}px, 0) rotate(${(pitch * 0.12).toFixed(2)}deg)`;
        }

        // position badge
        const rank = order.indexOf(i) + 1;
        const badge = posRefs.current[i];
        if (badge && shownPos.current[i] !== rank) {
          shownPos.current[i] = rank;
          badge.textContent = `P${rank}`;
          badge.style.color = rank === 1 ? "#ffd66b" : rank === 2 ? "#d7e2f5" : "#8b97ad";
        }
        if (badge) {
          badge.style.opacity = ph === "race" || ph === "finish" ? "1" : "0";
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [hydrated, progressRef, racing]);

  const sparks = useMemo(
    () =>
      hydrated
        ? Array.from({ length: 14 }, (_, i) => ({
            left: (i * 7.1 + 3) % 96,
            delay: ((i * 53) % 40) / 10,
            size: 1 + ((i * 17) % 3),
          }))
        : [],
    [hydrated],
  );

  const throttle = phase === "launch" ? 1 : phase === "race" ? 0.85 : phase === "finish" ? 0.15 : 0.05;

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
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: phase === "finish" ? "#26ff9a" : "#26ff9a",
              boxShadow: "0 0 8px #26ff9a",
              opacity: phase === "finish" ? 1 : 0.55,
            }}
          />
        ))}
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
              const dur = racing ? 0.55 : 1.9;
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
              height: 44,
              background:
                "linear-gradient(180deg, transparent, oklch(0.9 0.15 195 / 0.7), transparent)",
              animation: `streak ${0.5 + (i % 4) / 10}s linear ${s.delay / 4}s infinite`,
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
              bottom: "5%",
              transformOrigin: "50% 100%",
            }}
          >
            <div
              ref={(el) => {
                posRefs.current[i] = el;
              }}
              className="absolute -top-3 left-1/2 -translate-x-1/2 font-display text-[10px] tracking-[0.2em] opacity-0 transition-opacity"
            />
            <div
              ref={(el) => {
                bodyRefs.current[i] = el;
              }}
              className="gpu"
            >
              <Car
                spec={car}
                size={124}
                throttle={throttle}
                braking={phase === "prep" || phase === "lock" || phase === "finish"}
                glow={isWinner || (car.kind === "hyper" && hyperMode)}
              />
            </div>
            {isWinner && (
              <div className="absolute -top-9 left-1/2 -translate-x-1/2 font-display text-[10px] tracking-[0.3em] text-[#ffd66b] text-neon">
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
            {phase === "launch" ? "GO!" : "RACING"}
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
