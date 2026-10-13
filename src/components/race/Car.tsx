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
 * path coordinate or shape — shifting the body paint palette to the team color and
 * harmonizing the dark rubber tyres/wheels (`#1c212e`..`#323a4f`) so they blend naturally
 * with the slate-grey asphalt road surface.
 */
function tintNeutralToRoad(r: number, g: number, b: number): string {
  const lum = (r + g + b) / 3;
  // Lift pure blacks (0..45) into the road's slate-asphalt palette (#1b202c .. #363e52)
  // while keeping bright chrome/Exhaust/glass highlights intact
  if (lum <= 65) {
    const t = lum / 65; // 0 .. 1
    const nr = Math.round(28 + t * 38); // 28 .. 66
    const ng = Math.round(33 + t * 44); // 33 .. 77
    const nb = Math.round(46 + t * 56); // 46 .. 102
    return `rgb(${nr},${ng},${nb})`;
  }
  return `rgb(${r},${g},${b})`;
}

function buildColoredCarSvg(uid: string, targetHex: string, isHyper: boolean): string {
  // Unique gradient IDs per car instance so multiple cars on screen never collide
  const withScopedGradients = rawSvg
    .replace(/id="gGradient(\d+)"/g, `id="gGradient$1-${uid}"`)
    .replace(/url\(#gGradient(\d+)\)/g, `url(#gGradient$1-${uid})`);

  const [tr, tg, tb] = parseHex(isHyper ? "#f5b82e" : targetHex);
  const [targetH, targetS] = rgbToHsl(tr, tg, tb);
  const isRed = !isHyper && (targetH < 18 || targetH > 345) && targetS > 0.6;

  return withScopedGradients.replace(
    /rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g,
    (match, rStr, gStr, bStr) => {
      const r = Number(rStr);
      const g = Number(gStr);
      const b = Number(bStr);

      // Neutral greys, blacks, tyres, and trim: blend dark rubber tones into the grey road palette
      if (r - Math.max(g, b) < 10) {
        return tintNeutralToRoad(r, g, b);
      }

      if (isRed) {
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
  const accentColor = isHyper ? "#ffd66b" : spec.color;
  const t = Math.max(0, Math.min(1, throttle));

  const svgMarkup = useMemo(() => {
    const colored = buildColoredCarSvg(uid, spec.color, isHyper);
    return colored.replace(
      "<svg ",
      `<svg width="100%" height="100%" style="display:block;width:100%;height:100%;" `
    );
  }, [uid, spec.color, isHyper]);

  // Taillight intensity scales smoothly and stays strictly inside the rear taillight housings
  const tailOpacity = glow ? 0.9 : braking ? 0.78 : 0.25 + t * 0.35;
  const tailColor = glow
    ? accentColor
    : braking
      ? "#ff1e38"
      : accentColor;

  return (
    <div
      className="relative select-none"
      style={{
        width: w,
        height: h,
      }}
    >
      {/* Crisp, unblurred SVG body — no container-level drop-shadow or halo */}
      <div
        className="w-full h-full"
        dangerouslySetInnerHTML={{ __html: svgMarkup }}
      />

      {/* Localized rear taillight LED bar accents (strictly inside the left & right lamp housings) */}
      <span
        className="pointer-events-none absolute rounded-full transition-opacity duration-200"
        style={{
          left: "12.2%",
          top: "41.8%",
          width: "13.5%",
          height: "3.2%",
          opacity: tailOpacity,
          background: `radial-gradient(ellipse at center, #ffffff 0%, ${tailColor} 52%, transparent 100%)`,
          boxShadow: glow || braking ? `0 0 5px ${tailColor}` : "none",
        }}
      />
      <span
        className="pointer-events-none absolute rounded-full transition-opacity duration-200"
        style={{
          right: "12.2%",
          top: "41.8%",
          width: "13.5%",
          height: "3.2%",
          opacity: tailOpacity,
          background: `radial-gradient(ellipse at center, #ffffff 0%, ${tailColor} 52%, transparent 100%)`,
          boxShadow: glow || braking ? `0 0 5px ${tailColor}` : "none",
        }}
      />

      {/* Restrained central diffuser rain-light accent when braking or winning */}
      {(braking || glow) && (
        <span
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-sm transition-opacity duration-200"
          style={{
            bottom: "15.2%",
            width: "3.6%",
            height: "2.2%",
            opacity: glow ? 0.92 : 0.75,
            background: glow ? "#ffd66b" : "#ff2438",
            boxShadow: glow ? "0 0 4px #ffd66b" : "0 0 4px #ff2438",
          }}
        />
      )}

      {/* Tightly localized twin exhaust tips at high throttle */}
      {t > 0.14 && (
        <>
          <span
            className="pointer-events-none absolute rounded-full"
            style={{
              left: "19.2%",
              bottom: "17.6%",
              width: 4 + t * 3.5,
              height: 4 + t * 3.5,
              background: isHyper
                ? "radial-gradient(circle, #fffbe6 0%, #ff9d2e 55%, transparent 75%)"
                : "radial-gradient(circle, #ffffff 0%, #5ce1ff 55%, transparent 75%)",
              animation: `exhaust ${0.64 - t * 0.3}s ease-out infinite`,
            }}
          />
          <span
            className="pointer-events-none absolute rounded-full"
            style={{
              right: "19.2%",
              bottom: "17.6%",
              width: 4 + t * 3.5,
              height: 4 + t * 3.5,
              background: isHyper
                ? "radial-gradient(circle, #fffbe6 0%, #ff9d2e 55%, transparent 75%)"
                : "radial-gradient(circle, #ffffff 0%, #5ce1ff 55%, transparent 75%)",
              animation: `exhaust ${0.64 - t * 0.3}s ease-out infinite ${(0.64 - t * 0.3) / 2}s`,
            }}
          />
        </>
      )}
    </div>
  );
});
