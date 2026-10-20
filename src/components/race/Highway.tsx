import { Car, type CarSpec } from "./Car";
import {
  BASE_CAR,
  CAR_SPREAD,
  DASHES,
  DASH_LEN,
  DASH_PERIOD,
  DASH_SPAN,
  KERB_COUNT,
  KERB_SEG_LEN,
  SEAM_COUNT,
  SEAM_PERIOD,
  Z_CAR_NEAR,
} from "./highway-constants";
import { useHydrated } from "@/lib/use-hydrated";
import { useEffect, useMemo, useRef } from "react";
import { PHASE_MS, type RacePhase } from "@/lib/round-engine";
import { playShiftBackfire } from "@/lib/sound";
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
  /** freeze highway flow and movement when internet connection drops */
  paused?: boolean;
}

export function Highway({
  cars,
  phase,
  progressRef,
  winnerLane,
  hyperMode,
  countdown,
  myLane = null,
  paused = false,
}: Props) {
  const hydrated = useHydrated();
  const racing = phase === "launch" || phase === "race";
  const staging = phase === "prep" || phase === "lock";

  const stageRef = useRef<HTMLDivElement | null>(null);
  const cameraRef = useRef<HTMLDivElement | null>(null);
  const flashRef = useRef<HTMLDivElement | null>(null);
  const laneRefs = useRef<Array<HTMLDivElement | null>>([null, null, null]);
  const bodyRefs = useRef<Array<HTMLDivElement | null>>([null, null, null]);
  const posRefs = useRef<Array<HTMLDivElement | null>>([null, null, null]);
  const flameRefs = useRef<Array<HTMLDivElement | null>>([null, null, null]);
  const slipRefs = useRef<Array<HTMLDivElement | null>>([null, null, null]);
  const dashRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const seamRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const kerbLeftRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const kerbRightRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const roadGrainRef = useRef<HTMLDivElement | null>(null);

  const zCar = useRef<[number, number, number]>([Z_CAR_NEAR, Z_CAR_NEAR, Z_CAR_NEAR]);
  const zVel = useRef<[number, number, number]>([0, 0, 0]);
  const lastP = useRef<[number, number, number]>([0, 0, 0]);
  const speedS = useRef<[number, number, number]>([0, 0, 0]);
  const shownPos = useRef<[number, number, number]>([0, 0, 0]);
  const currentGear = useRef<[number, number, number]>([1, 1, 1]);
  const flameUntil = useRef<[number, number, number]>([0, 0, 0]);
  const pitchKick = useRef<[number, number, number]>([0, 0, 0]);
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
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  /* ---------------- one rAF loop drives the whole scene ---------------- */
  useEffect(() => {
    if (!hydrated) return;
    let raf = 0;
    let prev = performance.now();
    let acc = 0;
    const STEP = 1 / 120; // fixed physics step -> identical motion on 60/120Hz

    const loop = (ts: number) => {
      if (pausedRef.current) {
        flowSpeed.current = 0;
        prev = ts;
        raf = requestAnimationFrame(loop);
        return;
      }

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

      /* phase impulses -> cinematic camera */
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
          (Math.cos(tSec * 0.9 + i * 2.3) * 0.9 * 0.65 +
            Math.cos(tSec * 2.17 + i * 5.1) * 2.17 * 0.35);

        const x = xAt(LANE_U[i] + sway, z, w);
        const y = yAt(z, h); // tyres land exactly on the projected tarmac

        const el = laneRefs.current[i];
        if (el) {
          el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${k.toFixed(4)})`;
          el.style.zIndex = String(30 - Math.round((z - Z_CAR_NEAR) * 6));
          el.style.opacity = "1";
          /* wheels spin at the car's real speed, not a React snapshot */
          const rolling = speedS.current[i] > 0.004;
          const dur = Math.max(0.055, 0.5 - throttleI * 0.44);
          el.style.setProperty("--wheel-dur", `${dur.toFixed(3)}s`);
          el.style.setProperty("--hub-dur", `${(dur * 1.6).toFixed(3)}s`);
          el.style.setProperty("--wheel-play", rolling ? "running" : "paused");
        }

        /* gear progression & shift dynamics */
        const curP = p[i];
        let targetGear = 1;
        if (curP >= 0.84) targetGear = 7;
        else if (curP >= 0.66) targetGear = 6;
        else if (curP >= 0.48) targetGear = 5;
        else if (curP >= 0.32) targetGear = 4;
        else if (curP >= 0.18) targetGear = 3;
        else if (curP >= 0.08) targetGear = 2;

        if (live && targetGear > currentGear.current[i]) {
          currentGear.current[i] = targetGear;
          flameUntil.current[i] = ts + 150;
          pitchKick.current[i] = 1.0;
          playShiftBackfire();
        }
        pitchKick.current[i] = Math.max(0, pitchKick.current[i] - dt * 7.5);

        // Update backfire flame visibility
        const flameEl = flameRefs.current[i];
        if (flameEl) {
          flameEl.style.opacity = ts < flameUntil.current[i] ? "1" : "0";
        }

        // Update aerodynamic slipstream wake ribbons
        const slipEl = slipRefs.current[i];
        if (slipEl) {
          const aeroAlpha = live
            ? Math.min(0.85, Math.max(0, (speedS.current[i] - 0.04) * 4.8))
            : 0;
          slipEl.style.opacity = aeroAlpha.toFixed(3);
        }

        /* suspension: subtle body roll, gear-shift pitch jolt & micro-vibration */
        const bodyEl = bodyRefs.current[i];
        if (bodyEl) {
          const squat = ph === "launch" ? 1.4 : ph === "finish" ? -0.4 : 0;
          const shiftJolt = -pitchKick.current[i] * 2.2;
          const jitter = live ? Math.sin(ts * 0.06 + i * 2.1) * 0.35 * throttleI : 0;
          const roll = -swayVel * 14; // subtle lean into the direction of the weave
          bodyEl.style.transform =
            `translate3d(${jitter.toFixed(2)}px, ${(squat + shiftJolt).toFixed(2)}px, 0)` +
            ` rotate(${roll.toFixed(2)}deg)`;
        }

        const rank = [0, 1, 2].sort((a, b) => p[b] - p[a]).indexOf(i) + 1;
        const badge = posRefs.current[i];
        if (badge) {
          if (ph === "race" || ph === "finish") {
            badge.style.opacity = "1";
            if (rank === 1) {
              badge.textContent = `P1 · LEADER`;
              badge.style.color = "#ffd66b";
            } else {
              const leadLane = [0, 1, 2].sort((a, b) => p[b] - p[a])[0];
              const gapP = Math.max(0, p[leadLane] - p[i]);
              const gapSec = (gapP * 8.6).toFixed(2);
              badge.textContent = `P${rank} · +${gapSec}s`;
              badge.style.color = rank === 2 ? "#d7e2f5" : "#8b97ad";
            }
          } else {
            badge.style.opacity = "0";
          }
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
      for (let i = 0; i < SEAM_COUNT; i++) {
        const seamEl = seamRefs.current[i];
        if (!seamEl) continue;
        const z =
          Z_NEAR + ((((i * SEAM_PERIOD - flow.current) % DASH_SPAN) + DASH_SPAN) % DASH_SPAN);
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
          const z =
            Z_NEAR + ((((i * DASH_PERIOD - flow.current) % DASH_SPAN) + DASH_SPAN) % DASH_SPAN);
          if (z > Z_FAR) {
            el.style.opacity = "0";
            continue;
          }
          const zBack = Math.min(z + DASH_LEN, Z_FAR);
          const yFront = yAt(z, h);
          const yBack = yAt(zBack, h);
          const wNear = Math.max(0.8, 0.016 * w * scaleAt(z));
          const wFar = Math.max(0.4, 0.016 * w * scaleAt(zBack));
          const xNear = xAt(DIVIDER_U[d], z, w);
          const xFar = xAt(DIVIDER_U[d], zBack, w);
          el.style.clipPath =
            `polygon(${(xFar - wFar / 2).toFixed(2)}px ${yBack.toFixed(2)}px,` +
            ` ${(xFar + wFar / 2).toFixed(2)}px ${yBack.toFixed(2)}px,` +
            ` ${(xNear + wNear / 2).toFixed(2)}px ${yFront.toFixed(2)}px,` +
            ` ${(xNear - wNear / 2).toFixed(2)}px ${yFront.toFixed(2)}px)`;
          el.style.opacity = Math.min(1, (Z_FAR - z) / (Z_FAR * 0.45)).toFixed(3);
        }
      }

      /* ---- FIA alternating red/white kerb rumble strips ---- */
      for (let i = 0; i < KERB_COUNT; i++) {
        const z =
          Z_NEAR + ((((i * KERB_SEG_LEN - flow.current) % DASH_SPAN) + DASH_SPAN) % DASH_SPAN);
        const zBack = Math.min(z + KERB_SEG_LEN * 0.5, Z_FAR);
        const isFar = z > Z_FAR;

        // Left kerb (-1.04 to -0.96)
        const leftEl = kerbLeftRefs.current[i];
        if (leftEl) {
          if (isFar) {
            leftEl.style.opacity = "0";
          } else {
            const yNear = yAt(z, h);
            const yFar = yAt(zBack, h);
            const xInnerNear = xAt(-0.95, z, w);
            const xOuterNear = xAt(-1.03, z, w);
            const xInnerFar = xAt(-0.95, zBack, w);
            const xOuterFar = xAt(-1.03, zBack, w);
            leftEl.style.clipPath =
              `polygon(${xOuterFar.toFixed(2)}px ${yFar.toFixed(2)}px,` +
              ` ${xInnerFar.toFixed(2)}px ${yFar.toFixed(2)}px,` +
              ` ${xInnerNear.toFixed(2)}px ${yNear.toFixed(2)}px,` +
              ` ${xOuterNear.toFixed(2)}px ${yNear.toFixed(2)}px)`;
            leftEl.style.opacity = Math.min(0.85, (Z_FAR - z) / (Z_FAR * 0.4)).toFixed(3);
          }
        }

        // Right kerb (+0.96 to +1.04)
        const rightEl = kerbRightRefs.current[i];
        if (rightEl) {
          if (isFar) {
            rightEl.style.opacity = "0";
          } else {
            const yNear = yAt(z, h);
            const yFar = yAt(zBack, h);
            const xInnerNear = xAt(0.95, z, w);
            const xOuterNear = xAt(1.03, z, w);
            const xInnerFar = xAt(0.95, zBack, w);
            const xOuterFar = xAt(1.03, zBack, w);
            rightEl.style.clipPath =
              `polygon(${xInnerFar.toFixed(2)}px ${yFar.toFixed(2)}px,` +
              ` ${xOuterFar.toFixed(2)}px ${yFar.toFixed(2)}px,` +
              ` ${xOuterNear.toFixed(2)}px ${yNear.toFixed(2)}px,` +
              ` ${xInnerNear.toFixed(2)}px ${yNear.toFixed(2)}px)`;
            rightEl.style.opacity = Math.min(0.85, (Z_FAR - z) / (Z_FAR * 0.4)).toFixed(3);
          }
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

        {/* ---------- Road: solid authentic textured asphalt perspective plane ---------- */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Outer concrete roadbed / gravel verge */}
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(180deg, #0b0d14 0%, #151922 40%, #1e2330 100%)",
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
            {Array.from({ length: SEAM_COUNT }).map((_, i) => (
              <span
                key={i}
                ref={(el) => {
                  seamRefs.current[i] = el;
                }}
                className="absolute inset-0 block"
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
                  className="absolute inset-0 block"
                  style={{
                    background: "rgba(255,255,255,0.92)",
                    filter: "drop-shadow(0 0 5px rgba(255,255,255,0.35))",
                    opacity: 0,
                  }}
                />
              ))}
            </div>
          ))}

          {/* FIA Red & White Track Kerbs (Left & Right Track Limit Rumble Strips) */}
          <div className="absolute inset-0 pointer-events-none">
            {Array.from({ length: KERB_COUNT }).map((_, i) => (
              <span
                key={i}
                ref={(el) => {
                  kerbLeftRefs.current[i] = el;
                }}
                className="absolute inset-0 block pointer-events-none"
                style={{
                  background:
                    i % 2 === 0
                      ? "linear-gradient(90deg, #d81b30, #ff3b53)"
                      : "linear-gradient(90deg, #dce4f2, #ffffff)",
                  opacity: 0,
                  filter: "drop-shadow(0 0 4px rgba(255,45,63,0.35))",
                }}
              />
            ))}
            {Array.from({ length: KERB_COUNT }).map((_, i) => (
              <span
                key={i}
                ref={(el) => {
                  kerbRightRefs.current[i] = el;
                }}
                className="absolute inset-0 block pointer-events-none"
                style={{
                  background:
                    i % 2 === 0
                      ? "linear-gradient(90deg, #ff3b53, #d81b30)"
                      : "linear-gradient(90deg, #ffffff, #dce4f2)",
                  opacity: 0,
                  filter: "drop-shadow(0 0 4px rgba(255,45,63,0.35))",
                }}
              />
            ))}
          </div>
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
              {/* Anchor at horizontal center (-50%) and exact tyre-tarmac contact plane (-97.4%) */}
              <div style={{ transform: "translate(-50%, -97.4%)" }}>
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
                  style={{ transformOrigin: "50% 97.4%" }}
                >
                  {/* launch tyre smoke — localized at left & right rear tyres */}
                  {phase === "launch" && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-[2.2%] h-4">
                      {Array.from({ length: 4 }).map((__, s) => (
                        <span
                          key={s}
                          className="absolute bottom-0 rounded-full bg-white/25 blur-[2px]"
                          style={{
                            left: `${s < 2 ? 4 + s * 4 : 84 + (s - 2) * 4}%`,
                            width: 11,
                            height: 7,
                            animation: `tyre-smoke ${0.5 + s * 0.05}s ease-out ${s * 0.04}s both`,
                          }}
                        />
                      ))}
                    </div>
                  )}

                  {/* Tightly localized tyre-road contact patches + recessed under-chassis AO */}
                  {/* Left rear tyre contact shadow */}
                  <span
                    className="pointer-events-none absolute rounded-full"
                    style={{
                      left: "1.6%",
                      bottom: "1.8%",
                      width: "13.2%",
                      height: "3.4%",
                      background:
                        "radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.82) 55%, rgba(0,0,0,0) 100%)",
                    }}
                  />
                  {/* Right rear tyre contact shadow */}
                  <span
                    className="pointer-events-none absolute rounded-full"
                    style={{
                      right: "1.6%",
                      bottom: "1.8%",
                      width: "13.2%",
                      height: "3.4%",
                      background:
                        "radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.82) 55%, rgba(0,0,0,0) 100%)",
                    }}
                  />
                  {/* Subtle recessed ambient occlusion directly beneath the rear diffuser */}
                  <span
                    className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full"
                    style={{
                      bottom: "2.4%",
                      width: "76%",
                      height: "4.6%",
                      background:
                        "radial-gradient(ellipse at 50% 40%, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.55) 60%, rgba(0,0,0,0) 100%)",
                    }}
                  />

                  {/* Hero Car SVG: pure vector body with localized taillight LED accents */}
                  <Car
                    spec={car}
                    size={BASE_CAR}
                    throttle={throttle}
                    braking={staging || phase === "finish"}
                    glow={isWinner || myLane === i}
                  />

                  {/* Aerodynamic slipstream wake ribbons peeling off the rear flanks at speed */}
                  <div
                    ref={(el) => {
                      slipRefs.current[i] = el;
                    }}
                    className="pointer-events-none absolute inset-x-[-12%] top-[18%] bottom-[16%] opacity-0 transition-opacity duration-150"
                  >
                    {/* Left slipstream ribbon */}
                    <span
                      className="absolute left-0 top-0 bottom-0 w-[18%]"
                      style={{
                        background: `linear-gradient(180deg, transparent 0%, ${car.color}44 45%, transparent 100%)`,
                        filter: "blur(2px)",
                        transform: "skewY(-12deg)",
                      }}
                    />
                    {/* Right slipstream ribbon */}
                    <span
                      className="absolute right-0 top-0 bottom-0 w-[18%]"
                      style={{
                        background: `linear-gradient(180deg, transparent 0%, ${car.color}44 45%, transparent 100%)`,
                        filter: "blur(2px)",
                        transform: "skewY(12deg)",
                      }}
                    />
                  </div>

                  {/* Exhaust backfire flame tongues on upshift */}
                  <div
                    ref={(el) => {
                      flameRefs.current[i] = el;
                    }}
                    className="pointer-events-none absolute inset-x-0 bottom-0 opacity-0 transition-opacity duration-75"
                  >
                    {/* Left exhaust burst */}
                    <span
                      className="absolute rounded-full"
                      style={{
                        left: "17%",
                        bottom: "16%",
                        width: 14,
                        height: 14,
                        background:
                          "radial-gradient(circle, #ffffff 0%, #35e6ff 45%, #0066ff 75%, transparent 100%)",
                        boxShadow: "0 0 12px #35e6ff",
                        animation: "backfire-pop 0.14s ease-out infinite",
                      }}
                    />
                    {/* Right exhaust burst */}
                    <span
                      className="absolute rounded-full"
                      style={{
                        right: "17%",
                        bottom: "16%",
                        width: 14,
                        height: 14,
                        background:
                          "radial-gradient(circle, #ffffff 0%, #35e6ff 45%, #0066ff 75%, transparent 100%)",
                        boxShadow: "0 0 12px #35e6ff",
                        animation: "backfire-pop 0.14s ease-out infinite 0.02s",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* ---------- Launch impulse flash ---------- */}
        <div
          ref={flashRef}
          className="pointer-events-none absolute inset-0 bg-white opacity-0 transition-opacity duration-150 mix-blend-screen"
        />

        {/* Hyper-mode gold halo */}
        {hyperMode && (
          <div
            className="pointer-events-none absolute inset-0 animate-pulse"
            style={{
              background:
                "radial-gradient(ellipse at 50% 60%, rgba(255,214,107,0.18) 0%, transparent 65%)",
            }}
          />
        )}
      </div>
    </div>
  );
}
