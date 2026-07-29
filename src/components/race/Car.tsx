import { memo } from "react";

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
  racing?: boolean;
  glow?: boolean;
  reflection?: boolean;
}

function shade(hex: string, amt: number) {
  const h = hex.replace("#", "");
  const n = parseInt(
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h,
    16,
  );
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

/**
 * Rear 3/4 view sports car — the camera sits behind the grid, like the reference.
 * Pure SVG, scales with `size`.
 */
export const Car = memo(function Car({
  spec,
  size = 150,
  racing = false,
  glow = false,
  reflection = true,
}: Props) {
  const isHyper = spec.kind === "hyper";
  const isSmall = spec.kind === "small";
  const w = size * (isSmall ? 0.78 : isHyper ? 1.05 : 1);
  const h = w * 0.72;
  const c = spec.color;
  const light = shade(c, isHyper ? 46 : 58);
  const dark = shade(c, -78);
  const uid = spec.id;

  return (
    <div
      className="relative"
      style={{
        width: w,
        height: h * 1.34,
        filter: glow
          ? `drop-shadow(0 0 18px ${c}) drop-shadow(0 0 42px ${c}66)`
          : `drop-shadow(0 10px 16px rgba(0,0,0,0.65))`,
      }}
    >
      <svg viewBox="0 0 200 190" width={w} height={h * 1.34} style={{ display: "block" }}>
        <defs>
          <linearGradient id={`paint-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={light} />
            <stop offset="0.42" stopColor={c} />
            <stop offset="1" stopColor={dark} />
          </linearGradient>
          <linearGradient id={`side-${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={dark} />
            <stop offset="0.5" stopColor={c} />
            <stop offset="1" stopColor={dark} />
          </linearGradient>
          <linearGradient id={`glass2-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0d1520" />
            <stop offset="0.55" stopColor="#243347" />
            <stop offset="1" stopColor="#070b12" />
          </linearGradient>
          <linearGradient id={`tail-${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#ff2b3b" stopOpacity="0.35" />
            <stop offset="0.5" stopColor="#ff6b6b" />
            <stop offset="1" stopColor="#ff2b3b" stopOpacity="0.35" />
          </linearGradient>
          <radialGradient id={`floor-${uid}`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ff2b3b" stopOpacity={racing ? 0.55 : 0.3} />
            <stop offset="1" stopColor="#ff2b3b" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`refl-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={c} stopOpacity="0.3" />
            <stop offset="1" stopColor={c} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* ground contact shadow */}
        <ellipse cx="100" cy="152" rx="82" ry="12" fill="#000" opacity="0.55" />
        {/* taillight bloom on tarmac */}
        <ellipse cx="100" cy="160" rx="86" ry="22" fill={`url(#floor-${uid})`} />

        {/* rear tyres */}
        <path d="M14 96 q-6 22 2 44 h26 q-6-24 -2-46 z" fill="#08090c" />
        <path d="M186 96 q6 22 -2 44 h-26 q6-24 2-46 z" fill="#08090c" />
        <rect x="18" y="112" width="18" height="20" rx="4" fill="#15181f" />
        <rect x="164" y="112" width="18" height="20" rx="4" fill="#15181f" />

        {/* main body — wide rear haunches */}
        <path
          d={
            isSmall
              ? "M44 68 q10-24 56-24 t56 24 l10 44 q4 22 -6 30 l-14 6 h-92 l-14-6 q-10-8 -6-30 z"
              : isHyper
                ? "M22 62 q14-32 78-32 t78 32 l12 54 q4 24 -10 30 l-18 6 h-124 l-18-6 q-14-6 -10-30 z"
                : "M28 64 q14-30 72-30 t72 30 l11 50 q4 23 -8 30 l-17 6 h-116 l-17-6 q-12-7 -8-30 z"
          }
          fill={`url(#paint-${uid})`}
        />
        {/* body side shading */}
        <path
          d="M28 100 l144 0 l6 22 q2 16 -10 20 l-136 0 q-12-4 -10-20 z"
          fill={`url(#side-${uid})`}
          opacity="0.55"
        />

        {/* roof / rear window */}
        <path
          d={
            isSmall
              ? "M66 58 q34-16 68 0 l6 26 q-40-10 -80 0 z"
              : "M56 56 q44-20 88 0 l7 28 q-51-13 -102 0 z"
          }
          fill={`url(#glass2-${uid})`}
        />
        {/* window highlight */}
        <path d="M62 60 q40-16 76 0 l2 6 q-40-14 -80 0 z" fill="#8fd4ff" opacity="0.18" />

        {/* spoiler */}
        {isSmall ? null : (
          <>
            <rect x={isHyper ? 20 : 30} y="86" width={isHyper ? 160 : 140} height="8" rx="4" fill="#0c0e13" />
            <rect x={isHyper ? 26 : 36} y="88" width={isHyper ? 148 : 128} height="3" rx="1.5" fill={isHyper ? "#ffd66b" : light} opacity="0.6" />
            <rect x={isHyper ? 34 : 42} y="92" width="8" height="14" rx="2" fill="#0c0e13" />
            <rect x={isHyper ? 158 : 150} y="92" width="8" height="14" rx="2" fill="#0c0e13" />
          </>
        )}

        {/* full-width light bar */}
        <rect
          x="36"
          y="112"
          width="128"
          height="9"
          rx="4.5"
          fill={`url(#tail-${uid})`}
          opacity={racing ? 1 : 0.85}
        />
        <rect x="36" y="112" width="128" height="9" rx="4.5" fill="#ff2b3b" opacity={racing ? 0.75 : 0.35} />
        {/* light bar bloom */}
        <rect
          x="26"
          y="108"
          width="148"
          height="18"
          rx="9"
          fill="#ff2b3b"
          opacity={racing ? 0.28 : 0.14}
          style={{ filter: "blur(6px)" }}
        />

        {/* bumper / diffuser */}
        <path d="M34 130 h132 q6 8 0 12 h-132 q-6-4 0-12 z" fill="#0b0d12" />
        <rect x="60" y="134" width="80" height="5" rx="2" fill="#000" opacity="0.7" />
        {/* exhausts */}
        <circle cx="52" cy="137" r="4" fill="#1b1f27" />
        <circle cx="148" cy="137" r="4" fill="#1b1f27" />

        {/* plate */}
        <rect x="86" y="124" width="28" height="9" rx="2" fill="#e9edf5" opacity="0.75" />

        {/* underglow for hyper */}
        {isHyper && <ellipse cx="100" cy="150" rx="80" ry="8" fill="#ffd66b" opacity="0.4" />}

        {/* wet-road reflection */}
        {reflection && (
          <g transform="translate(0,318) scale(1,-1)" opacity="0.22">
            <path
              d="M28 64 q14-30 72-30 t72 30 l11 50 q4 23 -8 30 l-17 6 h-116 l-17-6 q-12-7 -8-30 z"
              fill={`url(#refl-${uid})`}
            />
          </g>
        )}
      </svg>

      {/* exhaust heat haze while racing */}
      {racing && (
        <>
          <span
            className="absolute rounded-full"
            style={{
              left: "24%",
              bottom: 4,
              width: 10,
              height: 10,
              background: isHyper
                ? "radial-gradient(circle,#ffd66b,#ff5b1f 55%,transparent 70%)"
                : "radial-gradient(circle,#fff,#8ad9ff 55%,transparent 70%)",
              animation: "exhaust 0.55s ease-out infinite",
            }}
          />
          <span
            className="absolute rounded-full"
            style={{
              right: "24%",
              bottom: 4,
              width: 10,
              height: 10,
              background: isHyper
                ? "radial-gradient(circle,#ffd66b,#ff5b1f 55%,transparent 70%)"
                : "radial-gradient(circle,#fff,#8ad9ff 55%,transparent 70%)",
              animation: "exhaust 0.55s ease-out infinite 0.25s",
            }}
          />
        </>
      )}
    </div>
  );
});
