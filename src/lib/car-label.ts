import type { CarSpec } from "@/components/race/Car";

/**
 * A car is always identified by its colour first — the class ("compact",
 * "hypercar") is secondary information, never a replacement for the colour.
 */
export function carLabel(car: CarSpec): string {
  return car.kind === "hyper" ? "BLACK" : car.colorName.toUpperCase();
}

export function carClassTag(car: CarSpec): string | null {
  if (car.kind === "hyper") return "HYPER";
  if (car.kind === "small") return "COMPACT";
  return null;
}

export function formatINR(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}
