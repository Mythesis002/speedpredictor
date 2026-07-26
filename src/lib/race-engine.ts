import type { CarSpec, CarKind } from "@/components/race/Car";

export type RacePhase =
  | "waiting"
  | "prep"
  | "lock"
  | "launch"
  | "race"
  | "finish";

export const COLORS: { name: string; hex: string }[] = [
  { name: "Red", hex: "#ff3b4d" },
  { name: "Green", hex: "#3bff97" },
  { name: "Blue", hex: "#3b8bff" },
  { name: "Purple", hex: "#a24bff" },
  { name: "Orange", hex: "#ff8a2a" },
  { name: "Yellow", hex: "#ffd83a" },
  { name: "White", hex: "#f0f4ff" },
  { name: "Silver", hex: "#c9d1dc" },
];

let idCounter = 0;
const nid = () => `c${++idCounter}`;

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function makeCarSpec(kind?: CarKind): CarSpec {
  const roll = Math.random();
  const k: CarKind = kind ?? (roll < 0.03 ? "hyper" : roll < 0.15 ? "small" : "normal");
  if (k === "hyper") {
    return {
      id: nid(),
      color: "#0b0b10",
      colorName: "Black",
      kind: "hyper",
      multiplier: 5,
    };
  }
  if (k === "small") {
    const c = pick(COLORS);
    return {
      id: nid(),
      color: c.hex,
      colorName: c.name,
      kind: "small",
      multiplier: 0.5,
    };
  }
  const c = pick(COLORS);
  return {
    id: nid(),
    color: c.hex,
    colorName: c.name,
    kind: "normal",
    multiplier: 1.5,
  };
}

export function makeRaceLineup(): [CarSpec, CarSpec, CarSpec] {
  // Ensure at most one hyper per race for drama
  const cars: CarSpec[] = [];
  let hasHyper = false;
  while (cars.length < 3) {
    const c = makeCarSpec();
    if (c.kind === "hyper") {
      if (hasHyper) continue;
      hasHyper = true;
    }
    // avoid same colorName for two normals to reduce repetition
    if (cars.some((x) => x.colorName === c.colorName && c.kind !== "hyper")) continue;
    cars.push(c);
  }
  return cars as [CarSpec, CarSpec, CarSpec];
}

/** Non-linear acceleration curve per lane; returns 0..1 progress at time t (0..1). */
export function accelCurve(seed: number) {
  // parameters vary the shape
  const power = 1.4 + (seed % 100) / 100; // 1.4..2.4
  const wobble = ((seed >> 3) % 30) / 300; // small mid-race variation
  return (t: number) => {
    const base = Math.pow(t, 1 / power); // ease-out-ish
    const mid = Math.sin(t * Math.PI) * wobble;
    return Math.max(0, Math.min(1, base + mid));
  };
}
