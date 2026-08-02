import { Car, type CarSpec } from "./Car";
import { useHydrated } from "@/lib/use-hydrated";
import { useEffect, useMemo, useRef } from "react";
import { PHASE_MS, type RacePhase } from "@/lib/round-engine";

interface Props {
  cars: [CarSpec, CarSpec, CarSpec];
  phase: RacePhase;
  /** live progress 0..1 per lane, mutated each frame outside React for 60fps */
  progressRef: { current: [number, number, number] };
  winnerLane: number | null;
  hyperMode: boolean;
  countdown: number;
  /** seconds elapsed inside the current phase, for VFX timing */
  phaseElapsedRef?: { current: number };
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
  const staging = phase === "prep" || phase === "lock";

  const stageRef = useRef<HTMLDivElement | null>(null);
  const cameraRef = useRef<HTMLDivElement | null>(null);
  const flashRef = useRef<HTMLDivElement | null>(null);
  const warpRef = useRef<HTMLDivElement | null>(null);
  const roadRef = useRef<HTMLDivElement | null>(null);
  const laneRefs = useRef<Array<HTMLDivElement | null>>([null, null, null]);
  const bodyRefs = useRef<Array<HTMLDivElement | null>>([null, null, null]);
  const posRefs = useRef<Array<HTMLDivElement | null>>([null, null, null]);

  const depth = useRef<[number, number, number]>([0, 0, 0]);
  const depthVel = useRef<[number, number, number]>([0, 0, 0]);
  const lastP = useRef<[number, number, number]>([0, 0, 0]);
  const speedS = useRef<[number, number, number]>([0, 0, 0]);
  const shownPos = useRef<[number, number, number]>([0, 0, 0]);
  const camShake = useRef(0);
  const camPunch = useRef(0);

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const prevPhase = useRef(phase);

  /* 60fps motion, written straight to the DOM (no React re-render) */
  useEffect(() => {
    if (!hydrated) return;
    let raf = 0;
    let prev = performance.now();
    let acc = 0;
    const STEP = 1 / 120; // fixed physics step keeps motion identical on 60/120Hz

    const loop = (ts: number) => {
      let dt = (ts - prev) / 1000;
      prev = ts;
      if (!Number.isFinite(dt) || dt <= 0) dt = 0.016;
      dt = Math.min(0.1, dt);
      acc += dt;

      const stage = stageRef.current;
      const w = stage?.clientWidth ?? 360;
      const hgt = stage?.clientHeight ?? 300;
      const ph = phaseRef.current;
      const p = progressRef.current;
      const trailer = Math.min(p[0], p[1], p[2]);

      // phase transition impulses -> cinematic camera
      if (prevPhase.current !== ph) {
        if (ph === "launch") {
          camShake.current = 1;
          camPunch.current = 1;
          if (flashRef.current) flashRef.current.style.opacity = "0.85";
        }
        if (ph === "finish") {
          camShake.current = 0.55;
          camPunch.current = -0.6;
        }
        prevPhase.current = ph;
      }

      // fixed-step integration of the critically-damped depth springs
      let steps = 0;
      while (acc >= STEP && steps < 8) {
        acc -= STEP;
        steps++;
        const omega = 9.5; // spring stiffness
        for (let i = 0; i < 3; i++) {
          const gap = Math.max(0, p[i] - trailer);
          const target = Math.min(1, Math.sqrt(gap) * 3.2);
          const x = depth.current[i] - target;
          // critically damped: no overshoot, buttery convergence
          const a = -omega * omega * x - 2 * omega * depthVel.current[i];
          depthVel.current[i] += a * STEP;
          depth.current[i] += depthVel.current[i] * STEP;
        }
        camShake.current = Math.max(0, camShake.current - STEP * 1.7);
        camPunch.current *= 1 - STEP * 3.4;
      }

      let fastest = 0;
      for (let i = 0; i < 3; i++) {
        const raw = Math.max(0, (p[i] - lastP.current[i]) / dt);
        lastP.current[i] = p[i];
        speedS.current[i] += (raw - speedS.current[i]) * Math.min(1, dt * 9);
        fastest = Math.max(fastest, speedS.current[i]);

        const d = Math.max(0, Math.min(1, depth.current[i]));
        const scale = 1 - d * 0.46;
        const y = -d * hgt * 0.34;
        const x = ((LANE_X[i] - 50) * (1 - d * 0.55) * w) / 100;

        const el = laneRefs.current[i];
        if (el) {
          el.style.transform = `translate3d(calc(-50% + ${x.toFixed(2)}px), ${y.toFixed(2)}px, 0) scale(${scale.toFixed(3)})`;
          el.style.zIndex = String(30 - Math.round(d * 12));
          el.style.opacity = (1 - d * 0.16).toFixed(3);
        }

        // launch squat / finish dive — body pitch sells accel + braking
        const bodyEl = bodyRefs.current[i];
        if (bodyEl) {
          const throttle = Math.min(1, speedS.current[i] * 2.6);
          const pitch = ph === "launch" ? 4.2 : ph === "finish" ? -2.6 : -throttle * 1.3;
          const jitter = racing ? Math.sin(ts * 0.06 + i * 2.1) * 0.5 * throttle : 0;
          bodyEl.style.transform = `translate3d(${jitter.toFixed(2)}px, ${(pitch * 0.4).toFixed(2)}px, 0) rotate(${(pitch * 0.1).toFixed(2)}deg)`;
        }

        const rank = [0, 1, 2].sort((a, b) => p[b] - p[a]).indexOf(i) + 1;
        const badge = posRefs.current[i];
        if (badge) {
          if (shownPos.current[i] !== rank) {
            shownPos.current[i] = rank;
            badge.textContent = `P${rank}`;
            badge.style.color = rank === 1 ? "#ffd66b" : rank === 2 ? "#d7e2f5" : "#8b97ad";
          }
          badge.style.opacity = ph === "race" || ph === "finish" ? "1" : "0";
        }
      }

      // ---- cinematic camera: shake + FOV punch ----
      const cam = cameraRef.current;
      if (cam) {
        const s = camShake.current;
        const sx = s * Math.sin(ts * 0.075) * 5;
        const sy = s * Math.cos(ts * 0.098) * 3.4;
        const rot = s * Math.sin(ts * 0.045) * 0.5;
        const punch = 1 + camPunch.current * 0.07 + Math.min(fastest, 0.4) * 0.03;
        cam.style.transform = `translate3d(${sx.toFixed(2)}px, ${sy.toFixed(2)}px, 0) scale(${punch.toFixed(4)}) rotate(${rot.toFixed(3)}deg)`;
      }

      // ---- warp streaks intensity follows real speed ----
      const warp = warpRef.current;
      if (warp) {
        const intensity = Math.min(1, fastest * 3.2);
        warp.style.opacity = intensity.toFixed(3);
        warp.style.setProperty("--warp-speed", `${(0.62 - intensity * 0.4).toFixed(3)}s`);
      }

      // ---- road flow rate follows the pack speed ----
      const road = roadRef.current;
      if (road) {
        const dur = racing ? Math.max(0.34, 0.95 - Math.min(fastest, 0.45) * 1.4) : 1.9;
        road.style.setProperty("--dash-dur", `${dur.toFixed(3)}s`);
      }

      // ---- launch flash decay ----
      const fl = flashRef.current;
      if (fl) {
        const cur = parseFloat(fl.style.opacity || "0");
        if (cur > 0.001) fl.style.opacity = (cur * (1 - dt * 6)).toFixed(4);
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [hydrated, progressRef, racing]);

  const sparks = useMemo(
    () =>
      hydrated
        ? Array.from({ length: 16 }, (_, i) => ({
            left: (i * 6.3 + 3) % 96,
            delay: ((i * 53) % 40) / 100,
            size: 1 + ((i * 17) % 3),
          }))
        : [],
    [hydrated],
  );

  const throttle =
    phase === "launch" ? 1 : phase === "race" ? 0.85 : phase === "finish" ? 0.15 : 0.05;

  // F1 start lights: 5 lights arm across `prep`, all out at lights-out.
  const prepSecs = PHASE_MS.prep / 1000;
  const litCount = staging
    ? phase === "lock"
      ? 5
      : Math.min(5, Math.max(0, Math.ceil(((prepSecs - countdown) / prepSecs) * 5)))
    : 0;

  return (
    <div ref={stageRef} className="relative w-full h-full overflow-hidden bg-[#04060c]">
      <div ref={cameraRef} className="absolute inset-0 gpu origin-center">
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
                background: "#26ff9a",
                boxShadow: "0 0 8px #26ff9a",
                opacity: phase === "finish" ? 1 : 0.55,
              }}
            />
          ))}
        </div>

        {/* ---------- Road (perspective) ---------- */}
        <div ref={roadRef} className="absolute inset-x-0 bottom-0 top-[42%] overflow-hidden">
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

          {/* lane dashes — flow rate driven by --dash-dur each frame */}
          {[0, 1].map((k) => (
            <div key={k} className="absolute inset-0 overflow-hidden">
              {Array.from({ length: 9 }).map((_, i) => (
                <span
                  key={i}
                  className="absolute left-1/2 block rounded-full bg-white/85 gpu dash"
                  style={{
                    top: 0,
                    width: 6,
                    height: 22,
                    transformOrigin: "50% 0%",
                    animationDelay: `calc(var(--dash-dur) * ${i / 9})`,
                    ["--dash-x" as string]: k === 0 ? "-1" : "1",
                  }}
                />
              ))}
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
              style={{ left: "50%", bottom: "5%", transformOrigin: "50% 100%" }}
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
                className="gpu relative"
              >
                {/* launch tyre smoke */}
                {phase === "launch" && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6">
                    {Array.from({ length: 6 }).map((_, s) => (
                      <span
                        key={s}
                        className="absolute bottom-0 rounded-full bg-white/45 blur-[3px]"
                        style={{
                          left: `${s < 3 ? 12 + s * 5 : 62 + (s - 3) * 5}%`,
                          width: 16,
                          height: 16,
                          animation: `tyre-smoke ${0.62 + s * 0.06}s ease-out ${s * 0.045}s both`,
                        }}
                      />
                    ))}
                  </div>
                )}
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

        {/* speed warp streaks — intensity written from the loop */}
        <div
          ref={warpRef}
          className="pointer-events-none absolute inset-0 z-[25]"
          style={{ opacity: 0, ["--warp-speed" as string]: "0.6s" }}
        >
          {sparks.map((s, i) => (
            <span
              key={i}
              className="absolute rounded-full gpu"
              style={{
                left: `${s.left}%`,
                bottom: 0,
                width: s.size,
                height: 52,
                background:
                  "linear-gradient(180deg, transparent, oklch(0.92 0.16 195 / 0.75), transparent)",
                animation: `streak var(--warp-speed) linear ${s.delay}s infinite`,
              }}
            />
          ))}
        </div>
      </div>

      {/* ---------- Start lights ---------- */}
      {staging && (
        <div className="absolute left-1/2 -translate-x-1/2 top-3 z-40 animate-scale-in">
          <div className="glass rounded-2xl px-3 py-2 flex gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="h-4 w-4 rounded-full transition-all duration-200"
                style={{
                  background: i < litCount ? "#ff2d3f" : "rgba(255,255,255,0.08)",
                  boxShadow: i < litCount ? "0 0 14px #ff2d3f, inset 0 0 6px #ffb3b3" : "none",
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ---------- Lights-out flash + GO ---------- */}
      <div
        ref={flashRef}
        className="pointer-events-none absolute inset-0 z-[60] bg-white"
        style={{ opacity: 0 }}
      />
      {phase === "launch" && (
        <div className="pointer-events-none absolute inset-0 z-[55] grid place-items-center">
          <div className="font-display text-5xl tracking-[0.2em] text-white animate-go-burst">
            GO!
          </div>
        </div>
      )}

      {/* ---------- Countdown pill ---------- */}
      {phase === "waiting" && (
        <div className="absolute left-1/2 -translate-x-1/2 top-2 z-30">
          <div className="glass rounded-2xl px-5 py-2 text-center min-w-[140px]">
            <div className="text-[9px] tracking-[0.25em] text-white/55 font-display">
              NEXT RACE IN
            </div>
            <div className="font-display text-2xl tabular text-[#ffc32b] leading-tight">
              {countdown.toFixed(1)}s
            </div>
          </div>
        </div>
      )}
      {phase === "race" && (
        <div className="absolute left-1/2 -translate-x-1/2 top-2 z-30">
          <div className="glass rounded-2xl px-5 py-2 font-display text-sm tracking-[0.35em] text-[#35e6ff] text-neon animate-pulse-glow">
            RACING
          </div>
        </div>
      )}

      {/* finish confetti */}
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
