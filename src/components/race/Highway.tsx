import { Car, type CarSpec } from "./Car";
import { useHydrated } from "@/lib/use-hydrated";
import { useEffect, useMemo, useRef } from "react";
import { PHASE_MS, type RacePhase } from "@/lib/round-engine";
import {
  DIVIDER_U,
  EDGE_PCT,
  LANE_U,
  Z_FAR,
  Z_NEAR,
  laneWidthAt,
  scaleAt,
  xAt,
  yAt,
} from "@/lib/track-geometry";

interface Props {
  cars: [CarSpec, CarSpec, CarSpec];
  phase: RacePhase;
  /** live progress 0..1 per lane, mutated each frame outside React for 60fps */
  progressRef: { current: [number, number, number] };
  winnerLane: number | null;
  hyperMode: boolean;
  countdown: number;
  /** lane the player has money on, so they can follow it at a glance */
  myLane?: number | null;
  /** seconds elapsed inside the current phase, for VFX timing */
  phaseElapsedRef?: { current: number };
}

/* ---- dash geometry (world units along z) ---- */
const DASHES = 16;
const DASH_PERIOD = 0.9;
const DASH_LEN = 0.34;
const DASH_SPAN = DASHES * DASH_PERIOD;

/* ---- car depth model ---- */
const Z_CAR_NEAR = 1.5; // trailing car, closest to the lens
const CAR_SPREAD = 2.0; // how much depth the leader gains
const BASE_CAR = 150; // px width the <Car/> svg is authored at

export function Highway({
  cars,
  phase,
  progressRef,
  winnerLane,
  hyperMode,
  countdown,
  myLane = null,
}: Props) {
  const hydrated = useHydrated();
  const racing = phase === "launch" || phase === "race";
  const staging = phase === "prep" || phase === "lock";

  const stageRef = useRef<HTMLDivElement | null>(null);
  const cameraRef = useRef<HTMLDivElement | null>(null);
  const flashRef = useRef<HTMLDivElement | null>(null);
  const warpRef = useRef<HTMLDivElement | null>(null);
  const laneRefs = useRef<Array<HTMLDivElement | null>>([null, null, null]);
  const bodyRefs = useRef<Array<HTMLDivElement | null>>([null, null, null]);
  const posRefs = useRef<Array<HTMLDivElement | null>>([null, null, null]);
  const dashRefs = useRef<Array<HTMLSpanElement | null>>([]);

  const zCar = useRef<[number, number, number]>([Z_CAR_NEAR, Z_CAR_NEAR, Z_CAR_NEAR]);
  const zVel = useRef<[number, number, number]>([0, 0, 0]);
  const lastP = useRef<[number, number, number]>([0, 0, 0]);
  const speedS = useRef<[number, number, number]>([0, 0, 0]);
  const shownPos = useRef<[number, number, number]>([0, 0, 0]);
  const flow = useRef(0); // accumulated road scroll, in world z units
  const flowSpeed = useRef(0);
  const camShake = useRef(0);
  const camPunch = useRef(0);

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const racingRef = useRef(racing);
  racingRef.current = racing;
  const prevPhase = useRef(phase);

  /* ---------------- one rAF loop drives the whole scene ---------------- */
  useEffect(() => {
    if (!hydrated) return;
    let raf = 0;
    let prev = performance.now();
    let acc = 0;
    const STEP = 1 / 120; // fixed physics step → identical motion on 60/120Hz

    const loop = (ts: number) => {
      let dt = (ts - prev) / 1000;
      prev = ts;
      if (!Number.isFinite(dt) || dt <= 0) dt = 0.016;
      dt = Math.min(0.1, dt);
      acc += dt;

      const stage = stageRef.current;
      const w = stage?.clientWidth ?? 360;
      const h = stage?.clientHeight ?? 300;
      const ph = phaseRef.current;
      const live = racingRef.current;
      const p = progressRef.current;
      const trailer = Math.min(p[0], p[1], p[2]);

      /* phase impulses → cinematic camera */
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

      /* per-lane smoothed speed (progress units / second) */
      let fastest = 0;
      for (let i = 0; i < 3; i++) {
        const raw = Math.max(0, (p[i] - lastP.current[i]) / dt);
        lastP.current[i] = p[i];
        speedS.current[i] += (raw - speedS.current[i]) * Math.min(1, dt * 9);
        fastest = Math.max(fastest, speedS.current[i]);
      }

      /* critically damped depth springs — no overshoot, no teleporting */
      let steps = 0;
      while (acc >= STEP && steps < 8) {
        acc -= STEP;
        steps++;
        const omega = 9;
        for (let i = 0; i < 3; i++) {
          const gap = Math.max(0, p[i] - trailer);
          const target = Math.min(5.2, Z_CAR_NEAR + Math.sqrt(gap) * CAR_SPREAD);
          const x = zCar.current[i] - target;
          const a = -omega * omega * x - 2 * omega * zVel.current[i];
          zVel.current[i] += a * STEP;
          zCar.current[i] += zVel.current[i] * STEP;
        }
        camShake.current = Math.max(0, camShake.current - STEP * 1.7);
        camPunch.current *= 1 - STEP * 3.4;
      }

      /* ---- cars: x / y / scale all derived from the same projection ---- */
      for (let i = 0; i < 3; i++) {
        const z = Math.max(Z_CAR_NEAR, Math.min(6, zCar.current[i]));
        const s = scaleAt(z);
        const carW = laneWidthAt(z, w) * 0.94;
        const k = carW / BASE_CAR;
        const x = xAt(LANE_U[i], z, w);
        const y = yAt(z, h); // tyres land exactly on the projected tarmac

        const el = laneRefs.current[i];
        if (el) {
          el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${k.toFixed(4)})`;
          el.style.zIndex = String(30 - Math.round((z - Z_CAR_NEAR) * 6));
          el.style.opacity = (1 - (1 - s) * 0.22).toFixed(3);
        }

        /* suspension: launch squat, braking dive, high-speed jitter */
        const bodyEl = bodyRefs.current[i];
        if (bodyEl) {
          const throttleI = Math.min(1, speedS.current[i] * 2.6);
          const pitch = ph === "launch" ? 4.2 : ph === "finish" ? -2.6 : -throttleI * 1.3;
          const jitter = live ? Math.sin(ts * 0.06 + i * 2.1) * 0.5 * throttleI : 0;
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

      /* ---- road markings: spawn at the horizon, sweep to the camera ---- */
      const targetFlow = live ? 2.2 + Math.min(fastest, 0.35) * 42 : 0;
      flowSpeed.current += (targetFlow - flowSpeed.current) * Math.min(1, dt * 3.2);
      flow.current = (flow.current + flowSpeed.current * dt) % DASH_SPAN;

      for (let d = 0; d < DIVIDER_U.length; d++) {
        for (let i = 0; i < DASHES; i++) {
          const el = dashRefs.current[d * DASHES + i];
          if (!el) continue;
          let z = Z_NEAR + (((i * DASH_PERIOD - flow.current) % DASH_SPAN) + DASH_SPAN) % DASH_SPAN;
          if (z > Z_FAR) {
            el.style.opacity = "0";
            continue;
          }
          const zBack = z + DASH_LEN;
          const yFront = yAt(z, h);
          const yBack = yAt(zBack, h);
          const s = scaleAt(z + DASH_LEN * 0.5);
          const wpx = Math.max(1, 0.016 * w * s);
          const hpx = Math.max(1, yFront - yBack);
          const x = xAt(DIVIDER_U[d], z + DASH_LEN * 0.5, w);
          el.style.transform = `translate3d(${(x - wpx / 2).toFixed(2)}px, ${yBack.toFixed(2)}px, 0) scale(${(wpx / 10).toFixed(4)}, ${(hpx / 10).toFixed(4)})`;
          // fade in as it emerges from the vanishing point
          el.style.opacity = Math.min(1, (Z_FAR - z) / (Z_FAR * 0.45)).toFixed(3);
        }
      }

      /* ---- cinematic camera: shake + FOV punch ---- */
      const cam = cameraRef.current;
      if (cam) {
        const sh = camShake.current;
        const sx = sh * Math.sin(ts * 0.075) * 5;
        const sy = sh * Math.cos(ts * 0.098) * 3.4;
        const rot = sh * Math.sin(ts * 0.045) * 0.5;
        const punch = 1 + camPunch.current * 0.07 + Math.min(fastest, 0.4) * 0.03;
        cam.style.transform = `translate3d(${sx.toFixed(2)}px, ${sy.toFixed(2)}px, 0) scale(${punch.toFixed(4)}) rotate(${rot.toFixed(3)}deg)`;
      }

      /* ---- speed streaks track the real car speed ---- */
      const warp = warpRef.current;
      if (warp) {
        const intensity = Math.min(1, fastest * 3.2);
        warp.style.opacity = intensity.toFixed(3);
        warp.style.setProperty("--warp-speed", `${(0.62 - intensity * 0.4).toFixed(3)}s`);
      }

      /* ---- launch flash decay ---- */
      const fl = flashRef.current;
      if (fl) {
        const cur = parseFloat(fl.style.opacity || "0");
        if (cur > 0.001) fl.style.opacity = (cur * (1 - dt * 6)).toFixed(4);
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [hydrated, progressRef]);

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
    phase === "launch" ? 1 : phase === "race" ? 0.85 : phase === "finish" ? 0.06 : 0.02;

  // F1 start lights: 5 lights arm across `prep`, all out at lights-out.
  const prepSecs = PHASE_MS.prep / 1000;
  const litCount = staging
    ? phase === "lock"
      ? 5
      : Math.min(5, Math.max(0, Math.ceil(((prepSecs - countdown) / prepSecs) * 5)))
    : 0;

  const roadClip = `polygon(${EDGE_PCT.topLeft}% ${EDGE_PCT.horizonPct}%, ${EDGE_PCT.topRight}% ${EDGE_PCT.horizonPct}%, ${EDGE_PCT.bottomRight}% 100%, ${EDGE_PCT.bottomLeft}% 100%)`;

  return (
    <div ref={stageRef} className="relative w-full h-full overflow-hidden bg-[#04060c]">
      <div ref={cameraRef} className="absolute inset-0 gpu origin-center">
        {/* ---------- Night sky + vanishing point ---------- */}
        <div
          className="absolute inset-x-0 top-0"
          style={{
            height: `${EDGE_PCT.horizonPct + 4}%`,
            background:
              "radial-gradient(120% 90% at 50% 100%, oklch(0.34 0.15 300 / 0.55), transparent 70%), linear-gradient(180deg,#05060d 0%, #0a0a18 60%, #100d22 100%)",
          }}
        />

        {/* skyline blocks */}
        <div className="absolute inset-x-0 top-[8%] h-[32%] opacity-70">
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

        {/* horizon haze */}
        <div
          className="absolute inset-x-0"
          style={{
            top: `${EDGE_PCT.horizonPct - 6}%`,
            height: "12%",
            background:
              "linear-gradient(180deg, transparent, oklch(0.55 0.2 320 / 0.28), transparent)",
          }}
        />

        {/* finish gantry, sized to the road at the horizon */}
        <div
          className="absolute -translate-x-1/2 h-1.5 rounded-sm bg-[#0d1220] border border-white/10 flex items-center justify-around"
          style={{
            left: "50%",
            top: `${EDGE_PCT.horizonPct - 2.2}%`,
            width: `${(EDGE_PCT.topRight - EDGE_PCT.topLeft) * 2.6}%`,
          }}
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1 h-1 rounded-full"
              style={{
                background: "#26ff9a",
                boxShadow: "0 0 8px #26ff9a",
                opacity: phase === "finish" ? 1 : 0.55,
              }}
            />
          ))}
        </div>

        {/* ---------- Road: one perspective plane ---------- */}
        <div className="absolute inset-0 overflow-hidden">
          {/* tarmac */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg,#0a0e18 0%, #12141f 35%, #191c29 75%, #1d202e 100%)",
              clipPath: roadClip,
            }}
          />
          {/* distance light bloom on the tarmac */}
          <div
            className="absolute inset-0 mix-blend-screen opacity-45"
            style={{
              background: `radial-gradient(70% 55% at 50% ${EDGE_PCT.horizonPct}%, oklch(0.62 0.2 300 / 0.4), transparent 70%)`,
              clipPath: roadClip,
            }}
          />
          {/* wet-asphalt neon reflections */}
          <div
            className="absolute inset-0 opacity-35 mix-blend-screen"
            style={{
              background:
                "linear-gradient(90deg, #b14bff33 0%, transparent 22%, transparent 78%, #35e6ff33 100%)",
              clipPath: roadClip,
            }}
          />
          {/* asphalt grain */}
          <div
            className="absolute inset-0 opacity-[0.1] pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(circle, #ffffff 0.4px, transparent 0.9px)",
              backgroundSize: "4px 4px",
              clipPath: roadClip,
            }}
          />

          {/* neon edge rails — same vanishing point as the tarmac */}
          <div
            className="absolute inset-0"
            style={{
              clipPath: `polygon(${EDGE_PCT.topLeft - 0.35}% ${EDGE_PCT.horizonPct}%, ${EDGE_PCT.topLeft + 0.35}% ${EDGE_PCT.horizonPct}%, ${EDGE_PCT.bottomLeft + 2.4}% 100%, ${EDGE_PCT.bottomLeft - 2.4}% 100%)`,
              background: "linear-gradient(180deg, transparent, #b14bff)",
              filter: "blur(0.4px) drop-shadow(0 0 10px #b14bffaa)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              clipPath: `polygon(${EDGE_PCT.topRight - 0.35}% ${EDGE_PCT.horizonPct}%, ${EDGE_PCT.topRight + 0.35}% ${EDGE_PCT.horizonPct}%, ${EDGE_PCT.bottomRight + 2.4}% 100%, ${EDGE_PCT.bottomRight - 2.4}% 100%)`,
              background: "linear-gradient(180deg, transparent, #35e6ff)",
              filter: "blur(0.4px) drop-shadow(0 0 10px #35e6ffaa)",
            }}
          />

          {/* lane dividers — every dash is projected in the render loop */}
          {DIVIDER_U.map((_, d) => (
            <div key={d} className="absolute inset-0 pointer-events-none">
              {Array.from({ length: DASHES }).map((__, i) => (
                <span
                  key={i}
                  ref={(el) => {
                    dashRefs.current[d * DASHES + i] = el;
                  }}
                  className="absolute left-0 top-0 block gpu rounded-[1px]"
                  style={{
                    width: 10,
                    height: 10,
                    transformOrigin: "0 0",
                    background: "rgba(255,255,255,0.92)",
                    boxShadow: "0 0 6px rgba(255,255,255,0.35)",
                    opacity: 0,
                  }}
                />
              ))}
            </div>
          ))}
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
              className="absolute left-0 top-0 z-20 gpu"
              style={{ transformOrigin: "0 0" }}
            >
              <div style={{ transform: "translate(-50%, -100%)" }}>
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
                      {Array.from({ length: 6 }).map((__, s) => (
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

                  {/* contact shadow + road light bounce */}
                  <div
                    className="pointer-events-none absolute left-1/2 -translate-x-1/2 -bottom-1 rounded-[50%]"
                    style={{
                      width: BASE_CAR * 0.78,
                      height: BASE_CAR * 0.13,
                      background:
                        "radial-gradient(closest-side, rgba(0,0,0,0.75), rgba(0,0,0,0.28) 62%, transparent 100%)",
                      filter: "blur(2px)",
                    }}
                  />
                  <div
                    className="pointer-events-none absolute left-1/2 -translate-x-1/2 -bottom-2 rounded-[50%] mix-blend-screen"
                    style={{
                      width: BASE_CAR * 0.6,
                      height: BASE_CAR * 0.1,
                      background: `radial-gradient(closest-side, ${car.color}55, transparent 100%)`,
                      filter: "blur(5px)",
                    }}
                  />

                  <Car
                    spec={car}
                    size={BASE_CAR}
                    throttle={throttle}
                    braking={phase === "prep" || phase === "lock" || phase === "finish"}
                    glow={isWinner || (car.kind === "hyper" && hyperMode)}
                  />
                </div>

                {myLane === i && !isWinner && (
                  <div
                    className="absolute -top-8 left-1/2 -translate-x-1/2 rounded-full px-1.5 py-[1px] font-display text-[7.5px] tracking-[0.2em] whitespace-nowrap"
                    style={{
                      background: "rgba(0,0,0,0.55)",
                      color: car.color,
                      boxShadow: `0 0 0 1px ${car.color}66`,
                    }}
                  >
                    YOUR BET
                  </div>
                )}
                {isWinner && (
                  <div className="absolute -top-9 left-1/2 -translate-x-1/2 font-display text-[10px] tracking-[0.3em] text-[#ffd66b] text-neon whitespace-nowrap">
                    WINNER
                  </div>
                )}
              </div>
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
          opacity: 0.7,
        }}
      />
    </div>
  );
}
