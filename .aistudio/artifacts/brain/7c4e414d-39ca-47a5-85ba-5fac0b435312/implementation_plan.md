# Motorsport Physics, Slingshot Pacing & Broadcast Telemetry Upgrade

Deliver a high-adrenaline, studio-grade racing simulation experience inside the Apex stage by introducing multi-lead-change slingshot pace curves, physical gear-shift chassis impulses with twin-exhaust backfire pops, peripheral FIA track kerbs and slipstream trails, and a live motorsport broadcast HUD with real-time speed, gear, and interval gap telemetry.

## User Review & Critical Decisions

> [!IMPORTANT]
> Review the confirmed physics and presentation upgrades below before we apply the changes to the race engine and highway renderer.

- **Confirmed Decision 1 — Race Pacing Style**: Photo-finish slingshot curves engineered to produce 2–3 dramatic lead changes per round while strictly converging on the provably fair server-committed finishing order `[P1, P2, P3]`.
- **Confirmed Decision 2 — Physics & Sensory Dopamine**: Gear-shift exhaust backfire pops with chassis pitch jolts, plus high-speed camera FOV pull, scrolling red/white FIA track kerbs, and aerodynamic slipstream ribbons.
- **Confirmed Decision 3 — Stage Telemetry**: Full motorsport broadcast HUD displaying live speed (`KM/H`), current gear (`1–7`), and real-time interval gaps (`+0.00s` / `LEADER`) on the cars and stage.

---

## 1. Overview & Core Concept

- **What It Does**: Transforms the 3-lane highway stage from a smooth linear interpolation into a visceral, physics-driven GT telemetry broadcast where cars battle wheel-to-wheel, trade the lead through slipstream slingshots, pop blue/gold flames on upshifts, and cross the line in tight photo finishes.
- **Target Audience / Persona**: Mobile-first prediction players watching 21-second live rounds inside the 394px Apex shell who crave high-craft visual spectacle, readable race tension, and clear feedback on their chosen car's momentum.
- **Key Value**: Maximizes anticipation and perceived fairness during the 11-second active race window (`launch` + `race`) without altering the underlying cryptographic commit-reveal outcome.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Staging & Rev-Up (`prep` / `lock`)**: As the 5 red F1 start lights arm, cars exhibit subtle engine idle micro-vibration (`idle-vibe`) and brake-light glow while the broadcast telemetry bar initializes in `GRID LOCK` / `LAUNCH CONTROL` mode.
  2. **Lights-Out Launch (`launch`)**: All 5 lights extinguish with a camera FOV punch, rear suspension squat (`+1.6px` pitch), localized twin-tyre smoke bursts, and rapid 1st-to-3rd gear upshifts.
  3. **Mid-Race Slingshot Battle (`race`)**:
     - Cars exchange the lead 2–3 times via counter-phased draft waves (`early leader`, `mid-race charger`, `final slingshot`).
     - At deterministic RPM shift thresholds, each car triggers a sharp chassis pitch jolt and twin-exhaust backfire flame pop.
     - Whenever a car is drafting or surging past a rival, translucent neon slipstream ribbons trail off its rear wing while red-and-white FIA apex kerbs blur past the track shoulders.
  4. **Final Stretch & Photo Finish (`race` > 82% → `finish`)**:
     - Camera pulls into a subtle high-speed tunnel-vision vignette and FOV zoom focused toward the battle at the front.
     - Live interval badges above each car update in real time (`LEADER` in `#ffd66b` gold, `+0.04s`, `+0.11s` in tabular monospace) until the winner crosses the finish gantry.
- **Visual Identity & Theme**:
  - _Aesthetic Direction_: FIA GT Night Broadcast meets high-precision dark telemetry (`#04060c` obsidian canvas, crisp tabular numerals, zero decorative clutter).
  - _Color Palette & Mood_: Deep asphalt (`#12151e`–`#282f40`), alternating crimson/white track kerbs (`#ff2d3f` / `#f0f6ff`), electric cyan speed cues (`--neon-cyan`), and gold leader accents (`#ffd66b`).
  - _Typography & Hierarchy_: `Orbitron` (`--font-display`) with `tabular-nums` for speed, gear, and interval deltas; `Inter` (`--font-body`) for clean labels.
  - _Component Styling & Layout_: Preserves the 394px shared mobile shell and pinhole perspective geometry (`src/lib/track-geometry.ts`) so every kerb, dash, and car tire lands accurately on the projected tarmac plane.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Counter-Phased Slingshot Curve Formulation**
  - _Chosen Approach_: Upgrade `outcomeFromReveal` in `src/lib/round-engine.ts` so the 3 lanes use orthogonal multi-harmonic overtake waves (`sin(2πt)` + `sin(3πt)`) weighted by role (`P1` late slingshot or mid-pack duel, `P2` early/mid leader that gets caught at `t ≈ 0.82–0.92`, `P3` early challenger) that smoothly blend ($w = t^4$) onto the exact deterministic podium margins at $t = 1.0$.
  - _Why_: Eliminates "procession races" where one car leads from start to finish, creating 2–3 genuine lead swaps every round while remaining 100% deterministic, isomorphic, and provably fair.
  - _Alternatives Considered_: Random frame-by-frame client noise (rejected because every client device must see the exact same race choreography).
- **Decision 2: Compositor-Driven 120Hz Physics & DOM Ref Mutators**
  - _Chosen Approach_: Drive all new telemetry readouts (speedo `KM/H`, `GEAR`, per-car `+0.00s` gap intervals, kerb projection, and gear-shift backfire triggers) inside the existing `requestAnimationFrame` loop in `Highway.tsx` via direct DOM refs (`textContent` and `transform: translate3d(...)`).
  - _Why_: Guarantees zero React re-renders during the 60/120fps race loop and keeps mobile battery/GPU performance smooth.

---

## 4. Technical Architecture & Data Strategy _(Technical Reference)_

- **Architecture & Component Diagram**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Deterministic Round Engine (Isomorphic)               │
│  outcomeFromReveal(reveal, roundId)                                     │
│   ├─ Multi-Harmonic Slingshot Curves (2-3 lead changes, t^4 finish lock)│
│   └─ Deterministic Final Time Gaps (P1: 0.00s, P2: +0.02..0.09s)        │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │ progressRef.current [p0, p1, p2]
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                 Highway 120Hz Physics & Projection Loop                 │
│  ├─ Critically Damped Depth Springs (zCar, zVel) + Overtake Surge Boost │
│  ├─ Gear-Shift Detector (RPM thresholds → chassis pitch + exhaust pop)  │
│  ├─ Pinhole Track Projector (Asphalt Seams + Red/White Shoulder Kerbs)  │
│  └─ Dynamic Camera Rig (FOV speed pull, overtake shake, finish zoom)    │
└─────────┬─────────────────────────┬───────────────────────────┬─────────┘
          │                         │                           │
          ▼                         ▼                           ▼
┌───────────────────┐   ┌───────────────────────┐   ┌─────────────────────┐
│   Hero Car Rig    │   │  Track & Aero Layer   │   │  Broadcast HUD Bar  │
│ • Suspension Roll │   │ • FIA Shoulder Kerbs  │   │ • Live KM/H Speedo  │
│ • Shift Backfire  │   │ • Slipstream Ribbons  │   │ • Gear (1-7) & RPM  │
│ • P1 / +0.04s Tag │   │ • Speed Warp Streaks  │   │ • Lead Car & Gap    │
└───────────────────┘   └───────────────────────┘   └─────────────────────┘
```

- **Data Model & State**:
  - **Slingshot Pace Curves (`round-engine.ts`)**: Parameterized per-lane progress functions $p_i(t) \in [0, 1]$ with guaranteed boundary conditions $p_i(0) = 0$ and $p_i(1) = \text{margin}_i$, plus coupled counter-harmonic waves ensuring lead cross-overs at $t \in [0.25, 0.55]$ and $t \in [0.65, 0.88]$.
  - **Physics & Shift State (`Highway.tsx`)**:
    - `gearRef`: Tracks current gear (`1..7`) per lane based on normalized race progress and velocity; increments trigger a `180ms` backfire impulse (`shiftPopRef`) and suspension pitch kick.
    - `kerbRefs`: Pre-allocated pool of projected red/white shoulder kerb segments along left (`u = -0.96`) and right (`u = +0.96`) track limits.
    - `hudSpeedRef`, `hudGearRef`, `hudRpmRef`, `hudGapRef`: Direct DOM refs updating the compact broadcast telemetry bar at the bottom of the stage without triggering React state updates.
- **Interactive Component & State Mapping**:
  - **Car Badges (`posRefs` & `gapRefs`)**: Dynamically updates each car's floating telemetry tag during `race` and `finish` phases to show position (`P1`, `P2`, `P3`) alongside live time-delta intervals (`LEADER`, `+0.03s`, `+0.09s`) and highlights the player's staked car (`YOUR BET`).
  - **Car Component (`Car.tsx`)**: Adds a dedicated high-intensity afterburner/backfire plume element (`data-backfire`) controlled smoothly from the physics loop during gear shifts and overtake surges.
