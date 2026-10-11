import { memo, useMemo } from "react";
import rawSvg from "./gt-car-raw.svg?raw";

export type CarKind = "normal" | "small" | "hyper";

export interface CarSpec {
  id: string;
  color: string; // hex
  colorName: string;
  kind: CarKind;
  multiplier: number;
}

interface Props {
  spec: CarSpec;
  size?: number; // width in px
  /** 0 = idle, 1 = flat out. Drives exhaust and light intensity. */
  throttle?: number;
  /** brake lights burn bright on launch prep + finish */
  braking?: boolean;
  glow?: boolean;
  reflection?: boolean;
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "").trim();
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return [249, 11, 10];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
        break;
    }
    h /= 6;
  }
  return [h * 360, s, l];
}

function hslToRgb(hDeg: number, s: number, l: number): [number, number, number] {
  const h = (((hDeg % 360) + 360) % 360) / 360;
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, h) * 255);
  const b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);
  return [
    Math.max(0, Math.min(255, r)),
    Math.max(0, Math.min(255, g)),
    Math.max(0, Math.min(255, b)),
  ];
}

/**
 * Remaps the exact user-provided GT car SVG (`gt-car-raw.svg`) without changing a single
 * path coordinate or shape — only shifting the red paint palette (`rgb(r,g,b)` where r > g+12)
 * to match the car's assigned team color and unique gradient IDs per instance.
 */
function buildColoredCarSvg(uid: string, targetHex: string, isHyper: boolean): string {
  // Unique gradient IDs per car instance so multiple cars on screen never collide
  const withScopedGradients = rawSvg
    .replace(/id="gGradient(\d+)"/g, `id="gGradient$1-${uid}"`)
    .replace(/url\(#gGradient(\d+)\)/g, `url(#gGradient$1-${uid})`);

  const [tr, tg, tb] = parseHex(isHyper ? "#f5b82e" : targetHex);
  const [targetH, targetS] = rgbToHsl(tr, tg, tb);

  // If the car is red (and not hyper), keep original red colors untouched
  const isRed = !isHyper && (targetH < 18 || targetH > 345) && targetS > 0.6;
  if (isRed) {
    return withScopedGradients;
  }

  return withScopedGradients.replace(
    /rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g,
    (match, rStr, gStr, bStr) => {
      const r = Number(rStr);
      const g = Number(gStr);
      const b = Number(bStr);

      // Neutral greys, blacks, chrome, tyres, and glass stay untouched
      if (r - Math.max(g, b) < 10) {
        return match;
      }

      const [, s, l] = rgbToHsl(r, g, b);
      const newS = Math.min(1, s * (isHyper ? 0.92 : Math.max(0.78, targetS)));
      const newL = isHyper ? Math.min(0.92, l * 1.06) : l;
      const [nr, ng, nb] = hslToRgb(targetH, newS, newL);
      return `rgb(${nr},${ng},${nb})`;
    }
  );
}

export const Car = memo(function Car({
  spec,
  size = 150,
  throttle = 0,
  braking = false,
  glow = false,
}: Props) {
  const isHyper = spec.kind === "hyper";
  const isSmall = spec.kind === "small";
  const w = size * (isSmall ? 0.88 : isHyper ? 1.06 : 1);
  // Exact aspect ratio of viewBox="0 258.7 2048 1501.3"
  const h = w * (1501.3 / 2048);

  const uid = spec.id.replace(/[^a-zA-Z0-9_-]/g, "");
  const specGlow = isHyper ? "#ffd66b" : spec.color;
  const t = Math.max(0, Math.min(1, throttle));

  const svgMarkup = useMemo(() => {
    const colored = buildColoredCarSvg(uid, spec.color, isHyper);
    return colored.replace(
      "<svg ",
      `<svg width="100%" height="100%" style="display:block;width:100%;height:100%;" `
    );
  }, [uid, spec.color, isHyper]);

  return (
    <div
      className="relative select-none"
      style={{
        width: w,
        height: h,
        filter: glow
          ? `drop-shadow(0 0 16px ${specGlow}) drop-shadow(0 0 36px ${specGlow}66)`
          : braking
            ? `drop-shadow(0 0 14px rgba(255,30,48,0.65)) drop-shadow(0 10px 16px rgba(0,0,0,0.82))`
            : `drop-shadow(0 10px 16px rgba(0,0,0,0.82))`,
      }}
    >
      <div
        className="w-full h-full"
        dangerouslySetInnerHTML={{ __html: svgMarkup }}
      />

      {/* Active exhaust flame bloom at high throttle */}
      {t > 0.14 && (
        <>
          <span
            className="pointer-events-none absolute rounded-full"
            style={{
              left: "16.5%",
              bottom: "15.5%",
              width: 8 + t * 6,
              height: 8 + t * 6,
              background: isHyper
                ? "radial-gradient(circle,#ffd66b,#ff5b1f 55%,transparent 72%)"
                : "radial-gradient(circle,#ffffff,#5ce1ff 55%,transparent 72%)",
              filter: "blur(1px)",
              animation: `exhaust ${0.64 - t * 0.3}s ease-out infinite`,
            }}
          />
          <span
            className="pointer-events-none absolute rounded-full"
            style={{
              right: "16.5%",
              bottom: "15.5%",
              width: 8 + t * 6,
              height: 8 + t * 6,
              background: isHyper
                ? "radial-gradient(circle,#ffd66b,#ff5b1f 55%,transparent 72%)"
                : "radial-gradient(circle,#ffffff,#5ce1ff 55%,transparent 72%)",
              filter: "blur(1px)",
              animation: `exhaust ${0.64 - t * 0.3}s ease-out infinite ${(0.64 - t * 0.3) / 2}s`,
            }}
          />
        </>
      )}
    </div>
  );
});
