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
const Z_CAR_NEAR = 1.46; // trailing car, closest to the lens
const CAR_SPREAD = 2.05; // how much depth the leader gains
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
  const seamRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const roadGrainRef = useRef<HTMLDivElement | null>(null);

  const zCar = useRef<[number, number, number]>([Z_CAR_NEAR, Z_CAR_NEAR, Z_CAR_NEAR]);
  const zVel = useRef<[number, number, number]>([0, 0, 0]);
  const lastP = useRef<[number, number, number]>([0, 0, 0]);
  const speedS = useRef<[number, number, number]>([0, 0, 0]);
  const shownPos = useRef<[number, number, number]>([0, 0, 0]);
  const flow = useRef(0); // accumulated road scroll, in world z units
  const grainOffset = useRef(0); // continuous pixel scroll for surface texture
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
        const carW = laneWidthAt(z, w) * 0.88;
        const k = carW / BASE_CAR;

        const throttleI = Math.min(1, speedS.current[i] * 2.6);
        /* the driver never holds a perfect line: a slow weave inside the lane */
        const tSec = ts / 1000;
        const sway =
          throttleI *
          0.072 *
          (Math.sin(tSec * 0.9 + i * 2.3) * 0.65 + Math.sin(tSec * 2.17 + i * 5.1) * 0.35);
        const swayVel =
          throttleI *
          0.072 *
          (Math.cos(tSec * 0.9 + i * 2.3) * 0.9 * 0.65 + Math.cos(tSec * 2.17 + i * 5.1) * 2.17 * 0.35);

        const x = xAt(LANE_U[i] + sway, z, w);
        const y = yAt(z, h); // tyres land exactly on the projected tarmac

        const el = laneRefs.current[i];
        if (el) {
          el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${k.toFixed(4)})`;
          el.style.zIndex = String(30 - Math.round((z - Z_CAR_NEAR) * 6));
          el.style.opacity = (1 - (1 - s) * 0.22).toFixed(3);
          /* wheels spin at the car's real speed, not a React snapshot */
          const rolling = speedS.current[i] > 0.004;
          const dur = Math.max(0.055, 0.5 - throttleI * 0.44);
          el.style.setProperty("--wheel-dur", `${dur.toFixed(3)}s`);
          el.style.setProperty("--hub-dur", `${(dur * 1.6).toFixed(3)}s`);
          el.style.setProperty("--wheel-play", rolling ? "running" : "paused");
        }

        /* suspension: launch squat, braking dive, high-speed jitter, body roll */
        const bodyEl = bodyRefs.current[i];
        if (bodyEl) {
          const pitch = ph === "launch" ? 4.2 : ph === "finish" ? -2.6 : -throttleI * 1.3;
          const jitter = live ? Math.sin(ts * 0.06 + i * 2.1) * 0.5 * throttleI : 0;
          const roll = -swayVel * 26; // lean into the direction of the weave
          bodyEl.style.transform =
            `translate3d(${jitter.toFixed(2)}px, ${(pitch * 0.4).toFixed(2)}px, 0)` +
            ` rotate(${(pitch * 0.1 + roll).toFixed(2)}deg)`;
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

      /* ---- road markings & solid tarmac surface scroll ---- */
      const targetFlow = live ? 2.2 + Math.min(fastest, 0.35) * 42 : 0;
      flowSpeed.current += (targetFlow - flowSpeed.current) * Math.min(1, dt * 3.2);
      flow.current = (flow.current + flowSpeed.current * dt) % DASH_SPAN;
      grainOffset.current = (grainOffset.current + flowSpeed.current * dt * 28) % 64;

      if (roadGrainRef.current) {
        roadGrainRef.current.style.backgroundPosition = `0px ${grainOffset.current.toFixed(1)}px, 0px ${(grainOffset.current * 1.5).toFixed(1)}px`;
      }

      // Project lateral tarmac expansion joints / concrete slab seams across the road width
      const SEAM_COUNT = 8;
      const SEAM_PERIOD = DASH_SPAN / SEAM_COUNT;
      for (let i = 0; i < SEAM_COUNT; i++) {
        const seamEl = seamRefs.current[i];
        if (!seamEl) continue;
        let z = Z_NEAR + (((i * SEAM_PERIOD - flow.current) % DASH_SPAN) + DASH_SPAN) % DASH_SPAN;
        if (z > Z_FAR) {
          seamEl.style.opacity = "0";
          continue;
        }
        const zBack = Math.min(z + 0.055, Z_FAR);
        const yFront = yAt(z, h);
        const yBack = yAt(zBack, h);
        const xLeftNear = xAt(-0.98, z, w);
        const xRightNear = xAt(0.98, z, w);
        const xLeftFar = xAt(-0.98, zBack, w);
        const xRightFar = xAt(0.98, zBack, w);
        seamEl.style.clipPath =
          `polygon(${xLeftFar.toFixed(2)}px ${yBack.toFixed(2)}px,` +
          ` ${xRightFar.toFixed(2)}px ${yBack.toFixed(2)}px,` +
          ` ${xRightNear.toFixed(2)}px ${yFront.toFixed(2)}px,` +
          ` ${xLeftNear.toFixed(2)}px ${yFront.toFixed(2)}px)`;
        seamEl.style.opacity = (Math.min(1, (Z_FAR - z) / (Z_FAR * 0.4)) * 0.45).toFixed(3);
      }

      for (let d = 0; d < DIVIDER_U.length; d++) {
        for (let i = 0; i < DASHES; i++) {
          const el = dashRefs.current[d * DASHES + i];
          if (!el) continue;
          let z = Z_NEAR + (((i * DASH_PERIOD - flow.current) % DASH_SPAN) + DASH_SPAN) % DASH_SPAN;
          if (z > Z_FAR) {
            el.style.opacity = "0";
            continue;
          }
          const zBack = Math.min(z + DASH_LEN, Z_FAR);
          const yFront = yAt(z, h);
          const yBack = yAt(zBack, h);
          // a dash is a trapezoid: narrower + converged at its far end,
          // wider at the end nearest the camera — never a straight stick.
          const wNear = Math.max(0.8, 0.016 * w * scaleAt(z));
          const wFar = Math.max(0.4, 0.016 * w * scaleAt(zBack));
          const xNear = xAt(DIVIDER_U[d], z, w);
          const xFar = xAt(DIVIDER_U[d], zBack, w);
          el.style.clipPath =
            `polygon(${(xFar - wFar / 2).toFixed(2)}px ${yBack.toFixed(2)}px,` +
            ` ${(xFar + wFar / 2).toFixed(2)}px ${yBack.toFixed(2)}px,` +
            ` ${(xNear + wNear / 2).toFixed(2)}px ${yFront.toFixed(2)}px,` +
            ` ${(xNear - wNear / 2).toFixed(2)}px ${yFront.toFixed(2)}px)`;
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

        {/* ---------- Road: solid textured asphalt perspective plane ---------- */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Outer concrete roadbed / gravel verge */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, #0b0d14 0%, #151922 40%, #1e2330 100%)",
              clipPath: `polygon(${EDGE_PCT.topLeft - 1.2}% ${EDGE_PCT.horizonPct}%, ${EDGE_PCT.topRight + 1.2}% ${EDGE_PCT.horizonPct}%, ${EDGE_PCT.bottomRight + 8}% 100%, ${EDGE_PCT.bottomLeft - 8}% 100%)`,
            }}
          />

          {/* Heavy solid tarmac base coat with crown shading */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, #12151e 0%, #1b202c 28%, #232938 68%, #282f40 100%)",
              clipPath: roadClip,
            }}
          />

          {/* Lateral road crown & 3-lane worn tyre rubber grooves */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, " +
                "#11141d 0%, " +
                "#262d3d 7%, " +
                "#181c26 14%, #252b3b 19%, #181c26 24%, " +
                "#2c3345 33.3%, " +
                "#181c26 42%, #262c3c 50%, #181c26 58%, " +
                "#2c3345 66.6%, " +
                "#181c26 76%, #252b3b 81%, #181c26 86%, " +
                "#262d3d 93%, " +
                "#11141d 100%)",
              opacity: 0.88,
              clipPath: roadClip,
            }}
          />

          {/* SVG procedural coarse stone & bitumen aggregate texture */}
          <svg className="absolute w-0 h-0 pointer-events-none" aria-hidden="true">
            <defs>
              <filter id="asphalt-aggregate" x="0%" y="0%" width="100%" height="100%">
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency="0.65 0.95"
                  numOctaves="3"
                  seed="19"
                  result="noise"
                />
                <feColorMatrix
                  type="matrix"
                  values="0.35 0 0 0 0.14
                          0.35 0 0 0 0.16
                          0.40 0 0 0 0.21
                          0    0 0 0.52 0"
                />
              </filter>
            </defs>
          </svg>
          <div
            className="absolute inset-0 pointer-events-none mix-blend-overlay"
            style={{
              filter: "url(#asphalt-aggregate)",
              clipPath: roadClip,
            }}
          />

          {/* Scrolling micro-aggregate & mineral speckle matrix */}
          <div
            ref={roadGrainRef}
            className="absolute inset-0 pointer-events-none opacity-45"
            style={{
              backgroundImage:
                "radial-gradient(circle at 2px 3px, rgba(255,255,255,0.22) 0.75px, transparent 1.2px), " +
                "radial-gradient(circle at 6px 7px, rgba(8,10,16,0.65) 1px, transparent 1.6px)",
              backgroundSize: "8px 12px, 11px 16px",
              clipPath: roadClip,
            }}
          />

          {/* Scrolling lateral tarmac expansion seams / paving joints */}
          <div className="absolute inset-0 pointer-events-none">
            {Array.from({ length: 8 }).map((_, i) => (
              <span
                key={i}
                ref={(el) => {
                  seamRefs.current[i] = el;
                }}
                className="absolute inset-0 block gpu"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(8,10,16,0.85) 0%, rgba(160,175,205,0.18) 100%)",
                  opacity: 0,
                }}
              />
            ))}
          </div>

          {/* Solid painted shoulder boundary lines (inner track limits) */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              clipPath: `polygon(${EDGE_PCT.topLeft + 0.25}% ${EDGE_PCT.horizonPct}%, ${EDGE_PCT.topLeft + 0.55}% ${EDGE_PCT.horizonPct}%, ${EDGE_PCT.bottomLeft + 4.8}% 100%, ${EDGE_PCT.bottomLeft + 3.2}% 100%)`,
              background: "linear-gradient(180deg, rgba(255,255,255,0.25), rgba(240,246,255,0.82))",
            }}
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              clipPath: `polygon(${EDGE_PCT.topRight - 0.55}% ${EDGE_PCT.horizonPct}%, ${EDGE_PCT.topRight - 0.25}% ${EDGE_PCT.horizonPct}%, ${EDGE_PCT.bottomRight - 3.2}% 100%, ${EDGE_PCT.bottomRight - 4.8}% 100%)`,
              background: "linear-gradient(180deg, rgba(255,255,255,0.25), rgba(240,246,255,0.82))",
            }}
          />

          {/* Subtle distance horizon blend so the solid road meets the gantry cleanly */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(180deg, #0b0e18 ${EDGE_PCT.horizonPct}%, transparent ${EDGE_PCT.horizonPct + 11}%)`,
              clipPath: roadClip,
            }}
          />

          {/* Neon outer barrier rails — same vanishing point as the tarmac */}
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
                  className="absolute inset-0 block gpu"
                  style={{
                    background: "rgba(255,255,255,0.92)",
                    filter: "drop-shadow(0 0 5px rgba(255,255,255,0.35))",
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
              {/* Anchor at horizontal center (-50%) and exact tyre-tarmac contact line (-97.3%) */}
              <div style={{ transform: "translate(-50%, -97.3%)" }}>
                <div
                  ref={(el) => {
                    posRefs.current[i] = el;
                  }}
                  className="absolute -top-2.5 left-1/2 -translate-x-1/2 font-display text-[10px] tracking-[0.2em] opacity-0 transition-opacity drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]"
                />
                <div
                  ref={(el) => {
                    bodyRefs.current[i] = el;
                  }}
                  className="gpu relative flex items-center justify-center"
                >
                  {/* launch tyre smoke */}
                  {phase === "launch" && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6">
                      {Array.from({ length: 6 }).map((__, s) => (
                        <span
                          key={s}
                          className="absolute bottom-0 rounded-full bg-white/45 blur-[3px]"
                          style={{
                            left: `${s < 3 ? 6 + s * 4 : 74 + (s - 3) * 4}%`,
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
                    className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-[0%] rounded-[50%]"
                    style={{
                      width: BASE_CAR * 0.94,
                      height: BASE_CAR * 0.12,
                      background:
                        "radial-gradient(closest-side, rgba(0,0,0,0.86), rgba(0,0,0,0.34) 64%, transparent 100%)",
                      filter: "blur(2px)",
                    }}
                  />
                  <div
                    className="pointer-events-none absolute left-1/2 -translate-x-1/2 -bottom-[2%] rounded-[50%] mix-blend-screen"
                    style={{
                      width: BASE_CAR * 0.76,
                      height: BASE_CAR * 0.1,
                      background: `radial-gradient(closest-side, ${car.color}66, transparent 100%)`,
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
                    className="absolute -top-7 left-1/2 -translate-x-1/2 rounded-full px-1.5 py-[1px] font-display text-[7.5px] tracking-[0.2em] whitespace-nowrap"
                    style={{
                      background: "rgba(4,6,12,0.78)",
                      color: car.color,
                      boxShadow: `0 0 0 1px ${car.color}88, 0 4px 10px rgba(0,0,0,0.6)`,
                    }}
                  >
                    YOUR BET
                  </div>
                )}
                {isWinner && (
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 font-display text-[10px] tracking-[0.3em] text-[#ffd66b] text-neon whitespace-nowrap">
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
