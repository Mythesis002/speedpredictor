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
  /** 0 = idle, 1 = flat out. Drives wheel blur, exhaust and light intensity. */
  throttle?: number;
  /** brake lights burn bright on launch prep + finish */
  braking?: boolean;
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
 * Rear view hyper-sports car. Pure SVG, drawn on a 240x210 stage so the
 * proportions stay wide-and-low like a real GT car seen from behind.
 */
export const Car = memo(function Car({
  spec,
  size = 150,
  throttle = 0,
  braking = false,
  glow = false,
  reflection = true,
}: Props) {
  const isHyper = spec.kind === "hyper";
  const isSmall = spec.kind === "small";
  const w = size * (isSmall ? 0.8 : isHyper ? 1.06 : 1);
  const h = w * 0.9;
  const c = spec.color;
  const light = shade(c, isHyper ? 52 : 66);
  const mid = shade(c, isHyper ? 14 : 6);
  const dark = shade(c, -84);
  const deep = shade(c, -110);
  const uid = spec.id;

  const t = Math.max(0, Math.min(1, throttle));
  const lampOpacity = braking ? 1 : 0.55 + t * 0.4;
  const bloom = braking ? 0.5 : 0.14 + t * 0.3;

  // body silhouette per class
  const body = isSmall
    ? "M52 84 q10-30 68-30 t68 30 l10 40 q6 24 -8 30 l-16 6 h-108 l-16-6 q-14-6 -8-30 z"
    : isHyper
      ? "M26 82 q16-40 94-40 t94 40 l12 44 q8 26 -12 32 l-20 6 h-148 l-20-6 q-20-6 -12-32 z"
      : "M34 84 q18-36 86-36 t86 36 l11 42 q7 25 -10 31 l-18 6 h-138 l-18-6 q-17-6 -10-31 z";

  return (
    <div
      className="relative"
      style={{
        width: w,
        height: h,
        filter: glow
          ? `drop-shadow(0 0 20px ${c}) drop-shadow(0 0 48px ${c}55)`
          : `drop-shadow(0 12px 18px rgba(0,0,0,0.7))`,
      }}
    >
      <svg viewBox="0 0 240 210" width={w} height={h} style={{ display: "block" }}>
        <defs>
          {/* body paint: sky reflection top, saturated flank, dark sill */}
          <linearGradient id={`paint-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={light} />
            <stop offset="0.22" stopColor={mid} />
            <stop offset="0.62" stopColor={c} />
            <stop offset="1" stopColor={deep} />
          </linearGradient>
          <linearGradient id={`flank-${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={deep} stopOpacity="0.95" />
            <stop offset="0.18" stopColor={dark} stopOpacity="0.35" />
            <stop offset="0.5" stopColor={light} stopOpacity="0.12" />
            <stop offset="0.82" stopColor={dark} stopOpacity="0.35" />
            <stop offset="1" stopColor={deep} stopOpacity="0.95" />
          </linearGradient>
          <linearGradient id={`glass-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0a1119" />
            <stop offset="0.45" stopColor="#20304a" />
            <stop offset="1" stopColor="#05080e" />
          </linearGradient>
          <linearGradient id={`lamp-${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#ff1e33" stopOpacity="0.4" />
            <stop offset="0.5" stopColor="#ff9aa2" />
            <stop offset="1" stopColor="#ff1e33" stopOpacity="0.4" />
          </linearGradient>
          <linearGradient id={`carbon-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1c2029" />
            <stop offset="1" stopColor="#070a0f" />
          </linearGradient>
          <radialGradient id={`floor-${uid}`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ff2b3b" stopOpacity={0.2 + t * 0.4} />
            <stop offset="1" stopColor="#ff2b3b" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`refl-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={c} stopOpacity="0.32" />
            <stop offset="1" stopColor={c} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`tyre-${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#04050a" />
            <stop offset="0.45" stopColor="#191d26" />
            <stop offset="1" stopColor="#04050a" />
          </linearGradient>
        </defs>

        {/* contact shadow + taillight bloom on tarmac */}
        <ellipse cx="120" cy="176" rx="96" ry="13" fill="#000" opacity="0.6" />
        <ellipse cx="120" cy="186" rx="102" ry="24" fill={`url(#floor-${uid})`} />

        {/* rear tyres (behind body) */}
        <g>
          <path d="M20 110 q-9 28 0 54 h30 q-8-28 -2-56 z" fill={`url(#tyre-${uid})`} />
          <path d="M220 110 q9 28 0 54 h-30 q8-28 2-56 z" fill={`url(#tyre-${uid})`} />
          {/* tread bands — blur into motion at speed */}
          <g opacity={0.75 - t * 0.55}>
            {[122, 134, 146, 158].map((y) => (
              <g key={y}>
                <rect x="20" y={y} width="26" height="2.4" rx="1.2" fill="#2b3140" opacity="0.7" />
                <rect x="194" y={y} width="26" height="2.4" rx="1.2" fill="#2b3140" opacity="0.7" />
              </g>
            ))}
          </g>
          {/* sidewall speed smear */}
          <g opacity={t * 0.5}>
            <rect x="20" y="118" width="28" height="44" rx="6" fill="#7f8aa3" opacity="0.25" />
            <rect x="192" y="118" width="28" height="44" rx="6" fill="#7f8aa3" opacity="0.25" />
          </g>
        </g>

        {/* main body */}
        <path d={body} fill={`url(#paint-${uid})`} />
        {/* flank shaping over the lower half */}
        <path d={body} fill={`url(#flank-${uid})`} />

        {/* shoulder highlight line */}
        <path
          d={
            isSmall
              ? "M58 88 q60-26 124 0"
              : "M42 90 q78-30 156 0"
          }
          fill="none"
          stroke={light}
          strokeOpacity="0.5"
          strokeWidth="2"
        />

        {/* haunch shadow creases */}
        <path d="M46 116 q26 10 74 10 t74-10" fill="none" stroke={deep} strokeOpacity="0.55" strokeWidth="3" />

        {/* greenhouse: roof + rear screen */}
        <path
          d={
            isSmall
              ? "M78 74 q42-20 84 0 l8 30 q-50-13 -100 0 z"
              : "M68 70 q52-24 104 0 l9 32 q-61-16 -122 0 z"
          }
          fill={`url(#glass-${uid})`}
        />
        <path
          d={isSmall ? "M84 76 q36-15 72 0 l2 6 q-38-13 -76 0 z" : "M74 72 q46-19 92 0 l3 7 q-49-15 -98 0 z"}
          fill="#9fdcff"
          opacity="0.16"
        />
        {/* roof strip */}
        <path
          d={isSmall ? "M80 74 q40-18 80 0" : "M70 70 q50-22 100 0"}
          fill="none"
          stroke={light}
          strokeOpacity="0.35"
          strokeWidth="2.5"
        />

        {/* side mirrors */}
        <path d="M52 92 q-16-4 -19 6 q13 5 21 0 z" fill={dark} />
        <path d="M188 92 q16-4 19 6 q-13 5 -21 0 z" fill={dark} />

        {/* rear wing */}
        {!isSmall && (
          <g>
            <rect
              x={isHyper ? 24 : 34}
              y="100"
              width={isHyper ? 192 : 172}
              height="9"
              rx="4.5"
              fill={`url(#carbon-${uid})`}
            />
            <rect
              x={isHyper ? 30 : 40}
              y="101.5"
              width={isHyper ? 180 : 160}
              height="2.5"
              rx="1.2"
              fill={isHyper ? "#ffd66b" : light}
              opacity="0.55"
            />
            <path d={`M${isHyper ? 44 : 52} 108 l6 0 l3 16 l-9 0 z`} fill="#0b0e14" />
            <path d={`M${isHyper ? 190 : 182} 108 l6 0 l-3 16 l-9 0 z`} fill="#0b0e14" />
          </g>
        )}

        {/* full-width light bar */}
        <g>
          <rect x="46" y="132" width="148" height="10" rx="5" fill={`url(#lamp-${uid})`} opacity={lampOpacity} />
          <rect x="46" y="132" width="148" height="10" rx="5" fill="#ff2233" opacity={braking ? 0.85 : 0.3 + t * 0.35} />
          <rect x="46" y="133.5" width="148" height="2.4" rx="1.2" fill="#ffd9dc" opacity={lampOpacity * 0.8} />
          <rect
            x="34"
            y="127"
            width="172"
            height="20"
            rx="10"
            fill="#ff2b3b"
            opacity={bloom}
            style={{ filter: "blur(7px)" }}
          />
        </g>

        {/* rear deck vents */}
        <g opacity="0.55">
          {[62, 72, 82].map((x) => (
            <rect key={x} x={x} y="120" width="4" height="8" rx="2" fill="#05070c" />
          ))}
          {[154, 164, 174].map((x) => (
            <rect key={x} x={x} y="120" width="4" height="8" rx="2" fill="#05070c" />
          ))}
        </g>

        {/* bumper + carbon diffuser */}
        <path d="M42 150 h156 q8 10 0 16 h-156 q-8-6 0-16 z" fill={`url(#carbon-${uid})`} />
        <g opacity="0.85">
          {[80, 96, 112, 128, 144, 160].map((x) => (
            <rect key={x} x={x} y="153" width="4" height="11" rx="1.6" fill="#02040a" />
          ))}
        </g>
        {/* fog / reverse lamp */}
        <rect x="112" y="146" width="16" height="4" rx="2" fill="#ff3344" opacity={braking ? 1 : 0.35} />

        {/* exhausts */}
        <circle cx="62" cy="159" r="5" fill="#12161e" stroke="#39404e" strokeWidth="1" />
        <circle cx="178" cy="159" r="5" fill="#12161e" stroke="#39404e" strokeWidth="1" />

        {/* plate */}
        <rect x="104" y="120" width="32" height="10" rx="2" fill="#e9edf5" opacity="0.7" />

        {/* hypercar underglow */}
        {isHyper && <ellipse cx="120" cy="172" rx="92" ry="9" fill="#ffd66b" opacity={0.28 + t * 0.25} />}

        {/* wet-road reflection */}
        {reflection && (
          <g transform="translate(0,352) scale(1,-1)" opacity="0.2">
            <path d={body} fill={`url(#refl-${uid})`} />
          </g>
        )}
      </svg>

      {/* exhaust heat haze */}
      {t > 0.15 && (
        <>
          <span
            className="absolute rounded-full"
            style={{
              left: "24%",
              bottom: "9%",
              width: 9 + t * 5,
              height: 9 + t * 5,
              background: isHyper
                ? "radial-gradient(circle,#ffd66b,#ff5b1f 55%,transparent 70%)"
                : "radial-gradient(circle,#fff,#8ad9ff 55%,transparent 70%)",
              animation: `exhaust ${0.75 - t * 0.35}s ease-out infinite`,
            }}
          />
          <span
            className="absolute rounded-full"
            style={{
              right: "24%",
              bottom: "9%",
              width: 9 + t * 5,
              height: 9 + t * 5,
              background: isHyper
                ? "radial-gradient(circle,#ffd66b,#ff5b1f 55%,transparent 70%)"
                : "radial-gradient(circle,#fff,#8ad9ff 55%,transparent 70%)",
              animation: `exhaust ${0.75 - t * 0.35}s ease-out infinite ${(0.75 - t * 0.35) / 2}s`,
            }}
          />
        </>
      )}
    </div>
  );
});
